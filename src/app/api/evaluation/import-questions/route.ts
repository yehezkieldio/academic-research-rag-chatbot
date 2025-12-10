import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

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
