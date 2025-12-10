import { avg, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

export async function GET() {
    try {
        // Get aggregate hallucination metrics across all completed evaluations
        const metrics = await db
            .select({
                avgHallucinationRate: avg(evaluationQuestions.ragHallucinationRate),
                avgFactualConsistency: avg(evaluationQuestions.ragFactualConsistency),
                avgSourceAttribution: avg(evaluationQuestions.ragSourceAttribution),
                avgContradictionFree: avg(evaluationQuestions.ragContradictionScore),
                avgNonRagHallucination: avg(evaluationQuestions.nonRagHallucinationRate),
            })
            .from(evaluationQuestions)
            .innerJoin(evaluationRuns, eq(evaluationQuestions.runId, evaluationRuns.id))
            .where(eq(evaluationRuns.status, "completed"));

        const result = metrics[0] || {
            avgHallucinationRate: null,
            avgFactualConsistency: null,
            avgSourceAttribution: null,
            avgContradictionFree: null,
            avgNonRagHallucination: null,
        };

        return Response.json(result);
    } catch (error) {
        console.error("Hallucination summary error:", error);
        return Response.json({ error: "Failed to fetch hallucination summary" }, { status: 500 });
    }
}
