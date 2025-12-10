import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { CHAT_MODEL, telemetryConfig } from "@/lib/ai";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";
import { buildRagPrompt, retrieveContext, SYSTEM_PROMPTS } from "@/lib/rag/context-builder";
import {
    calculateAllMetrics,
    calculateAnswerCorrectness,
    calculateAnswerRelevancy,
    calculateHallucinationRate,
    createLatencyTracker,
} from "@/lib/rag/evaluation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        console.log(`[Evaluation Run] Starting evaluation run: ${id}`);

        // Update run status
        await db.update(evaluationRuns).set({ status: "running" }).where(eq(evaluationRuns.id, id));

        // Get questions for this run
        const questions = await db.select().from(evaluationQuestions).where(eq(evaluationQuestions.runId, id));

        console.log(`[Evaluation Run] Processing ${questions.length} questions`);

        let completedCount = 0;

        for (const question of questions) {
            try {
                console.log(
                    `[Evaluation Run] Question ${completedCount + 1}/${questions.length}: ${question.question.substring(0, 50)}...`
                );

                // Create latency tracker for detailed timing
                const latencyTracker = createLatencyTracker();
                latencyTracker.start();

                // Generate RAG response
                const ragStartTime = Date.now();

                latencyTracker.mark("retrieval");
                const contextResult = await retrieveContext(question.question, {
                    topK: 5,
                    minSimilarity: 0.3, // Lower threshold for better recall
                    strategy: "hybrid",
                });

                const ragPrompt = buildRagPrompt(SYSTEM_PROMPTS.rag, contextResult.context, question.question);

                latencyTracker.mark("generation");
                const ragResponse = await generateText({
                    model: CHAT_MODEL,
                    prompt: ragPrompt,
                    temperature: 0.3,
                    experimental_telemetry: telemetryConfig,
                });
                const ragLatency = Date.now() - ragStartTime;

                // Generate non-RAG response
                const nonRagStartTime = Date.now();
                const nonRagResponse = await generateText({
                    model: CHAT_MODEL,
                    system: SYSTEM_PROMPTS.nonRag,
                    prompt: question.question,
                    temperature: 0.3,
                    experimental_telemetry: telemetryConfig,
                });
                const nonRagLatency = Date.now() - nonRagStartTime;

                // Calculate RAGAS metrics for RAG response (includes all hallucination metrics)
                const ragMetrics = await calculateAllMetrics(
                    question.question,
                    ragResponse.text,
                    contextResult.chunks.map((c) => c.content),
                    question.groundTruth,
                    contextResult.chunks.map((c) => c.chunkId), // retrievedIds
                    undefined, // relevantIds - would need ground truth labels
                    "akademik/universitas",
                    latencyTracker
                );

                // Calculate metrics for non-RAG response
                const nonRagRelevancy = await calculateAnswerRelevancy(question.question, nonRagResponse.text);
                const nonRagCorrectness = await calculateAnswerCorrectness(nonRagResponse.text, question.groundTruth);
                const nonRagHallucination = await calculateHallucinationRate(nonRagResponse.text, []); // No context for non-RAG

                // Update question with all results including hallucination and domain metrics
                await db
                    .update(evaluationQuestions)
                    .set({
                        ragAnswer: ragResponse.text,
                        nonRagAnswer: nonRagResponse.text,
                        retrievedContexts: contextResult.chunks.map((c) => c.content),
                        // Core RAGAS metrics
                        ragFaithfulness: ragMetrics.faithfulness,
                        ragAnswerRelevancy: ragMetrics.answerRelevancy,
                        ragContextPrecision: ragMetrics.contextPrecision,
                        ragContextRecall: ragMetrics.contextRecall,
                        ragAnswerCorrectness: ragMetrics.answerCorrectness,
                        // Non-RAG metrics
                        nonRagAnswerRelevancy: nonRagRelevancy,
                        nonRagAnswerCorrectness: nonRagCorrectness,
                        nonRagHallucinationRate: nonRagHallucination,
                        // Domain-specific metrics
                        ragAcademicRigor: ragMetrics.academicRigor,
                        ragCitationAccuracy: ragMetrics.citationAccuracy,
                        ragTerminologyCorrectness: ragMetrics.terminologyCorrectness,
                        // Hallucination metrics
                        ragHallucinationRate: ragMetrics.hallucinationRate,
                        ragFactualConsistency: ragMetrics.factualConsistency,
                        ragSourceAttribution: ragMetrics.sourceAttribution,
                        ragContradictionScore: ragMetrics.contradictionScore,
                        // Retrieval metrics
                        retrievalNdcg: ragMetrics.retrievalNdcg,
                        retrievalMrr: ragMetrics.retrievalMrr,
                        retrievalPrecision: ragMetrics.retrievalPrecision,
                        // Latency metrics
                        ragLatencyMs: ragLatency,
                        nonRagLatencyMs: nonRagLatency,
                        ragRetrievalLatencyMs: Math.round(ragMetrics.retrievalLatencyMs),
                        ragRerankingLatencyMs: Math.round(ragMetrics.rerankingLatencyMs),
                        ragGenerationLatencyMs: Math.round(ragMetrics.generationLatencyMs),
                        ragAgentReasoningLatencyMs: Math.round(ragMetrics.agentReasoningLatencyMs),
                        ragToolCallLatencyMs: Math.round(ragMetrics.toolCallLatencyMs),
                        ragTokensPerSecond: ragMetrics.tokensPerSecond,
                        // Metadata
                        retrievalMethod: contextResult.retrievalStrategy,
                    })
                    .where(eq(evaluationQuestions.id, question.id));

                completedCount += 1;

                // Update run progress
                await db
                    .update(evaluationRuns)
                    .set({ completedQuestions: completedCount })
                    .where(eq(evaluationRuns.id, id));

                console.log(
                    `[Evaluation Run] Question completed - faithfulness: ${ragMetrics.faithfulness.toFixed(3)}, correctness: ${ragMetrics.answerCorrectness.toFixed(3)}, hallucination: ${ragMetrics.hallucinationRate.toFixed(3)}`
                );
            } catch (error) {
                console.error(`[Evaluation Run] Error evaluating question ${question.id}:`, error);
            }
        }

        // Mark run as completed
        await db
            .update(evaluationRuns)
            .set({
                status: "completed",
                completedAt: new Date(),
                completedQuestions: completedCount,
            })
            .where(eq(evaluationRuns.id, id));

        console.log(`[Evaluation Run] Completed - ${completedCount}/${questions.length} questions processed`);

        return Response.json({ success: true, completedQuestions: completedCount });
    } catch (error) {
        console.error("[Evaluation Run] Error:", error);

        // Mark run as failed
        const { id } = await params;
        await db.update(evaluationRuns).set({ status: "failed" }).where(eq(evaluationRuns.id, id));

        return Response.json({ error: "Evaluation failed" }, { status: 500 });
    }
}
