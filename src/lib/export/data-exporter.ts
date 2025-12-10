/**
 * @fileoverview Data Export Utility for Statistical Analysis
 *
 * WHY This Module:
 * - Bridges gap between RAG evaluation and statistical analysis tools
 * - Supports multiple research workflows (R, Python, SPSS)
 * - Generates bilingual variable labels (English/Indonesian)
 * - Includes ready-to-use analysis scripts
 *
 * Supported Formats:
 * - CSV: Universal compatibility, Excel, pandas, R
 * - JSON: Programmatic access, web applications, metadata preservation
 * - SPSS: Social science research standard (generates .sps syntax file)
 * - Python: Complete analysis script with scipy, pandas, matplotlib
 * - R: Script with ggplot2 visualizations and statistical tests
 *
 * WHY Generate Analysis Scripts:
 * - Reduces barrier to entry for researchers
 * - Ensures correct statistical methods (paired t-tests, effect sizes)
 * - Provides reproducible analysis workflow
 * - Includes visualizations for publication
 */

export interface ExportOptions {
    format: "csv" | "json" | "spss" | "python" | "r" | "excel";
    includeMetadata: boolean;
    language: "id";
    decimalPlaces: number;
    missingValueCode: string | number;
}

export interface RawEvaluationData {
    questionId: string;
    question: string;
    groundTruth: string;
    ragAnswer: string | null;
    nonRagAnswer: string | null;
    retrievedContexts: string[];
    // RAGAS Metrics
    ragFaithfulness: number | null;
    ragAnswerRelevancy: number | null;
    ragContextPrecision: number | null;
    ragContextRecall: number | null;
    ragAnswerCorrectness: number | null;
    nonRagAnswerRelevancy: number | null;
    nonRagAnswerCorrectness: number | null;
    // Domain-specific
    ragAcademicRigor: number | null;
    ragCitationAccuracy: number | null;
    ragTerminologyCorrectness: number | null;
    // Hallucination
    ragHallucinationRate: number | null;
    ragFactualConsistency: number | null;
    ragSourceAttribution: number | null;
    ragContradictionScore: number | null;
    nonRagHallucinationRate: number | null;
    // Retrieval Quality
    retrievalNdcg: number | null;
    retrievalMrr: number | null;
    retrievalPrecision: number | null;
    // Latency (ms)
    ragLatencyMs: number | null;
    nonRagLatencyMs: number | null;
    ragRetrievalLatencyMs: number | null;
    ragRerankingLatencyMs: number | null;
    ragGenerationLatencyMs: number | null;
    ragAgentReasoningLatencyMs: number | null;
    ragToolCallLatencyMs: number | null;
    ragTokensPerSecond: number | null;
    // Configuration
    retrievalMethod: string | null;
    rerankerStrategy: string | null;
    agentStepsUsed: number | null;
    guardrailsTriggered: number | null;
}

export interface AblationRawData {
    configurationName: string;
    useRag: boolean;
    useReranker: boolean;
    rerankerStrategy: string | null;
    retrievalStrategy: string;
    chunkingStrategy: string;
    useAgenticMode: boolean;
    useGuardrails: boolean;
    topK: number;
    // Aggregated metrics
    avgFaithfulness: number | null;
    avgAnswerRelevancy: number | null;
    avgContextPrecision: number | null;
    avgContextRecall: number | null;
    avgAnswerCorrectness: number | null;
    avgHallucinationRate: number | null;
    avgLatencyMs: number | null;
    avgTokensPerSecond: number | null;
}

