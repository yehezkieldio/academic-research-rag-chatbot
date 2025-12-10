import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { CHAT_MODEL, telemetryConfig } from "@/lib/ai";
import { db } from "@/lib/db";
import { chatMessages, chatSessions, guardrailLogs } from "@/lib/db/schema";
import { runAgenticRag } from "@/lib/rag/agentic-rag";
import { buildRagPrompt, retrieveContext, SYSTEM_PROMPTS } from "@/lib/rag/context-builder";
import { detectNegativeReaction, validateInput, validateOutput } from "@/lib/rag/guardrails";
import { detectQueryLanguage } from "@/lib/rag/university-domain";

export const maxDuration = 30;

export async function POST(request: Request) {
    const startTime = Date.now();

    try {
        const {
            messages,
            sessionId,
            useRag = true,
            useAgenticMode = true,
            retrievalStrategy = "hybrid",
            enableGuardrails = true,
        }: {
            messages: UIMessage[];
            sessionId?: string;
            useRag?: boolean;
            useAgenticMode?: boolean;
            retrievalStrategy?: "vector" | "keyword" | "hybrid";
            enableGuardrails?: boolean;
        } = await request.json();

        const lastMessage = messages.at(-1);
        const userMessage =
            lastMessage?.parts
                .filter((part) => part.type === "text")
                .map((part) => (part.type === "text" ? part.text : ""))
                .join(" ") || "";
        const language = detectQueryLanguage(userMessage);

        if (enableGuardrails) {
            const [inputValidation, negativeReaction] = await Promise.all([
                validateInput(userMessage),
                detectNegativeReaction(userMessage),
            ]);

            // Log guardrail checks
            if (sessionId) {
                await db.insert(guardrailLogs).values({
                    sessionId,
                    guardrailType: "input_validation",
                    triggered: !inputValidation.passed,
                    severity: inputValidation.severity,
                    details: {
                        rule: inputValidation.violations.map((v) => v.rule).join(", ") || "none",
                        action: inputValidation.passed ? "allowed" : "blocked",
                        matchedContent: negativeReaction.detected ? String(negativeReaction.type) : undefined,
                    },
                });
            }

            // Handle negative reactions with empathetic response
            if (negativeReaction.detected && negativeReaction.severity === "high") {
                const empathyResponse =
                    language === "id"
                        ? `Saya mengerti Anda mungkin merasa ${negativeReaction.type === "frustration" ? "frustrasi" : "bingung"}. ${negativeReaction.suggestedResponse} Bagaimana saya bisa membantu Anda dengan lebih baik?`
                        : `I understand you might be feeling ${negativeReaction.type}. ${negativeReaction.suggestedResponse} How can I better assist you?`;

                return Response.json({
                    content: empathyResponse,
                    negativeReactionDetected: true,
                    language,
                });
            }

            if (!inputValidation.passed) {
                return new Response(
                    JSON.stringify({
                        error:
                            language === "id"
                                ? "Permintaan diblokir oleh kebijakan konten"
                                : "Query blocked by content policy",
                        violations: inputValidation.violations.map((v) => v.description),
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }
        }

        if (useRag && useAgenticMode) {
            const agentResult = await runAgenticRag(userMessage, {
                sessionId,
                retrievalStrategy,
                enableGuardrails,
            });

            const latencyMs = Date.now() - startTime;

            // Save to database
            if (sessionId) {
                await Promise.all([
                    db.insert(chatMessages).values({
                        sessionId,
                        role: "user",
                        content: userMessage,
                        ragEnabled: useRag,
                        agenticMode: true,
                        createdAt: new Date(),
                    }),
                    db.insert(chatMessages).values({
                        sessionId,
                        role: "assistant",
                        content: agentResult.answer,
                        retrievedChunks:
                            agentResult.retrievedChunks.length > 0
                                ? agentResult.retrievedChunks.map((c) => ({
                                      chunkId: c.chunkId,
                                      documentTitle: c.documentTitle,
                                      content: c.content,
                                      similarity: c.fusedScore,
                                      retrievalMethod: c.retrievalMethod,
                                      vectorScore: c.vectorScore,
                                      bm25Score: c.bm25Score,
                                  }))
                                : undefined,
                        ragEnabled: useRag,
                        agenticMode: true,
                        agentStepsCount: agentResult.steps.length,
                        latencyMs,
                        createdAt: new Date(),
                    }),
                    db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId)),
                ]);
            }

            return Response.json({
                content: agentResult.answer,
                steps: agentResult.steps,
                retrievedChunks: agentResult.retrievedChunks.map((c) => ({
                    documentTitle: c.documentTitle,
                    content: c.content,
                    similarity: c.fusedScore,
                    retrievalMethod: c.retrievalMethod,
                    vectorScore: c.vectorScore,
                    bm25Score: c.bm25Score,
                })),
                latencyMs,
                language: agentResult.language,
                reasoning: agentResult.reasoning,
                guardrails: agentResult.guardrailResults,
            });
        }

        let systemPrompt = useRag ? SYSTEM_PROMPTS.rag : SYSTEM_PROMPTS.nonRag;
        let retrievedChunks: Array<{
            chunkId: string;
            documentTitle: string;
            content: string;
            similarity: number;
            retrievalMethod?: "vector" | "keyword" | "hybrid";
            vectorScore?: number;
            bm25Score?: number;
        }> = [];

        if (useRag) {
            const contextResult = await retrieveContext(userMessage, {
                topK: 5,
                minSimilarity: 0.3,
                maxTokens: 4000,
                strategy: retrievalStrategy,
            });

            retrievedChunks = contextResult.chunks;

            if (contextResult.context) {
                systemPrompt = buildRagPrompt(SYSTEM_PROMPTS.rag, contextResult.context, userMessage);
            }
        }

        const result = streamText({
            model: CHAT_MODEL,
            system: systemPrompt,
            messages: convertToModelMessages(messages.slice(0, -1)),
            experimental_telemetry: {
                ...telemetryConfig,
                functionId: useRag ? "rag-chat" : "direct-chat",
                metadata: {
                    ...telemetryConfig.metadata,
                    language,
                    useRag,
                    retrievalStrategy,
                },
            },
            onFinish: async ({ text, usage }) => {
                const latencyMs = Date.now() - startTime;

                // Output validation
                if (enableGuardrails) {
                    const outputValidation = await validateOutput(text, {
                        retrievedChunks: retrievedChunks.map((c) => c.content),
                        query: userMessage,
                    });

                    if (sessionId) {
                        await db.insert(guardrailLogs).values({
                            sessionId,
                            guardrailType: "output_validation",
                            triggered: !outputValidation.passed,
                            severity: outputValidation.severity,
                            details: {
                                rule: outputValidation.violations.map((v) => v.rule).join(", ") || "none",
                                action: outputValidation.passed ? "allowed" : "flagged",
                            },
                        });
                    }
                }

                // Save messages to database
                if (sessionId) {
                    await Promise.all([
                        db.insert(chatMessages).values({
                            sessionId,
                            role: "user",
                            content: userMessage,
                            ragEnabled: useRag,
                            agenticMode: false,
                            createdAt: new Date(),
                        }),
                        db.insert(chatMessages).values({
                            sessionId,
                            role: "assistant",
                            content: text,
                            retrievedChunks: retrievedChunks.length > 0 ? retrievedChunks : undefined,
                            ragEnabled: useRag,
                            agenticMode: false,
                            latencyMs,
                            tokenCount: usage?.totalTokens,
                            createdAt: new Date(),
                        }),
                        db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId)),
                    ]);
                }
            },
        });

        return result.toUIMessageStreamResponse({
            headers: {
                "X-Retrieved-Chunks": JSON.stringify(
                    retrievedChunks.map((c) => ({
                        documentTitle: c.documentTitle,
                        similarity: c.similarity?.toFixed(3),
                        method: c.retrievalMethod || "vector",
                    }))
                ),
                "X-Retrieval-Strategy": retrievalStrategy,
                "X-Language": language,
            },
        });
    } catch (error) {
        console.error("Chat API error:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to process chat request",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
