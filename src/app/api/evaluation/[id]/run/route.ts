import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { CHAT_MODEL } from "@/lib/ai";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";
import { buildRagPrompt, retrieveContext, SYSTEM_PROMPTS } from "@/lib/rag/context-builder";
import { calculateAllMetrics } from "@/lib/rag/evaluation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Update run status
        await db.update(evaluationRuns).set({ status: "running" }).where(eq(evaluationRuns.id, id));

        // Get questions for this run
        const questions = await db.select().from(evaluationQuestions).where(eq(evaluationQuestions.runId, id));

        let completedCount = 0;

        for (const question of questions) {
            try {
                // Generate RAG response
                const ragStartTime = Date.now();
                const contextResult = await retrieveContext(question.question, {
                    topK: 5,
                    minSimilarity: 0.7,
                });

                const ragPrompt = buildRagPrompt(SYSTEM_PROMPTS.rag, contextResult.context, question.question);

                const ragResponse = await generateText({
                    model: CHAT_MODEL,
                    prompt: ragPrompt,
                });
                const ragLatency = Date.now() - ragStartTime;

                // Generate non-RAG response
                const nonRagStartTime = Date.now();
                const nonRagResponse = await generateText({
                    model: CHAT_MODEL,
                    system: SYSTEM_PROMPTS.nonRag,
                    prompt: question.question,
                });
                const nonRagLatency = Date.now() - nonRagStartTime;

                // Calculate RAGAS metrics for RAG response
                const ragMetrics = await calculateAllMetrics(
                    question.question,
                    ragResponse.text,
                    contextResult.chunks.map((c) => c.content),
                    question.groundTruth
                );

                // Calculate metrics for non-RAG response
                const { calculateAnswerRelevancy, calculateAnswerCorrectness } = await import("@/lib/rag/evaluation");
                const nonRagRelevancy = await calculateAnswerRelevancy(question.question, nonRagResponse.text);
                const nonRagCorrectness = await calculateAnswerCorrectness(nonRagResponse.text, question.groundTruth);

                // Update question with results
                await db
                    .update(evaluationQuestions)
                    .set({
                        ragAnswer: ragResponse.text,
                        nonRagAnswer: nonRagResponse.text,
                        retrievedContexts: contextResult.chunks.map((c) => c.content),
                        ragFaithfulness: ragMetrics.faithfulness,
                        ragAnswerRelevancy: ragMetrics.answerRelevancy,
                        ragContextPrecision: ragMetrics.contextPrecision,
                        ragContextRecall: ragMetrics.contextRecall,
                        ragAnswerCorrectness: ragMetrics.answerCorrectness,
                        nonRagAnswerRelevancy: nonRagRelevancy,
                        nonRagAnswerCorrectness: nonRagCorrectness,
                        ragLatencyMs: ragLatency,
                        nonRagLatencyMs: nonRagLatency,
                    })
                    .where(eq(evaluationQuestions.id, question.id));

                completedCount += 1;

                // Update run progress
                await db
                    .update(evaluationRuns)
                    .set({ completedQuestions: completedCount })
                    .where(eq(evaluationRuns.id, id));
            } catch (error) {
                console.error(`Error evaluating question ${question.id}:`, error);
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

        return Response.json({ success: true, completedQuestions: completedCount });
    } catch (error) {
        console.error("Evaluation error:", error);

        // Mark run as failed
        const { id } = await params;
        await db.update(evaluationRuns).set({ status: "failed" }).where(eq(evaluationRuns.id, id));

        return Response.json({ error: "Evaluation failed" }, { status: 500 });
    }
}
