import { pipeline } from "@huggingface/transformers";
import { generateText } from "ai";
import { CHAT_MODEL } from "@/lib/ai";
import type { RetrievalResult } from "@/lib/rag/hybrid-retrieval";

// Regex patterns defined at top level to avoid performance issues
const SCORE_REGEX = /\d+\.?\d*/;
const LATIN_REGEX = /[a-zA-Z]/;
const INDONESIAN_WORDS_REGEX = /\b(yang|dengan|untuk|adalah)\b/i;
const DOC_ID_REGEX = /doc_(\d+)/;

export type RerankerStrategy = "cross_encoder" | "llm" | "llm_listwise" | "cohere" | "ensemble" | "none";

export interface RerankerOptions {
    strategy: RerankerStrategy;
    topK?: number;
    minScore?: number;
    language?: "en" | "id" | "auto";
    // Cross-encoder specific
    crossEncoderModel?: string;
    // LLM specific
    llmDetailedScoring?: boolean;
    // Ensemble specific
    ensembleWeights?: {
        crossEncoder: number;
        llm: number;
        original: number;
    };
}

export interface RerankedResult extends RetrievalResult {
    originalRank: number;
    rerankedScore: number;
    rerankerStrategy: RerankerStrategy;
    rerankerReasoning?: string;
}

/**
 * Default reranker options.
 *
 * Strategy choices:
 * - "cross_encoder" (default): Fast TinyBERT-based scoring (~100ms). Recommended for production.
 * - "llm": LLM-based pointwise scoring. Higher quality but slower (~3-5s per query).
 * - "llm_listwise": Single LLM call to rank all documents. Best for Agentic mode.
 * - "cohere": Pairwise comparison style. Experimental.
 * - "ensemble": Combines cross_encoder + llm_listwise. Highest quality but slowest.
 * - "none": No reranking, use original retrieval scores.
 *
 * Production recommendation: Use "cross_encoder" for low latency.
 * Agentic mode recommendation: Use "llm_listwise" or "ensemble" for better relevance.
 */
const DEFAULT_OPTIONS: RerankerOptions = {
    strategy: "cross_encoder", // Changed from "ensemble" for production performance
    topK: 5,
    minScore: 0.3,
    language: "auto",
    llmDetailedScoring: true,
    ensembleWeights: {
        crossEncoder: 0.4,
        llm: 0.4,
        original: 0.2,
    },
};

// @ts-expect-error: expression produces a union type that is too complex to represent.
let crossEncoderPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getCrossEncoderPipeline() {
    if (!crossEncoderPipeline) {
        crossEncoderPipeline = await pipeline("text-classification", "Xenova/ms-marco-TinyBERT-L-2-v2");
    }
    return crossEncoderPipeline;
}

async function crossEncoderScore(query: string, passages: string[]): Promise<number[]> {
    const pipe = await getCrossEncoderPipeline();
    const scores: number[] = [];

    for (const passage of passages) {
        try {
            // Text-classification pipeline expects text and text_pair as separate arguments
            const result = await pipe(query, passage.slice(0, 512));

            // Normalize the result (always an array)
            const first = Array.isArray(result) ? result[0] : result;

            // score can be null, so provide a default
            const score = "score" in first && first.score !== null ? first.score : 0;

            scores.push(score);
        } catch (err) {
            console.error("Cross-encoder scoring error:", err);
            scores.push(0);
        }
    }

    return scores;
}

