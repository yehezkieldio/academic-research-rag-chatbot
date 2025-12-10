import { and, isNotNull, sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { documentChunks, documents } from "@/lib/db/schema";

export interface RetrievalResult {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    content: string;
    vectorScore: number;
    bm25Score: number;
    fusedScore: number;
    retrievalMethod: "vector" | "keyword" | "hybrid";
    metadata?: {
        pageNumber?: number;
        section?: string;
        headings?: string[];
    };
}

export interface HybridRetrievalOptions {
    topK?: number;
    minScore?: number;
    vectorWeight?: number;
    bm25Weight?: number;
    strategy?: "vector" | "keyword" | "hybrid";
    rrfK?: number;
    language?: "en" | "id" | "auto";
}

export interface ExtractKeywordsOptions {
    language?: "en" | "id" | "auto";
}

const DEFAULT_OPTIONS: Required<HybridRetrievalOptions> = {
    topK: 10,
    minScore: 0.01,
    vectorWeight: 0.6,
    bm25Weight: 0.4,
    strategy: "hybrid",
    rrfK: 60,
    language: "auto",
};

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const BM25_K3 = 8;
const BM25_DELTA = 1;

// Regex patterns defined at top level for performance
const WHITESPACE_REGEX = /\s+/;
const SPECIAL_CHARS_REGEX = /[^\w\s\u00C0-\u024F]/g;

const INDONESIAN_STOP_WORDS = new Set([
    "dan",
    "atau",
    "yang",
    "di",
    "ke",
    "dari",
    "ini",
    "itu",
    "dengan",
    "untuk",
    "pada",
    "adalah",
    "sebagai",
    "dalam",
    "tidak",
    "akan",
    "dapat",
    "telah",
    "oleh",
    "juga",
    "sudah",
    "saat",
    "setelah",
    "bisa",
    "ada",
    "mereka",
    "kami",
    "kita",
    "saya",
    "anda",
    "ia",
    "dia",
    "kamu",
    "beliau",
    "tersebut",
    "hal",
    "antara",
    "lain",
    "seperti",
    "serta",
    "bahwa",
    "karena",
    "secara",
    "namun",
    "tetapi",
    "hanya",
    "jika",
    "maka",
    "agar",
    "ketika",
    "hingga",
    "sampai",
    "masih",
    "pun",
    "lagi",
    "sangat",
    "lebih",
    "kurang",
    "hampir",
    "selalu",
    "sering",
    "kadang",
    "jarang",
    "begitu",
    "demikian",
    "yakni",
    "yaitu",
    "penelitian",
    "berdasarkan",
    "menurut",
    "menunjukkan",
    "menggunakan",
    "terhadap",
    "melalui",
    "terdapat",
    "merupakan",
    "dilakukan",
    "diperoleh",
    "apa",
    "siapa",
    "dimana",
    "kapan",
    "mengapa",
    "bagaimana",
    "berapa",
]);

const ENGLISH_STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "up",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "can",
    "will",
    "just",
    "should",
    "now",
    "also",
    "been",
    "being",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "would",
    "could",
    "might",
    "must",
    "shall",
    "this",
    "that",
    "these",
    "those",
    "is",
    "are",
    "was",
    "were",
    "be",
    "it",
    "its",
    "as",
    "if",
]);

function detectLanguage(text: string): "en" | "id" {
    const indonesianPatterns = [
        /\b(yang|dengan|untuk|dalam|adalah|dapat|telah|sudah|akan)\b/gi,
        /\b(berdasarkan|menurut|menunjukkan|menggunakan|terhadap|merupakan)\b/gi,
        /\b(mahasiswa|universitas|fakultas|jurusan|skripsi|tesis)\b/gi,
    ];

    let indonesianScore = 0;
    for (const pattern of indonesianPatterns) {
        const matches = text.match(pattern);
        indonesianScore += matches ? matches.length : 0;
    }

    return indonesianScore > 5 ? "id" : "en";
}

