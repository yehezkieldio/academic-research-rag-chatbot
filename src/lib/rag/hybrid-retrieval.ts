import { cosineSimilarity } from "ai";
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
    minScore: 0.3,
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

async function performVectorSearch(
    query: string,
    allChunks: ChunkData[]
): Promise<{ id: string; rank: number; score: number }[]> {
    const { embedding: queryEmbedding } = await generateEmbedding(query);

    return allChunks
        .map((chunk) => ({
            id: chunk.chunkId,
            score: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding as number[]) : 0,
            rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function performBM25Search(
    query: string,
    allChunks: ChunkData[],
    language: "en" | "id"
): { id: string; rank: number; score: number }[] {
    const queryTerms = tokenize(query, language);
    const queryTermFreqs = getQueryTermFreqs(queryTerms);
    const docFrequencies = new Map<string, number>();
    const docTermsMap = new Map<string, string[]>();
    let totalLength = 0;

    for (const chunk of allChunks) {
        const terms = tokenize(chunk.content, language);
        docTermsMap.set(chunk.chunkId, terms);
        totalLength += terms.length;

        const uniqueTerms = new Set(terms);
        for (const term of uniqueTerms) {
            docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
        }
    }

    const avgDocLength = totalLength / allChunks.length;

    return allChunks
        .map((chunk) => ({
            id: chunk.chunkId,
            score: calculateOkapiBM25(
                queryTerms,
                docTermsMap.get(chunk.chunkId) || [],
                avgDocLength,
                docFrequencies,
                allChunks.length,
                queryTermFreqs
            ),
            rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function combineRankings(
    vectorRanking: { id: string; rank: number; score: number }[],
    bm25Ranking: { id: string; rank: number; score: number }[],
    allChunks: ChunkData[],
    strategy: "vector" | "keyword" | "hybrid",
    rrfK: number
): Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }> {
    let finalScores: Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }>;

    if (strategy === "hybrid") {
        const fusedScores = reciprocalRankFusion(
            [
                vectorRanking.map((r) => ({ id: r.id, rank: r.rank })),
                bm25Ranking.map((r) => ({ id: r.id, rank: r.rank })),
            ],
            rrfK
        );

        finalScores = new Map();
        for (const chunk of allChunks) {
            const vectorItem = vectorRanking.find((r) => r.id === chunk.chunkId);
            const bm25Item = bm25Ranking.find((r) => r.id === chunk.chunkId);

            finalScores.set(chunk.chunkId, {
                vectorScore: vectorItem?.score || 0,
                bm25Score: bm25Item?.score || 0,
                fusedScore: fusedScores.get(chunk.chunkId) || 0,
            });
        }
    } else if (strategy === "vector") {
        finalScores = new Map();
        for (const item of vectorRanking) {
            finalScores.set(item.id, {
                vectorScore: item.score,
                bm25Score: 0,
                fusedScore: item.score,
            });
        }
    } else {
        finalScores = new Map();
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
    allChunks: ChunkData[],
    finalScores: Map<string, { vectorScore: number; bm25Score: number; fusedScore: number }>,
    strategy: "vector" | "keyword" | "hybrid"
): RetrievalResult[] {
    const results: RetrievalResult[] = [];

    for (const chunk of allChunks) {
        const scores = finalScores.get(chunk.chunkId);
        if (!scores) continue;

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

export async function hybridRetrieve(query: string, options: HybridRetrievalOptions = {}): Promise<RetrievalResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

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
        .where(and(isNotNull(documentChunks.embedding), sql`${documents.processingStatus} = 'completed'`));

    if (allChunks.length === 0) {
        return [];
    }

    const language = opts.language === "auto" ? detectLanguage(`${query} ${allChunks[0].content}`) : opts.language;

    let vectorRanking: { id: string; rank: number; score: number }[] = [];
    if (opts.strategy === "vector" || opts.strategy === "hybrid") {
        vectorRanking = await performVectorSearch(query, allChunks);
    }

    let bm25Ranking: { id: string; rank: number; score: number }[] = [];
    if (opts.strategy === "keyword" || opts.strategy === "hybrid") {
        bm25Ranking = performBM25Search(query, allChunks, language);
    }

    const finalScores = combineRankings(vectorRanking, bm25Ranking, allChunks, opts.strategy, opts.rrfK);
    const results = buildResults(allChunks, finalScores, opts.strategy);

    return results
        .sort((a, b) => b.fusedScore - a.fusedScore)
        .filter((r) => r.fusedScore >= opts.minScore)
        .slice(0, opts.topK);
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