async function llmRerank(
    query: string,
    passages: { content: string; originalScore: number }[],
    language: "en" | "id",
    detailed = true
): Promise<{ score: number; reasoning?: string }[]> {
    const systemPrompt =
        language === "id"
            ? `Anda adalah penilai relevansi dokumen akademik. Tugas Anda adalah menilai seberapa relevan sebuah bagian dokumen terhadap pertanyaan pengguna.

Berikan skor dari 0.0 hingga 1.0:
- 1.0: Sangat relevan, langsung menjawab pertanyaan
- 0.7-0.9: Relevan, berisi informasi yang berguna
- 0.4-0.6: Cukup relevan, berisi informasi terkait
- 0.1-0.3: Sedikit relevan, hanya menyinggung topik
- 0.0: Tidak relevan sama sekali

${detailed ? "Berikan juga alasan singkat (1 kalimat) dalam bahasa Indonesia." : ""}`
            : `You are an academic document relevance assessor. Your task is to score how relevant a document passage is to a user's question.

Provide a score from 0.0 to 1.0:
- 1.0: Highly relevant, directly answers the question
- 0.7-0.9: Relevant, contains useful information
- 0.4-0.6: Moderately relevant, contains related information
- 0.1-0.3: Slightly relevant, only touches on the topic
- 0.0: Not relevant at all

${detailed ? "Also provide a brief reasoning (1 sentence)." : ""}`;

    // Parallelize all LLM calls
    const promises = passages.map(async (passage) => {
        try {
            const prompt = detailed
                ? `Question: ${query}\n\nPassage: ${passage.content}\n\nRespond in JSON format: {"score": <number>, "reasoning": "<string>"}`
                : `Question: ${query}\n\nPassage: ${passage.content}\n\nRespond with only the relevance score (0.0-1.0):`;

            const { text } = await generateText({
                model: CHAT_MODEL,
                system: systemPrompt,
                prompt,
                maxOutputTokens: detailed ? 150 : 10,
            });

            if (detailed) {
                try {
                    const parsed = JSON.parse(text.trim());
                    return {
                        score: Math.min(1, Math.max(0, parsed.score || 0)),
                        reasoning: parsed.reasoning,
                    };
                } catch {
                    const scoreMatch = text.match(SCORE_REGEX)?.[0];
                    return {
                        score: scoreMatch
                            ? Math.min(1, Math.max(0, Number.parseFloat(scoreMatch)))
                            : passage.originalScore,
                    };
                }
            } else {
                const score = Number.parseFloat(text.trim());
                return {
                    score: Number.isNaN(score) ? passage.originalScore : Math.min(1, Math.max(0, score)),
                };
            }
        } catch (error) {
            console.error("LLM rerank error:", error);
            return { score: passage.originalScore };
        }
    });

    return await Promise.all(promises);
}

// ask LLM once to rank all documents
async function llmListwiseRerank(
    query: string,
    passages: { content: string; id: string; originalScore: number }[],
    language: "en" | "id"
): Promise<Map<string, { score: number; reasoning?: string }>> {
    const results = new Map<string, { score: number; reasoning?: string }>();

    // Initialize with original scores as fallback
    for (const passage of passages) {
        results.set(passage.id, { score: passage.originalScore });
    }

    const systemPrompt =
        language === "id"
            ? `Anda adalah penilai relevansi dokumen akademik. Tugas Anda adalah mengurutkan dokumen berdasarkan relevansinya terhadap pertanyaan.

Urutkan dokumen dari yang paling relevan (rank 1) hingga paling tidak relevan.
Respond dalam format JSON: {"rankings": [{"id": "doc_X", "rank": 1, "score": 0.95, "reasoning": "..."}, ...]}`
            : `You are an academic document relevance assessor. Your task is to rank documents by their relevance to the question.

Rank documents from most relevant (rank 1) to least relevant.
Respond in JSON format: {"rankings": [{"id": "doc_X", "rank": 1, "score": 0.95, "reasoning": "..."}, ...]}`;

    try {
        // Create passages list with IDs
        const passagesList = passages
            .map((p, idx) => `Document ${idx + 1} (id: doc_${idx}):\n${p.content.slice(0, 300)}...`)
            .join("\n\n");

        const prompt = `Question: ${query}\n\n${passagesList}\n\nRank these ${passages.length} documents by relevance:`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            system: systemPrompt,
            prompt,
            maxOutputTokens: 500,
        });

        const parsed = JSON.parse(text.trim());
        const rankings = parsed.rankings || [];

        for (const ranking of rankings) {
            const idMatch = ranking.id?.match(DOC_ID_REGEX);
            if (idMatch) {
                const idx = Number.parseInt(idMatch[1], 10);
                if (idx >= 0 && idx < passages.length) {
                    const actualId = passages[idx].id;
                    // Convert rank to score (rank 1 = highest score)
                    const score = ranking.score || 1.0 - (ranking.rank - 1) * 0.1;
                    results.set(actualId, {
                        score: Math.min(1, Math.max(0, score)),
                        reasoning: ranking.reasoning,
                    });
                }
            }
        }
    } catch (error) {
        console.error("Listwise LLM rerank error:", error);
        // Fall back to original scores (already initialized)
    }

    return results;
}

