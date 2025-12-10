import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ablationStudies, evaluationQuestions, evaluationRuns } from "@/lib/db/schema";
import {
    analyzeAblationStudy,
    bootstrapConfidenceInterval,
    calculateDescriptiveStats,
    compareRAGvsNonRAG,
    confidenceInterval,
    generateStatisticalReport,
    independentTTest,
    oneWayANOVA,
    pairedTTest,
    type RAGComparisonResult,
} from "@/lib/statistics/statistical-analysis";

// Real evaluation data structure from database
interface EvaluationData {
    questionId: string;
    question: string;
    ragScores: {
        faithfulness: number;
        answerRelevancy: number;
        contextPrecision: number;
        contextRecall: number;
        answerCorrectness: number;
        hallucinationRate: number;
        latencyMs: number;
        retrievalLatencyMs: number;
        rerankingLatencyMs: number;
        generationLatencyMs: number;
        agentReasoningLatencyMs: number;
    };
    nonRagScores: {
        answerRelevancy: number;
        answerCorrectness: number;
        hallucinationRate: number;
        latencyMs: number;
    };
}

interface AblationData {
    configName: string;
    scores: {
        faithfulness: number[];
        answerRelevancy: number[];
        contextPrecision: number[];
        contextRecall: number[];
        answerCorrectness: number[];
        hallucinationRate: number[];
        latencyMs: number[];
    };
}

// ===== DATA FETCHING FUNCTIONS =====

/**
 * Fetch the latest evaluation run
 */
async function getLatestEvaluationRun() {
    const runs = await db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.createdAt)).limit(1);
    return runs[0] || null;
}

/**
 * Fetch the latest ablation study
 */
async function getLatestAblationStudy() {
    const studies = await db.select().from(ablationStudies).orderBy(desc(ablationStudies.createdAt)).limit(1);
    return studies[0] || null;
}

/**
 * Fetch evaluation run data with all questions and metrics
 */
async function fetchEvaluationRunData(runId: string): Promise<EvaluationData[]> {
    const questions = await db.select().from(evaluationQuestions).where(eq(evaluationQuestions.runId, runId));

    return questions
        .filter((q) => q.ragAnswerCorrectness !== null) // Only include completed questions
        .map((q) => ({
            questionId: q.id,
            question: q.question,
            ragScores: {
                faithfulness: q.ragFaithfulness ?? 0,
                answerRelevancy: q.ragAnswerRelevancy ?? 0,
                contextPrecision: q.ragContextPrecision ?? 0,
                contextRecall: q.ragContextRecall ?? 0,
                answerCorrectness: q.ragAnswerCorrectness ?? 0,
                hallucinationRate: q.ragHallucinationRate ?? 0,
                latencyMs: q.ragLatencyMs ?? 0,
                retrievalLatencyMs: q.ragRetrievalLatencyMs ?? 0,
                rerankingLatencyMs: q.ragRerankingLatencyMs ?? 0,
                generationLatencyMs: q.ragGenerationLatencyMs ?? 0,
                agentReasoningLatencyMs: q.ragAgentReasoningLatencyMs ?? 0,
            },
            nonRagScores: {
                answerRelevancy: q.nonRagAnswerRelevancy ?? 0,
                answerCorrectness: q.nonRagAnswerCorrectness ?? 0,
                hallucinationRate: q.nonRagHallucinationRate ?? 0,
                latencyMs: q.nonRagLatencyMs ?? 0,
            },
        }));
}

/**
 * Fetch ablation study data with all configurations and metrics
 */
