/**
 * @fileoverview RAGAS Metrics and Ablation Studies for RAG Evaluation
 *
 * WHY RAGAS Metrics:
 * - Standard RAG evaluation framework from "RAGAS: Automated Evaluation of RAG" (Shahul et al., 2023)
 * - LLM-based metrics eliminate need for manual labeling
 * - Comprehensive coverage: faithfulness, relevancy, precision, recall
 * - Research-backed correlation with human judgments (0.8-0.9 Pearson correlation)
 *
 * WHY Ablation Studies:
 * - Identify which components contribute to performance (vector vs BM25 vs reranking)
 * - Quantify impact of design decisions (chunking strategy, reranker choice)
 * - Enable evidence-based optimization (not just intuition)
 * - Required for academic publication of research findings
 *
 * Key Metrics Implemented:
 * 1. Core RAGAS: faithfulness, answer relevancy, context precision/recall, correctness
 * 2. Domain-Specific: academic rigor, citation accuracy, terminology correctness
 * 3. Hallucination: hallucination rate, factual consistency, source attribution, contradiction score
 * 4. Retrieval Quality: NDCG, MRR, Precision@K
 * 5. Efficiency: latency breakdown, token usage, throughput
 *
 * Research Foundation:
 * - RAGAS: "Automated Evaluation of Retrieval-Augmented Generation" (Shahul et al., 2023)
 * - NDCG: "Cumulated Gain-Based Evaluation of IR Techniques" (Järvelin & Kekäläinen, 2002)
 * - Faithfulness: NLI-based approach from "TRUE: Re-evaluating Factual Consistency" (Honovich et al., 2022)
 */

import { cosineSimilarity, generateText } from "ai";
import { CHAT_MODEL, telemetryConfig } from "@/lib/ai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { runAgenticRag } from "./agentic-rag";
import { buildRagPrompt, retrieveContext, SYSTEM_PROMPTS } from "./context-builder";
import { hybridRetrieve } from "./hybrid-retrieval";
import type { RerankerStrategy } from "./reranker";

/**
 * Comprehensive evaluation metrics for RAG systems
 *
 * WHY So Many Metrics:
 * - No single metric captures all aspects of RAG quality
 * - Different stakeholders care about different metrics (researchers vs users vs operators)
 * - Tradeoffs exist (latency vs quality, recall vs precision)
 * - Academic research requires rigorous multi-faceted evaluation
 *
 * Metric Categories:
 * 1. **Core RAGAS** (standard RAG evaluation)
 * 2. **Domain-Specific** (Indonesian academic context)
 * 3. **Hallucination Detection** (critical for academic trust)
 * 4. **Retrieval Quality** (how good is document selection?)
 * 5. **Efficiency** (latency, throughput, cost)
 *
 * @property faithfulness - Are claims grounded in retrieved sources? (0-1)
 * @property answerRelevancy - Does answer match query intent? (0-1)
 * @property contextPrecision - Are retrieved chunks relevant to query? (0-1)
 * @property contextRecall - Are all relevant facts retrieved? (0-1)
 * @property answerCorrectness - Semantic + factual similarity to ground truth (0-1)
 * @property academicRigor - Quality of academic language and argumentation (0-1)
 * @property citationAccuracy - Are citations correct and verifiable? (0-1)
 * @property terminologyCorrectness - Proper use of technical terms? (0-1)
 * @property hallucinationRate - Proportion of fabricated information (0-1, lower is better)
 * @property factualConsistency - NLI-based consistency with sources (0-1)
 * @property sourceAttribution - Are claims properly attributed? (0-1)
 * @property contradictionScore - Presence of logical contradictions (0-1, higher is better)
 * @property retrievalNdcg - NDCG@K for retrieval quality (0-1)
 * @property retrievalMrr - Mean Reciprocal Rank (0-1)
 * @property retrievalPrecision - Precision@K for retrieval (0-1)
 * @property totalLatencyMs - End-to-end latency (milliseconds)
 * @property retrievalLatencyMs - Time for retrieval phase (milliseconds)
 * @property rerankingLatencyMs - Time for reranking phase (milliseconds)
 * @property generationLatencyMs - Time for LLM generation (milliseconds)
 * @property agentReasoningLatencyMs - Time for agentic planning/reasoning (milliseconds)
 * @property tokenEfficiency - Output tokens / input tokens ratio
 * @property tokensPerSecond - Throughput metric
 * @property toolCallLatencyMs - Time spent in tool executions (agentic mode)
 * @property planningLatencyMs - Time spent in query planning (agentic mode)
 * @property synthesisLatencyMs - Time spent synthesizing final answer (agentic mode)
 * @property totalAgentSteps - Number of steps in agentic workflow
 * @property avgStepLatencyMs - Average latency per agentic step
 */
