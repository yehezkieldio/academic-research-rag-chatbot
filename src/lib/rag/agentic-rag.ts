/**
 * @fileoverview Agentic RAG (Retrieval-Augmented Generation) Pipeline
 *
 * WHY Agentic Mode:
 * - Multi-step reasoning: Breaks down complex academic queries into manageable sub-questions
 * - Tool-based retrieval: Uses specialized tools (search, query expansion, decomposition, verification)
 * - Self-correcting: Can refine searches and verify claims against sources
 * - Better for complex queries: Research questions, multi-part questions, fact-checking scenarios
 *
 * WHY vs Standard RAG:
 * - Standard RAG: Single retrieval → generation (fast, good for simple queries)
 * - Agentic RAG: Planning → Multi-step retrieval → Tool execution → Synthesis (thorough, better accuracy)
 *
 * Research Context:
 * This implementation is designed for Indonesian academic content (skripsi, tesis, lecture notes).
 * The agentic approach significantly improves answer quality for multi-hop questions common in
 * academic research while maintaining citation accuracy and reducing hallucinations.
 *
 * Key Features:
 * - Parallel tool execution for efficiency (avoid sequential bottleneck)
 * - Citation management with unique numbering
 * - Guardrail integration for safety and quality
 * - Streaming support for real-time responses
 * - Language enforcement (always Indonesian)
 */

