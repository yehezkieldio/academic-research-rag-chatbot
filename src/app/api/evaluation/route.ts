/**
 * @fileoverview API Route: Evaluation Management
 *
 * WHY This Endpoint Exists:
 * - Manages evaluation runs for RAG system testing and benchmarking
 * - Supports RAGAS metrics calculation (faithfulness, relevancy, precision, recall)
 * - Enables comparative analysis between RAG and non-RAG responses
 * - Facilitates academic research and ablation studies
 *
 * Request/Response Flow:
 * - GET: Retrieve all evaluation runs with metadata
 * - POST: Create new evaluation run with questions and configuration
 */

import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationQuestions, evaluationRuns } from "@/lib/db/schema";

/**
 * GET /api/evaluation
 *
 * WHY: Lists all evaluation runs for dashboard display
 * - Orders by creation date for chronological view
 * - Includes run status and configuration for filtering
 *
 * Response:
 * - Success (200): { runs: EvaluationRun[] }
 * - Error (500): { error: string }
 *
 * @returns JSON response with evaluation runs array
 */
export async function GET() {
    try {
        const runs = await db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.createdAt));

        return Response.json({ runs });
    } catch (error) {
        return Response.json({ error: "Failed to fetch evaluation runs" }, { status: 500 });
    }
}

/**
 * POST /api/evaluation
 *
 * WHY: Creates evaluation run with test questions and configuration
 * - Supports batch question import for systematic testing
 * - Configures RAG parameters for controlled experiments
 * - Enables reproducible evaluation across different configurations
 *
 * Request Body:
 * - name: string - Evaluation run name
 * - description?: string - Run description and purpose
 * - questions?: Array<{ question: string, groundTruth: string }> - Test questions
 * - useAgenticMode: boolean - Enable agentic RAG (default: true)
 * - retrievalStrategy: "vector" | "keyword" | "hybrid" - Retrieval method (default: "hybrid")
 * - chunkingStrategy: string - Text chunking algorithm (default: "recursive")
 * - enableGuardrails: boolean - Enable safety checks (default: true)
 *
 * Response:
 * - Success (200): { run: EvaluationRun } - Created run with ID
 * - Error (500): { error: string } - Creation failure
 *
 * @param request - Next.js request with JSON body
 * @returns JSON response with created evaluation run
 */
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