function stemIndonesian(word: string): string {
    let stem = word.toLowerCase();

    const suffixes = ["kan", "an", "i", "lah", "kah", "nya"];
    for (const suffix of suffixes) {
        if (stem.endsWith(suffix) && stem.length > suffix.length + 2) {
            stem = stem.slice(0, -suffix.length);
            break;
        }
    }

    const prefixes = ["meng", "mem", "men", "me", "peng", "pem", "pen", "pe", "di", "ter", "ber", "ke", "se"];

    for (const prefix of prefixes) {
        if (stem.startsWith(prefix) && stem.length > prefix.length + 2) {
            stem = stem.slice(prefix.length);
            break;
        }
    }

    return stem;
}

function tokenize(text: string, language: "en" | "id" = "en"): string[] {
    const stopWords = language === "id" ? INDONESIAN_STOP_WORDS : ENGLISH_STOP_WORDS;

    const tokens = text
        .toLowerCase()
        .replace(SPECIAL_CHARS_REGEX, " ")
        .split(WHITESPACE_REGEX)
        .filter((token) => token.length > 2)
        .filter((token) => !stopWords.has(token));

    if (language === "id") {
        return tokens.map(stemIndonesian);
    }

    return tokens;
}

function calculateOkapiBM25(
    queryTerms: string[],
    docTerms: string[],
    avgDocLength: number,
    docFrequencies: Map<string, number>,
    totalDocs: number,
    queryTermFreqs?: Map<string, number>
): number {
    const docLength = docTerms.length;
    const termFreqs = new Map<string, number>();

    for (const term of docTerms) {
        termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
    }

    let score = 0;
    for (const term of queryTerms) {
        const tf = termFreqs.get(term) || 0;
        const df = docFrequencies.get(term) || 0;

        if (tf > 0 && df > 0) {
            const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
            const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength)));

            let qtf = 1;
            if (queryTermFreqs) {
                const queryTf = queryTermFreqs.get(term) || 1;
                qtf = ((BM25_K3 + 1) * queryTf) / (BM25_K3 + queryTf);
            }

            score += idf * (tfNorm + BM25_DELTA) * qtf;
        }
    }

    return score;
}

function getQueryTermFreqs(queryTerms: string[]): Map<string, number> {
    const freqs = new Map<string, number>();
    for (const term of queryTerms) {
        freqs.set(term, (freqs.get(term) || 0) + 1);
    }
    return freqs;
}

function reciprocalRankFusion(rankings: { id: string; rank: number }[][], k = 60): Map<string, number> {
    const fusedScores = new Map<string, number>();

    for (const ranking of rankings) {
        for (const { id, rank } of ranking) {
            const currentScore = fusedScores.get(id) || 0;
            fusedScores.set(id, currentScore + 1 / (k + rank));
        }
    }

    return fusedScores;
}

type ChunkData = {
    chunkId: string;
    documentId: string;
    content: string;
    metadata: unknown;
    embedding: number[] | null;
    documentTitle: string;
};

/**
 * Perform vector similarity search using pgvector's native <=> (cosine distance) operator.
 * This is more efficient than in-memory calculation as it leverages database indexing
 * and only returns the top-K results directly from the database.
 *
 * @param query - The search query string
 * @param topK - Number of results to return (used for both vector and BM25 candidate pool)
 * @param language - Language for processing
 * @returns Ranked results with cosine similarity scores
 */