// Cohere-style re-ranking using pairwise comparison
async function cohereStyleRerank(
    query: string,
    passages: { content: string; id: string }[],
    language: "en" | "id"
): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (passages.length <= 1) {
        for (const p of passages) {
            scores.set(p.id, 1.0);
        }
        return scores;
    }

    // Initialize scores
    for (const p of passages) {
        scores.set(p.id, 0);
    }

    // Pairwise comparisons (sample for efficiency)
    const maxComparisons = Math.min(passages.length * 2, 20);
    const comparisons: [number, number][] = [];

    for (let i = 0; i < maxComparisons && comparisons.length < maxComparisons; i++) {
        const idx1 = Math.floor(Math.random() * passages.length);
        let idx2 = Math.floor(Math.random() * passages.length);
        while (idx2 === idx1) {
            idx2 = Math.floor(Math.random() * passages.length);
        }
        comparisons.push([idx1, idx2]);
    }

    const systemPrompt =
        language === "id"
            ? `Bandingkan dua bagian dokumen dan tentukan mana yang lebih relevan untuk menjawab pertanyaan. Jawab hanya dengan "A" atau "B".`
            : `Compare two document passages and determine which is more relevant for answering the question. Respond with only "A" or "B".`;

    for (const [idx1, idx2] of comparisons) {
        try {
            const { text } = await generateText({
                model: CHAT_MODEL,
                system: systemPrompt,
                prompt: `Question: ${query}\n\nPassage A:\n${passages[idx1].content.slice(0, 500)}\n\nPassage B:\n${passages[idx2].content.slice(0, 500)}\n\nWhich passage is more relevant?`,
                maxOutputTokens: 5,
            });

            const winner = text.trim().toUpperCase();
            if (winner === "A") {
                scores.set(passages[idx1].id, (scores.get(passages[idx1].id) || 0) + 1);
            } else if (winner === "B") {
                scores.set(passages[idx2].id, (scores.get(passages[idx2].id) || 0) + 1);
            }
        } catch {
            // Skip failed comparisons
        }
    }

    // Normalize scores
    const maxScore = Math.max(...Array.from(scores.values()), 1);
    for (const [id, score] of scores) {
        scores.set(id, score / maxScore);
    }

    return scores;
}

function detectLanguage(query: string): "en" | "id" {
    const hasLatin = LATIN_REGEX.test(query);
    const hasIndonesian = INDONESIAN_WORDS_REGEX.test(query);
    return hasLatin && !hasIndonesian ? "en" : "id";
}

export async function rerank(
    query: string,
    results: RetrievalResult[],
    options: Partial<RerankerOptions> = {}
): Promise<RerankedResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.strategy === "none" || results.length === 0) {
        return results.map((r, idx) => ({
            ...r,
            originalRank: idx + 1,
            rerankedScore: r.fusedScore,
            rerankerStrategy: "none" as RerankerStrategy,
        }));
    }

    return await reankInternal(query, results, opts as Required<RerankerOptions>);
}

async function reankInternal(
    query: string,
    results: RetrievalResult[],
    opts: Required<RerankerOptions>
): Promise<RerankedResult[]> {
    // Detect language if auto
    const language = opts.language === "auto" ? detectLanguage(query) : opts.language;

    const rerankedResults: RerankedResult[] = results.map((r, idx) => ({
        ...r,
        originalRank: idx + 1,
        rerankedScore: r.fusedScore,
        rerankerStrategy: opts.strategy,
    }));

    try {
        await applyRerankingStrategy(query, results, rerankedResults, opts, language);
    } catch (error) {
        console.error("Re-ranking error:", error);
        // Fall back to original scores
    }

    // Sort by reranked score and apply filters
    return rerankedResults
        .sort((a, b) => b.rerankedScore - a.rerankedScore)
        .filter((r) => r.rerankedScore >= (opts.minScore || 0))
        .slice(0, opts.topK);
}