// Variable labels for SPSS
const VARIABLE_LABELS: Record<string, { en: string; id: string }> = {
    questionId: { en: "Question ID", id: "ID Pertanyaan" },
    question: { en: "Question Text", id: "Teks Pertanyaan" },
    groundTruth: { en: "Ground Truth Answer", id: "Jawaban Referensi" },
    ragAnswer: { en: "RAG System Answer", id: "Jawaban Sistem RAG" },
    nonRagAnswer: { en: "Non-RAG System Answer", id: "Jawaban Sistem Non-RAG" },
    ragFaithfulness: { en: "RAG Faithfulness Score (0-1)", id: "Skor Kesetiaan RAG (0-1)" },
    ragAnswerRelevancy: { en: "RAG Answer Relevancy Score (0-1)", id: "Skor Relevansi Jawaban RAG (0-1)" },
    ragContextPrecision: { en: "RAG Context Precision Score (0-1)", id: "Skor Presisi Konteks RAG (0-1)" },
    ragContextRecall: { en: "RAG Context Recall Score (0-1)", id: "Skor Recall Konteks RAG (0-1)" },
    ragAnswerCorrectness: { en: "RAG Answer Correctness Score (0-1)", id: "Skor Kebenaran Jawaban RAG (0-1)" },
    nonRagAnswerRelevancy: { en: "Non-RAG Answer Relevancy Score (0-1)", id: "Skor Relevansi Jawaban Non-RAG (0-1)" },
    nonRagAnswerCorrectness: {
        en: "Non-RAG Answer Correctness Score (0-1)",
        id: "Skor Kebenaran Jawaban Non-RAG (0-1)",
    },
    ragAcademicRigor: { en: "RAG Academic Rigor Score (0-1)", id: "Skor Rigor Akademik RAG (0-1)" },
    ragCitationAccuracy: { en: "RAG Citation Accuracy Score (0-1)", id: "Skor Akurasi Sitasi RAG (0-1)" },
    ragTerminologyCorrectness: {
        en: "RAG Terminology Correctness Score (0-1)",
        id: "Skor Ketepatan Terminologi RAG (0-1)",
    },
    ragHallucinationRate: {
        en: "RAG Hallucination Rate (0-1, lower is better)",
        id: "Tingkat Halusinasi RAG (0-1, lebih rendah lebih baik)",
    },
    ragFactualConsistency: { en: "RAG Factual Consistency Score (0-1)", id: "Skor Konsistensi Faktual RAG (0-1)" },
    ragSourceAttribution: { en: "RAG Source Attribution Score (0-1)", id: "Skor Atribusi Sumber RAG (0-1)" },
    ragContradictionScore: {
        en: "RAG Contradiction Score (0-1, lower is better)",
        id: "Skor Kontradiksi RAG (0-1, lebih rendah lebih baik)",
    },
    nonRagHallucinationRate: { en: "Non-RAG Hallucination Rate (0-1)", id: "Tingkat Halusinasi Non-RAG (0-1)" },
    retrievalNdcg: { en: "Retrieval NDCG Score (0-1)", id: "Skor NDCG Retrieval (0-1)" },
    retrievalMrr: { en: "Retrieval MRR Score (0-1)", id: "Skor MRR Retrieval (0-1)" },
    retrievalPrecision: { en: "Retrieval Precision Score (0-1)", id: "Skor Presisi Retrieval (0-1)" },
    ragLatencyMs: { en: "RAG Total Latency (ms)", id: "Latensi Total RAG (ms)" },
    nonRagLatencyMs: { en: "Non-RAG Total Latency (ms)", id: "Latensi Total Non-RAG (ms)" },
    ragRetrievalLatencyMs: { en: "RAG Retrieval Latency (ms)", id: "Latensi Retrieval RAG (ms)" },
    ragRerankingLatencyMs: { en: "RAG Reranking Latency (ms)", id: "Latensi Reranking RAG (ms)" },
    ragGenerationLatencyMs: { en: "RAG Generation Latency (ms)", id: "Latensi Generasi RAG (ms)" },
    ragAgentReasoningLatencyMs: { en: "RAG Agent Reasoning Latency (ms)", id: "Latensi Penalaran Agen RAG (ms)" },
    ragToolCallLatencyMs: { en: "RAG Tool Call Latency (ms)", id: "Latensi Panggilan Tool RAG (ms)" },
    ragTokensPerSecond: { en: "RAG Tokens per Second", id: "Token per Detik RAG" },
    retrievalMethod: { en: "Retrieval Method", id: "Metode Retrieval" },
    rerankerStrategy: { en: "Reranker Strategy", id: "Strategi Reranker" },
    agentStepsUsed: { en: "Agent Steps Used", id: "Langkah Agen Digunakan" },
    guardrailsTriggered: { en: "Guardrails Triggered Count", id: "Jumlah Guardrails Terpicu" },
};

// SPSS variable types
const VARIABLE_TYPES: Record<string, "numeric" | "string"> = {
    questionId: "string",
    question: "string",
    groundTruth: "string",
    ragAnswer: "string",
    nonRagAnswer: "string",
    retrievalMethod: "string",
    rerankerStrategy: "string",
};

/**
 * Export evaluation data to CSV format
 *
 * WHY CSV:
 * - Universal compatibility with Excel, R, Python pandas, SPSS
 * - Human-readable for manual inspection
 * - Small file size for large datasets
 *
 * Features:
 * - Proper escaping for commas and quotes in text fields
 * - Configurable decimal precision for metrics
 * - Missing value handling
 *
 * @param data - Evaluation data or ablation results
 * @param options - Export configuration
 * @returns CSV string with headers
 */