async function performVectorSearch(
    query: string,
    topK: number
): Promise<{ id: string; rank: number; score: number; chunk: ChunkData }[]> {
    const { embedding: queryEmbedding } = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(",")}]`;

    // Use pgvector's native cosine distance operator (<=>)
    // Cosine similarity = 1 - cosine distance
    const results = await db
        .select({
            chunkId: documentChunks.id,
            documentId: documentChunks.documentId,
            content: documentChunks.content,
            metadata: documentChunks.metadata,
            embedding: documentChunks.embedding,
            documentTitle: documents.title,
            // Calculate cosine similarity: 1 - cosine_distance
            vectorScore: sql<number>`1 - (${documentChunks.embedding} <=> ${queryVector}::vector)`,
        })
        .from(documentChunks)
        .innerJoin(documents, sql`${documentChunks.documentId} = ${documents.id}`)
        .where(and(isNotNull(documentChunks.embedding), sql`${documents.processingStatus} = 'completed'`))
        .orderBy(sql`${documentChunks.embedding} <=> ${queryVector}::vector`)
        .limit(topK * 3); // Fetch more candidates for RRF fusion with BM25

    return results.map((row, idx) => ({
        id: row.chunkId,
        rank: idx + 1,
        score: row.vectorScore ?? 0,
        chunk: {
            chunkId: row.chunkId,
            documentId: row.documentId,
            content: row.content,
            metadata: row.metadata,
            embedding: row.embedding as number[] | null,
            documentTitle: row.documentTitle,
        },
    }));
}

/**
 * Perform BM25 keyword search on chunks.
 * Can work on a subset of chunks (from vector search candidates) for efficiency.
 */
function performBM25Search(
    query: string,
    chunks: ChunkData[],
    language: "en" | "id"
): { id: string; rank: number; score: number }[] {
    if (chunks.length === 0) {
        console.log("[performBM25Search] No chunks provided for BM25 search");
        return [];
    }

    console.log(`[performBM25Search] Starting BM25 search on ${chunks.length} chunks, language: ${language}`);
    const queryTerms = tokenize(query, language);
    console.log(
        `[performBM25Search] Query terms after tokenization (${queryTerms.length}): ${queryTerms.slice(0, 5).join(", ")}...`
    );
    const queryTermFreqs = getQueryTermFreqs(queryTerms);
    const docFrequencies = new Map<string, number>();
    const docTermsMap = new Map<string, string[]>();
    let totalLength = 0;

    for (const chunk of chunks) {
        const terms = tokenize(chunk.content, language);
        docTermsMap.set(chunk.chunkId, terms);
        totalLength += terms.length;

        const uniqueTerms = new Set(terms);
        for (const term of uniqueTerms) {
            docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
        }
    }

    const avgDocLength = totalLength / chunks.length;
    console.log(
        `[performBM25Search] Avg doc length: ${avgDocLength.toFixed(2)}, total unique terms: ${docFrequencies.size}`
    );

    const scored = chunks
        .map((chunk) => ({
            id: chunk.chunkId,
            score: calculateOkapiBM25(
                queryTerms,
                docTermsMap.get(chunk.chunkId) || [],
                avgDocLength,
                docFrequencies,
                chunks.length,
                queryTermFreqs
            ),
            rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));

    console.log(`[performBM25Search] BM25 scoring complete, top score: ${scored[0]?.score.toFixed(3) || "N/A"}`);
    return scored;
}

function combineRankings(
    vectorRanking: { id: string; rank: number; score: number }[],
    bm25Ranking: { id: string; rank: number; score: number }[],
    _chunkMap: Map<string, ChunkData>,
    strategy: "vector" | "keyword" | "hybrid",
    rrfK: number
): Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }> {
    const finalScores = new Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }>();

    if (strategy === "hybrid") {
        const fusedScores = reciprocalRankFusion(
            [
                vectorRanking.map((r) => ({ id: r.id, rank: r.rank })),
                bm25Ranking.map((r) => ({ id: r.id, rank: r.rank })),
            ],
            rrfK
        );

        // Combine all unique chunk IDs from both rankings
        const allIds = new Set([...vectorRanking.map((r) => r.id), ...bm25Ranking.map((r) => r.id)]);

        for (const chunkId of allIds) {
            const vectorItem = vectorRanking.find((r) => r.id === chunkId);
            const bm25Item = bm25Ranking.find((r) => r.id === chunkId);

            finalScores.set(chunkId, {
                vectorScore: vectorItem?.score || 0,
                bm25Score: bm25Item?.score || 0,
                fusedScore: fusedScores.get(chunkId) || 0,
            });
        }
    } else if (strategy === "vector") {
        for (const item of vectorRanking) {
            finalScores.set(item.id, {
                vectorScore: item.score,
                bm25Score: 0,
                fusedScore: item.score,
            });
        }
    } else {
        const maxBM25 = Math.max(...bm25Ranking.map((r) => r.score), 1);
        for (const item of bm25Ranking) {
            finalScores.set(item.id, {
                vectorScore: 0,
                bm25Score: item.score,
                fusedScore: item.score / maxBM25,
            });
        }
    }

    return finalScores;
}

function buildResults(
    chunkMap: Map<string, ChunkData>,
    finalScores: Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }>,
    strategy: "vector" | "keyword" | "hybrid"
): RetrievalResult[] {
    const results: RetrievalResult[] = [];

    for (const [chunkId, scores] of finalScores) {
        const chunk = chunkMap.get(chunkId);
        if (!chunk) continue;

        results.push({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            content: chunk.content,
            vectorScore: scores.vectorScore,
            bm25Score: scores.bm25Score,
            fusedScore: scores.fusedScore,
            retrievalMethod: strategy,
            metadata: chunk.metadata as RetrievalResult["metadata"],
        });
    }

    return results;
}

/**
 * Perform hybrid retrieval using pgvector for vector search and BM25 for keyword search.
 *
 * Optimization: Uses pgvector's native <=> operator for efficient database-level vector search
 * instead of fetching all chunks and computing cosine similarity in-memory.
 *
 * For "hybrid" strategy:
 * 1. Vector search returns top-K*3 candidates using pgvector SQL
 * 2. BM25 is computed on the candidate pool (not all documents)
 * 3. Results are fused using Reciprocal Rank Fusion (RRF)
 *
 * This approach is compliant with research constraints in README.md and scales
 * efficiently for large document collections.
 */
export async function hybridRetrieve(query: string, options: HybridRetrievalOptions = {}): Promise<RetrievalResult[]> {
    const retrievalId = crypto.randomUUID().slice(0, 8);
    console.log(`[hybridRetrieve:${retrievalId}] Starting hybrid retrieval pipeline`);
    console.time(`hybridRetrieve:${retrievalId}`);
    const opts = { ...DEFAULT_OPTIONS, ...options };
    console.log(
        `[hybridRetrieve:${retrievalId}] Options - strategy: ${opts.strategy}, topK: ${opts.topK}, language: ${opts.language}`
    );

    // Build a map to store chunk data for efficient lookup
    const chunkMap = new Map<string, ChunkData>();

    const vectorRankingResults: { id: string; rank: number; score: number }[] = [];
    const bm25RankingResults: { id: string; rank: number; score: number }[] = [];
    let detectedLanguage: "en" | "id" = "en";

    if (opts.strategy === "vector" || opts.strategy === "hybrid") {
        // Use pgvector SQL for efficient vector search
        console.log(`[hybridRetrieve:${retrievalId}] Performing vector search`);
        const vectorResults = await performVectorSearch(query, opts.topK);
        console.log(`[hybridRetrieve:${retrievalId}] Vector search returned ${vectorResults.length} results`);

        if (vectorResults.length === 0) {
            console.log(`[hybridRetrieve:${retrievalId}] No vector results found`);
            console.timeEnd(`hybridRetrieve:${retrievalId}`);
            return [];
        }

        // Populate chunk map and vector ranking
        for (const result of vectorResults) {
            chunkMap.set(result.id, result.chunk);
            vectorRankingResults.push({ id: result.id, rank: result.rank, score: result.score });
        }

        // Detect language from first chunk if auto
        detectedLanguage =
            opts.language === "auto" ? detectLanguage(`${query} ${vectorResults[0].chunk.content}`) : opts.language;
        console.log(`[hybridRetrieve:${retrievalId}] Detected language: ${detectedLanguage}`);
    }

    if (opts.strategy === "keyword") {
        // For keyword-only strategy, fetch chunks for BM25
        console.log(`[hybridRetrieve:${retrievalId}] Performing keyword search (BM25 only)`);
        const allChunks = await db
            .select({
                chunkId: documentChunks.id,
                documentId: documentChunks.documentId,
                content: documentChunks.content,
                metadata: documentChunks.metadata,
                embedding: documentChunks.embedding,
                documentTitle: documents.title,
            })
            .from(documentChunks)
            .innerJoin(documents, sql`${documentChunks.documentId} = ${documents.id}`)
            .where(sql`${documents.processingStatus} = 'completed'`)
            .limit(opts.topK * 10); // Limit for performance

        console.log(`[hybridRetrieve:${retrievalId}] Fetched ${allChunks.length} chunks for BM25 search`);

        if (allChunks.length === 0) {
            console.log(`[hybridRetrieve:${retrievalId}] No chunks found for BM25`);
            console.timeEnd(`hybridRetrieve:${retrievalId}`);
            return [];
        }

        for (const chunk of allChunks) {
            chunkMap.set(chunk.chunkId, {
                chunkId: chunk.chunkId,
                documentId: chunk.documentId,
                content: chunk.content,
                metadata: chunk.metadata,
                embedding: chunk.embedding as number[] | null,
                documentTitle: chunk.documentTitle,
            });
        }

        detectedLanguage =
            opts.language === "auto" ? detectLanguage(`${query} ${allChunks[0].content}`) : opts.language;
    }

    // Perform BM25 search on candidate chunks
    if (opts.strategy === "keyword" || opts.strategy === "hybrid") {
        console.log(`[hybridRetrieve:${retrievalId}] Performing BM25 search`);
        const chunksForBM25 = Array.from(chunkMap.values());
        bm25RankingResults.push(...performBM25Search(query, chunksForBM25, detectedLanguage));
        console.log(`[hybridRetrieve:${retrievalId}] BM25 search returned ${bm25RankingResults.length} results`);
    }

    const finalScores = combineRankings(vectorRankingResults, bm25RankingResults, chunkMap, opts.strategy, opts.rrfK);
    console.log(`[hybridRetrieve:${retrievalId}] Combined rankings - total unique results: ${finalScores.size}`);
    const results = buildResults(chunkMap, finalScores, opts.strategy);

    // Log score distribution for debugging
    const allScores = results.map((r) => r.fusedScore).sort((a, b) => b - a);
    console.log(
        `[hybridRetrieve:${retrievalId}] Score distribution - max: ${allScores[0]?.toFixed(4) || "N/A"}, min: ${allScores.at(-1)?.toFixed(4) || "N/A"}, median: ${allScores[Math.floor(allScores.length / 2)]?.toFixed(4) || "N/A"}`
    );

    const finalResults = results
        .sort((a, b) => b.fusedScore - a.fusedScore)
        .filter((r) => r.fusedScore >= opts.minScore)
        .slice(0, opts.topK);

    console.log(
        `[hybridRetrieve:${retrievalId}] Final results: ${finalResults.length} (min score: ${opts.minScore}, topK: ${opts.topK})`
    );
    console.timeEnd(`hybridRetrieve:${retrievalId}`);
    return finalResults;
}

export function extractKeywords(text: string, options: ExtractKeywordsOptions = {}): string[] {
    const language = options.language ?? "auto";
    const detectedLang = language === "auto" ? detectLanguage(text) : language;
    const tokens = tokenize(text, detectedLang);
    const freqs = new Map<string, number>();

    for (const token of tokens) {
        freqs.set(token, (freqs.get(token) || 0) + 1);
    }

    return Array.from(freqs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([term]) => term);
}

export function expandQueryIndonesian(query: string): string[] {
    const synonyms: Record<string, string[]> = {
        penelitian: ["riset", "studi", "kajian", "investigasi"],
        mahasiswa: ["pelajar", "siswa", "peserta didik"],
        dosen: ["pengajar", "guru besar", "profesor", "tenaga pengajar"],
        skripsi: ["tugas akhir", "karya ilmiah", "thesis"],
        tesis: ["thesis", "disertasi"],
        metode: ["metodologi", "pendekatan", "cara", "teknik"],
        hasil: ["temuan", "output", "keluaran", "outcome"],
        analisis: ["pembahasan", "evaluasi", "pengkajian", "telaah"],
        kesimpulan: ["simpulan", "konklusi", "ringkasan"],
        hipotesis: ["dugaan", "asumsi", "perkiraan"],
        variabel: ["parameter", "faktor", "unsur"],
        data: ["informasi", "bukti", "fakta"],
        signifikan: ["bermakna", "penting", "berarti"],
        korelasi: ["hubungan", "keterkaitan", "relasi"],
        dampak: ["pengaruh", "efek", "akibat"],
        implementasi: ["penerapan", "pelaksanaan"],
        evaluasi: ["penilaian", "assessment", "pengukuran"],
    };

    const expandedQueries = [query];
    const lowerQuery = query.toLowerCase();

    for (const [term, syns] of Object.entries(synonyms)) {
        if (lowerQuery.includes(term)) {
            for (const syn of syns) {
                expandedQueries.push(query.replace(new RegExp(term, "gi"), syn));
            }
        }
    }

    return [...new Set(expandedQueries)];
}
