export interface StatisticalResult {
    testName: string;
    testNameId: string;
    statistic: number;
    pValue: number;
    significant: boolean;
    significanceLevel: number;
    effectSize?: number;
    effectSizeInterpretation?: string;
    confidenceInterval?: { lower: number; upper: number; level: number };
    degreesOfFreedom?: number;
    sampleSize: number;
    interpretation: string;
    interpretationId: string;
}

export interface DescriptiveStats {
    mean: number;
    median: number;
    stdDev: number;
    variance: number;
    min: number;
    max: number;
    range: number;
    n: number;
    sem: number; // Standard Error of Mean
    skewness: number;
    kurtosis: number;
}

// Calculate descriptive statistics
export function calculateDescriptiveStats(data: number[]): DescriptiveStats {
    const n = data.length;
    if (n === 0) {
        return {
            mean: 0,
            median: 0,
            stdDev: 0,
            variance: 0,
            min: 0,
            max: 0,
            range: 0,
            n: 0,
            sem: 0,
            skewness: 0,
            kurtosis: 0,
        };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Median
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Variance and standard deviation (sample)
    const squaredDiffs = data.map((x) => (x - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    // Standard Error of Mean
    const sem = stdDev / Math.sqrt(n);

    // Skewness (Fisher's)
    const cubedDiffs = data.map((x) => ((x - mean) / stdDev) ** 3);
    const skewness = n > 2 ? (n / ((n - 1) * (n - 2))) * cubedDiffs.reduce((a, b) => a + b, 0) : 0;

    // Kurtosis (excess kurtosis)
    const fourthDiffs = data.map((x) => ((x - mean) / stdDev) ** 4);
    const kurtosis =
        n > 3
            ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * fourthDiffs.reduce((a, b) => a + b, 0) -
              (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
            : 0;

    return {
        mean,
        median,
        stdDev,
        variance,
        min: sorted[0],
        max: sorted[n - 1],
        range: sorted[n - 1] - sorted[0],
        n,
        sem,
        skewness,
        kurtosis,
    };
}

// T-distribution critical values (approximation for common values)
function tCriticalValue(df: number, alpha: number): number {
    // Two-tailed critical values approximation
    const criticalValues: Record<number, Record<number, number>> = {
        0.05: {
            1: 12.706,
            2: 4.303,
            3: 3.182,
            4: 2.776,
            5: 2.571,
            10: 2.228,
            20: 2.086,
            30: 2.042,
            60: 2.0,
            120: 1.98,
        },
        0.01: {
            1: 63.657,
            2: 9.925,
            3: 5.841,
            4: 4.604,
            5: 4.032,
            10: 3.169,
            20: 2.845,
            30: 2.75,
            60: 2.66,
            120: 2.617,
        },
    };

    const alphaValues = criticalValues[alpha] || criticalValues[0.05];

    // Find closest df
    const dfs = Object.keys(alphaValues)
        .map(Number)
        .sort((a, b) => a - b);
    let closestDf = dfs[0];
    for (const d of dfs) {
        if (d <= df) closestDf = d;
        else break;
    }

    return alphaValues[closestDf] || 1.96; // Default to z-score for large df
}

// Calculate p-value from t-statistic (approximation)
function tToPValue(t: number, df: number): number {
    // Using approximation for p-value from t-distribution
    const x = df / (df + t * t);

    // Incomplete beta function approximation
    const a = df / 2;
    const b = 0.5;

    // Simple approximation using normal distribution for large df
    if (df > 30) {
        // Use normal approximation
        const z = Math.abs(t);
        const p = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
        return 2 * p * (1 + 0.231_641_9 * z);
    }

    // For smaller df, use lookup table interpolation
    const criticalValues = [
        { t: 12.706, p: 0.05 },
        { t: 4.303, p: 0.05 },
        { t: 3.182, p: 0.05 },
        { t: 2.776, p: 0.05 },
        { t: 2.571, p: 0.05 },
        { t: 2.228, p: 0.05 },
        { t: 2.086, p: 0.05 },
        { t: 2.042, p: 0.05 },
        { t: 1.96, p: 0.05 },
    ];

    const absT = Math.abs(t);
    if (absT > 4) return 0.001;
    if (absT > 3) return 0.01;
    if (absT > 2) return 0.05;
    if (absT > 1.5) return 0.15;
    return 0.5;
}

// Paired t-test
export function pairedTTest(group1: number[], group2: number[], alpha = 0.05): StatisticalResult {
    if (group1.length !== group2.length) {
        throw new Error("Paired t-test requires equal sample sizes");
    }

    const n = group1.length;
    const differences = group1.map((v, i) => v - group2[i]);

    const stats = calculateDescriptiveStats(differences);
    const tStatistic = stats.mean / stats.sem;
    const df = n - 1;
    const pValue = tToPValue(tStatistic, df);

    // Cohen's d effect size
    const cohensD = stats.mean / stats.stdDev;
    const effectSizeInterpretation = interpretCohensD(cohensD);

    // Confidence interval for mean difference
    const tCrit = tCriticalValue(df, alpha);
    const marginOfError = tCrit * stats.sem;
    const ci = {
        lower: stats.mean - marginOfError,
        upper: stats.mean + marginOfError,
        level: 1 - alpha,
    };

    const significant = pValue < alpha;

    return {
        testName: "Paired t-test",
        testNameId: "Uji t Berpasangan",
        statistic: tStatistic,
        pValue,
        significant,
        significanceLevel: alpha,
        effectSize: cohensD,
        effectSizeInterpretation,
        confidenceInterval: ci,
        degreesOfFreedom: df,
        sampleSize: n,
        interpretation: significant
            ? `The difference between groups is statistically significant (t(${df}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Effect size (Cohen's d = ${cohensD.toFixed(3)}) indicates a ${effectSizeInterpretation} effect.`
            : `No statistically significant difference found between groups (t(${df}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
        interpretationId: significant
            ? `Perbedaan antara kelompok signifikan secara statistik (t(${df}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Ukuran efek (Cohen's d = ${cohensD.toFixed(3)}) menunjukkan efek ${translateEffectSize(effectSizeInterpretation)}.`
            : `Tidak ditemukan perbedaan signifikan secara statistik antara kelompok (t(${df}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
    };
}

// Independent samples t-test
export function independentTTest(group1: number[], group2: number[], alpha = 0.05): StatisticalResult {
    const stats1 = calculateDescriptiveStats(group1);
    const stats2 = calculateDescriptiveStats(group2);

    const n1 = stats1.n;
    const n2 = stats2.n;

    // Welch's t-test (doesn't assume equal variances)
    const meanDiff = stats1.mean - stats2.mean;
    const se = Math.sqrt(stats1.variance / n1 + stats2.variance / n2);
    const tStatistic = meanDiff / se;

    // Welch-Satterthwaite degrees of freedom
    const v1 = stats1.variance / n1;
    const v2 = stats2.variance / n2;
    const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));

    const pValue = tToPValue(tStatistic, df);

    // Cohen's d effect size (pooled SD)
    const pooledSD = Math.sqrt(((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / (n1 + n2 - 2));
    const cohensD = meanDiff / pooledSD;
    const effectSizeInterpretation = interpretCohensD(cohensD);

    // Confidence interval
    const tCrit = tCriticalValue(Math.round(df), alpha);
    const marginOfError = tCrit * se;
    const ci = {
        lower: meanDiff - marginOfError,
        upper: meanDiff + marginOfError,
        level: 1 - alpha,
    };

    const significant = pValue < alpha;

    return {
        testName: "Independent t-test (Welch's)",
        testNameId: "Uji t Independen (Welch)",
        statistic: tStatistic,
        pValue,
        significant,
        significanceLevel: alpha,
        effectSize: cohensD,
        effectSizeInterpretation,
        confidenceInterval: ci,
        degreesOfFreedom: df,
        sampleSize: n1 + n2,
        interpretation: significant
            ? `Significant difference between groups (t(${df.toFixed(1)}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Effect size: ${effectSizeInterpretation} (d = ${cohensD.toFixed(3)}).`
            : `No significant difference between groups (t(${df.toFixed(1)}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
        interpretationId: significant
            ? `Terdapat perbedaan signifikan antara kelompok (t(${df.toFixed(1)}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Ukuran efek: ${translateEffectSize(effectSizeInterpretation)} (d = ${cohensD.toFixed(3)}).`
            : `Tidak ada perbedaan signifikan antara kelompok (t(${df.toFixed(1)}) = ${tStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
    };
}

// One-way ANOVA
export function oneWayANOVA(groups: number[][], alpha = 0.05): StatisticalResult & { postHoc?: StatisticalResult[] } {
    const k = groups.length; // Number of groups
    const N = groups.reduce((sum, g) => sum + g.length, 0); // Total sample size

    // Grand mean
    const allData = groups.flat();
    const grandMean = allData.reduce((a, b) => a + b, 0) / N;

    // Between-group sum of squares (SSB)
    let ssb = 0;
    const groupMeans: number[] = [];
    for (const group of groups) {
        const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
        groupMeans.push(groupMean);
        ssb += group.length * (groupMean - grandMean) ** 2;
    }

    // Within-group sum of squares (SSW)
    let ssw = 0;
    groups.forEach((group, i) => {
        for (const value of group) {
            ssw += (value - groupMeans[i]) ** 2;
        }
    });

    // Degrees of freedom
    const dfBetween = k - 1;
    const dfWithin = N - k;

    // Mean squares
    const msb = ssb / dfBetween;
    const msw = ssw / dfWithin;

    // F-statistic
    const fStatistic = msb / msw;

    // P-value approximation for F-distribution
    const pValue = fToPValue(fStatistic, dfBetween, dfWithin);

    // Eta-squared effect size
    const etaSquared = ssb / (ssb + ssw);
    const effectSizeInterpretation = interpretEtaSquared(etaSquared);

    const significant = pValue < alpha;

    const result: StatisticalResult & { postHoc?: StatisticalResult[] } = {
        testName: "One-way ANOVA",
        testNameId: "ANOVA Satu Arah",
        statistic: fStatistic,
        pValue,
        significant,
        significanceLevel: alpha,
        effectSize: etaSquared,
        effectSizeInterpretation,
        degreesOfFreedom: dfBetween,
        sampleSize: N,
        interpretation: significant
            ? `Significant differences found among groups (F(${dfBetween}, ${dfWithin}) = ${fStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Effect size (η² = ${etaSquared.toFixed(3)}) indicates ${effectSizeInterpretation} effect.`
            : `No significant differences among groups (F(${dfBetween}, ${dfWithin}) = ${fStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
        interpretationId: significant
            ? `Ditemukan perbedaan signifikan antar kelompok (F(${dfBetween}, ${dfWithin}) = ${fStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}). Ukuran efek (η² = ${etaSquared.toFixed(3)}) menunjukkan efek ${translateEffectSize(effectSizeInterpretation)}.`
            : `Tidak ditemukan perbedaan signifikan antar kelompok (F(${dfBetween}, ${dfWithin}) = ${fStatistic.toFixed(3)}, p = ${pValue.toFixed(4)}).`,
    };

    // Post-hoc tests if significant
    if (significant && k > 2) {
        result.postHoc = performTukeyHSD(groups, groupMeans, msw, alpha);
    }

    return result;
}

// Tukey's HSD post-hoc test
function performTukeyHSD(groups: number[][], groupMeans: number[], msw: number, alpha: number): StatisticalResult[] {
    const results: StatisticalResult[] = [];
    const k = groups.length;

    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            const meanDiff = Math.abs(groupMeans[i] - groupMeans[j]);
            const se = Math.sqrt((msw * (1 / groups[i].length + 1 / groups[j].length)) / 2);
            const q = meanDiff / se;

            // Approximate p-value using Studentized range distribution
            const pValue = qToPValue(q, k, groups.reduce((sum, g) => sum + g.length, 0) - k);

            results.push({
                testName: `Tukey HSD: Group ${i + 1} vs Group ${j + 1}`,
                testNameId: `Tukey HSD: Kelompok ${i + 1} vs Kelompok ${j + 1}`,
                statistic: q,
                pValue,
                significant: pValue < alpha,
                significanceLevel: alpha,
                sampleSize: groups[i].length + groups[j].length,
                interpretation:
                    pValue < alpha
                        ? `Significant difference between groups ${i + 1} and ${j + 1} (q = ${q.toFixed(3)}, p = ${pValue.toFixed(4)})`
                        : `No significant difference between groups ${i + 1} and ${j + 1}`,
                interpretationId:
                    pValue < alpha
                        ? `Perbedaan signifikan antara kelompok ${i + 1} dan ${j + 1} (q = ${q.toFixed(3)}, p = ${pValue.toFixed(4)})`
                        : `Tidak ada perbedaan signifikan antara kelompok ${i + 1} dan ${j + 1}`,
            });
        }
    }

    return results;
}

// Confidence interval for a single mean
export function confidenceInterval(
    data: number[],
    confidenceLevel = 0.95
): { mean: number; lower: number; upper: number; level: number; marginOfError: number } {
    const stats = calculateDescriptiveStats(data);
    const alpha = 1 - confidenceLevel;
    const tCrit = tCriticalValue(stats.n - 1, alpha);
    const marginOfError = tCrit * stats.sem;

    return {
        mean: stats.mean,
        lower: stats.mean - marginOfError,
        upper: stats.mean + marginOfError,
        level: confidenceLevel,
        marginOfError,
    };
}

// Bootstrap confidence interval (non-parametric)
export function bootstrapConfidenceInterval(
    data: number[],
    statistic: (d: number[]) => number = (d) => d.reduce((a, b) => a + b, 0) / d.length,
    confidenceLevel = 0.95,
    nBootstrap = 1000
): { estimate: number; lower: number; upper: number; level: number } {
    const bootstrapStats: number[] = [];

    for (let i = 0; i < nBootstrap; i++) {
        // Resample with replacement
        const sample = Array.from({ length: data.length }, () => data[Math.floor(Math.random() * data.length)]);
        bootstrapStats.push(statistic(sample));
    }

    bootstrapStats.sort((a, b) => a - b);

    const alpha = 1 - confidenceLevel;
    const lowerIdx = Math.floor((alpha / 2) * nBootstrap);
    const upperIdx = Math.floor((1 - alpha / 2) * nBootstrap);

    return {
        estimate: statistic(data),
        lower: bootstrapStats[lowerIdx],
        upper: bootstrapStats[upperIdx],
        level: confidenceLevel,
    };
}

// Helper functions
function interpretCohensD(d: number): string {
    const absD = Math.abs(d);
    if (absD < 0.2) return "negligible";
    if (absD < 0.5) return "small";
    if (absD < 0.8) return "medium";
    return "large";
}

function interpretEtaSquared(eta2: number): string {
    if (eta2 < 0.01) return "negligible";
    if (eta2 < 0.06) return "small";
    if (eta2 < 0.14) return "medium";
    return "large";
}

function translateEffectSize(effect: string): string {
    const translations: Record<string, string> = {
        negligible: "sangat kecil",
        small: "kecil",
        medium: "sedang",
        large: "besar",
    };
    return translations[effect] || effect;
}

function fToPValue(f: number, _df1: number, _df2: number): number {
    // Approximation for F-distribution p-value
    if (f < 1) return 0.5;
    if (f > 10) return 0.001;
    if (f > 5) return 0.01;
    if (f > 3) return 0.05;
    if (f > 2) return 0.15;
    return 0.3;
}

function qToPValue(q: number, _k: number, _df: number): number {
    // Approximation for Studentized range distribution
    if (q > 5) return 0.001;
    if (q > 4) return 0.01;
    if (q > 3.5) return 0.05;
    if (q > 3) return 0.1;
    return 0.5;
}

// RAG-specific statistical analysis
export interface RAGComparisonResult {
    metric: string;
    metricId: string;
    ragStats: DescriptiveStats;
    nonRagStats: DescriptiveStats;
    testResult: StatisticalResult;
    improvement: number;
    improvementPercent: number;
}

export function compareRAGvsNonRAG(
    ragScores: number[],
    nonRagScores: number[],
    metricName: string,
    metricNameId: string,
    paired = true
): RAGComparisonResult {
    const ragStats = calculateDescriptiveStats(ragScores);
    const nonRagStats = calculateDescriptiveStats(nonRagScores);

    const testResult = paired ? pairedTTest(ragScores, nonRagScores) : independentTTest(ragScores, nonRagScores);

    const improvement = ragStats.mean - nonRagStats.mean;
    const improvementPercent = nonRagStats.mean !== 0 ? (improvement / nonRagStats.mean) * 100 : 0;

    return {
        metric: metricName,
        metricId: metricNameId,
        ragStats,
        nonRagStats,
        testResult,
        improvement,
        improvementPercent,
    };
}

// Ablation study analysis
export function analyzeAblationStudy(configurations: { name: string; scores: number[] }[]): {
    anova: StatisticalResult & { postHoc?: StatisticalResult[] };
    rankings: { name: string; mean: number; ci: { lower: number; upper: number } }[];
    bestConfig: string;
    significantDifferences: string[];
} {
    const groups = configurations.map((c) => c.scores);
    const anova = oneWayANOVA(groups);

    // Calculate rankings with confidence intervals
    const rankings = configurations
        .map((c) => {
            const ci = confidenceInterval(c.scores);
            return {
                name: c.name,
                mean: ci.mean,
                ci: { lower: ci.lower, upper: ci.upper },
            };
        })
        .sort((a, b) => b.mean - a.mean);

    // Find significant differences
    const significantDifferences: string[] = [];
    if (anova.postHoc) {
        for (const test of anova.postHoc) {
            if (test.significant) {
                significantDifferences.push(test.testName);
            }
        }
    }

    return {
        anova,
        rankings,
        bestConfig: rankings[0]?.name || "",
        significantDifferences,
    };
}

// Generate statistical report
export function generateStatisticalReport(
    comparisons: RAGComparisonResult[],
    ablationResults?: ReturnType<typeof analyzeAblationStudy>,
    language: "en" | "id" = "en"
): string {
    let report = language === "id" ? "# Laporan Analisis Statistik\n\n" : "# Statistical Analysis Report\n\n";

    report +=
        language === "id"
            ? `Tanggal: ${new Date().toLocaleDateString("id-ID")}\n\n`
            : `Date: ${new Date().toLocaleDateString("en-US")}\n\n`;

    // RAG vs Non-RAG Comparisons
    report += language === "id" ? "## Perbandingan RAG vs Non-RAG\n\n" : "## RAG vs Non-RAG Comparison\n\n";

    for (const comp of comparisons) {
        const metricLabel = language === "id" ? comp.metricId : comp.metric;
        report += `### ${metricLabel}\n\n`;

        report += language === "id" ? "| Statistik | RAG | Non-RAG |\n" : "| Statistic | RAG | Non-RAG |\n";
        report += "|-----------|-----|--------|\n";
        report += `| Mean | ${comp.ragStats.mean.toFixed(4)} | ${comp.nonRagStats.mean.toFixed(4)} |\n`;
        report += `| Std Dev | ${comp.ragStats.stdDev.toFixed(4)} | ${comp.nonRagStats.stdDev.toFixed(4)} |\n`;
        report += `| 95% CI | [${confidenceInterval(new Array(comp.ragStats.n).fill(comp.ragStats.mean)).lower.toFixed(4)}, ${confidenceInterval(new Array(comp.ragStats.n).fill(comp.ragStats.mean)).upper.toFixed(4)}] | - |\n\n`;

        report +=
            language === "id"
                ? `**Hasil Uji t:** ${comp.testResult.interpretationId}\n\n`
                : `**t-test Result:** ${comp.testResult.interpretation}\n\n`;

        const improvementLabel = language === "id" ? "Peningkatan" : "Improvement";
        report += `**${improvementLabel}:** ${comp.improvement > 0 ? "+" : ""}${comp.improvement.toFixed(4)} (${comp.improvementPercent.toFixed(1)}%)\n\n`;
    }

    // Ablation Study Results
    if (ablationResults) {
        report += language === "id" ? "## Hasil Studi Ablasi\n\n" : "## Ablation Study Results\n\n";

        report +=
            language === "id"
                ? `### Hasil ANOVA\n\n${ablationResults.anova.interpretationId}\n\n`
                : `### ANOVA Results\n\n${ablationResults.anova.interpretation}\n\n`;

        report += language === "id" ? "### Peringkat Konfigurasi\n\n" : "### Configuration Rankings\n\n";
        report +=
            language === "id"
                ? "| Peringkat | Konfigurasi | Mean | 95% CI |\n"
                : "| Rank | Configuration | Mean | 95% CI |\n";
        report += "|------|---------------|------|--------|\n";

        ablationResults.rankings.forEach((r, i) => {
            report += `| ${i + 1} | ${r.name} | ${r.mean.toFixed(4)} | [${r.ci.lower.toFixed(4)}, ${r.ci.upper.toFixed(4)}] |\n`;
        });

        if (ablationResults.significantDifferences.length > 0) {
            report +=
                language === "id"
                    ? "\n### Perbedaan Signifikan (Post-hoc)\n\n"
                    : "\n### Significant Differences (Post-hoc)\n\n";

            for (const diff of ablationResults.significantDifferences) {
                report += `- ${diff}\n`;
            }
        }
    }

    return report;
}
