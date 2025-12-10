/**
 * @fileoverview API Route: Ablation Studies
 *
 * WHY This Endpoint Exists:
 * - Systematic comparison of different RAG configurations
 * - Identifies which components contribute most to performance
 * - Supports academic research on RAG architecture decisions
 * - Enables data-driven optimization of retrieval strategies
 *
 * Request/Response Flow:
 * - GET: Retrieve recent ablation studies
 * - POST: Execute ablation study across multiple configurations
 *
 * WHY Ablation Studies Matter:
 * - Shows which components (reranking, hybrid retrieval, agentic mode) provide value
 * - Helps justify architectural complexity with empirical data
 * - Guides resource allocation (compute vs accuracy tradeoffs)
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ablationStudies, evaluationQuestions as evaluationQuestionsTable } from "@/lib/db/schema";
import { ACADEMIC_QUESTIONS } from "@/lib/evaluation-questions";
import { ABLATION_CONFIGS, type AblationConfig, generateAblationReport, runAblationStudy } from "@/lib/rag/evaluation";

/**
 * GET /api/evaluation/ablation
 *
 * WHY: Lists recent ablation studies for comparison
 *
 * Response:
 * - Success (200): { studies: AblationStudy[] } - Last 10 studies
 * - Error (500): { error: string }
 *
 * @returns JSON response with ablation studies array
 */
export async function GET() {
    try {
        const studies = await db.select().from(ablationStudies).orderBy(desc(ablationStudies.createdAt)).limit(10);

        return Response.json({ studies });
    } catch (error) {
        console.error("[GET /api/evaluation/ablation] Error:", error);
        return Response.json({ error: "Failed to fetch ablation studies" }, { status: 500 });
    }
}

/**
 * POST /api/evaluation/ablation
 *
 * WHY Complex Execution:
 * - Tests multiple configurations (baseline, vector-only, BM25, hybrid, agentic)
 * - Each config tested against all questions (20-50 questions × 5-10 configs)
 * - Calculates full RAGAS metrics for each config-question pair
 * - Can take 30-60 minutes for comprehensive ablation study
 *
 * Request Body:
 * - questions?: Array<{ question, groundTruth }> - Custom questions or uses defaults
 * - configs?: AblationConfig[] - Custom configs or uses predefined set
 * - name?: string - Study name
 * - description?: string - Study purpose and notes
 *
 * Response:
 * - Success (200): {
 *     study: AblationStudy with results and comprehensive report
 *   }
 * - Error (500): { error: string }
 *
 * Tested Configurations:
 * 1. Baseline (no RAG) - Direct LLM
 * 2. Vector-only - Pure semantic similarity
 * 3. BM25-only - Pure keyword matching
 * 4. Hybrid (RRF) - Combined vector + BM25
 * 5. Agentic RAG - Multi-step reasoning with tools
 *
 * @param request - Next.js request with JSON body
 * @returns JSON response with completed ablation study and analysis report
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const {
            questions: providedQuestions = [],
            configs: providedConfigs,
            name: studyName,
            description: studyDescription,
        } = body;

        // Parse configs - use provided or default to first 5 for faster testing
        const configs: AblationConfig[] = providedConfigs || ABLATION_CONFIGS.slice(0, 5);

        // Get questions from various sources
        let testQuestions: { question: string; groundTruth: string }[] = [];

        if (providedQuestions.length > 0) {
            // Use provided questions
            testQuestions = providedQuestions;
        } else {
            // Try to get questions from the latest evaluation run
            const latestQuestions = await db
                .select({
                    question: evaluationQuestionsTable.question,
                    groundTruth: evaluationQuestionsTable.groundTruth,
                })
                .from(evaluationQuestionsTable)
                .limit(20);

            if (latestQuestions.length > 0) {
                testQuestions = latestQuestions;
            } else {
                // Fallback to predefined academic questions from the centralized store
                testQuestions = ACADEMIC_QUESTIONS.map((q) => ({
                    question: q.question,
                    groundTruth: q.groundTruth,
                }));
            }
        }

        console.log(
            `[POST /api/evaluation/ablation] Starting ablation study with ${testQuestions.length} questions and ${configs.length} configs`
        );

        // Create ablation study record
        const [study] = await db
            .insert(ablationStudies)
            .values({
                name: studyName || `Ablation Study ${new Date().toISOString()}`,
                description:
                    studyDescription ||
                    `Automated ablation study comparing ${configs.length} RAG configurations with ${testQuestions.length} questions`,
                status: "running",
                configurations: configs.map((c) => ({
                    name: c.name,
                    useRag: c.useRag,
                    useReranker: c.useReranker,
                    rerankerStrategy: c.rerankerStrategy,
                    retrievalStrategy: c.retrievalStrategy,
                    chunkingStrategy: c.chunkingStrategy,
                    useAgenticMode: c.useAgenticMode,
                    useGuardrails: c.useGuardrails,
                    topK: c.topK,
                })),
            })
            .returning();

        // Run the actual ablation study with real RAG pipeline
        const ablationResults = await runAblationStudy(testQuestions, configs, {
            onProgress: (configIdx, questionIdx, totalConfigs, totalQuestions) => {
                console.log(
                    `[Ablation Progress] Config ${configIdx + 1}/${totalConfigs}, Question ${questionIdx + 1}/${totalQuestions}`
                );
            },
        });

        // Format results for storage
        const results = ablationResults.map((result) => ({
            configName: result.config.name,
            metrics: {
                faithfulness: result.metrics.faithfulness,
                answerRelevancy: result.metrics.answerRelevancy,
                contextPrecision: result.metrics.contextPrecision,
                contextRecall: result.metrics.contextRecall,
                answerCorrectness: result.metrics.answerCorrectness,
                academicRigor: result.metrics.academicRigor,
                citationAccuracy: result.metrics.citationAccuracy,
                terminologyCorrectness: result.metrics.terminologyCorrectness,
                hallucinationRate: result.metrics.hallucinationRate,
                factualConsistency: result.metrics.factualConsistency,
                sourceAttribution: result.metrics.sourceAttribution,
                contradictionScore: result.metrics.contradictionScore,
                totalLatencyMs: result.metrics.totalLatencyMs,
                retrievalLatencyMs: result.metrics.retrievalLatencyMs,
                rerankingLatencyMs: result.metrics.rerankingLatencyMs,
                generationLatencyMs: result.metrics.generationLatencyMs,
                agentReasoningLatencyMs: result.metrics.agentReasoningLatencyMs,
            },
        }));

        // Generate comprehensive report
        const report = generateAblationReport(ablationResults);

        // Update study with results
        await db
            .update(ablationStudies)
            .set({
                status: "completed",
                results,
                report,
                completedAt: new Date(),
            })
            .where(eq(ablationStudies.id, study.id));

        console.log(`[POST /api/evaluation/ablation] Ablation study completed: ${study.id}`);

        return Response.json({
            study: { ...study, results, report, status: "completed" },
        });
    } catch (error) {
        console.error("[POST /api/evaluation/ablation] Ablation study error:", error);
        return Response.json({ error: "Failed to run ablation study" }, { status: 500 });
    }
}
