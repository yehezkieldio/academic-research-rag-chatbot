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

// Sample evaluation data structure
interface EvaluationData {
    questionId: string;
    ragScores: {
        faithfulness: number;
        answerRelevancy: number;
        contextPrecision: number;
        answerCorrectness: number;
        hallucinationRate: number;
        latencyMs: number;
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
        latencyMs: number[];
    };
}

// biome-ignore lint/suspicious/useAwait: not sure
async function runAnalysis() {
    console.log("=".repeat(60));
    console.log("RAG Evaluation Statistical Analysis");
    console.log("Analisis Statistik Evaluasi RAG");
    console.log("=".repeat(60));
    console.log();

    // ===== SAMPLE DATA =====
    // In production, this would come from your database
    const sampleData: EvaluationData[] = generateSampleData(30);
    const ablationData: AblationData[] = generateAblationData();

    // ===== 1. DESCRIPTIVE STATISTICS =====
    console.log("1. DESCRIPTIVE STATISTICS / STATISTIK DESKRIPTIF");
    console.log("-".repeat(50));

    const ragFaithfulness = sampleData.map((d) => d.ragScores.faithfulness);
    const ragRelevancy = sampleData.map((d) => d.ragScores.answerRelevancy);
    const ragLatency = sampleData.map((d) => d.ragScores.latencyMs);

    const nonRagRelevancy = sampleData.map((d) => d.nonRagScores.answerRelevancy);
    const nonRagLatency = sampleData.map((d) => d.nonRagScores.latencyMs);

    console.log("\nRAG Faithfulness:");
    printDescriptiveStats(calculateDescriptiveStats(ragFaithfulness));

    console.log("\nRAG Answer Relevancy:");
    printDescriptiveStats(calculateDescriptiveStats(ragRelevancy));

    console.log("\nRAG Latency (ms):");
    printDescriptiveStats(calculateDescriptiveStats(ragLatency));

    // ===== 2. PAIRED T-TESTS (RAG vs Non-RAG) =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("2. PAIRED T-TESTS / UJI T BERPASANGAN");
    console.log("-".repeat(50));

    // Answer Relevancy comparison
    console.log("\n2.1 Answer Relevancy: RAG vs Non-RAG");
    const relevancyTest = pairedTTest(ragRelevancy, nonRagRelevancy);
    printTestResult(relevancyTest);

    // Latency comparison
    console.log("\n2.2 Latency: RAG vs Non-RAG");
    const latencyTest = pairedTTest(ragLatency, nonRagLatency);
    printTestResult(latencyTest);

    // ===== 3. CONFIDENCE INTERVALS =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("3. CONFIDENCE INTERVALS / INTERVAL KEPERCAYAAN");
    console.log("-".repeat(50));

    console.log("\n95% CI for RAG Faithfulness:");
    const faithCI = confidenceInterval(ragFaithfulness, 0.95);
    console.log(`  Mean: ${faithCI.mean.toFixed(4)}`);
    console.log(`  95% CI: [${faithCI.lower.toFixed(4)}, ${faithCI.upper.toFixed(4)}]`);
    console.log(`  Margin of Error: ±${faithCI.marginOfError.toFixed(4)}`);

    console.log("\nBootstrap 95% CI for RAG Faithfulness:");
    const bootstrapCI = bootstrapConfidenceInterval(ragFaithfulness, undefined, 0.95, 1000);
    console.log(`  Estimate: ${bootstrapCI.estimate.toFixed(4)}`);
    console.log(`  95% CI: [${bootstrapCI.lower.toFixed(4)}, ${bootstrapCI.upper.toFixed(4)}]`);

    // ===== 4. ONE-WAY ANOVA (ABLATION STUDY) =====
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
            console.log(`  ${test.testName}: q = ${test.statistic.toFixed(3)}, p = ${test.pValue.toFixed(4)} ${sig}`);
        }
    }

    // ===== 5. COMPREHENSIVE RAG COMPARISON =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("5. COMPREHENSIVE RAG vs NON-RAG COMPARISON");
    console.log("-".repeat(50));

    const comparisons: RAGComparisonResult[] = [
        compareRAGvsNonRAG(ragRelevancy, nonRagRelevancy, "Answer Relevancy", "Relevansi Jawaban"),
        compareRAGvsNonRAG(
            sampleData.map((d) => d.ragScores.answerCorrectness),
            sampleData.map((d) => d.nonRagScores.answerCorrectness),
            "Answer Correctness",
            "Kebenaran Jawaban"
        ),
        compareRAGvsNonRAG(
            sampleData.map((d) => 1 - d.ragScores.hallucinationRate),
            sampleData.map((d) => 1 - d.nonRagScores.hallucinationRate),
            "Factual Accuracy (1 - Hallucination)",
            "Akurasi Faktual (1 - Halusinasi)"
        ),
    ];

    for (const comp of comparisons) {
        console.log(`\n${comp.metric} / ${comp.metricId}:`);
        console.log(`  RAG Mean: ${comp.ragStats.mean.toFixed(4)} (SD: ${comp.ragStats.stdDev.toFixed(4)})`);
        console.log(`  Non-RAG Mean: ${comp.nonRagStats.mean.toFixed(4)} (SD: ${comp.nonRagStats.stdDev.toFixed(4)})`);
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

    // ===== 6. ABLATION STUDY ANALYSIS =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("6. ABLATION STUDY ANALYSIS / ANALISIS STUDI ABLASI");
    console.log("-".repeat(50));

    const ablationAnalysis = analyzeAblationStudy(
        ablationData.map((d) => ({
            name: d.configName,
            scores: d.scores.faithfulness,
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

    // ===== 8. GENERATE FULL REPORT =====
    console.log(`\n${"=".repeat(60)}`);
    console.log("8. GENERATING FULL REPORT / MEMBUAT LAPORAN LENGKAP");
    console.log("-".repeat(50));

    const fullReport = generateStatisticalReport(comparisons, ablationAnalysis, "en");
    const fullReportId = generateStatisticalReport(comparisons, ablationAnalysis, "id");

    console.log("\nEnglish Report Preview (first 500 chars):");
    console.log(`${fullReport.substring(0, 500)}...`);

    console.log("\nIndonesian Report Preview (first 500 chars):");
    console.log(`${fullReportId.substring(0, 500)}...`);

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

// Generate sample data for demonstration
function generateSampleData(n: number): EvaluationData[] {
    const data: EvaluationData[] = [];

    for (let i = 0; i < n; i++) {
        // RAG generally performs better than non-RAG
        const ragFaithfulness = 0.75 + Math.random() * 0.2; // 0.75-0.95
        const ragRelevancy = 0.7 + Math.random() * 0.25; // 0.70-0.95
        const ragPrecision = 0.65 + Math.random() * 0.3; // 0.65-0.95
        const ragCorrectness = 0.7 + Math.random() * 0.25; // 0.70-0.95
        const ragHallucination = 0.05 + Math.random() * 0.15; // 0.05-0.20 (lower is better)
        const ragLatency = 800 + Math.random() * 1200; // 800-2000ms

        const nonRagRelevancy = 0.5 + Math.random() * 0.3; // 0.50-0.80
        const nonRagCorrectness = 0.45 + Math.random() * 0.35; // 0.45-0.80
        const nonRagHallucination = 0.2 + Math.random() * 0.3; // 0.20-0.50 (higher)
        const nonRagLatency = 200 + Math.random() * 400; // 200-600ms (faster)

        data.push({
            questionId: `q_${i + 1}`,
            ragScores: {
                faithfulness: ragFaithfulness,
                answerRelevancy: ragRelevancy,
                contextPrecision: ragPrecision,
                answerCorrectness: ragCorrectness,
                hallucinationRate: ragHallucination,
                latencyMs: ragLatency,
            },
            nonRagScores: {
                answerRelevancy: nonRagRelevancy,
                answerCorrectness: nonRagCorrectness,
                hallucinationRate: nonRagHallucination,
                latencyMs: nonRagLatency,
            },
        });
    }

    return data;
}

function generateAblationData(): AblationData[] {
    const configs = [
        { name: "Baseline (No RAG)", faithBase: 0.45, latencyBase: 300 },
        { name: "Vector Only", faithBase: 0.65, latencyBase: 600 },
        { name: "BM25 Only", faithBase: 0.6, latencyBase: 500 },
        { name: "Hybrid (No Rerank)", faithBase: 0.72, latencyBase: 700 },
        { name: "Hybrid + Cross-Encoder", faithBase: 0.78, latencyBase: 900 },
        { name: "Hybrid + LLM Rerank", faithBase: 0.8, latencyBase: 1200 },
        { name: "Hybrid + Ensemble", faithBase: 0.82, latencyBase: 1100 },
        { name: "Agentic Mode", faithBase: 0.85, latencyBase: 2000 },
        { name: "Full System", faithBase: 0.88, latencyBase: 2500 },
        { name: "Indonesian Optimized", faithBase: 0.86, latencyBase: 2200 },
    ];

    return configs.map((config) => {
        const n = 20; // samples per config
        return {
            configName: config.name,
            scores: {
                faithfulness: Array.from({ length: n }, () =>
                    Math.max(0, Math.min(1, config.faithBase + (Math.random() - 0.5) * 0.15))
                ),
                answerRelevancy: Array.from({ length: n }, () =>
                    Math.max(0, Math.min(1, config.faithBase - 0.05 + (Math.random() - 0.5) * 0.15))
                ),
                latencyMs: Array.from({ length: n }, () =>
                    Math.max(100, config.latencyBase + (Math.random() - 0.5) * config.latencyBase * 0.4)
                ),
            },
        };
    });
}

// Run the analysis
runAnalysis().catch(console.error);