export interface EvaluationMetrics {
    // Core RAGAS metrics
    faithfulness: number;
    answerRelevancy: number;
    contextPrecision: number;
    contextRecall: number;
    answerCorrectness: number;
    // Domain-specific metrics (Indonesian academic)
    academicRigor: number;
    citationAccuracy: number;
    terminologyCorrectness: number;
    // Hallucination-specific metrics
    hallucinationRate: number;
    factualConsistency: number;
    sourceAttribution: number;
    contradictionScore: number;
    // Retrieval quality metrics
    retrievalNdcg: number;
    retrievalMrr: number;
    retrievalPrecision: number;
    // Latency and efficiency metrics
    totalLatencyMs: number;
    retrievalLatencyMs: number;
    rerankingLatencyMs: number;
    generationLatencyMs: number;
    agentReasoningLatencyMs: number;
    tokenEfficiency: number;
    tokensPerSecond: number;
    // Agentic-specific latency
    toolCallLatencyMs: number;
    planningLatencyMs: number;
    synthesisLatencyMs: number;
    totalAgentSteps: number;
    avgStepLatencyMs: number;
}

// Top-level regex used for token splitting to avoid re-creating the literal repeatedly
export const WHITESPACE_REGEX = /\s+/;

// Helper: aggregate latency and token metrics into a compact object
function aggregateLatencyAndTokenMetrics(
    latencyTracker: ReturnType<typeof createLatencyTracker> | undefined,
    answer: string,
    contexts: string[]
) {
    const profile = latencyTracker?.getProfile();
    const totalLatencyMs = profile?.totalMs || 0;
    const retrievalLatencyMs = latencyTracker?.getPhaseLatency("retrieval") || 0;
    const rerankingLatencyMs = latencyTracker?.getPhaseLatency("reranking") || 0;
    const generationLatencyMs = latencyTracker?.getPhaseLatency("generation") || 0;
    const agentReasoningLatencyMs = latencyTracker?.getPhaseLatency("planning") || 0;
    const toolCallLatencyMs = latencyTracker?.getPhaseLatency("tool_call") || 0;
    const planningLatencyMs = latencyTracker?.getPhaseLatency("planning") || 0;
    const synthesisLatencyMs = latencyTracker?.getPhaseLatency("synthesis") || 0;

    const breakdown = latencyTracker?.getBreakdown() || [];
    const totalAgentSteps = breakdown.filter((b) => ["tool_call", "planning", "synthesis"].includes(b.phase)).length;
    const avgStepLatencyMs =
        totalAgentSteps > 0 ? (toolCallLatencyMs + planningLatencyMs + synthesisLatencyMs) / totalAgentSteps : 0;

    const answerTokens = answer.split(WHITESPACE_REGEX).filter(Boolean).length;
    const contextTokens = contexts.join(" ").split(WHITESPACE_REGEX).filter(Boolean).length;
    const tokensPerSecond = totalLatencyMs > 0 ? (answerTokens / totalLatencyMs) * 1000 : 0;
    const tokenEfficiency = contextTokens > 0 ? answerTokens / contextTokens : 0;

    return {
        totalLatencyMs,
        retrievalLatencyMs,
        rerankingLatencyMs,
        generationLatencyMs,
        agentReasoningLatencyMs,
        toolCallLatencyMs,
        planningLatencyMs,
        synthesisLatencyMs,
        totalAgentSteps,
        avgStepLatencyMs,
        tokensPerSecond,
        tokenEfficiency,
    };
}

export interface LatencyBreakdown {
    timestamp: number;
    phase: "retrieval" | "reranking" | "generation" | "tool_call" | "planning" | "synthesis" | "guardrails";
    durationMs: number;
    metadata?: {
        toolName?: string;
        stepIndex?: number;
        tokensGenerated?: number;
        documentsProcessed?: number;
    };
}

export interface LatencyProfile {
    breakdown: LatencyBreakdown[];
    totalMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    stdDevMs: number;
}

export function createLatencyTracker() {
    const breakdown: LatencyBreakdown[] = [];
    let startTime = Date.now();

    return {
        start() {
            startTime = Date.now();
        },

        mark(phase: LatencyBreakdown["phase"], metadata?: LatencyBreakdown["metadata"]) {
            const now = Date.now();
            breakdown.push({
                timestamp: now,
                phase,
                durationMs: now - startTime,
                metadata,
            });
            startTime = now;
        },

        getBreakdown(): LatencyBreakdown[] {
            return breakdown;
        },

        getTotalMs(): number {
            return breakdown.reduce((sum, b) => sum + b.durationMs, 0);
        },

        getPhaseLatency(phase: LatencyBreakdown["phase"]): number {
            return breakdown.filter((b) => b.phase === phase).reduce((sum, b) => sum + b.durationMs, 0);
        },

        getProfile(): LatencyProfile {
            const durations = breakdown.map((b) => b.durationMs).sort((a, b) => a - b);
            const totalMs = this.getTotalMs();
            const avgMs = durations.length > 0 ? totalMs / durations.length : 0;

            // Calculate standard deviation
            const variance = durations.reduce((sum, d) => sum + (d - avgMs) ** 2, 0) / durations.length;
            const stdDevMs = Math.sqrt(variance);

            return {
                breakdown,
                totalMs,
                p50Ms: durations[Math.floor(durations.length * 0.5)] || 0,
                p95Ms: durations[Math.floor(durations.length * 0.95)] || 0,
                p99Ms: durations[Math.floor(durations.length * 0.99)] || 0,
                avgMs,
                stdDevMs,
            };
        },
    };
}