import { generateText, NoSuchToolError, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { CHAT_MODEL, telemetryConfig } from "@/lib/ai";
import { detectNegativeReaction, type GuardrailResult, validateInput, validateOutput } from "./guardrails";
import { hybridRetrieve, type RetrievalResult } from "./hybrid-retrieval";
import type { RerankerStrategy } from "./reranker";
import { detectQueryLanguage, expandQueryIndonesian, expandQueryWithSynonyms } from "./university-domain";

// ==================== Types ====================

/**
 * Represents a single step in the agentic workflow
 *
 * @property stepIndex - Sequential index of this step in the workflow
 * @property stepType - Type of operation performed (reasoning, tool_call, retrieval, synthesis, reranking)
 * @property toolName - Name of the tool called (if stepType is tool_call)
 * @property toolInput - Input parameters passed to the tool
 * @property toolOutput - Result returned by the tool
 * @property reasoning - Text explanation of reasoning (for synthesis/reasoning steps)
 * @property durationMs - Time taken for this step in milliseconds
 * @property timestamp - Unix timestamp when step started
 * @property tokenUsage - LLM token consumption for this step
 */
export interface AgentStep {
    stepIndex: number;
    stepType: "reasoning" | "tool_call" | "retrieval" | "synthesis" | "reranking";
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    reasoning?: string;
    durationMs: number;
    timestamp: number;
    tokenUsage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

/**
 * Result of the agentic RAG pipeline execution
 *
 * @property answer - Final generated answer in Indonesian
 * @property steps - Array of all agent steps taken during execution
 * @property retrievedChunks - All document chunks retrieved across all searches
 * @property citations - Unique citations with assigned numbers for source attribution
 * @property guardrailResults - Safety and quality validation results
 * @property language - Always "id" (Indonesian) for this system
 * @property totalLatencyMs - Total time taken for the entire pipeline
 * @property reasoning - Optional array of reasoning steps from the LLM
 */
export interface AgenticRagResult {
    answer: string;
    steps: AgentStep[];
    retrievedChunks: RetrievalResult[];
    citations: Array<{ id: string; documentTitle: string; citationNumber: number }>;
    guardrailResults: {
        input?: GuardrailResult;
        output?: GuardrailResult;
        negativeReaction?: Awaited<ReturnType<typeof detectNegativeReaction>>;
    };
    language: "id";
    totalLatencyMs: number;
    reasoning?: string[];
}

interface StreamingState {
    retrievedChunks: RetrievalResult[];
    citationManager: CitationManager;
}

// ==================== Citation Manager ====================

class CitationManager {
    private readonly citations = new Map<string, number>();
    private nextId = 1;

    assignCitation(chunkId: string): number {
        const existing = this.citations.get(chunkId);
        if (existing) {
            return existing;
        }

        const citationNumber = this.nextId;
        this.nextId += 1;
        this.citations.set(chunkId, citationNumber);
        return citationNumber;
    }

    getCitations(): Array<{ id: string; documentTitle: string; citationNumber: number }> {
        const results: Array<{ id: string; documentTitle: string; citationNumber: number }> = [];
        for (const [id, num] of this.citations.entries()) {
            results.push({
                id,
                documentTitle: "",
                citationNumber: num,
            });
        }
        return results;
    }

    clear(): void {
        this.citations.clear();
        this.nextId = 1;
    }
}

// Global session state storage
const sessionStates = new Map<string, StreamingState>();

export function clearSessionCitations(sessionId: string): void {
    sessionStates.delete(sessionId);
}

export function clearStreamingState(sessionId: string): void {
    sessionStates.delete(sessionId);
}

function getOrCreateStreamingState(sessionId: string): StreamingState {
    let state = sessionStates.get(sessionId);
    if (!state) {
        state = {
            retrievedChunks: [],
            citationManager: new CitationManager(),
        };
        sessionStates.set(sessionId, state);
    }
    return state;
}

// ==================== System Prompt ====================

const AGENTIC_SYSTEM_PROMPT = `Anda adalah asisten penelitian akademis canggih dengan akses ke alat-alat khusus.

Kemampuan Anda:
1. Mencari dokumen menggunakan pengambilan hibrida (Okapi BM25 + kesamaan vektor)
2. Memperluas kueri dengan sinonim akademis
3. Menguraikan pertanyaan akademis kompleks menjadi sub-pertanyaan yang lebih sederhana
4. Memverifikasi fakta terhadap sumber yang diambil
5. Mensintesis informasi dari beberapa dokumen

Pedoman:
- Selalu kutip sumber dengan format [1], [2], [3]
- Akui ketidakpastian ketika informasi tidak lengkap
- Gunakan terminologi akademis yang sesuai
- Selalu jawab dalam Bahasa Indonesia
- Verifikasi klaim penting dengan alat verify_claim

PENTING - Eksekusi Alat Paralel:
- Untuk kueri kompleks, PERTAMA gunakan decompose_query untuk memecah pertanyaan
- Setelah dekomposisi, Anda HARUS memanggil search_documents untuk SEMUA sub-pertanyaan DALAM SATU GILIRAN
- Panggil beberapa alat search_documents secara bersamaan (paralel) - JANGAN panggil satu per satu
- Contoh: Jika ada 3 sub-pertanyaan, buat 3 panggilan search_documents dalam respons yang sama
- Eksekusi paralel ini secara signifikan mengurangi latensi dan meningkatkan waktu respons`;

// ==================== Tool Creation Functions ====================

function createSearchTool(language: "id", streamingState?: StreamingState) {
    return tool({
        description:
            "Cari basis pengetahuan untuk dokumen yang relevan menggunakan pengambilan hibrida (Okapi BM25 + kesamaan vektor). Gunakan untuk setiap sub-pertanyaan setelah dekomposisi.",
        inputSchema: z.object({
            query: z.string().describe("The search query"),
            strategy: z.enum(["vector", "keyword", "hybrid"]).default("hybrid"),
            topK: z.number().min(1).max(20).default(5),
        }),
        execute: async ({ query, strategy, topK }) => {
            console.log(
                `[searchTool] Executing search - query: "${query.substring(0, 80)}...", strategy: ${strategy}, topK: ${topK}`
            );
            const results = await hybridRetrieve(query, {
                strategy,
                topK,
                language,
                useReranker: true,
                rerankerStrategy: "cross_encoder",
            });
            console.log(
                `[searchTool] Retrieved ${results.length} results with average score ${(results.reduce((sum, r) => sum + r.fusedScore, 0) / results.length).toFixed(3)}`
            );

            // Add to streaming state if available
            if (streamingState) {
                let newChunks = 0;
                for (const result of results) {
                    // Avoid duplicates
                    const exists = streamingState.retrievedChunks.some((c) => c.chunkId === result.chunkId);
                    if (!exists) {
                        streamingState.retrievedChunks.push(result);
                        streamingState.citationManager.assignCitation(result.chunkId);
                        newChunks += 1;
                    }
                }
                console.log(
                    `[searchTool] Added ${newChunks} new chunks to streaming state (total: ${streamingState.retrievedChunks.length})`
                );
            }

            return {
                found: results.length,
                documents: results.map((r) => ({
                    title: r.documentTitle,
                    content: r.content.substring(0, 500) + (r.content.length > 500 ? "..." : ""),
                    score: r.fusedScore.toFixed(3),
                    method: r.retrievalMethod,
                })),
            };
        },
    });
}

function createExpandQueryTool(language: "id") {
    return tool({
        description: "Perluas kueri dengan sinonim akademis untuk meningkatkan cakupan pengambilan",
        inputSchema: z.object({
            query: z.string(),
        }),
        execute: ({ query }) => {
            const expandedQueries = language === "id" ? expandQueryIndonesian(query) : expandQueryWithSynonyms(query);
            return {
                originalQuery: query,
                language,
                expandedQueries: expandedQueries.slice(0, 5),
            };
        },
    });
}

function createDecomposeQueryTool(language: "id") {
    return tool({
        description:
            "Uraikan pertanyaan akademis kompleks menjadi sub-pertanyaan yang lebih sederhana. PENTING: Setelah menggunakan tool ini, panggil search_documents untuk SEMUA sub-pertanyaan SECARA BERSAMAAN dalam satu giliran (paralel).",
        inputSchema: z.object({
            query: z.string(),
            maxSubQuestions: z.number().min(2).max(5).default(3),
        }),
        execute: async ({ query, maxSubQuestions }) => {
            const { text } = await generateText({
                model: CHAT_MODEL,
                prompt: `Uraikan pertanyaan akademis ini menjadi ${maxSubQuestions} sub-pertanyaan yang lebih sederhana yang bersama-sama menjawab pertanyaan asli. Jawab dalam Bahasa Indonesia.

Pertanyaan: ${query}

Kembalikan hanya array JSON berisi sub-pertanyaan.`,
                temperature: 0.3,
                experimental_telemetry: telemetryConfig,
            });

            try {
                const subQuestions = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
                return {
                    subQuestions,
                    language,
                    nextAction:
                        "CRITICAL: Call search_documents for ALL sub-questions IN PARALLEL (multiple tool calls in the same response). Do NOT call them one at a time.",
                };
            } catch {
                return {
                    subQuestions: [query],
                    language,
                    nextAction: "Call search_documents for this question.",
                };
            }
        },
    });
}

function createVerifyClaimTool() {
    return tool({
        description: "Verifikasi klaim terhadap dokumen yang diambil untuk mencegah halusinasi",
        inputSchema: z.object({
            claim: z.string(),
            context: z.string(),
        }),
        execute: async ({ claim, context }) => {
            const { text } = await generateText({
                model: CHAT_MODEL,
                prompt: `Verifikasi apakah klaim ini didukung oleh konteks. Jawab dalam Bahasa Indonesia.

Klaim: ${claim}

Konteks: ${context}

Jawab dengan JSON: { "supported": boolean, "confidence": number (0-1), "evidence": string }`,
                temperature: 0.1,
                experimental_telemetry: telemetryConfig,
            });

            try {
                return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
            } catch {
                return { supported: false, confidence: 0, evidence: "Tidak dapat memverifikasi" };
            }
        },
    });
}

function createSynthesizeAnswerTool() {
    return tool({
        description: "Sintesis jawaban akhir dari beberapa sumber dengan kutipan yang tepat",
        inputSchema: z.object({
            question: z.string(),
            sources: z.array(
                z.object({
                    title: z.string(),
                    content: z.string(),
                })
            ),
        }),
        execute: async ({ question, sources }) => {
            const sourcesText = sources.map((s, i) => `[${i + 1}] ${s.title}:\n${s.content}`).join("\n\n");

            const { text } = await generateText({
                model: CHAT_MODEL,
                prompt: `Sintesis jawaban komprehensif dalam Bahasa Indonesia untuk pertanyaan ini menggunakan sumber-sumber yang disediakan. Sertakan kutipan [1], [2], dst.

Pertanyaan: ${question}

Sumber:
${sourcesText}`,
                temperature: 0.3,
                experimental_telemetry: telemetryConfig,
            });

            return { synthesizedAnswer: text, sourceCount: sources.length };
        },
    });
}

function createAgentTools(language: "id", streamingState?: StreamingState) {
    return {
        search_documents: createSearchTool(language, streamingState),
        expand_query: createExpandQueryTool(language),
        decompose_query: createDecomposeQueryTool(language),
        verify_claim: createVerifyClaimTool(),
        synthesize_answer: createSynthesizeAnswerTool(),
    };
}

// ==================== Main Agent Functions ====================

export async function runAgenticRag(
    query: string,
    options: {
        sessionId?: string;
        retrievalStrategy?: "vector" | "keyword" | "hybrid";
        enableGuardrails?: boolean;
        maxSteps?: number;
        rerankerStrategy?: RerankerStrategy;
        useReranker?: boolean;
        streamCallback?: (step: AgentStep) => void;
    } = {}
): Promise<AgenticRagResult> {
    const {
        sessionId = crypto.randomUUID(),
        retrievalStrategy = "hybrid",
        enableGuardrails = true,
        maxSteps = 5,
        streamCallback,
    } = options;

    console.log(
        `[runAgenticRag] Starting agentic RAG pipeline - sessionId: ${sessionId}, strategy: ${retrievalStrategy}, guardrails: ${enableGuardrails}`
    );
    console.log(`[runAgenticRag] Query: ${query.substring(0, 100)}...`);

    const startTime = Date.now();
    const language = "id" as const; // Always Indonesian
    const streamingState = getOrCreateStreamingState(sessionId);
    console.log(`[runAgenticRag] Using language: ${language}`);

    // Validate input
    console.log(`[runAgenticRag] Starting input validation with guardrails enabled: ${enableGuardrails}`);
    const { passed, steps, guardrailResults } = await validateInputWithGuardrails(query, enableGuardrails);
    console.log(
        `[runAgenticRag] Input validation result: passed=${passed}, violations=${guardrailResults.input?.violations.length || 0}`
    );

    if (!passed) {
        console.warn("[runAgenticRag] Input validation failed - returning early with policy violation message");
        return {
            answer: "Maaf, permintaan Anda tidak dapat diproses karena melanggar kebijakan konten.",
            steps: [],
            retrievedChunks: [],
            citations: [],
            guardrailResults,
            language: "id",
            totalLatencyMs: Date.now() - startTime,
        };
    }

    // Create tools with streaming state
    const agentTools = createAgentTools(language, streamingState);

    try {
        console.log(`[runAgenticRag] Executing agent workflow with maxSteps: ${maxSteps}`);
        const result = await executeAgentWorkflow(
            query,
            language,
            agentTools,
            streamingState,
            maxSteps,
            sessionId,
            retrievalStrategy,
            steps,
            streamCallback
        );
        console.log(
            `[runAgenticRag] Agent workflow completed - steps: ${steps.length}, retrieved chunks: ${streamingState.retrievedChunks.length}`
        );

        // Validate output
        if (enableGuardrails) {
            const outputValidation = await validateOutput(result.text, {
                retrievedChunks: streamingState.retrievedChunks.map((c) => c.content),
                query,
            });
            guardrailResults.output = outputValidation;
        }

        calculateStepDurations(steps);
        const totalLatencyMs = Date.now() - startTime;

        console.log(`[runAgenticRag] Pipeline completed successfully in ${totalLatencyMs}ms`);
        console.log(
            `[runAgenticRag] Answer length: ${result.text.length}, citations: ${streamingState.citationManager.getCitations().length}`
        );
        console.log(`[runAgenticRag] Answer Preview: ${result.text.substring(0, 50)}...`);

        return {
            answer: result.text,
            steps,
            retrievedChunks: streamingState.retrievedChunks,
            citations: streamingState.citationManager.getCitations(),
            guardrailResults,
            language,
            totalLatencyMs,
            reasoning: result.reasoning?.map((r) => r.text) || undefined,
        };
    } catch (error) {
        console.error("[runAgenticRag] Error in agent workflow:", error);
        return handleAgentError(error, language, steps, streamingState, guardrailResults, startTime);
    }
}

async function validateInputWithGuardrails(
    query: string,
    enableGuardrails: boolean
): Promise<{
    passed: boolean;
    steps: AgentStep[];
    guardrailResults: AgenticRagResult["guardrailResults"];
}> {
    const steps: AgentStep[] = [];
    const guardrailResults: AgenticRagResult["guardrailResults"] = {};

    if (enableGuardrails) {
        const inputValidation = await validateInput(query);
        guardrailResults.input = inputValidation;

        if (!inputValidation.passed) {
            return { passed: false, steps, guardrailResults };
        }

        const negativeReaction = await detectNegativeReaction(query);
        if (negativeReaction.detected) {
            guardrailResults.negativeReaction = negativeReaction;
        }
    }

    return { passed: true, steps, guardrailResults };
}

async function executeAgentWorkflow(
    query: string,
    language: "id",
    agentTools: ReturnType<typeof createAgentTools>,
    streamingState: StreamingState,
    maxSteps: number,
    sessionId: string,
    retrievalStrategy: string,
    steps: AgentStep[],
    streamCallback?: (step: AgentStep) => void
) {
    // Enforce response language explicitly in the system prompt
    const systemWithLanguage = `${AGENTIC_SYSTEM_PROMPT}\n\n[PENEGAK BAHASA] Selalu jawab HANYA dalam Bahasa Indonesia.`;

    // Log language + top chunk languages to help debug accidental language switching
    console.log(`[executeAgentWorkflow] Expected response language: ${language}`);
    console.log(
        `[executeAgentWorkflow] Top retrieved chunk languages: ${streamingState.retrievedChunks
            .slice(0, 5)
            .map((c) => detectQueryLanguage(c.content))
            .join(", ")}`
    );

    const result = await generateText({
        model: CHAT_MODEL,
        system: systemWithLanguage,
        prompt: `${query}`,
        tools: agentTools,
        stopWhen: stepCountIs(maxSteps),
        temperature: 0.3,
        experimental_telemetry: {
            ...telemetryConfig,
            functionId: "agentic-rag",
            metadata: {
                ...telemetryConfig.metadata,
                language,
                retrievalStrategy,
                sessionId: sessionId || "anonymous",
            },
        },
        onStepFinish: (stepResult) => {
            processStepFinish(stepResult, steps, streamingState, streamCallback);
        },
    });

    // If the model answered using the wrong language, try a forced re-synthesis
    try {
        const detected = detectQueryLanguage(result.text || "");
        if (detected && detected !== language) {
            console.warn(
                `[executeAgentWorkflow] Language mismatch detected: expected=${language}, actual=${detected}. Attempting forced re-synthesis.`
            );

            const sourcesText = streamingState.retrievedChunks
                .slice(0, 10)
                .map((s, i) => `[${i + 1}] ${s.documentTitle}:\n${s.content}`)
                .join("\n\n");

            try {
                const { text: synthText } = await generateText({
                    model: CHAT_MODEL,
                    system: systemWithLanguage,
                    prompt: `Sintesis jawaban komprehensif dalam Bahasa Indonesia untuk pertanyaan ini menggunakan sumber-sumber yang disediakan. Sertakan kutipan [1], [2], dst.\n\nPertanyaan: ${query}\n\nSumber:\n${sourcesText}`,
                    temperature: 0.3,
                    experimental_telemetry: telemetryConfig,
                });

                if (synthText && synthText.trim().length > 0) {
                    console.log("[executeAgentWorkflow] Forced re-synthesis succeeded; using synthesized answer.");
                    const newResult = { ...result, text: synthText } as typeof result;
                    return newResult;
                }
            } catch (synthErr) {
                console.error("[executeAgentWorkflow] Forced re-synthesis failed:", synthErr);
            }
        }
    } catch (err) {
        console.error("[executeAgentWorkflow] Failed to detect language of model output:", err);
    }

    return result;
}

function processStepFinish(
    stepResult: {
        text: string;
        toolCalls?: Array<{
            toolCallId: string;
            toolName: string;
            input: unknown;
        }>;
        toolResults?: Array<{
            toolCallId: string;
            toolName: string;
            output: unknown;
        }>;
        finishReason: string;
        usage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
        };
    },
    steps: AgentStep[],
    streamingState: StreamingState,
    streamCallback?: (step: AgentStep) => void
): void {
    const { text, toolCalls, toolResults, finishReason, usage } = stepResult;
    console.log(
        `[processStepFinish] Processing step - finishReason: ${finishReason}, toolCalls: ${toolCalls?.length || 0}, tokens: ${usage?.totalTokens || 0}`
    );

    // Record tool calls
    if (toolCalls && toolCalls.length > 0) {
        console.log(`[processStepFinish] Recording ${toolCalls.length} tool calls`);
        for (const call of toolCalls) {
            const toolResult = toolResults?.find((r) => r.toolCallId === call.toolCallId);
            console.log(
                `[processStepFinish] Tool: ${call.toolName} - input: ${JSON.stringify(call.input).substring(0, 100)}...`
            );
            const agentStep: AgentStep = {
                stepIndex: steps.length,
                stepType: "tool_call",
                toolName: call.toolName,
                toolInput: call.input as Record<string, unknown>,
                toolOutput: toolResult?.output,
                durationMs: 0,
                timestamp: Date.now(),
                tokenUsage: usage
                    ? {
                          inputTokens: usage.inputTokens ?? 0,
                          outputTokens: usage.outputTokens ?? 0,
                          totalTokens: usage.totalTokens ?? 0,
                      }
                    : undefined,
            };
            steps.push(agentStep);
            streamCallback?.(agentStep);

            // Collect retrieved chunks from search results
            collectSearchResults(call, toolResult, streamingState);
        }
    }

    // Record reasoning/synthesis steps
    if (text && finishReason === "stop") {
        const synthesisStep: AgentStep = {
            stepIndex: steps.length,
            stepType: "synthesis",
            reasoning: text.substring(0, 200),
            durationMs: 0,
            timestamp: Date.now(),
            tokenUsage: usage
                ? {
                      inputTokens: usage.inputTokens ?? 0,
                      outputTokens: usage.outputTokens ?? 0,
                      totalTokens: usage.totalTokens ?? 0,
                  }
                : undefined,
        };
        steps.push(synthesisStep);
        streamCallback?.(synthesisStep);
    }
}

function collectSearchResults(
    call: { toolName: string; toolCallId: string; input: unknown },
    toolResult: { toolCallId: string; toolName: string; output: unknown } | undefined,
    streamingState: StreamingState
): void {
    if (call.toolName === "search_documents" && toolResult?.output) {
        const searchResult = toolResult.output as {
            documents?: Array<{ title: string; content: string; score: string }>;
        };
        if (searchResult.documents) {
            for (const doc of searchResult.documents) {
                const chunkId = crypto.randomUUID();
                const result: RetrievalResult = {
                    chunkId,
                    documentId: crypto.randomUUID(),
                    documentTitle: doc.title,
                    content: doc.content,
                    fusedScore: Number.parseFloat(doc.score),
                    vectorScore: 0,
                    bm25Score: 0,
                    retrievalMethod: "hybrid",
                };

                // Avoid duplicates
                const exists = streamingState.retrievedChunks.some((c) => c.content === result.content);
                if (!exists) {
                    streamingState.retrievedChunks.push(result);
                    streamingState.citationManager.assignCitation(chunkId);
                }
            }
        }
    }
}

function calculateStepDurations(steps: AgentStep[]): void {
    for (let i = 0; i < steps.length; i++) {
        if (i < steps.length - 1) {
            steps[i].durationMs = steps[i + 1].timestamp - steps[i].timestamp;
        } else {
            steps[i].durationMs = Date.now() - steps[i].timestamp;
        }
    }
}

function handleAgentError(
    error: unknown,
    _language: "id",
    steps: AgentStep[],
    streamingState: StreamingState,
    guardrailResults: AgenticRagResult["guardrailResults"],
    startTime: number
): AgenticRagResult {
    if (NoSuchToolError.isInstance(error)) {
        console.error("Tool not found:", error.toolName);
        return {
            answer: "Maaf, terjadi kesalahan: alat yang diminta tidak tersedia.",
            steps,
            retrievedChunks: streamingState.retrievedChunks,
            citations: streamingState.citationManager.getCitations(),
            guardrailResults,
            language: "id",
            totalLatencyMs: Date.now() - startTime,
        };
    }

    throw error;
}

// ==================== Streaming Version ====================

export async function streamAgenticRag(
    query: string,
    options: {
        sessionId?: string;
        retrievalStrategy?: "vector" | "keyword" | "hybrid";
        enableGuardrails?: boolean;
        maxSteps?: number;
        useReranker?: boolean;
        rerankerStrategy?: RerankerStrategy;
    } = {}
) {
    const {
        sessionId = crypto.randomUUID(),
        retrievalStrategy = "hybrid",
        enableGuardrails = true,
        maxSteps = 5,
    } = options;

    const language = "id" as const; // Always Indonesian
    const streamingState = getOrCreateStreamingState(sessionId);
    const steps: AgentStep[] = [];

    // Input validation
    if (enableGuardrails) {
        const inputValidation = await validateInput(query);
        if (!inputValidation.passed) {
            throw new Error("Validasi input gagal");
        }
    }

    // Initial retrieval for context
    const initialResults = await hybridRetrieve(query, {
        strategy: retrievalStrategy,
        topK: 5,
        language,
        useReranker: true,
        rerankerStrategy: "cross_encoder",
    });

    // Add to streaming state
    for (const result of initialResults) {
        streamingState.retrievedChunks.push(result);
        streamingState.citationManager.assignCitation(result.chunkId);
    }

    const context = streamingState.retrievedChunks.map((c) => `[${c.documentTitle}]: ${c.content}`).join("\n\n");

    const agentTools = createAgentTools(language, streamingState);

    const systemWithLanguage = `${AGENTIC_SYSTEM_PROMPT}\n\n[PENEGAK BAHASA] Selalu jawab HANYA dalam Bahasa Indonesia.`;

    console.log(`[streamAgenticRag] Using enforced language: ${language}`);
    console.log(
        `[streamAgenticRag] Top-of-context chunk languages: ${streamingState.retrievedChunks
            .slice(0, 5)
            .map((c) => detectQueryLanguage(c.content))
            .join(", ")}`
    );

    const result = streamText({
        model: CHAT_MODEL,
        system: systemWithLanguage,
        prompt: `Context:\n${context}\n\nQuestion: ${query}`,
        tools: agentTools,
        stopWhen: stepCountIs(maxSteps),
        temperature: 0.4,
        experimental_telemetry: {
            ...telemetryConfig,
            functionId: "stream-agentic-rag",
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
            if (toolCalls) {
                for (const call of toolCalls) {
                    const toolResult = toolResults?.find((r) => r.toolCallId === call.toolCallId);
                    steps.push({
                        stepIndex: steps.length,
                        stepType: "tool_call",
                        toolName: call.toolName,
                        toolInput: call.input as Record<string, unknown>,
                        toolOutput: toolResult?.output,
                        durationMs: 0,
                        timestamp: Date.now(),
                    });
                }
            }
        },
    });

    return {
        stream: result,
        steps,
        retrievedChunks: streamingState.retrievedChunks,
        citations: streamingState.citationManager.getCitations(),
        language,
    };
}
