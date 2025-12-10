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