export function exportToCSV(
    data: RawEvaluationData[] | AblationRawData[],
    options: Partial<ExportOptions> = {}
): string {
    const opts: ExportOptions = {
        format: "csv",
        includeMetadata: true,
        language: "id",
        decimalPlaces: 4,
        missingValueCode: "",
        ...options,
    };

    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const rows: string[] = [];

    // Header row
    rows.push(headers.join(","));

    // Data rows
    for (const row of data) {
        const values = headers.map((header) => {
            const value = (row as unknown as Record<string, unknown>)[header];
            if (value === null || value === undefined) {
                return opts.missingValueCode.toString();
            }
            if (typeof value === "number") {
                return value.toFixed(opts.decimalPlaces);
            }
            if (typeof value === "string") {
                // Escape quotes and wrap in quotes if contains comma
                const escaped = value.replace(/"/g, '""');
                return escaped.includes(",") || escaped.includes("\n") ? `"${escaped}"` : escaped;
            }
            if (Array.isArray(value)) {
                return `"${value.join("; ")}"`;
            }
            return String(value);
        });
        rows.push(values.join(","));
    }

    return rows.join("\n");
}

export function exportToJSON(
    data: RawEvaluationData[] | AblationRawData[],
    options: Partial<ExportOptions> = {}
): string {
    const opts: ExportOptions = {
        format: "json",
        includeMetadata: true,
        language: "id",
        decimalPlaces: 4,
        missingValueCode: null as unknown as string,
        ...options,
    };

    const output: Record<string, unknown> = {
        exportDate: new Date().toISOString(),
        totalRecords: data.length,
        language: opts.language,
    };

    if (opts.includeMetadata && data.length > 0) {
        output.variableLabels = Object.fromEntries(
            Object.keys(data[0]).map((key) => [key, VARIABLE_LABELS[key] || key])
        );
    }

    output.data = data;

    return JSON.stringify(output, null, 2);
}

/**
 * Generate SPSS Syntax file (.sps) for importing CSV data
 * This creates the syntax needed to properly label variables in SPSS
 */
export function generateSPSSSyntax(
    data: RawEvaluationData[] | AblationRawData[],
    csvFileName: string,
    options: Partial<ExportOptions> = {}
): string {
    const opts: ExportOptions = {
        format: "spss",
        includeMetadata: true,
        language: "id",
        decimalPlaces: 4,
        missingValueCode: -999,
        ...options,
    };

    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const lines: string[] = [];

    // Header comment
    lines.push("* SPSS Syntax for Academic RAG Evaluation Data.");
    lines.push(`* Generated: ${new Date().toISOString()}`);
    lines.push("* Language: Bahasa Indonesia");
    lines.push("");

    // GET DATA command
    lines.push("GET DATA /TYPE=TXT");
    lines.push(`  /FILE="${csvFileName}"`);
    lines.push("  /DELCASE=LINE");
    lines.push(`  /DELIMITERS=","`);
    lines.push(`  /QUALIFIER='"'`);
    lines.push("  /ARRANGEMENT=DELIMITED");
    lines.push("  /FIRSTCASE=2");
    lines.push("  /VARIABLES=");

    // Variable definitions
    for (const header of headers) {
        const varType = VARIABLE_TYPES[header] || "numeric";
        if (varType === "string") {
            lines.push(`    ${header} A255`);
        } else {
            lines.push(`    ${header} F10.${opts.decimalPlaces}`);
        }
    }
    lines.push(".");
    lines.push("");

    // Variable labels
    lines.push("VARIABLE LABELS");
    for (const header of headers) {
        const label = VARIABLE_LABELS[header] || header;
        lines.push(`  ${header} "${label}"`);
    }
    lines.push(".");
    lines.push("");

    // Missing values
    const numericVars = headers.filter((h) => VARIABLE_TYPES[h] !== "string");
    if (numericVars.length > 0) {
        lines.push(`MISSING VALUES ${numericVars.join(" ")} (${opts.missingValueCode}).`);
        lines.push("");
    }

    // Value labels for categorical variables
    lines.push("VALUE LABELS");
    lines.push("  retrievalMethod");
    lines.push('    "vector" "Vector Search"');
    lines.push('    "keyword" "Keyword Search (BM25)"');
    lines.push('    "hybrid" "Hybrid (Vector + BM25)"');
    lines.push("  /rerankerStrategy");
    lines.push('    "cross_encoder" "Cross-Encoder"');
    lines.push('    "llm" "LLM-based"');
    lines.push('    "cohere" "Cohere Pairwise"');
    lines.push('    "ensemble" "Ensemble"');
    lines.push(".");
    lines.push("");

    // Descriptive statistics
    lines.push("* Descriptive Statistics.");
    lines.push(`DESCRIPTIVES VARIABLES=${numericVars.slice(0, 20).join(" ")}`);
    lines.push("  /STATISTICS=MEAN STDDEV MIN MAX.");
    lines.push("");

    // Paired t-test for RAG vs Non-RAG
    lines.push("* Paired Samples T-Test: RAG vs Non-RAG.");
    lines.push("T-TEST PAIRS=ragAnswerCorrectness WITH nonRagAnswerCorrectness (PAIRED)");
    lines.push("  /CRITERIA=CI(.95).");
    lines.push("");

    lines.push("T-TEST PAIRS=ragHallucinationRate WITH nonRagHallucinationRate (PAIRED)");
    lines.push("  /CRITERIA=CI(.95).");
    lines.push("");

    // Correlation matrix
    lines.push("* Correlation Matrix for Key Metrics.");
    lines.push("CORRELATIONS");
    lines.push(
        "  /VARIABLES=ragFaithfulness ragAnswerRelevancy ragContextPrecision ragContextRecall ragAnswerCorrectness"
    );
    lines.push("  /PRINT=TWOTAIL NOSIG");
    lines.push("  /MISSING=PAIRWISE.");
    lines.push("");

    // Reliability analysis
    lines.push("* Reliability Analysis (Cronbach Alpha) for RAGAS metrics.");
    lines.push("RELIABILITY");
    lines.push(
        "  /VARIABLES=ragFaithfulness ragAnswerRelevancy ragContextPrecision ragContextRecall ragAnswerCorrectness"
    );
    lines.push("  /SCALE('RAGAS Metrics') ALL");
    lines.push("  /MODEL=ALPHA.");
    lines.push("");

    return lines.join("\n");
}

/**
 * Generate Python script for statistical analysis
 */
export function generatePythonScript(_options: Partial<ExportOptions> = {}): string {
    const comments = {
        title: "Script Analisis Statistik untuk Evaluasi RAG",
        imports: "Import library yang diperlukan",
        loadData: "Muat data dari CSV",
        descriptive: "Statistik Deskriptif",
        pairedTTest: "Paired T-Test: RAG vs Non-RAG",
        anova: "ANOVA untuk perbandingan strategi retrieval",
        correlation: "Matriks Korelasi",
        visualization: "Visualisasi",
        effectSize: "Hitung Effect Size (Cohen's d)",
        confidence: "Confidence Interval Bootstrap",
        export: "Ekspor hasil ke format akademik",
    };

    return `#!/usr/bin/env python3
"""
${comments.title}
Generated: ${new Date().toISOString()}
"""

# ${comments.imports}
import pandas as pd
import numpy as np
from scipy import stats
from scipy.stats import ttest_rel, ttest_ind, f_oneway, pearsonr, spearmanr
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Tuple, Dict, List
import warnings
warnings.filterwarnings('ignore')

# Konfigurasi visualisasi / Visualization config
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 12

# ============================================
# ${comments.loadData}
# ============================================

def load_evaluation_data(filepath: str) -> pd.DataFrame:
    """Load and preprocess evaluation data from CSV."""
    df = pd.read_csv(filepath)

    # Convert numeric columns
    numeric_cols = [
        'ragFaithfulness', 'ragAnswerRelevancy', 'ragContextPrecision',
        'ragContextRecall', 'ragAnswerCorrectness', 'nonRagAnswerRelevancy',
        'nonRagAnswerCorrectness', 'ragAcademicRigor', 'ragCitationAccuracy',
        'ragTerminologyCorrectness', 'ragHallucinationRate', 'ragFactualConsistency',
        'ragSourceAttribution', 'ragContradictionScore', 'nonRagHallucinationRate',
        'retrievalNdcg', 'retrievalMrr', 'retrievalPrecision',
        'ragLatencyMs', 'nonRagLatencyMs', 'ragRetrievalLatencyMs',
        'ragRerankingLatencyMs', 'ragGenerationLatencyMs', 'ragAgentReasoningLatencyMs',
        'ragToolCallLatencyMs', 'ragTokensPerSecond'
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return df

# ============================================
# ${comments.effectSize}
# ============================================

def cohens_d(group1: np.ndarray, group2: np.ndarray) -> Tuple[float, str]:
    """
    Calculate Cohen's d effect size for paired samples.

    Returns:
        Tuple of (effect_size, interpretation)
    """
    n1, n2 = len(group1), len(group2)
    var1, var2 = group1.var(), group2.var()

    # Pooled standard deviation
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))

    d = (group1.mean() - group2.mean()) / pooled_std if pooled_std > 0 else 0

    # Interpretation
    abs_d = abs(d)
    if abs_d < 0.2:
        interpretation = "dapat diabaikan"
    elif abs_d < 0.5:
        interpretation = "kecil"
    elif abs_d < 0.8:
        interpretation = "sedang"
    else:
        interpretation = "besar"

    return d, interpretation

def eta_squared(f_stat: float, df_between: int, df_within: int) -> Tuple[float, str]:
    """Calculate eta-squared effect size for ANOVA."""
    ss_between = f_stat * df_between
    ss_total = ss_between + df_within
    eta_sq = ss_between / ss_total if ss_total > 0 else 0

    if eta_sq < 0.01:
        interpretation = "dapat diabaikan"
    elif eta_sq < 0.06:
        interpretation = "kecil"
    elif eta_sq < 0.14:
        interpretation = "sedang"
    else:
        interpretation = "besar"

    return eta_sq, interpretation

# ============================================
# ${comments.confidence}
# ============================================

def bootstrap_ci(data: np.ndarray, n_bootstrap: int = 10000,
                 confidence: float = 0.95) -> Tuple[float, float, float]:
    """
    Calculate bootstrap confidence interval for the mean.

    Returns:
        Tuple of (mean, ci_lower, ci_upper)
    """
    data = data[~np.isnan(data)]
    if len(data) == 0:
        return np.nan, np.nan, np.nan

    bootstrap_means = []
    for _ in range(n_bootstrap):
        sample = np.random.choice(data, size=len(data), replace=True)
        bootstrap_means.append(sample.mean())

    alpha = 1 - confidence
    ci_lower = np.percentile(bootstrap_means, alpha / 2 * 100)
    ci_upper = np.percentile(bootstrap_means, (1 - alpha / 2) * 100)

    return data.mean(), ci_lower, ci_upper

# ============================================
# ${comments.pairedTTest}
# ============================================

def paired_ttest_analysis(df: pd.DataFrame,
                          rag_col: str,
                          nonrag_col: str,
                          metric_name: str) -> Dict:
    """
    Perform paired t-test comparing RAG vs Non-RAG.

    Returns:
        Dictionary with test results and interpretation
    """
    rag_data = df[rag_col].dropna()
    nonrag_data = df[nonrag_col].dropna()

    # Align data (paired samples must have same length)
    valid_idx = df[[rag_col, nonrag_col]].dropna().index
    rag_paired = df.loc[valid_idx, rag_col].values
    nonrag_paired = df.loc[valid_idx, nonrag_col].values

    if len(rag_paired) < 2:
        return {"error": "Insufficient data for paired t-test"}

    # Perform paired t-test
    t_stat, p_value = ttest_rel(rag_paired, nonrag_paired)

    # Effect size
    d, d_interp = cohens_d(rag_paired, nonrag_paired)

    # Confidence intervals
    rag_mean, rag_ci_l, rag_ci_u = bootstrap_ci(rag_paired)
    nonrag_mean, nonrag_ci_l, nonrag_ci_u = bootstrap_ci(nonrag_paired)
    diff_mean, diff_ci_l, diff_ci_u = bootstrap_ci(rag_paired - nonrag_paired)

    # Significance
    alpha = 0.05
    significant = p_value < alpha

    return {
        "metric": metric_name,
        "n_pairs": len(rag_paired),
        "rag_mean": rag_mean,
        "rag_std": rag_paired.std(),
        "rag_ci_95": (rag_ci_l, rag_ci_u),
        "nonrag_mean": nonrag_mean,
        "nonrag_std": nonrag_paired.std(),
        "nonrag_ci_95": (nonrag_ci_l, nonrag_ci_u),
        "mean_difference": diff_mean,
        "diff_ci_95": (diff_ci_l, diff_ci_u),
        "t_statistic": t_stat,
        "p_value": p_value,
        "cohens_d": d,
        "effect_size_interpretation": d_interp,
        "significant": significant,
        "conclusion": f"{'Signifikan' if significant else 'Tidak signifikan'} (p={'<0.001' if p_value < 0.001 else f'{p_value:.4f}'})"
    }

# ============================================
# ${comments.anova}
# ============================================

def anova_analysis(df: pd.DataFrame,
                   metric_col: str,
                   group_col: str,
                   metric_name: str) -> Dict:
    """
    Perform one-way ANOVA with post-hoc Tukey HSD.
    """
    groups = df.groupby(group_col)[metric_col].apply(list).to_dict()
    group_names = list(groups.keys())
    group_data = [np.array(groups[g]) for g in group_names]
    group_data = [g[~np.isnan(g)] for g in group_data]

    if len(group_data) < 2 or any(len(g) < 2 for g in group_data):
        return {"error": "Insufficient data for ANOVA"}

    # Perform ANOVA
    f_stat, p_value = f_oneway(*group_data)

    # Effect size
    df_between = len(group_data) - 1
    df_within = sum(len(g) - 1 for g in group_data)
    eta_sq, eta_interp = eta_squared(f_stat, df_between, df_within)

    # Group statistics
    group_stats = {}
    for name, data in zip(group_names, group_data):
        mean, ci_l, ci_u = bootstrap_ci(data)
        group_stats[name] = {
            "n": len(data),
            "mean": mean,
            "std": data.std(),
            "ci_95": (ci_l, ci_u)
        }

    return {
        "metric": metric_name,
        "group_column": group_col,
        "n_groups": len(group_data),
        "group_stats": group_stats,
        "f_statistic": f_stat,
        "p_value": p_value,
        "df_between": df_between,
        "df_within": df_within,
        "eta_squared": eta_sq,
        "effect_size_interpretation": eta_interp,
        "significant": p_value < 0.05
    }

# ============================================
# ${comments.descriptive}
# ============================================

def descriptive_statistics(df: pd.DataFrame, columns: List[str] = None) -> pd.DataFrame:
    """Generate descriptive statistics table."""
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()

    stats_data = []
    for col in columns:
        data = df[col].dropna()
        if len(data) == 0:
            continue

        mean, ci_l, ci_u = bootstrap_ci(data.values)

        stats_data.append({
            "Variable": col,
            "N": len(data),
            "Mean": mean,
            "SD": data.std(),
            "SE": data.std() / np.sqrt(len(data)),
            "CI_Lower": ci_l,
            "CI_Upper": ci_u,
            "Min": data.min(),
            "Max": data.max(),
            "Median": data.median(),
            "Skewness": data.skew(),
            "Kurtosis": data.kurtosis()
        })

    return pd.DataFrame(stats_data)

# ============================================
# ${comments.correlation}
# ============================================

def correlation_matrix(df: pd.DataFrame, columns: List[str]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Calculate correlation matrix with p-values.

    Returns:
        Tuple of (correlation_matrix, p_value_matrix)
    """
    n = len(columns)
    corr_matrix = np.zeros((n, n))
    p_matrix = np.zeros((n, n))

    for i, col1 in enumerate(columns):
        for j, col2 in enumerate(columns):
            valid_idx = df[[col1, col2]].dropna().index
            if len(valid_idx) >= 3:
                r, p = pearsonr(df.loc[valid_idx, col1], df.loc[valid_idx, col2])
                corr_matrix[i, j] = r
                p_matrix[i, j] = p
            else:
                corr_matrix[i, j] = np.nan
                p_matrix[i, j] = np.nan

    corr_df = pd.DataFrame(corr_matrix, index=columns, columns=columns)
    p_df = pd.DataFrame(p_matrix, index=columns, columns=columns)

    return corr_df, p_df

# ============================================
# ${comments.visualization}
# ============================================

def plot_rag_comparison(df: pd.DataFrame,
                        rag_col: str,
                        nonrag_col: str,
                        title: str,
                        output_path: str = None):
    """Create comparison plot for RAG vs Non-RAG."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # Box plot
    data_to_plot = [df[rag_col].dropna(), df[nonrag_col].dropna()]
    axes[0].boxplot(data_to_plot, labels=['RAG', 'Non-RAG'])
    axes[0].set_title(f'{title} - Box Plot')
    axes[0].set_ylabel('Score')

    # Paired difference histogram
    valid_idx = df[[rag_col, nonrag_col]].dropna().index
    diff = df.loc[valid_idx, rag_col] - df.loc[valid_idx, nonrag_col]
    axes[1].hist(diff, bins=20, edgecolor='black', alpha=0.7)
    axes[1].axvline(x=0, color='red', linestyle='--', label='No difference')
    axes[1].axvline(x=diff.mean(), color='green', linestyle='-', label=f'Mean diff: {diff.mean():.3f}')
    axes[1].set_title(f'{title} - Difference Distribution')
    axes[1].set_xlabel('RAG - Non-RAG')
    axes[1].legend()

    # Bar chart with error bars
    means = [df[rag_col].mean(), df[nonrag_col].mean()]
    stds = [df[rag_col].std(), df[nonrag_col].std()]
    axes[2].bar(['RAG', 'Non-RAG'], means, yerr=stds, capsize=5, alpha=0.7)
    axes[2].set_title(f'{title} - Mean Comparison')
    axes[2].set_ylabel('Score')

    plt.tight_layout()

    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.show()

def plot_correlation_heatmap(corr_df: pd.DataFrame,
                              p_df: pd.DataFrame,
                              output_path: str = None):
    """Create correlation heatmap with significance markers."""
    fig, ax = plt.subplots(figsize=(12, 10))

    # Create mask for upper triangle
    mask = np.triu(np.ones_like(corr_df, dtype=bool))

    # Plot heatmap
    sns.heatmap(corr_df, mask=mask, annot=True, fmt='.2f',
                cmap='RdBu_r', center=0, vmin=-1, vmax=1,
                square=True, linewidths=0.5, ax=ax)

    ax.set_title('Correlation Matrix - RAGAS Metrics')

    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.show()

def plot_latency_breakdown(df: pd.DataFrame, output_path: str = None):
    """Create stacked bar chart for latency breakdown."""
    latency_cols = ['ragRetrievalLatencyMs', 'ragRerankingLatencyMs',
                    'ragGenerationLatencyMs', 'ragAgentReasoningLatencyMs',
                    'ragToolCallLatencyMs']

    available_cols = [c for c in latency_cols if c in df.columns]
    if not available_cols:
        print("No latency columns available")
        return

    means = df[available_cols].mean()

    fig, ax = plt.subplots(figsize=(10, 6))

    labels = ['Retrieval', 'Reranking', 'Generation', 'Agent Reasoning', 'Tool Calls']
    labels = labels[:len(available_cols)]

    ax.bar(range(len(means)), means, tick_label=labels)
    ax.set_ylabel('Latency (ms)')
    ax.set_title('Average Latency Breakdown by Component')

    # Add value labels
    for i, v in enumerate(means):
        ax.text(i, v + 5, f'{v:.1f}ms', ha='center')

    plt.xticks(rotation=45)
    plt.tight_layout()

    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.show()

# ============================================
# ${comments.export}
# ============================================

def export_to_latex_table(df: pd.DataFrame,
                          caption: str,
                          label: str,
                          output_path: str = None) -> str:
    """Export DataFrame to LaTeX table format."""
    latex = df.to_latex(
        index=False,
        float_format="%.4f",
        caption=caption,
        label=label,
        position='htbp'
    )

    if output_path:
        with open(output_path, 'w') as f:
            f.write(latex)

    return latex

def generate_academic_report(results: Dict) -> str:
    """Generate academic-style report from analysis results."""
    report = []
    report.append("=" * 60)
    report.append("LAPORAN ANALISIS STATISTIK")
    report.append("Evaluasi Sistem RAG Akademik")
    report.append("=" * 60)
    report.append("")

    if 'paired_ttest' in results:
        r = results['paired_ttest']
        report.append("## Uji T Berpasangan: RAG vs Non-RAG")
        report.append(f"Metrik: {r['metric']}")
        report.append(f"Jumlah Pasangan: N = {r['n_pairs']}")
        report.append("")
        report.append("### Statistik Deskriptif")
        report.append(f"RAG: M = {r['rag_mean']:.4f}, SD = {r['rag_std']:.4f}, 95% CI [{r['rag_ci_95'][0]:.4f}, {r['rag_ci_95'][1]:.4f}]")
        report.append(f"Non-RAG: M = {r['nonrag_mean']:.4f}, SD = {r['nonrag_std']:.4f}, 95% CI [{r['nonrag_ci_95'][0]:.4f}, {r['nonrag_ci_95'][1]:.4f}]")
        report.append("")
        report.append("### Hasil Uji T")
        report.append(f"t({r['n_pairs']-1}) = {r['t_statistic']:.4f}, p = {r['p_value']:.4f}")
        report.append(f"Cohen's d = {r['cohens_d']:.4f} (efek {r['effect_size_interpretation']})")
        report.append(f"Perbedaan Mean: {r['mean_difference']:.4f}, 95% CI [{r['diff_ci_95'][0]:.4f}, {r['diff_ci_95'][1]:.4f}]")
        report.append("")
        report.append(f"### Kesimpulan: {r['conclusion']}")
        report.append("")

    return "\\n".join(report)

# ============================================
# MAIN EXECUTION
# ============================================

if __name__ == "__main__":
    # Example usage
    print("Academic RAG Evaluation - Statistical Analysis")
    print("=" * 50)

    # Load data
    # df = load_evaluation_data("evaluation_data.csv")

    # Generate sample data for demonstration
    np.random.seed(42)
    n_samples = 50

    df = pd.DataFrame({
        'questionId': [f'Q{i:03d}' for i in range(n_samples)],
        'ragFaithfulness': np.random.beta(8, 2, n_samples),
        'ragAnswerRelevancy': np.random.beta(7, 2, n_samples),
        'ragContextPrecision': np.random.beta(6, 2, n_samples),
        'ragContextRecall': np.random.beta(7, 3, n_samples),
        'ragAnswerCorrectness': np.random.beta(7, 2, n_samples),
        'nonRagAnswerRelevancy': np.random.beta(5, 3, n_samples),
        'nonRagAnswerCorrectness': np.random.beta(5, 3, n_samples),
        'ragHallucinationRate': np.random.beta(2, 8, n_samples),
        'nonRagHallucinationRate': np.random.beta(4, 6, n_samples),
        'ragLatencyMs': np.random.normal(1500, 300, n_samples),
        'nonRagLatencyMs': np.random.normal(800, 200, n_samples),
        'retrievalMethod': np.random.choice(['vector', 'keyword', 'hybrid'], n_samples)
    })

    print("\\n1. Descriptive Statistics")
    print("-" * 50)
    desc_stats = descriptive_statistics(df)
    print(desc_stats.to_string())

    print("\\n2. Paired T-Test: Answer Correctness")
    print("-" * 50)
    ttest_result = paired_ttest_analysis(
        df, 'ragAnswerCorrectness', 'nonRagAnswerCorrectness',
        'Answer Correctness'
    )
    for key, value in ttest_result.items():
        print(f"  {key}: {value}")

    print("\\n3. Paired T-Test: Hallucination Rate")
    print("-" * 50)
    halluc_result = paired_ttest_analysis(
        df, 'ragHallucinationRate', 'nonRagHallucinationRate',
        'Hallucination Rate'
    )
    for key, value in halluc_result.items():
        print(f"  {key}: {value}")

    print("\\n4. ANOVA: Retrieval Strategy Comparison")
    print("-" * 50)
    anova_result = anova_analysis(
        df, 'ragAnswerCorrectness', 'retrievalMethod',
        'Answer Correctness by Retrieval Method'
    )
    for key, value in anova_result.items():
        print(f"  {key}: {value}")

    print("\\n5. Correlation Analysis")
    print("-" * 50)
    ragas_cols = ['ragFaithfulness', 'ragAnswerRelevancy',
                  'ragContextPrecision', 'ragContextRecall',
                  'ragAnswerCorrectness']
    corr_df, p_df = correlation_matrix(df, ragas_cols)
    print(corr_df.to_string())

    print("\\n6. Academic Report")
    print("-" * 50)
    report = generate_academic_report({
        'paired_ttest': ttest_result
    })
    print(report)

    print("\\n[Analysis Complete]")
`;
}

/**
 * Generate R script for statistical analysis
 */
export function generateRScript(_options: Partial<ExportOptions> = {}): string {
    const comments = {
        title: "Script Analisis Statistik R untuk Evaluasi RAG",
        install: "Install packages jika belum ada",
        load: "Muat data",
        descriptive: "Statistik Deskriptif",
        ttest: "Paired T-Test",
        anova: "ANOVA",
    };

    return `# ${comments.title}
# Generated: ${new Date().toISOString()}

# ${comments.install}
required_packages <- c("tidyverse", "psych", "effsize", "boot", "car", "ggpubr")
new_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if(length(new_packages)) install.packages(new_packages)

library(tidyverse)
library(psych)
library(effsize)
library(boot)
library(car)
library(ggpubr)

# ============================================
# ${comments.load}
# ============================================

load_evaluation_data <- function(filepath) {
  df <- read_csv(filepath)
  return(df)
}

# ============================================
# ${comments.descriptive}
# ============================================

descriptive_analysis <- function(df) {
  numeric_cols <- df %>% select(where(is.numeric))

  desc_stats <- describe(numeric_cols)
  print("Descriptive Statistics:")
  print(desc_stats)

  return(desc_stats)
}

# ============================================
# ${comments.ttest}
# ============================================

paired_ttest_analysis <- function(df, rag_col, nonrag_col, metric_name) {
  # Remove NA pairs
  valid_data <- df %>%
    select(all_of(c(rag_col, nonrag_col))) %>%
    drop_na()

  rag_data <- valid_data[[rag_col]]
  nonrag_data <- valid_data[[nonrag_col]]

  # Paired t-test
  test_result <- t.test(rag_data, nonrag_data, paired = TRUE)

  # Effect size (Cohen's d)
  d <- cohen.d(rag_data, nonrag_data, paired = TRUE)

  # Results
  results <- list(
    metric = metric_name,
    n_pairs = nrow(valid_data),
    rag_mean = mean(rag_data),
    rag_sd = sd(rag_data),
    nonrag_mean = mean(nonrag_data),
    nonrag_sd = sd(nonrag_data),
    mean_diff = mean(rag_data - nonrag_data),
    t_statistic = test_result$statistic,
    df = test_result$parameter,
    p_value = test_result$p.value,
    ci_lower = test_result$conf.int[1],
    ci_upper = test_result$conf.int[2],
    cohens_d = d$estimate,
    effect_magnitude = d$magnitude
  )

  cat(sprintf("\\n=== %s ===\\n", metric_name))
  cat(sprintf("RAG: M = %.4f, SD = %.4f\\n", results$rag_mean, results$rag_sd))
  cat(sprintf("Non-RAG: M = %.4f, SD = %.4f\\n", results$nonrag_mean, results$nonrag_sd))
  cat(sprintf("t(%d) = %.4f, p = %.4f\\n", results$df, results$t_statistic, results$p_value))
  cat(sprintf("Cohen's d = %.4f (%s)\\n", results$cohens_d, results$effect_magnitude))
  cat(sprintf("95%% CI [%.4f, %.4f]\\n", results$ci_lower, results$ci_upper))

  return(results)
}

# ============================================
# ${comments.anova}
# ============================================

anova_analysis <- function(df, metric_col, group_col, metric_name) {
  formula_str <- as.formula(paste(metric_col, "~", group_col))

  # One-way ANOVA
  anova_result <- aov(formula_str, data = df)
  summary_result <- summary(anova_result)

  # Effect size (eta-squared)
  ss_between <- summary_result[[1]]$\`Sum Sq\`[1]
  ss_total <- sum(summary_result[[1]]$\`Sum Sq\`)
  eta_sq <- ss_between / ss_total

  # Post-hoc Tukey HSD
  tukey_result <- TukeyHSD(anova_result)

  cat(sprintf("\\n=== ANOVA: %s ===\\n", metric_name))
  print(summary_result)
  cat(sprintf("Eta-squared = %.4f\\n", eta_sq))
  cat("\\nPost-hoc Tukey HSD:\\n")
  print(tukey_result)

  return(list(
    anova = summary_result,
    eta_squared = eta_sq,
    tukey = tukey_result
  ))
}

# ============================================
# VISUALIZATION
# ============================================

plot_comparison <- function(df, rag_col, nonrag_col, title) {
  # Prepare data for plotting
  plot_data <- df %>%
    select(all_of(c(rag_col, nonrag_col))) %>%
    pivot_longer(cols = everything(), names_to = "System", values_to = "Score")

  # Box plot with individual points
  p <- ggplot(plot_data, aes(x = System, y = Score, fill = System)) +
    geom_boxplot(alpha = 0.7) +
    geom_jitter(width = 0.2, alpha = 0.5) +
    stat_compare_means(method = "t.test", paired = TRUE, label = "p.signif") +
    labs(title = title, y = "Score") +
    theme_minimal() +
    theme(legend.position = "none")

  print(p)
  return(p)
}

# ============================================
# MAIN EXECUTION
# ============================================

main <- function() {
  # Load data
  # df <- load_evaluation_data("evaluation_data.csv")

  # Generate sample data for demonstration
  set.seed(42)
  n <- 50

  df <- tibble(
    questionId = sprintf("Q%03d", 1:n),
    ragFaithfulness = rbeta(n, 8, 2),
    ragAnswerRelevancy = rbeta(n, 7, 2),
    ragContextPrecision = rbeta(n, 6, 2),
    ragContextRecall = rbeta(n, 7, 3),
    ragAnswerCorrectness = rbeta(n, 7, 2),
    nonRagAnswerRelevancy = rbeta(n, 5, 3),
    nonRagAnswerCorrectness = rbeta(n, 5, 3),
    ragHallucinationRate = rbeta(n, 2, 8),
    nonRagHallucinationRate = rbeta(n, 4, 6),
    ragLatencyMs = rnorm(n, 1500, 300),
    nonRagLatencyMs = rnorm(n, 800, 200),
    retrievalMethod = sample(c("vector", "keyword", "hybrid"), n, replace = TRUE)
  )

  cat("\\n========================================\\n")
  cat("Academic RAG Evaluation - R Analysis\\n")
  cat("========================================\\n")

  # 1. Descriptive Statistics
  desc_stats <- descriptive_analysis(df)

  # 2. Paired T-Tests
  ttest_correctness <- paired_ttest_analysis(
    df, "ragAnswerCorrectness", "nonRagAnswerCorrectness",
    "Answer Correctness: RAG vs Non-RAG"
  )

  ttest_hallucination <- paired_ttest_analysis(
    df, "ragHallucinationRate", "nonRagHallucinationRate",
    "Hallucination Rate: RAG vs Non-RAG"
  )

  # 3. ANOVA
  anova_retrieval <- anova_analysis(
    df, "ragAnswerCorrectness", "retrievalMethod",
    "Answer Correctness by Retrieval Strategy"
  )

  # 4. Visualizations
  plot_comparison(df, "ragAnswerCorrectness", "nonRagAnswerCorrectness",
                  "RAG vs Non-RAG: Answer Correctness")

  cat("\\n[Analysis Complete]\\n")
}

# Run main
main()
`;
}

/**
 * Format data for export and analysis
 */
export function formatForExport(evaluationQuestions: Record<string, unknown>[]): RawEvaluationData[] {
    return evaluationQuestions.map((q) => ({
        questionId: String(q.id || ""),
        question: String(q.question || ""),
        groundTruth: String(q.groundTruth || ""),
        ragAnswer: q.ragAnswer as string | null,
        nonRagAnswer: q.nonRagAnswer as string | null,
        retrievedContexts: (q.retrievedContexts as string[]) || [],
        ragFaithfulness: q.ragFaithfulness as number | null,
        ragAnswerRelevancy: q.ragAnswerRelevancy as number | null,
        ragContextPrecision: q.ragContextPrecision as number | null,
        ragContextRecall: q.ragContextRecall as number | null,
        ragAnswerCorrectness: q.ragAnswerCorrectness as number | null,
        nonRagAnswerRelevancy: q.nonRagAnswerRelevancy as number | null,
        nonRagAnswerCorrectness: q.nonRagAnswerCorrectness as number | null,
        ragAcademicRigor: q.ragAcademicRigor as number | null,
        ragCitationAccuracy: q.ragCitationAccuracy as number | null,
        ragTerminologyCorrectness: q.ragTerminologyCorrectness as number | null,
        ragHallucinationRate: q.ragHallucinationRate as number | null,
        ragFactualConsistency: q.ragFactualConsistency as number | null,
        ragSourceAttribution: q.ragSourceAttribution as number | null,
        ragContradictionScore: q.ragContradictionScore as number | null,
        nonRagHallucinationRate: q.nonRagHallucinationRate as number | null,
        retrievalNdcg: q.retrievalNdcg as number | null,
        retrievalMrr: q.retrievalMrr as number | null,
        retrievalPrecision: q.retrievalPrecision as number | null,
        ragLatencyMs: q.ragLatencyMs as number | null,
        nonRagLatencyMs: q.nonRagLatencyMs as number | null,
        ragRetrievalLatencyMs: q.ragRetrievalLatencyMs as number | null,
        ragRerankingLatencyMs: q.ragRerankingLatencyMs as number | null,
        ragGenerationLatencyMs: q.ragGenerationLatencyMs as number | null,
        ragAgentReasoningLatencyMs: q.ragAgentReasoningLatencyMs as number | null,
        ragToolCallLatencyMs: q.ragToolCallLatencyMs as number | null,
        ragTokensPerSecond: q.ragTokensPerSecond as number | null,
        retrievalMethod: q.retrievalMethod as string | null,
        rerankerStrategy: q.rerankerStrategy as string | null,
        agentStepsUsed: q.agentStepsUsed as number | null,
        guardrailsTriggered: q.guardrailsTriggered as number | null,
    }));
}
