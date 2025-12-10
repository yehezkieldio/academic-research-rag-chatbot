import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const [run] = await db.select().from(evaluationRuns).where(eq(evaluationRuns.id, id));

        const questions = await db.select().from(evaluationQuestions).where(eq(evaluationQuestions.runId, id));

        // Calculate aggregate metrics
        const validQuestions = questions.filter((q) => q.ragAnswerCorrectness !== null);

        const aggregateMetrics = {
            rag: {
                faithfulness: average(validQuestions.map((q) => q.ragFaithfulness)),
                answerRelevancy: average(validQuestions.map((q) => q.ragAnswerRelevancy)),
                contextPrecision: average(validQuestions.map((q) => q.ragContextPrecision)),
                contextRecall: average(validQuestions.map((q) => q.ragContextRecall)),
                answerCorrectness: average(validQuestions.map((q) => q.ragAnswerCorrectness)),
                averageLatencyMs: average(validQuestions.map((q) => q.ragLatencyMs)),
            },
            nonRag: {
                answerRelevancy: average(validQuestions.map((q) => q.nonRagAnswerRelevancy)),
                answerCorrectness: average(validQuestions.map((q) => q.nonRagAnswerCorrectness)),
                averageLatencyMs: average(validQuestions.map((q) => q.nonRagLatencyMs)),
            },
        };

        return Response.json({
            run,
            questions,
            aggregateMetrics,
        });
    } catch (error) {
        return Response.json({ error: "Failed to fetch results" }, { status: 500 });
    }
}

function average(values: (number | null | undefined)[]): number {
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}