export interface AblationConfig {
    name: string;
    description: string;
    useRag: boolean;
    useReranker: boolean;
    rerankerStrategy?: string;
    retrievalStrategy: "vector" | "keyword" | "hybrid";
    chunkingStrategy: "recursive" | "semantic" | "sentence_window" | "hierarchical";
    useAgenticMode: boolean;
    useGuardrails: boolean;
    topK: number;
    language: "en" | "id" | "auto";
}

export interface AblationResult {
    config: AblationConfig;
    metrics: EvaluationMetrics;
    latencyProfile: LatencyProfile;
    sampleResults: {
        question: string;
        answer: string;
        groundTruth: string;
        contexts: string[];
        latencyMs: number;
    }[];
}

// Language detection helper - always returns Indonesian
function detectLanguage(_text: string): "id" {
    return "id";
}

// Core RAGAS Metrics

export async function calculateFaithfulness(answer: string, contexts: string[]): Promise<number> {
    console.log(
        `[calculateFaithfulness] Calculating faithfulness - answer: ${answer.length} chars, contexts: ${contexts.length}`
    );
    if (!answer || contexts.length === 0) {
        console.log("[calculateFaithfulness] Skipping - empty answer or contexts");
        return 0;
    }

    try {
        console.log("[calculateFaithfulness] Using Indonesian prompt");
        const prompt = `Anda mengevaluasi kesetiaan jawaban terhadap konteks sumbernya.

Konteks:
${contexts.join("\n\n")}

Jawaban:
${answer}

Tugas: Analisis jawaban dan tentukan berapa persen klaim dalam jawaban yang dapat langsung didukung oleh konteks.
Jawab HANYA dengan angka antara 0 dan 1 yang merepresentasikan skor kesetiaan.
- 1.0 = Semua klaim langsung didukung oleh konteks
- 0.0 = Tidak ada klaim yang didukung oleh konteks`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        const result = Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
        console.log(`[calculateFaithfulness] Result: ${result.toFixed(3)}`);
        return result;
    } catch (error) {
        console.error("[calculateFaithfulness] Calculation error:", error);
        return 0;
    }
}

export async function calculateAnswerRelevancy(question: string, answer: string): Promise<number> {
    if (!(question && answer)) return 0;

    try {
        const [questionEmbed, answerEmbed] = await Promise.all([
            generateEmbedding(question),
            generateEmbedding(answer),
        ]);

        return cosineSimilarity(questionEmbed.embedding, answerEmbed.embedding);
    } catch (error) {
        console.error("Answer relevancy calculation error:", error);
        return 0;
    }
}

export async function calculateContextPrecision(
    question: string,
    contexts: string[],
    groundTruth: string
): Promise<number> {
    if (!question || contexts.length === 0 || !groundTruth) return 0;

    try {
        const prompt = `Anda mengevaluasi presisi konteks yang diambil untuk menjawab pertanyaan.

Pertanyaan: ${question}

Jawaban Benar: ${groundTruth}

Konteks yang Diambil:
${contexts.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}

Tugas: Untuk setiap konteks, tentukan apakah mengandung informasi yang berguna untuk menjawab pertanyaan dengan benar.
Hitung berapa banyak konteks yang relevan dan bagi dengan total konteks.
Jawab HANYA dengan angka antara 0 dan 1.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Context precision calculation error:", error);
        return 0;
    }
}

export async function calculateContextRecall(groundTruth: string, contexts: string[]): Promise<number> {
    if (!groundTruth || contexts.length === 0) return 0;

    try {
        const prompt = `Anda mengevaluasi recall dari konteks yang diambil.

Jawaban Benar: ${groundTruth}

Konteks yang Diambil:
${contexts.join("\n\n")}

Tugas: Tentukan berapa persen informasi dalam jawaban benar yang tercakup oleh konteks yang diambil.
Jawab HANYA dengan angka antara 0 dan 1.
- 1.0 = Semua informasi dalam jawaban benar ada di konteks
- 0.0 = Tidak ada informasi dari jawaban benar di konteks`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Context recall calculation error:", error);
        return 0;
    }
}

export async function calculateAnswerCorrectness(answer: string, groundTruth: string): Promise<number> {
    if (!(answer && groundTruth)) return 0;

    try {
        const [answerEmbed, truthEmbed] = await Promise.all([
            generateEmbedding(answer),
            generateEmbedding(groundTruth),
        ]);

        const semanticSimilarity = cosineSimilarity(answerEmbed.embedding, truthEmbed.embedding);

        const prompt = `Anda membandingkan dua jawaban untuk kebenaran faktual.

Jawaban yang Dihasilkan: ${answer}

Jawaban Benar: ${groundTruth}

Tugas: Evaluasi seberapa benar secara faktual jawaban yang dihasilkan dibandingkan dengan jawaban benar.
Pertimbangkan akurasi faktual dan kelengkapan.
Jawab HANYA dengan angka antara 0 dan 1.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const factualScore = Number.parseFloat(text.trim());
        const validFactualScore = Number.isNaN(factualScore) ? 0 : Math.min(1, Math.max(0, factualScore));

        return semanticSimilarity * 0.3 + validFactualScore * 0.7;
    } catch (error) {
        console.error("Answer correctness calculation error:", error);
        return 0;
    }
}

