/**
 * @fileoverview API Route: Hallucination Summary
 *
 * WHY This Endpoint Exists:
 * - Tracks hallucination metrics across all evaluations for system-wide monitoring
 * - Compares RAG vs non-RAG hallucination rates to quantify RAG benefit
 * - Supports academic research on LLM factuality and grounding
 *
 * Request/Response Flow:
 * 1. Query all completed evaluation runs
 * 2. Calculate average hallucination metrics across all questions
 * 3. Return aggregated statistics
 *
 * WHY Hallucination Tracking Matters:
 * - Hallucinations are a critical problem in academic/research contexts
 * - RAG should reduce hallucinations by grounding in retrieved documents
 * - Metrics help validate that RAG is working as intended
 */

import { avg, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

/**
 * GET /api/evaluation/hallucination-summary
 *
 * WHY Aggregate Across All Runs:
 * - Single-run metrics can be noisy
 * - Long-term tracking reveals trends and regression
 * - Provides overall system health indicator
 *
 * Response:
 * - Success (200): {
 *     avgHallucinationRate: number | null,
 *     avgFactualConsistency: number | null,
 *     avgSourceAttribution: number | null,
 *     avgContradictionFree: number | null,
 *     avgNonRagHallucination: number | null
 *   }
 * - Error (500): { error: string }
 *
 * Metrics Explanation:
 * - avgHallucinationRate: 0-1, lower is better (RAG)
 * - avgFactualConsistency: 0-1, higher is better (RAG)
 * - avgSourceAttribution: 0-1, higher is better (RAG properly cites sources)
 * - avgContradictionFree: 0-1, lower is better (no internal contradictions)
 * - avgNonRagHallucination: 0-1, baseline hallucination rate without RAG
 *
 * @returns JSON response with aggregated hallucination metrics
 */
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
