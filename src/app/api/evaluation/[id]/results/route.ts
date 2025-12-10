import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const [run] = await db.select().from(evaluationRuns).where(eq(evaluationRuns.id, id));

        if (!run) {
            return Response.json({ error: "Evaluation run not found" }, { status: 404 });
        }

        const questions = await db.select().from(evaluationQuestions).where(eq(evaluationQuestions.runId, id));

        // Calculate aggregate metrics
        const validQuestions = questions.filter((q) => q.ragAnswerCorrectness !== null);

        const aggregateMetrics = {
            // Core RAGAS metrics
            rag: {
                faithfulness: average(validQuestions.map((q) => q.ragFaithfulness)),
                answerRelevancy: average(validQuestions.map((q) => q.ragAnswerRelevancy)),
                contextPrecision: average(validQuestions.map((q) => q.ragContextPrecision)),
                contextRecall: average(validQuestions.map((q) => q.ragContextRecall)),
                answerCorrectness: average(validQuestions.map((q) => q.ragAnswerCorrectness)),
            },
            nonRag: {
                answerRelevancy: average(validQuestions.map((q) => q.nonRagAnswerRelevancy)),
                answerCorrectness: average(validQuestions.map((q) => q.nonRagAnswerCorrectness)),
            },
            // Domain-specific metrics
            avgAcademicRigor: average(validQuestions.map((q) => q.ragAcademicRigor)),
            avgCitationAccuracy: average(validQuestions.map((q) => q.ragCitationAccuracy)),
            avgTerminologyCorrectness: average(validQuestions.map((q) => q.ragTerminologyCorrectness)),
            // Hallucination metrics
            avgHallucinationRate: average(validQuestions.map((q) => q.ragHallucinationRate)),
            avgFactualConsistency: average(validQuestions.map((q) => q.ragFactualConsistency)),
            avgSourceAttribution: average(validQuestions.map((q) => q.ragSourceAttribution)),
            avgContradictionFree: average(validQuestions.map((q) => q.ragContradictionScore)),
            nonRagHallucinationRate: average(validQuestions.map((q) => q.nonRagHallucinationRate)),
            // Retrieval metrics
            retrievalNdcg: average(validQuestions.map((q) => q.retrievalNdcg)),
            retrievalMrr: average(validQuestions.map((q) => q.retrievalMrr)),
            retrievalPrecision: average(validQuestions.map((q) => q.retrievalPrecision)),
            // Latency metrics
            avgLatencyMs: average(validQuestions.map((q) => q.ragLatencyMs)),
            avgRetrievalLatencyMs: average(validQuestions.map((q) => q.ragRetrievalLatencyMs)),
            avgRerankingLatencyMs: average(validQuestions.map((q) => q.ragRerankingLatencyMs)),
            avgGenerationLatencyMs: average(validQuestions.map((q) => q.ragGenerationLatencyMs)),
            avgAgentReasoningLatencyMs: average(validQuestions.map((q) => q.ragAgentReasoningLatencyMs)),
            avgTokensPerSecond: average(validQuestions.map((q) => q.ragTokensPerSecond)),
            // Legacy field names for backward compatibility with dashboard
            avgFaithfulness: average(validQuestions.map((q) => q.ragFaithfulness)),
            avgAnswerRelevancy: average(validQuestions.map((q) => q.ragAnswerRelevancy)),
            avgContextPrecision: average(validQuestions.map((q) => q.ragContextPrecision)),
            avgContextRecall: average(validQuestions.map((q) => q.ragContextRecall)),
            avgAnswerCorrectness: average(validQuestions.map((q) => q.ragAnswerCorrectness)),
        };

        // Calculate improvement percentages
        const improvements = {
            answerRelevancy: calculateImprovement(
                aggregateMetrics.rag.answerRelevancy,
                aggregateMetrics.nonRag.answerRelevancy
            ),
            answerCorrectness: calculateImprovement(
                aggregateMetrics.rag.answerCorrectness,
                aggregateMetrics.nonRag.answerCorrectness
            ),
            hallucinationReduction: calculateImprovement(
                1 - (aggregateMetrics.avgHallucinationRate || 0),
                1 - (aggregateMetrics.nonRagHallucinationRate || 0)
            ),
        };

        return Response.json({
            run,
            questions,
            aggregateMetrics,
            improvements,
            summary: {
                totalQuestions: questions.length,
                completedQuestions: validQuestions.length,
                ragBetterThanNonRag: aggregateMetrics.rag.answerCorrectness > aggregateMetrics.nonRag.answerCorrectness,
            },
        });
    } catch (error) {
        console.error("[GET /api/evaluation/:id/results] Error:", error);
        return Response.json({ error: "Failed to fetch results" }, { status: 500 });
    }
}

function average(values: (number | null | undefined)[]): number {
    const valid = values.filter((v): v is number => v !== null && v !== undefined);
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function calculateImprovement(ragValue: number, nonRagValue: number): number {
    if (nonRagValue === 0) return ragValue > 0 ? 100 : 0;
    return ((ragValue - nonRagValue) / nonRagValue) * 100;
}