export async function calculateAcademicRigor(answer: string, contexts: string[]): Promise<number> {
    if (!answer) return 0;

    try {
        const prompt = `Evaluasi ketelitian akademis dari jawaban berikut dalam konteks pendidikan tinggi Indonesia.

Jawaban: ${answer}

Konteks pendukung: ${contexts.slice(0, 3).join("\n")}

Kriteria penilaian:
1. Penggunaan bahasa akademis yang tepat
2. Struktur argumentasi yang logis
3. Kedalaman analisis
4. Penggunaan istilah teknis yang benar
5. Objektivitas dan netralitas

Berikan skor 0-1. Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Academic rigor calculation error:", error);
        return 0;
    }
}

export async function calculateCitationAccuracy(answer: string, contexts: string[]): Promise<number> {
    if (!answer || contexts.length === 0) return 0;

    try {
        const prompt = `Evaluasi akurasi sitasi dan referensi dalam jawaban berikut.

Jawaban: ${answer}

Konteks sumber: ${contexts.join("\n\n")}

Kriteria:
1. Apakah klaim-klaim utama memiliki dukungan dari konteks?
2. Apakah atribusi sumber dilakukan dengan benar?
3. Apakah tidak ada fabrikasi referensi?
4. Apakah kutipan akurat terhadap sumber asli?

Berikan skor 0-1. Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Citation accuracy calculation error:", error);
        return 0;
    }
}

export async function calculateTerminologyCorrectness(
    answer: string,
    contexts: string[],
    domain?: string
): Promise<number> {
    if (!answer) return 0;

    try {
        const domainContext = domain || "akademik/universitas";

        const prompt = `Evaluasi ketepatan penggunaan terminologi dalam jawaban untuk domain ${domainContext}.

Jawaban: ${answer}

Konteks referensi: ${contexts.slice(0, 2).join("\n")}

Kriteria:
1. Penggunaan istilah teknis yang tepat dan konsisten
2. Definisi yang akurat
3. Tidak ada kesalahan penggunaan jargon
4. Konsistensi dengan terminologi standar di bidang terkait
5. Penggunaan singkatan yang tepat

Berikan skor 0-1. Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Terminology correctness calculation error:", error);
        return 0;
    }
}

export async function calculateHallucinationRate(answer: string, contexts: string[]): Promise<number> {
    if (!answer) return 1; // No answer = 100% hallucination

    try {
        const prompt = `Analisis jawaban berikut untuk mendeteksi halusinasi (informasi yang dibuat-buat atau tidak akurat).

Jawaban: ${answer}

Konteks yang tersedia: ${contexts.join("\n\n")}

Identifikasi:
1. Fakta yang tidak ada dalam konteks dan tidak dapat diverifikasi
2. Klaim yang bertentangan dengan konteks
3. Detail spesifik (angka, nama, tanggal) yang tidak didukung
4. Generalisasi berlebihan tanpa dasar

Berikan TINGKAT HALUSINASI 0-1 (0 = tidak ada halusinasi, 1 = sepenuhnya halusinasi).
Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Hallucination rate calculation error:", error);
        return 0.5;
    }
}

export async function calculateFactualConsistency(answer: string, contexts: string[]): Promise<number> {
    if (!answer || contexts.length === 0) return 0;

    try {
        // Use NLI-style approach: check if answer is entailed by contexts
        const prompt = `Evaluasi konsistensi faktual menggunakan pendekatan Natural Language Inference.

Premis (Konteks):
${contexts.join("\n\n")}

Hipotesis (Jawaban): ${answer}

Tentukan hubungan:
- ENTAILMENT (1.0): Jawaban sepenuhnya didukung oleh konteks
- NEUTRAL (0.5): Jawaban tidak bertentangan tapi tidak sepenuhnya didukung
- CONTRADICTION (0.0): Jawaban bertentangan dengan konteks

Berikan skor 0-1 berdasarkan tingkat entailment. Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Factual consistency calculation error:", error);
        return 0.5;
    }
}

export async function calculateSourceAttribution(answer: string, contexts: string[]): Promise<number> {
    if (!answer || contexts.length === 0) return 0;

    try {
        // Check if claims are properly attributed to sources
        const prompt = `Evaluasi atribusi sumber dalam jawaban.

Jawaban: ${answer}

Sumber yang tersedia: ${contexts.length} konteks

Kriteria:
1. Apakah klaim-klaim penting diatribusikan ke sumber?
2. Apakah tidak ada klaim tanpa sumber yang seharusnya memiliki sumber?
3. Apakah atribusi akurat (tidak salah mengaitkan)?
4. Apakah pembaca dapat memverifikasi klaim dari sumber?

Berikan skor 0-1. Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Source attribution calculation error:", error);
        return 0.5;
    }
}