async function applyRerankingStrategy(
    query: string,
    results: RetrievalResult[],
    rerankedResults: RerankedResult[],
    opts: Required<RerankerOptions>,
    language: "en" | "id"
): Promise<void> {
    switch (opts.strategy) {
        case "cross_encoder": {
            const scores = await crossEncoderScore(
                query,
                results.map((r) => r.content)
            );
            for (let idx = 0; idx < scores.length; idx++) {
                rerankedResults[idx].rerankedScore = scores[idx];
            }
            break;
        }

        case "llm": {
            const llmResults = await llmRerank(
                query,
                results.map((r) => ({ content: r.content, originalScore: r.fusedScore })),
                language,
                opts.llmDetailedScoring
            );
            for (let idx = 0; idx < llmResults.length; idx++) {
                rerankedResults[idx].rerankedScore = llmResults[idx].score;
                rerankedResults[idx].rerankerReasoning = llmResults[idx].reasoning;
            }
            break;
        }

        case "llm_listwise": {
            const listwiseResults = await llmListwiseRerank(
                query,
                results.map((r) => ({ content: r.content, id: r.chunkId, originalScore: r.fusedScore })),
                language
            );
            for (const r of rerankedResults) {
                const result = listwiseResults.get(r.chunkId);
                if (result) {
                    r.rerankedScore = result.score;
                    r.rerankerReasoning = result.reasoning;
                }
            }
            break;
        }

        case "cohere": {
            const cohereScores = await cohereStyleRerank(
                query,
                results.map((r) => ({ content: r.content, id: r.chunkId })),
                language
            );
            for (const r of rerankedResults) {
                r.rerankedScore = cohereScores.get(r.chunkId) || r.fusedScore;
            }
            break;
        }

        default: {
            await applyEnsembleStrategy(query, results, rerankedResults, opts, language);
            break;
        }
    }
}

async function applyEnsembleStrategy(
    query: string,
    results: RetrievalResult[],
    rerankedResults: RerankedResult[],
    opts: Required<RerankerOptions>,
    language: "en" | "id"
): Promise<void> {
    // Use listwise LLM reranking in ensemble for better performance
    const [crossScores, listwiseResults] = await Promise.all([
        crossEncoderScore(
            query,
            results.map((r) => r.content)
        ),
        llmListwiseRerank(
            query,
            results.map((r) => ({ content: r.content, id: r.chunkId, originalScore: r.fusedScore })),
            language
        ),
    ]);

    const weights = opts.ensembleWeights;
    for (let idx = 0; idx < rerankedResults.length; idx++) {
        const r = rerankedResults[idx];
        const crossScore = crossScores[idx] || 0;
        const llmResult = listwiseResults.get(r.chunkId);
        const llmScore = llmResult?.score || 0;
        const originalScore = r.fusedScore;

        r.rerankedScore = crossScore * weights.crossEncoder + llmScore * weights.llm + originalScore * weights.original;

        // Normalize by total weights
        const totalWeight = weights.crossEncoder + weights.llm + weights.original;
        r.rerankedScore /= totalWeight;

        // Add reasoning from listwise if available
        if (llmResult?.reasoning) {
            r.rerankerReasoning = llmResult.reasoning;
        }
    }
}

// Utility to compare re-ranker performance
export function calculateRerankerMetrics(
    results: RerankedResult[],
    relevantIds: Set<string>
): {
    ndcg: number;
    mrr: number;
    precision: number;
    rankChange: number;
} {
    // NDCG (Normalized Discounted Cumulative Gain)
    let dcg = 0;
    let idcg = 0;
    const relevantCount = Math.min(relevantIds.size, results.length);

    results.forEach((r, idx) => {
        const rel = relevantIds.has(r.chunkId) ? 1 : 0;
        dcg += rel / Math.log2(idx + 2);
    });

    for (let i = 0; i < relevantCount; i++) {
        idcg += 1 / Math.log2(i + 2);
    }

    const ndcg = idcg > 0 ? dcg / idcg : 0;

    // MRR (Mean Reciprocal Rank)
    let mrr = 0;
    for (let i = 0; i < results.length; i++) {
        if (relevantIds.has(results[i].chunkId)) {
            mrr = 1 / (i + 1);
            break;
        }
    }

    // Precision@K
    const precision = results.filter((r) => relevantIds.has(r.chunkId)).length / results.length;

    // Average rank change
    const rankChange =
        results.reduce((sum, r) => {
            const newRank = results.indexOf(r) + 1;
            return sum + Math.abs(newRank - r.originalRank);
        }, 0) / results.length;

    return { ndcg, mrr, precision, rankChange };
}
