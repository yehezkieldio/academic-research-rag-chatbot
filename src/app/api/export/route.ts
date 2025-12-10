/**
 * @fileoverview API Route: Data Export
 *
 * WHY This Endpoint Exists:
 * - Exports evaluation data for statistical analysis in R, Python, SPSS
 * - Generates analysis scripts with proper variable labels and test code
 * - Supports academic research and publication requirements
 * - Enables reproducible analysis with standardized data formats
 *
 * Request/Response Flow:
 * 1. Parse query parameters (runId/ablationId, format, options)
 * 2. Fetch evaluation data from database
 * 3. Format data according to requested format (CSV, JSON, SPSS, Python, R)
 * 4. Generate analysis scripts with bilingual labels (English/Indonesian)
 * 5. Return formatted data or script as downloadable file
 *
 * WHY Multiple Formats:
 * - CSV: Universal compatibility, Excel, R, Python pandas
 * - JSON: Programmatic access, web applications
 * - SPSS: Social science research standard
 * - Python: Includes complete analysis script with statistical tests
 * - R: Includes ggplot2 visualizations and statistical tests
 *
 * Integration Points:
 * - Frontend: DataExportPanel component triggers downloads
 * - Statistical Analysis: R/Python scripts include t-tests, ANOVA, effect sizes
 * - Academic Publishing: SPSS format for traditional social science workflows
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ablationStudies, evaluationQuestions, evaluationRuns } from "@/lib/db/schema";
import {
    type ExportOptions,
    exportToCSV,
    exportToJSON,
    formatForExport,
    generatePythonScript,
    generateRScript,
    generateSPSSSyntax,
} from "@/lib/export/data-exporter";

/**
 * GET /api/export
 *
 * WHY Query Parameters Instead of POST:
 * - GET allows direct browser download with URL
 * - Simpler integration with download buttons
 * - Cacheable (though typically not cached due to dynamic data)
 *
 * Query Parameters:
 * - runId?: string - Evaluation run ID to export
 * - ablationId?: string - Ablation study ID to export
 * - format: \"csv\" | \"json\" | \"spss\" | \"python\" | \"r\" (default: \"csv\")
 * - language: \"en\" | \"id\" (default: \"id\") - Variable labels language
 * - includeMetadata: boolean (default: true) - Include variable descriptions
 * - decimalPlaces: number (default: 4) - Numeric precision
 *
 * Response:
 * - Success (200): File download with appropriate Content-Type and Content-Disposition headers
 *   - CSV: text/csv
 *   - JSON: application/json
 *   - SPSS: text/plain (.sps syntax file)
 *   - Python: text/x-python
 *   - R: text/x-r
 * - Error (400): { error: string } - Missing required parameters
 * - Error (404): { error: string } - Run/study not found
 * - Error (500): { error: string } - Export generation failure
 *
 * Exported Data Schema:
 * - Question-level: All RAGAS metrics, latency breakdown, retrieved chunks
 * - Ablation-level: Configuration details, aggregated metrics per config
 *
 * Python Script Features:
 * - Paired t-tests (RAG vs Non-RAG)
 * - ANOVA for multi-group comparison
 * - Effect size calculations (Cohen's d, eta-squared)
 * - Bootstrap confidence intervals
 * - Correlation matrices
 * - Visualization with matplotlib/seaborn
 *
 * R Script Features:
 * - ggplot2 visualizations
 * - Paired t-tests with effect sizes
 * - Tukey HSD post-hoc tests
 * - Confidence intervals
 *
 * @param request - Next.js request with query parameters
 * @returns File download response or JSON error
 *
 * @example
 * ```typescript
 * // Download CSV for evaluation run
 * window.location.href = `/api/export?runId=${runId}&format=csv&language=id`;
 *
 * // Download Python analysis script
 * window.location.href = `/api/export?format=python&language=id`;
 * ```
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const runId = searchParams.get("runId");
    const ablationId = searchParams.get("ablationId");
    const format = (searchParams.get("format") || "csv") as ExportOptions["format"];
    const language = "id" as const;
    const includeMetadata = searchParams.get("includeMetadata") !== "false";

    const options: Partial<ExportOptions> = {
        format,
        language,
        includeMetadata,
        decimalPlaces: 4,
        missingValueCode: format === "spss" ? -999 : "",
    };

    try {
        // Export Python script
        if (format === "python") {
            const script = generatePythonScript(options);
            return new NextResponse(script, {
                headers: {
                    "Content-Type": "text/x-python",
                    "Content-Disposition": `attachment; filename="rag_analysis_${language}.py"`,
                },
            });
        }

        // Export R script
        if (format === "r") {
            const script = generateRScript(options);
            return new NextResponse(script, {
                headers: {
                    "Content-Type": "text/x-r",
                    "Content-Disposition": `attachment; filename="rag_analysis_${language}.R"`,
                },
            });
        }

        // Get evaluation data
        if (runId) {
            const run = await db.query.evaluationRuns.findFirst({
                where: eq(evaluationRuns.id, runId),
            });

            if (!run) {
                return NextResponse.json({ error: "Evaluation run not found" }, { status: 404 });
            }

            const questions = await db.query.evaluationQuestions.findMany({
                where: eq(evaluationQuestions.runId, runId),
            });

            const formattedData = formatForExport(questions as unknown as Record<string, unknown>[]);

            // Generate output based on format
            if (format === "csv") {
                const csv = exportToCSV(formattedData, options);
                return new NextResponse(csv, {
                    headers: {
                        "Content-Type": "text/csv",
                        "Content-Disposition": `attachment; filename="evaluation_${run.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv"`,
                    },
                });
            }

            if (format === "json") {
                const json = exportToJSON(formattedData, options);
                return new NextResponse(json, {
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Disposition": `attachment; filename="evaluation_${run.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json"`,
                    },
                });
            }

            if (format === "spss") {
                // Return SPSS syntax file
                const csvFileName = `evaluation_${run.name.replace(/\s+/g, "_")}.csv`;
                const syntax = generateSPSSSyntax(formattedData, csvFileName, options);
                return new NextResponse(syntax, {
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Disposition": `attachment; filename="evaluation_${run.name.replace(/\s+/g, "_")}_spss.sps"`,
                    },
                });
            }
        }

        // Get ablation study data
        if (ablationId) {
            const study = await db.query.ablationStudies.findFirst({
                where: eq(ablationStudies.id, ablationId),
            });

            if (!study) {
                return NextResponse.json({ error: "Ablation study not found" }, { status: 404 });
            }

            // Format ablation data for export
            const ablationData: import("@/lib/export/data-exporter").AblationRawData[] = (study.results || []).map(
                (result: { configName: string; metrics: Record<string, number> }) => {
                    const config = (study.configurations || []).find(
                        (c: { name: string }) => c.name === result.configName
                    );
                    const metrics = result.metrics;
                    return {
                        configurationName: result.configName,
                        useRag: config?.useRag ?? true,
                        useReranker: config?.useReranker ?? false,
                        rerankerStrategy: config?.rerankerStrategy || null,
                        retrievalStrategy: config?.retrievalStrategy || "hybrid",
                        chunkingStrategy: config?.chunkingStrategy || "recursive",
                        useAgenticMode: config?.useAgenticMode ?? true,
                        useGuardrails: config?.useGuardrails ?? true,
                        topK: config?.topK ?? 5,
                        avgFaithfulness: metrics.avgFaithfulness ?? null,
                        avgAnswerRelevancy: metrics.avgAnswerRelevancy ?? null,
                        avgContextPrecision: metrics.avgContextPrecision ?? null,
                        avgContextRecall: metrics.avgContextRecall ?? null,
                        avgAnswerCorrectness: metrics.avgAnswerCorrectness ?? null,
                        avgHallucinationRate: metrics.avgHallucinationRate ?? null,
                        avgLatencyMs: metrics.avgLatencyMs ?? null,
                        avgTokensPerSecond: metrics.avgTokensPerSecond ?? null,
                    };
                }
            );

            if (format === "csv") {
                const csv = exportToCSV(ablationData, options);
                return new NextResponse(csv, {
                    headers: {
                        "Content-Type": "text/csv",
                        "Content-Disposition": `attachment; filename="ablation_${study.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv"`,
                    },
                });
            }

            if (format === "json") {
                const json = exportToJSON(ablationData, options);
                return new NextResponse(json, {
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Disposition": `attachment; filename="ablation_${study.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json"`,
                    },
                });
            }
        }

        return NextResponse.json({ error: "Please provide runId or ablationId parameter" }, { status: 400 });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
    }
}