export async function calculateContradictionScore(answer: string, contexts: string[]): Promise<number> {
    if (!answer || contexts.length === 0) return 0;

    try {
        const prompt = `Deteksi kontradiksi dalam jawaban terhadap konteks sumber.

Jawaban: ${answer}

Konteks:
${contexts.join("\n\n")}

Identifikasi kontradiksi:
1. Kontradiksi langsung dengan fakta dalam konteks
2. Inkonsistensi logis
3. Angka atau data yang bertentangan
4. Pernyataan yang saling bertentangan dalam jawaban itu sendiri

Berikan skor KEBEBASAN KONTRADIKSI 0-1 (1 = tidak ada kontradiksi, 0 = kontradiksi berat).
Jawab HANYA dengan angka.`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            maxOutputTokens: 10,
        });

        const score = Number.parseFloat(text.trim());
        return Number.isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
        console.error("Contradiction score calculation error:", error);
        return 0.5;
    }
}

export function calculateNDCG(retrievedIds: string[], relevantIds: Set<string>, k?: number): number {
    const results = k ? retrievedIds.slice(0, k) : retrievedIds;

    let dcg = 0;
    let idcg = 0;
    const relevantCount = Math.min(relevantIds.size, results.length);

    results.forEach((id, idx) => {
        const rel = relevantIds.has(id) ? 1 : 0;
        dcg += rel / Math.log2(idx + 2);
    });

    for (let i = 0; i < relevantCount; i++) {
        idcg += 1 / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
}

export function calculateMRR(retrievedIds: string[], relevantIds: Set<string>): number {
    for (let i = 0; i < retrievedIds.length; i++) {
        if (relevantIds.has(retrievedIds[i])) {
            return 1 / (i + 1);
        }
    }
    return 0;
}

export function calculateRetrievalPrecision(retrievedIds: string[], relevantIds: Set<string>, k?: number): number {
    const results = k ? retrievedIds.slice(0, k) : retrievedIds;
    const relevant = results.filter((id) => relevantIds.has(id)).length;
    return results.length > 0 ? relevant / results.length : 0;
}

export async function calculateAllMetrics(
    question: string,
    answer: string,
    contexts: string[],
    groundTruth: string,
    retrievedIds?: string[],
    relevantIds?: Set<string>,
    domain?: string,
    latencyTracker?: ReturnType<typeof createLatencyTracker>
): Promise<EvaluationMetrics> {
    console.log(
        `[calculateAllMetrics] Starting metric calculation - question: "${question.substring(0, 60)}...", answer length: ${answer.length}`
    );
    const [
        // Core RAGAS
        faithfulness,
        answerRelevancy,
        contextPrecision,
        contextRecall,
        answerCorrectness,
        // Domain-specific
        academicRigor,
        citationAccuracy,
        terminologyCorrectness,
        // Hallucination
        hallucinationRate,
        factualConsistency,
        sourceAttribution,
        contradictionScore,
    ] = await Promise.all([
        calculateFaithfulness(answer, contexts),
        calculateAnswerRelevancy(question, answer),
        calculateContextPrecision(question, contexts, groundTruth),
        calculateContextRecall(groundTruth, contexts),
        calculateAnswerCorrectness(answer, groundTruth),
        calculateAcademicRigor(answer, contexts),
        calculateCitationAccuracy(answer, contexts),
        calculateTerminologyCorrectness(answer, contexts, domain),
        calculateHallucinationRate(answer, contexts),
        calculateFactualConsistency(answer, contexts),
        calculateSourceAttribution(answer, contexts),
        calculateContradictionScore(answer, contexts),
    ]);

    console.log(
        `[calculateAllMetrics] Core metrics calculated - faithfulness: ${faithfulness.toFixed(3)}, relevancy: ${answerRelevancy.toFixed(3)}`
    );

    // Calculate retrieval metrics if IDs provided
    const retrievalNdcg = retrievedIds && relevantIds ? calculateNDCG(retrievedIds, relevantIds) : 0;
    const retrievalMrr = retrievedIds && relevantIds ? calculateMRR(retrievedIds, relevantIds) : 0;
    const retrievalPrecision = retrievedIds && relevantIds ? calculateRetrievalPrecision(retrievedIds, relevantIds) : 0;
    console.log(
        `[calculateAllMetrics] Retrieval metrics - NDCG: ${retrievalNdcg.toFixed(3)}, MRR: ${retrievalMrr.toFixed(3)}, Precision: ${retrievalPrecision.toFixed(3)}`
    );

    // Get latency & token metrics using a helper to keep this function compact
    const {
        totalLatencyMs,
        retrievalLatencyMs,
        rerankingLatencyMs,
        generationLatencyMs,
        agentReasoningLatencyMs,
        toolCallLatencyMs,
        planningLatencyMs,
        synthesisLatencyMs,
        totalAgentSteps,
        avgStepLatencyMs,
        tokensPerSecond,
        tokenEfficiency,
    } = aggregateLatencyAndTokenMetrics(latencyTracker, answer, contexts);

    console.log(
        `[calculateAllMetrics] Latency metrics - total: ${totalLatencyMs}ms, generation: ${generationLatencyMs}ms, hallucination rate: ${hallucinationRate.toFixed(3)}`
    );

    return {
        faithfulness,
        answerRelevancy,
        contextPrecision,
        contextRecall,
        answerCorrectness,
        academicRigor,
        citationAccuracy,
        terminologyCorrectness,
        hallucinationRate,
        factualConsistency,
        sourceAttribution,
        contradictionScore,
        retrievalNdcg,
        retrievalMrr,
        retrievalPrecision,
        totalLatencyMs,
        retrievalLatencyMs,
        rerankingLatencyMs,
        generationLatencyMs,
        agentReasoningLatencyMs,
        tokenEfficiency,
        tokensPerSecond,
        toolCallLatencyMs,
        planningLatencyMs,
        synthesisLatencyMs,
        totalAgentSteps,
        avgStepLatencyMs,
    };
}

// Predefined ablation configurations
export const ABLATION_CONFIGS: AblationConfig[] = [
    {
        name: "baseline_no_rag",
        description: "Baseline tanpa RAG - LLM murni",
        useRag: false,
        useReranker: false,
        retrievalStrategy: "vector",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "vector_only",
        description: "Hanya vector similarity search",
        useRag: true,
        useReranker: false,
        retrievalStrategy: "vector",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "bm25_only",
        description: "Hanya Okapi BM25 keyword search",
        useRag: true,
        useReranker: false,
        retrievalStrategy: "keyword",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "hybrid_no_rerank",
        description: "Hybrid retrieval tanpa re-ranking",
        useRag: true,
        useReranker: false,
        retrievalStrategy: "hybrid",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "hybrid_cross_encoder",
        description: "Hybrid dengan Cross-Encoder re-ranking",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "cross_encoder",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "hybrid_llm_rerank",
        description: "Hybrid dengan LLM-based re-ranking",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "llm",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "hybrid_ensemble_rerank",
        description: "Hybrid dengan Ensemble re-ranking",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "recursive",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "semantic_chunking",
        description: "Semantic chunking strategy",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "semantic",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "sentence_window",
        description: "Sentence window chunking",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "sentence_window",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "hierarchical_chunking",
        description: "Hierarchical parent-child chunking",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "hierarchical",
        useAgenticMode: false,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "agentic_mode",
        description: "Agentic RAG dengan multi-step reasoning",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "recursive",
        useAgenticMode: true,
        useGuardrails: false,
        topK: 5,
        language: "auto",
    },
    {
        name: "full_system",
        description: "Full system dengan semua fitur",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "semantic",
        useAgenticMode: true,
        useGuardrails: true,
        topK: 5,
        language: "auto",
    },
    {
        name: "indonesian_optimized",
        description: "Dioptimasi untuk Bahasa Indonesia",
        useRag: true,
        useReranker: true,
        rerankerStrategy: "ensemble",
        retrievalStrategy: "hybrid",
        chunkingStrategy: "semantic",
        useAgenticMode: true,
        useGuardrails: true,
        topK: 7,
        language: "id",
    },
];

// Run ablation study
/**
 * Run an ablation study comparing different RAG configurations.
 * This function uses the actual RAG pipeline (agentic or standard) based on config settings.
 *
 * @param questions - Array of evaluation questions with ground truth answers
 * @param configs - RAG configurations to test (defaults to ABLATION_CONFIGS)
 * @param options - Optional settings for progress callbacks
 * @returns Array of ablation results with metrics for each configuration
 */
export async function runAblationStudy(
    questions: { question: string; groundTruth: string }[],
    configs: AblationConfig[] = ABLATION_CONFIGS,
    options: {
        onProgress?: (configIndex: number, questionIndex: number, totalConfigs: number, totalQuestions: number) => void;
    } = {}
): Promise<AblationResult[]> {
    const results: AblationResult[] = [];
    const { onProgress } = options;

    console.log(
        `[runAblationStudy] Starting ablation study with ${configs.length} configs and ${questions.length} questions`
    );

    for (let configIdx = 0; configIdx < configs.length; configIdx++) {
        const config = configs[configIdx];
        console.log(`[runAblationStudy] Testing config ${configIdx + 1}/${configs.length}: ${config.name}`);

        const latencyTracker = createLatencyTracker();
        latencyTracker.start();

        const sampleResults: AblationResult["sampleResults"] = [];
        const allMetrics: EvaluationMetrics[] = [];

        for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const { question, groundTruth } = questions[qIdx];
            const questionStartTime = Date.now();

            console.log(
                `[runAblationStudy] [${config.name}] Question ${qIdx + 1}/${questions.length}: "${question.substring(0, 50)}..."`
            );

            // Report progress if callback provided
            onProgress?.(configIdx, qIdx, configs.length, questions.length);

            let answer: string;
            let contexts: string[];
            let retrievedIds: string[] | undefined;

            try {
                // Execute the actual RAG pipeline based on configuration
                const pipelineResult = await executeRagPipeline(question, config, latencyTracker);
                answer = pipelineResult.answer;
                contexts = pipelineResult.contexts;
                retrievedIds = pipelineResult.retrievedIds;

                console.log(
                    `[runAblationStudy] [${config.name}] Answer generated - length: ${answer.length}, contexts: ${contexts.length}`
                );
            } catch (error) {
                console.error(`[runAblationStudy] [${config.name}] Error processing question:`, error);
                // On error, use empty results but continue with study
                answer = `[Error] Failed to generate answer for: ${question}`;
                contexts = [];
                retrievedIds = undefined;
            }

            const questionLatencyMs = Date.now() - questionStartTime;

            // Calculate all RAGAS metrics using the actual LLM-based evaluation
            const metrics = await calculateAllMetrics(
                question,
                answer,
                contexts,
                groundTruth,
                retrievedIds,
                undefined, // relevantIds - would need ground truth relevance labels
                "akademik/universitas",
                latencyTracker
            );

            allMetrics.push(metrics);
            sampleResults.push({ question, answer, groundTruth, contexts, latencyMs: questionLatencyMs });
        }

        // Average metrics across all questions for this config
        const avgMetrics = averageMetrics(allMetrics);

        results.push({
            config,
            metrics: avgMetrics,
            latencyProfile: latencyTracker.getProfile(),
            sampleResults,
        });

        console.log(
            `[runAblationStudy] Config ${config.name} completed - avgFaithfulness: ${avgMetrics.faithfulness.toFixed(3)}, avgCorrectness: ${avgMetrics.answerCorrectness.toFixed(3)}`
        );
    }

    console.log(`[runAblationStudy] Ablation study completed - ${results.length} configurations tested`);
    return results;
}

