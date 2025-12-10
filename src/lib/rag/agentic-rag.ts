import { generateText, NoSuchToolError, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { CHAT_MODEL, telemetryConfig } from "@/lib/ai";
import { detectNegativeReaction, type GuardrailResult, validateInput, validateOutput } from "./guardrails";
import { hybridRetrieve, type RetrievalResult } from "./hybrid-retrieval";
import type { RerankerStrategy } from "./reranker";
import { detectQueryLanguage, expandQueryIndonesian, expandQueryWithSynonyms } from "./university-domain";

// ==================== Types ====================

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
    language: "en" | "id";
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

const AGENTIC_SYSTEM_PROMPT = `You are an advanced academic research assistant with access to specialized tools.
Anda adalah asisten penelitian akademis canggih dengan akses ke alat-alat khusus.

Your capabilities / Kemampuan Anda:
1. Search documents using hybrid retrieval (Okapi BM25 + Vector similarity)
   Mencari dokumen menggunakan pengambilan hibrida (Okapi BM25 + kesamaan vektor)
2. Expand queries with academic synonyms in EN/ID
   Memperluas kueri dengan sinonim akademis dalam EN/ID
3. Decompose complex questions into sub-questions
   Menguraikan pertanyaan akademis kompleks menjadi sub-pertanyaan yang lebih sederhana
4. Verify facts against retrieved sources
   Memverifikasi fakta terhadap sumber yang diambil
5. Synthesize information from multiple documents
   Mensintesis informasi dari beberapa dokumen

Guidelines / Pedoman:
- Always cite sources with [1], [2], [3] format / Selalu kutip sumber dengan format [1], [2], [3]
- Acknowledge uncertainty when information is incomplete / Akui ketidakpastian ketika informasi tidak lengkap
- Use appropriate academic terminology / Gunakan terminologi akademis yang sesuai
- Respond in the same language as the query / Jawab dalam bahasa yang sama dengan kueri
- Verify important claims with the verify_claim tool / Verifikasi klaim penting dengan alat verify_claim

IMPORTANT - Parallel Tool Execution / Eksekusi Alat Paralel:
- For complex queries, FIRST use decompose_query to break down the question
- After decomposing, you MUST call search_documents for ALL sub-questions IN A SINGLE TURN
- Call multiple search_documents tools simultaneously (in parallel) - DO NOT call them one at a time
- Example: If you have 3 sub-questions, make 3 search_documents calls in the same response
- This parallel execution significantly reduces latency and improves response time

Setelah dekomposisi, Anda HARUS memanggil search_documents untuk SEMUA sub-pertanyaan DALAM SATU GILIRAN.
Panggil beberapa alat search_documents secara bersamaan (paralel) - JANGAN panggil satu per satu.`;

// ==================== Tool Creation Functions ====================

function createSearchTool(language: "en" | "id", streamingState?: StreamingState) {
    return tool({
        description:
            language === "id"
                ? "Cari basis pengetahuan untuk dokumen yang relevan menggunakan pengambilan hibrida (Okapi BM25 + kesamaan vektor). Gunakan untuk setiap sub-pertanyaan setelah dekomposisi."
                : "Search the knowledge base for relevant documents using hybrid retrieval (Okapi BM25 + vector similarity). Use this for each sub-question after decomposition.",
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

function createExpandQueryTool(language: "en" | "id") {
    return tool({
        description:
            language === "id"
                ? "Perluas kueri dengan sinonim akademis untuk meningkatkan cakupan pengambilan"
                : "Expand a query with academic synonyms to improve retrieval coverage",
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

function createDecomposeQueryTool(language: "en" | "id") {
    return tool({
        description:
            language === "id"
                ? "Uraikan pertanyaan akademis kompleks menjadi sub-pertanyaan yang lebih sederhana. PENTING: Setelah menggunakan tool ini, panggil search_documents untuk SEMUA sub-pertanyaan SECARA BERSAMAAN dalam satu giliran (paralel)."
                : "Break down a complex academic question into simpler sub-questions. IMPORTANT: After using this tool, call search_documents for ALL sub-questions SIMULTANEOUSLY in a single turn (parallel execution).",
        inputSchema: z.object({
            query: z.string(),
            maxSubQuestions: z.number().min(2).max(5).default(3),
        }),
        execute: async ({ query, maxSubQuestions }) => {
            const { text } = await generateText({
                model: CHAT_MODEL,
                prompt: `Decompose this academic question into ${maxSubQuestions} simpler sub-questions that together answer the original. ${language === "id" ? "Respond in Indonesian." : "Respond in English."}

Question: ${query}

Return a JSON array of sub-questions only.`,
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

function createVerifyClaimTool(language: "en" | "id") {
    return tool({
        description:
            language === "id"
                ? "Verifikasi klaim terhadap dokumen yang diambil untuk mencegah halusinasi"
                : "Verify a claim against retrieved documents to prevent hallucination",
        inputSchema: z.object({
            claim: z.string(),
            context: z.string(),
        }),
        execute: async ({ claim, context }) => {
            const { text } = await generateText({
                model: CHAT_MODEL,
                prompt: `Verify if this claim is supported by the context. ${language === "id" ? "Respond in Indonesian." : ""}

Claim: ${claim}

Context: ${context}

Respond with JSON: { "supported": boolean, "confidence": number (0-1), "evidence": string }`,
                temperature: 0.1,
                experimental_telemetry: telemetryConfig,
            });

            try {
                return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
            } catch {
                return { supported: false, confidence: 0, evidence: "Unable to verify" };
            }
        },
    });
}

function createSynthesizeAnswerTool(language: "en" | "id") {
    return tool({
        description:
            language === "id"
                ? "Sintesis jawaban akhir dari beberapa sumber dengan kutipan yang tepat"
                : "Synthesize a final answer from multiple sources with proper citations",
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
                prompt: `${language === "id" ? "Sintesis jawaban komprehensif dalam Bahasa Indonesia" : "Synthesize a comprehensive answer"} for this question using the provided sources. Include citations [1], [2], etc.

Question: ${question}

Sources:
${sourcesText}`,
                temperature: 0.3,
                experimental_telemetry: telemetryConfig,
            });

            return { synthesizedAnswer: text, sourceCount: sources.length };
        },
    });
}

function createAgentTools(language: "en" | "id", streamingState?: StreamingState) {
    return {
        search_documents: createSearchTool(language, streamingState),
        expand_query: createExpandQueryTool(language),
        decompose_query: createDecomposeQueryTool(language),
        verify_claim: createVerifyClaimTool(language),
        synthesize_answer: createSynthesizeAnswerTool(language),
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
    const language = detectQueryLanguage(query);
    const streamingState = getOrCreateStreamingState(sessionId);
    console.log(`[runAgenticRag] Detected language: ${language}`);

    // Validate input
    console.log(`[runAgenticRag] Starting input validation with guardrails enabled: ${enableGuardrails}`);
    const { passed, steps, guardrailResults } = await validateInputWithGuardrails(query, enableGuardrails);
    console.log(
        `[runAgenticRag] Input validation result: passed=${passed}, violations=${guardrailResults.input?.violations.length || 0}`
    );

    if (!passed) {
        console.warn("[runAgenticRag] Input validation failed - returning early with policy violation message");
        return {
            answer:
                language === "id"
                    ? "Maaf, permintaan Anda tidak dapat diproses karena melanggar kebijakan konten."
                    : "Sorry, your request cannot be processed due to content policy violations.",
            steps: [],
            retrievedChunks: [],
            citations: [],
            guardrailResults,
            language,
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
    language: "en" | "id",
    agentTools: ReturnType<typeof createAgentTools>,
    streamingState: StreamingState,
    maxSteps: number,
    sessionId: string,
    retrievalStrategy: string,
    steps: AgentStep[],
    streamCallback?: (step: AgentStep) => void
) {
    const result = await generateText({
        model: CHAT_MODEL,
        system: AGENTIC_SYSTEM_PROMPT,
        prompt: `${language === "id" ? "Jawab dalam Bahasa Indonesia: " : ""}${query}`,
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
    language: "en" | "id",
    steps: AgentStep[],
    streamingState: StreamingState,
    guardrailResults: AgenticRagResult["guardrailResults"],
    startTime: number
): AgenticRagResult {
    if (NoSuchToolError.isInstance(error)) {
        console.error("Tool not found:", error.toolName);
        return {
            answer:
                language === "id"
                    ? "Maaf, terjadi kesalahan: alat yang diminta tidak tersedia."
                    : "Sorry, an error occurred: the requested tool is not available.",
            steps,
            retrievedChunks: streamingState.retrievedChunks,
            citations: streamingState.citationManager.getCitations(),
            guardrailResults,
            language,
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
    } = {}
) {
    const {
        sessionId = crypto.randomUUID(),
        retrievalStrategy = "hybrid",
        enableGuardrails = true,
        maxSteps = 5,
    } = options;

    const language = detectQueryLanguage(query);
    const streamingState = getOrCreateStreamingState(sessionId);
    const steps: AgentStep[] = [];

    // Input validation
    if (enableGuardrails) {
        const inputValidation = await validateInput(query);
        if (!inputValidation.passed) {
            throw new Error("Input validation failed");
        }
    }

    // Initial retrieval for context
    const initialResults = await hybridRetrieve(query, {
        strategy: retrievalStrategy,
        topK: 5,
        language,
    });

    // Add to streaming state
    for (const result of initialResults) {
        streamingState.retrievedChunks.push(result);
        streamingState.citationManager.assignCitation(result.chunkId);
    }

    const context = streamingState.retrievedChunks.map((c) => `[${c.documentTitle}]: ${c.content}`).join("\n\n");

    const agentTools = createAgentTools(language, streamingState);

    const result = streamText({
        model: CHAT_MODEL,
        system: AGENTIC_SYSTEM_PROMPT,
        prompt: `${language === "id" ? "Jawab dalam Bahasa Indonesia.\n\n" : ""}Context:\n${context}\n\nQuestion: ${query}`,
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
