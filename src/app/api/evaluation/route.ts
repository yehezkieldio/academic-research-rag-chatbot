import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

export async function GET() {
    try {
        const runs = await db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.createdAt));

        return Response.json({ runs });
    } catch (error) {
        return Response.json({ error: "Failed to fetch evaluation runs" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const {
            name,
            description,
            questions,
            useAgenticMode = true,
            retrievalStrategy = "hybrid",
            chunkingStrategy = "recursive",
            enableGuardrails = true,
        } = await request.json();

        // Create evaluation run with configuration
        const [run] = await db
            .insert(evaluationRuns)
            .values({
                name,
                description,
                totalQuestions: questions?.length || 0,
                status: "pending",
                useAgenticMode,
                retrievalStrategy,
                chunkingStrategy,
            })
            .returning();

        // Insert questions if provided
        if (questions?.length > 0) {
            await db.insert(evaluationQuestions).values(
                // @ts-expect-error FIXME: type will be fixed later
                questions.map((q) => ({
                    runId: run.id,
                    question: q.question,
                    groundTruth: q.groundTruth,
                }))
            );
        }

        return Response.json({ run });
    } catch (error) {
        return Response.json({ error: "Failed to create evaluation run" }, { status: 500 });
    }
}