/**
 * Execute the RAG pipeline for a single question based on the ablation config.
 * Routes to either agentic RAG, standard RAG, or baseline LLM based on settings.
 */
async function executeRagPipeline(
    question: string,
    config: AblationConfig,
    latencyTracker: ReturnType<typeof createLatencyTracker>
): Promise<{ answer: string; contexts: string[]; retrievedIds: string[] }> {
    // Baseline: No RAG - pure LLM response
    if (!config.useRag) {
        console.log(`[executeRagPipeline] Using baseline (no RAG) for: ${config.name}`);
        latencyTracker.mark("generation");

        const { text } = await generateText({
            model: CHAT_MODEL,
            system: SYSTEM_PROMPTS.nonRag,
            prompt: question,
            temperature: 0.3,
            experimental_telemetry: telemetryConfig,
        });

        return { answer: text, contexts: [], retrievedIds: [] };
    }

    // Agentic RAG mode: Use the full agentic pipeline with tools
    if (config.useAgenticMode) {
        console.log(`[executeRagPipeline] Using agentic RAG for: ${config.name}`);
        latencyTracker.mark("planning");

        const agenticResult = await runAgenticRag(question, {
            sessionId: crypto.randomUUID(),
            retrievalStrategy: config.retrievalStrategy,
            enableGuardrails: config.useGuardrails,
            maxSteps: 5,
            useReranker: config.useReranker,
            rerankerStrategy: config.rerankerStrategy as RerankerStrategy | undefined,
        });

        latencyTracker.mark("synthesis", { tokensGenerated: agenticResult.answer.length });

        const contexts = agenticResult.retrievedChunks.map((c) => c.content);
        const retrievedIds = agenticResult.retrievedChunks.map((c) => c.chunkId);

        return { answer: agenticResult.answer, contexts, retrievedIds };
    }

    // Standard RAG mode: Retrieval + Generation
    console.log(`[executeRagPipeline] Using standard RAG for: ${config.name}`);

    // Step 1: Retrieval
    latencyTracker.mark("retrieval", { documentsProcessed: config.topK });

    const retrievalResults = await hybridRetrieve(question, {
        strategy: config.retrievalStrategy,
        topK: config.topK,
        language: config.language,
        useReranker: config.useReranker,
        rerankerStrategy: config.rerankerStrategy as RerankerStrategy | undefined,
    });

    const contexts = retrievalResults.map((r) => r.content);
    const retrievedIds = retrievalResults.map((r) => r.chunkId);

    // Step 2: Optional re-ranking (simulated - actual reranking would be in hybrid-retrieval)
    if (config.useReranker) {
        latencyTracker.mark("reranking", { documentsProcessed: retrievalResults.length });
        // Note: Re-ranking is typically already applied in hybridRetrieve when using ensemble strategy
        // This marker is for tracking purposes
    }

    // Step 3: Build context and generate response
    const contextResult = await retrieveContext(question, {
        topK: config.topK,
        strategy: config.retrievalStrategy,
        language: config.language,
        useReranker: config.useReranker,
        rerankerStrategy: config.rerankerStrategy as RerankerStrategy | undefined,
    });

    latencyTracker.mark("generation");

    const ragPrompt = buildRagPrompt(SYSTEM_PROMPTS.rag, contextResult.context, question);

    const ragResponse = await generateText({
        model: CHAT_MODEL,
        prompt: ragPrompt,
        temperature: 0.3,
        experimental_telemetry: telemetryConfig,
    });

    return { answer: ragResponse.text, contexts, retrievedIds };
}

