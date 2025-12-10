/**
 * @fileoverview API Route: Import Evaluation Questions
 *
 * WHY This Endpoint Exists:
 * - Bulk import of evaluation questions from external sources (CSV, JSON)
 * - Enables reuse of question sets across multiple evaluation runs
 * - Supports standardized benchmarking with shared question sets
 *
 * Request/Response Flow:
 * 1. Validate request body (runId, questions array)
 * 2. Validate question format (question and groundTruth required)
 * 3. Insert questions into database
 * 4. Update evaluation run's total question count
 * 5. Return imported questions
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

/**
 * POST /api/evaluation/import-questions
 *
 * WHY Bulk Import:
 * - Manual question creation is time-consuming for large evaluation sets
 * - Allows sharing of question banks between researchers
 * - Enables programmatic question generation
 *
 * Request Body:
 * - runId: string (required) - Target evaluation run ID
 * - questions: Array<{ question: string, groundTruth: string }> (required)
 *
 * Response:
 * - Success (200): {
 *     success: true,
 *     imported: number,
 *     questions: EvaluationQuestion[]
 *   }
 * - Error (400): { error: string } - Invalid request body or missing fields
 * - Error (500): { error: string } - Database insertion failure
 *
 * @param request - Next.js request with JSON body
 * @returns JSON response with imported questions
 *
 * @example
 * ```typescript
 * // Import questions from CSV parser
 * const questions = csvData.map(row => ({
 *   question: row.question,
 *   groundTruth: row.expected_answer
 * }));
 *
 * await fetch('/api/evaluation/import-questions', {
 *   method: 'POST',
 *   body: JSON.stringify({ runId, questions })
 * });
 * ```
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { runId, questions } = body as {
            runId: string;
            questions: { question: string; groundTruth: string }[];
        };

        if (!(runId && questions && Array.isArray(questions))) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        // Validate questions format
        const invalidQuestions = questions.filter((q) => !(q.question && q.groundTruth));
        if (invalidQuestions.length > 0) {
            return NextResponse.json(
                { error: `${invalidQuestions.length} questions are missing required fields` },
                { status: 400 }
            );
        }

        // Insert questions into database
        const insertedQuestions: unknown[] = [];
        for (const q of questions) {
            const [inserted] = await db
                .insert(evaluationQuestions)
                .values({
                    runId,
                    question: q.question,
                    groundTruth: q.groundTruth,
                })
                .returning();

            insertedQuestions.push(inserted);
        }

        // Update run's total questions count
        await db.update(evaluationRuns).set({ totalQuestions: questions.length }).where(eq(evaluationRuns.id, runId));

        return NextResponse.json({
            success: true,
            imported: insertedQuestions.length,
            questions: insertedQuestions,
        });
    } catch (error) {
        console.error("[v0] Import questions error:", error);
        return NextResponse.json({ error: "Failed to import questions" }, { status: 500 });
    }
}