async function fetchAblationStudyData(studyId: string): Promise<AblationData[]> {
    const [study] = await db.select().from(ablationStudies).where(eq(ablationStudies.id, studyId));

    if (!study?.results) {
        return [];
    }

    // Group results by configuration
    const configMap = new Map<string, AblationData>();

    for (const result of study.results as unknown as Array<{
        configName: string;
        metrics: Record<string, number>;
    }>) {
        if (!configMap.has(result.configName)) {
            configMap.set(result.configName, {
                configName: result.configName,
                scores: {
                    faithfulness: [],
                    answerRelevancy: [],
                    contextPrecision: [],
                    contextRecall: [],
                    answerCorrectness: [],
                    hallucinationRate: [],
                    latencyMs: [],
                },
            });
        }

        const config = configMap.get(result.configName);
        if (config) {
            // Aggregate metrics - each result represents aggregated metrics for a config
            // We'll use these as single data points
            if (result.metrics.faithfulness !== undefined) config.scores.faithfulness.push(result.metrics.faithfulness);
            if (result.metrics.answerRelevancy !== undefined)
                config.scores.answerRelevancy.push(result.metrics.answerRelevancy);
            if (result.metrics.contextPrecision !== undefined)
                config.scores.contextPrecision.push(result.metrics.contextPrecision);
            if (result.metrics.contextRecall !== undefined)
                config.scores.contextRecall.push(result.metrics.contextRecall);
            if (result.metrics.answerCorrectness !== undefined)
                config.scores.answerCorrectness.push(result.metrics.answerCorrectness);
            if (result.metrics.hallucinationRate !== undefined)
                config.scores.hallucinationRate.push(result.metrics.hallucinationRate);
            if (result.metrics.totalLatencyMs !== undefined)
                config.scores.latencyMs.push(result.metrics.totalLatencyMs);
        }
    }

    return Array.from(configMap.values());
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: wip
async function runAnalysis() {
    console.log("=".repeat(60));
    console.log("RAG Evaluation Statistical Analysis");
    console.log("Analisis Statistik Evaluasi RAG");
    console.log("=".repeat(60));
    console.log();

    // Get command line arguments
    const args = process.argv.slice(2);
    const runIdArg = args.find((arg) => arg.startsWith("--run-id="))?.split("=")[1];
    const ablationIdArg = args.find((arg) => arg.startsWith("--ablation-id="))?.split("=")[1];
    const latestFlag = args.includes("--latest");

    // ===== FETCH REAL DATA =====
    console.log("Fetching data from database...");

    let evaluationData: EvaluationData[] = [];
    let ablationData: AblationData[] = [];

    try {
        // Fetch evaluation run data
        if (runIdArg) {
            evaluationData = await fetchEvaluationRunData(runIdArg);
            console.log(`Loaded evaluation run: ${runIdArg} (${evaluationData.length} questions)`);
        } else if (latestFlag) {
            const latestRun = await getLatestEvaluationRun();
            if (latestRun) {
                evaluationData = await fetchEvaluationRunData(latestRun.id);
                console.log(`Loaded latest evaluation run: ${latestRun.name} (${evaluationData.length} questions)`);
            }
        }

        // Fetch ablation study data
        if (ablationIdArg) {
            ablationData = await fetchAblationStudyData(ablationIdArg);
            console.log(`Loaded ablation study: ${ablationIdArg} (${ablationData.length} configs)`);
        } else if (latestFlag) {
            const latestAblation = await getLatestAblationStudy();
            if (latestAblation) {
                ablationData = await fetchAblationStudyData(latestAblation.id);
                console.log(`Loaded latest ablation study: ${latestAblation.name} (${ablationData.length} configs)`);
            }
        }

        // If no data specified, try to load latest of both
        if (!(runIdArg || ablationIdArg || latestFlag)) {
            console.log("No specific run specified. Loading latest available data...");
            const latestRun = await getLatestEvaluationRun();
            if (latestRun) {
                evaluationData = await fetchEvaluationRunData(latestRun.id);
                console.log(`Loaded latest evaluation run: ${latestRun.name} (${evaluationData.length} questions)`);
            }
            const latestAblation = await getLatestAblationStudy();
            if (latestAblation) {
                ablationData = await fetchAblationStudyData(latestAblation.id);
                console.log(`Loaded latest ablation study: ${latestAblation.name} (${ablationData.length} configs)`);
            }
        }

        if (evaluationData.length === 0 && ablationData.length === 0) {
            console.log("\nNo evaluation data found in database.");
            console.log("Please run an evaluation first or provide --run-id or --ablation-id.");
            console.log("\nUsage:");
            console.log("  bun run scripts/run-statistical-analysis.ts --latest");
            console.log("  bun run scripts/run-statistical-analysis.ts --run-id=<uuid>");
            console.log("  bun run scripts/run-statistical-analysis.ts --ablation-id=<uuid>");
            return;
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log();

    // ===== 1. DESCRIPTIVE STATISTICS =====
    if (evaluationData.length > 0) {
        console.log("1. DESCRIPTIVE STATISTICS / STATISTIK DESKRIPTIF");
        console.log("-".repeat(50));

        const ragFaithfulness = evaluationData.map((d) => d.ragScores.faithfulness).filter((v) => v !== null);
        const ragRelevancy = evaluationData.map((d) => d.ragScores.answerRelevancy).filter((v) => v !== null);
        const ragLatency = evaluationData.map((d) => d.ragScores.latencyMs).filter((v) => v !== null);

        const nonRagRelevancy = evaluationData.map((d) => d.nonRagScores.answerRelevancy).filter((v) => v !== null);
        const nonRagLatency = evaluationData.map((d) => d.nonRagScores.latencyMs).filter((v) => v !== null);

        if (ragFaithfulness.length > 0) {
            console.log("\nRAG Faithfulness:");
            printDescriptiveStats(calculateDescriptiveStats(ragFaithfulness));
        }

        if (ragRelevancy.length > 0) {
            console.log("\nRAG Answer Relevancy:");
            printDescriptiveStats(calculateDescriptiveStats(ragRelevancy));
        }

        if (ragLatency.length > 0) {
            console.log("\nRAG Latency (ms):");
            printDescriptiveStats(calculateDescriptiveStats(ragLatency));
        }

        // ===== 2. PAIRED T-TESTS (RAG vs Non-RAG) =====
        console.log(`\n${"=".repeat(60)}`);
        console.log("2. PAIRED T-TESTS / UJI T BERPASANGAN");
        console.log("-".repeat(50));

        // Answer Relevancy comparison
        if (ragRelevancy.length > 0 && nonRagRelevancy.length > 0 && ragRelevancy.length === nonRagRelevancy.length) {
            console.log("\n2.1 Answer Relevancy: RAG vs Non-RAG");
            const relevancyTest = pairedTTest(ragRelevancy, nonRagRelevancy);
            printTestResult(relevancyTest);
        }

        // Latency comparison
        if (ragLatency.length > 0 && nonRagLatency.length > 0 && ragLatency.length === nonRagLatency.length) {
            console.log("\n2.2 Latency: RAG vs Non-RAG");
            const latencyTest = pairedTTest(ragLatency, nonRagLatency);
            printTestResult(latencyTest);
        }

        // ===== 3. CONFIDENCE INTERVALS =====
        console.log(`\n${"=".repeat(60)}`);
        console.log("3. CONFIDENCE INTERVALS / INTERVAL KEPERCAYAAN");
        console.log("-".repeat(50));

        if (ragFaithfulness.length > 0) {
            console.log("\n95% CI for RAG Faithfulness:");
            const faithCI = confidenceInterval(ragFaithfulness, 0.95);
            console.log(`  Mean: ${faithCI.mean.toFixed(4)}`);
            console.log(`  95% CI: [${faithCI.lower.toFixed(4)}, ${faithCI.upper.toFixed(4)}]`);
            console.log(`  Margin of Error: ±${faithCI.marginOfError.toFixed(4)}`);

            console.log("\nBootstrap 95% CI for RAG Faithfulness:");
            const bootstrapCI = bootstrapConfidenceInterval(ragFaithfulness, undefined, 0.95, 1000);
            console.log(`  Estimate: ${bootstrapCI.estimate.toFixed(4)}`);
            console.log(`  95% CI: [${bootstrapCI.lower.toFixed(4)}, ${bootstrapCI.upper.toFixed(4)}]`);
        }
    }

    // ===== 4. ONE-WAY ANOVA (ABLATION STUDY) =====
    if (ablationData.length > 2) {
        console.log(`\n${"=".repeat(60)}`);
        console.log("4. ONE-WAY ANOVA / ANOVA SATU ARAH (Ablation Study)");
        console.log("-".repeat(50));

        const ablationGroups = ablationData.map((d) => d.scores.faithfulness);
        const anovaResult = oneWayANOVA(ablationGroups);

        console.log("\nANOVA Results for Faithfulness across configurations:");
        console.log(`  F-statistic: ${anovaResult.statistic.toFixed(4)}`);
        console.log(`  p-value: ${anovaResult.pValue.toFixed(4)}`);
        console.log(`  Significant: ${anovaResult.significant ? "Yes / Ya" : "No / Tidak"}`);
        console.log(`  Effect size (η²): ${anovaResult.effectSize?.toFixed(4)}`);
        console.log(`  Effect interpretation: ${anovaResult.effectSizeInterpretation}`);
        console.log(`\n  EN: ${anovaResult.interpretation}`);
        console.log(`  ID: ${anovaResult.interpretationId}`);

        if (anovaResult.postHoc && anovaResult.postHoc.length > 0) {
            console.log("\nPost-hoc Tests (Tukey HSD):");
            for (const test of anovaResult.postHoc) {
                const sig = test.significant ? "***" : "";
                console.log(
                    `  ${test.testName}: q = ${test.statistic.toFixed(3)}, p = ${test.pValue.toFixed(4)} ${sig}`
                );
            }
        }
    }

    // ===== 5. COMPREHENSIVE RAG COMPARISON =====
    if (evaluationData.length > 0) {
        console.log(`\n${"=".repeat(60)}`);
        console.log("5. COMPREHENSIVE RAG vs NON-RAG COMPARISON");
        console.log("-".repeat(50));

        const comparisons: RAGComparisonResult[] = [];

        // Only compare if we have paired data
        const ragRelevancy = evaluationData.map((d) => d.ragScores.answerRelevancy).filter((v) => v !== null);
        const nonRagRelevancy = evaluationData.map((d) => d.nonRagScores.answerRelevancy).filter((v) => v !== null);

        if (ragRelevancy.length > 0 && nonRagRelevancy.length > 0 && ragRelevancy.length === nonRagRelevancy.length) {
            comparisons.push(
                compareRAGvsNonRAG(ragRelevancy, nonRagRelevancy, "Answer Relevancy", "Relevansi Jawaban")
            );
        }

        const ragCorrectness = evaluationData.map((d) => d.ragScores.answerCorrectness).filter((v) => v !== null);
        const nonRagCorrectness = evaluationData.map((d) => d.nonRagScores.answerCorrectness).filter((v) => v !== null);

        if (
            ragCorrectness.length > 0 &&
            nonRagCorrectness.length > 0 &&
            ragCorrectness.length === nonRagCorrectness.length
        ) {
            comparisons.push(
                compareRAGvsNonRAG(ragCorrectness, nonRagCorrectness, "Answer Correctness", "Kebenaran Jawaban")
            );
        }

        const ragFactual = evaluationData
            .map((d) => 1 - d.ragScores.hallucinationRate)
            .filter((v) => v !== null && !Number.isNaN(v));
        const nonRagFactual = evaluationData
            .map((d) => 1 - d.nonRagScores.hallucinationRate)
            .filter((v) => v !== null && !Number.isNaN(v));

        if (ragFactual.length > 0 && nonRagFactual.length > 0 && ragFactual.length === nonRagFactual.length) {
            comparisons.push(
                compareRAGvsNonRAG(
                    ragFactual,
                    nonRagFactual,
                    "Factual Accuracy (1 - Hallucination)",
                    "Akurasi Faktual (1 - Halusinasi)"
                )
            );
        }

        for (const comp of comparisons) {
            console.log(`\n${comp.metric} / ${comp.metricId}:`);
            console.log(`  RAG Mean: ${comp.ragStats.mean.toFixed(4)} (SD: ${comp.ragStats.stdDev.toFixed(4)})`);
            console.log(
                `  Non-RAG Mean: ${comp.nonRagStats.mean.toFixed(4)} (SD: ${comp.nonRagStats.stdDev.toFixed(4)})`
            );
            console.log(
                `  Improvement: ${comp.improvement > 0 ? "+" : ""}${comp.improvement.toFixed(4)} (${comp.improvementPercent.toFixed(1)}%)`
            );
            console.log(
                `  Significant: ${comp.testResult.significant ? "Yes / Ya" : "No / Tidak"} (p = ${comp.testResult.pValue.toFixed(4)})`
            );
            console.log(
                `  Effect Size: ${comp.testResult.effectSize?.toFixed(3)} (${comp.testResult.effectSizeInterpretation})`
            );
        }
    }

    // ===== 6. ABLATION STUDY ANALYSIS =====
    if (ablationData.length > 0) {
        console.log(`\n${"=".repeat(60)}`);
        console.log("6. ABLATION STUDY ANALYSIS / ANALISIS STUDI ABLASI");
        console.log("-".repeat(50));

        const ablationAnalysis = analyzeAblationStudy(
            ablationData.map((d) => ({
                name: d.configName,
                scores: d.scores.faithfulness.length > 0 ? d.scores.faithfulness : [0],
            }))
        );

        console.log("\nConfiguration Rankings (by Faithfulness):");
        console.log("Peringkat Konfigurasi (berdasarkan Faithfulness):\n");
        console.log("| Rank | Configuration                 | Mean   | 95% CI                |");
        console.log("|------|------------------------------|--------|----------------------|");

        ablationAnalysis.rankings.forEach((r, i) => {
            const name = r.name.padEnd(28);
            const mean = r.mean.toFixed(4);
            const ci = `[${r.ci.lower.toFixed(3)}, ${r.ci.upper.toFixed(3)}]`;
            console.log(`| ${(i + 1).toString().padEnd(4)} | ${name} | ${mean} | ${ci.padEnd(20)} |`);
        });

        console.log(`\nBest Configuration / Konfigurasi Terbaik: ${ablationAnalysis.bestConfig}`);

        // ===== 7. LATENCY ANALYSIS =====
        console.log(`\n${"=".repeat(60)}`);
        console.log("7. LATENCY ANALYSIS / ANALISIS LATENSI");
        console.log("-".repeat(50));

        const latencyByConfig = ablationData.map((d) => ({
            name: d.configName,
            stats: calculateDescriptiveStats(d.scores.latencyMs),
        }));

        console.log("\nLatency Statistics by Configuration (ms):");
        console.log("Statistik Latensi per Konfigurasi (ms):\n");
        console.log("| Configuration                 | Mean    | Median  | P95     | Std Dev |");
        console.log("|------------------------------|---------|---------|---------|---------|");

        for (const { name, stats } of latencyByConfig) {
            const sorted = new Array(stats.n).fill(stats.mean).sort((a, b) => a - b);
            const p95 = sorted[Math.floor(stats.n * 0.95)] || stats.max;
            console.log(
                `| ${name.padEnd(28)} | ${stats.mean.toFixed(1).padStart(7)} | ${stats.median.toFixed(1).padStart(7)} | ${p95.toFixed(1).padStart(7)} | ${stats.stdDev.toFixed(1).padStart(7)} |`
            );
        }

        // Latency comparison: Agentic vs Non-Agentic
        const agenticLatencies = ablationData
            .filter((d) => d.configName.includes("Agentic") || d.configName.includes("Full"))
            .flatMap((d) => d.scores.latencyMs);

        const nonAgenticLatencies = ablationData
            .filter((d) => !(d.configName.includes("Agentic") || d.configName.includes("Full")))
            .flatMap((d) => d.scores.latencyMs);

        if (agenticLatencies.length > 0 && nonAgenticLatencies.length > 0) {
            console.log("\nAgentic vs Non-Agentic Latency Comparison:");
            const latencyComparison = independentTTest(agenticLatencies, nonAgenticLatencies);
            console.log(`  Agentic Mean: ${calculateDescriptiveStats(agenticLatencies).mean.toFixed(1)}ms`);
            console.log(`  Non-Agentic Mean: ${calculateDescriptiveStats(nonAgenticLatencies).mean.toFixed(1)}ms`);
            console.log(
                `  Difference: ${(calculateDescriptiveStats(agenticLatencies).mean - calculateDescriptiveStats(nonAgenticLatencies).mean).toFixed(1)}ms`
            );
            console.log(
                `  Significant: ${latencyComparison.significant ? "Yes / Ya" : "No / Tidak"} (p = ${latencyComparison.pValue.toFixed(4)})`
            );
        }
    }

    // ===== 8. GENERATE FULL REPORT =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("8. GENERATING FULL REPORT / MEMBUAT LAPORAN LENGKAP");
    console.log("-".repeat(50));

    // Collect comparisons from the evaluation section
    const allComparisons: RAGComparisonResult[] = [];
    if (evaluationData.length > 0) {
        const ragRel = evaluationData.map((d) => d.ragScores.answerRelevancy).filter((v) => v !== null);
        const nonRagRel = evaluationData.map((d) => d.nonRagScores.answerRelevancy).filter((v) => v !== null);
        if (ragRel.length > 0 && nonRagRel.length > 0 && ragRel.length === nonRagRel.length) {
            allComparisons.push(compareRAGvsNonRAG(ragRel, nonRagRel, "Answer Relevancy", "Relevansi Jawaban"));
        }
    }

    if (ablationData.length > 0) {
        const ablationAnalysis = analyzeAblationStudy(
            ablationData.map((d) => ({
                name: d.configName,
                scores: d.scores.faithfulness.length > 0 ? d.scores.faithfulness : [0],
            }))
        );

        if (allComparisons.length > 0) {
            const fullReport = generateStatisticalReport(allComparisons, ablationAnalysis, "en");
            const fullReportId = generateStatisticalReport(allComparisons, ablationAnalysis, "id");

            console.log("\nEnglish Report Preview (first 500 chars):");
            console.log(`${fullReport.substring(0, 500)}...`);

            console.log("\nIndonesian Report Preview (first 500 chars):");
            console.log(`${fullReportId.substring(0, 500)}...`);
        } else {
            const fullReport = generateStatisticalReport([], ablationAnalysis, "en");
            console.log("\nReport Preview (first 500 chars):");
            console.log(`${fullReport.substring(0, 500)}...`);
        }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("Analysis Complete / Analisis Selesai");
    console.log("=".repeat(60));
}

// Helper functions
function printDescriptiveStats(stats: ReturnType<typeof calculateDescriptiveStats>) {
    console.log(`  N: ${stats.n}`);
    console.log(`  Mean: ${stats.mean.toFixed(4)}`);
    console.log(`  Median: ${stats.median.toFixed(4)}`);
    console.log(`  Std Dev: ${stats.stdDev.toFixed(4)}`);
    console.log(`  Min: ${stats.min.toFixed(4)}`);
    console.log(`  Max: ${stats.max.toFixed(4)}`);
    console.log(`  SEM: ${stats.sem.toFixed(4)}`);
    console.log(`  Skewness: ${stats.skewness.toFixed(4)}`);
    console.log(`  Kurtosis: ${stats.kurtosis.toFixed(4)}`);
}

function printTestResult(result: ReturnType<typeof pairedTTest>) {
    console.log(`  Test: ${result.testName} / ${result.testNameId}`);
    console.log(`  t-statistic: ${result.statistic.toFixed(4)}`);
    console.log(`  p-value: ${result.pValue.toFixed(4)}`);
    console.log(`  Degrees of Freedom: ${result.degreesOfFreedom}`);
    console.log(`  Significant (α=0.05): ${result.significant ? "Yes / Ya" : "No / Tidak"}`);
    if (result.effectSize !== undefined) {
        console.log(`  Effect Size (Cohen's d): ${result.effectSize.toFixed(4)} (${result.effectSizeInterpretation})`);
    }
    if (result.confidenceInterval) {
        console.log(
            `  95% CI: [${result.confidenceInterval.lower.toFixed(4)}, ${result.confidenceInterval.upper.toFixed(4)}]`
        );
    }
    console.log(`\n  EN: ${result.interpretation}`);
    console.log(`  ID: ${result.interpretationId}`);
}

// Run the analysis
runAnalysis().catch(console.error);