function defaultZeroMetrics(): EvaluationMetrics {
    return {
        faithfulness: 0,
        answerRelevancy: 0,
        contextPrecision: 0,
        contextRecall: 0,
        answerCorrectness: 0,
        academicRigor: 0,
        citationAccuracy: 0,
        terminologyCorrectness: 0,
        hallucinationRate: 0,
        factualConsistency: 0,
        sourceAttribution: 0,
        contradictionScore: 0,
        retrievalNdcg: 0,
        retrievalMrr: 0,
        retrievalPrecision: 0,
        totalLatencyMs: 0,
        retrievalLatencyMs: 0,
        rerankingLatencyMs: 0,
        generationLatencyMs: 0,
        agentReasoningLatencyMs: 0,
        tokenEfficiency: 0,
        tokensPerSecond: 0,
        toolCallLatencyMs: 0,
        planningLatencyMs: 0,
        synthesisLatencyMs: 0,
        totalAgentSteps: 0,
        avgStepLatencyMs: 0,
    };
}

function averageMetrics(metricsArray: EvaluationMetrics[]): EvaluationMetrics {
    if (metricsArray.length === 0) return defaultZeroMetrics();

    const keys = Object.keys(metricsArray[0]) as (keyof EvaluationMetrics)[];
    const sum: Record<string, number> = {};
    for (const k of keys) sum[k as string] = 0;

    for (const m of metricsArray) {
        for (const k of keys) {
            sum[k as string] += Number(m[k]) || 0;
        }
    }

    const n = metricsArray.length;
    const avgMetrics = {} as EvaluationMetrics;
    for (const k of keys) avgMetrics[k] = sum[k as string] / n;
    return avgMetrics;
}

// Generate ablation study report
export function generateAblationReport(results: AblationResult[]): string {
    let report = "# Laporan Studi Ablasi RAG\n\n";
    report += `Tanggal: ${new Date().toISOString()}\n\n`;
    report += "## Ringkasan Eksekutif\n\n";

    // Find best config for each metric
    const bestFaithfulness = results.reduce((best, r) =>
        r.metrics.faithfulness > best.metrics.faithfulness ? r : best
    );
    const bestRelevancy = results.reduce((best, r) =>
        r.metrics.answerRelevancy > best.metrics.answerRelevancy ? r : best
    );
    const lowestHallucination = results.reduce((best, r) =>
        r.metrics.hallucinationRate < best.metrics.hallucinationRate ? r : best
    );
    const lowestLatency = results.reduce((best, r) =>
        r.metrics.totalLatencyMs < best.metrics.totalLatencyMs ? r : best
    );

    report += `- **Faithfulness Terbaik**: ${bestFaithfulness.config.name} (${(bestFaithfulness.metrics.faithfulness * 100).toFixed(1)}%)\n`;
    report += `- **Relevancy Terbaik**: ${bestRelevancy.config.name} (${(bestRelevancy.metrics.answerRelevancy * 100).toFixed(1)}%)\n`;
    report += `- **Halusinasi Terendah**: ${lowestHallucination.config.name} (${(lowestHallucination.metrics.hallucinationRate * 100).toFixed(1)}%)\n`;
    report += `- **Latensi Terendah**: ${lowestLatency.config.name} (${lowestLatency.metrics.totalLatencyMs.toFixed(0)}ms)\n\n`;

    report += "## Hasil Detail\n\n";
    report += "| Konfigurasi | Faithfulness | Relevancy | Precision | Hallucination | Latency (ms) | Agent Steps |\n";
    report += "|-------------|--------------|-----------|-----------|------------|--------------|-------------|\n";

    for (const result of results) {
        report += `| ${result.config.name} | `;
        report += `${(result.metrics.faithfulness * 100).toFixed(1)}% | `;
        report += `${(result.metrics.answerRelevancy * 100).toFixed(1)}% | `;
        report += `${(result.metrics.contextPrecision * 100).toFixed(1)}% | `;
        report += `${(result.metrics.hallucinationRate * 100).toFixed(1)}% | `;
        report += `${result.metrics.totalLatencyMs.toFixed(0)} | `;
        report += `${result.metrics.totalAgentSteps} |\n`;
    }

    report += "\n## Analisis Latensi\n\n";
    report += "| Konfigurasi | Total | Retrieval | Reranking | Generation | Agent Reasoning |\n";
    report += "|-------------|-------|-----------|-----------|------------|----------------|\n";

    for (const result of results) {
        report += `| ${result.config.name} | `;
        report += `${result.metrics.totalLatencyMs.toFixed(0)}ms | `;
        report += `${result.metrics.retrievalLatencyMs.toFixed(0)}ms | `;
        report += `${result.metrics.rerankingLatencyMs.toFixed(0)}ms | `;
        report += `${result.metrics.generationLatencyMs.toFixed(0)}ms | `;
        report += `${result.metrics.agentReasoningLatencyMs.toFixed(0)}ms |\n`;
    }

    return report;
}
