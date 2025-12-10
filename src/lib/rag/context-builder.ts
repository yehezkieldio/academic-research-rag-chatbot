import { encode } from "gpt-tokenizer";
import { hybridRetrieve } from "./hybrid-retrieval";
import { enhancePromptForUniversity, type UniversityMetadata } from "./university-domain";

export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    content: string;
    similarity: number;
    vectorScore?: number;
    bm25Score?: number;
    fusedScore?: number;
    retrievalMethod: "vector" | "keyword" | "hybrid";
    metadata?: {
        pageNumber?: number;
        section?: string;
        headings?: string[];
        sentenceWindowContext?: string;
    };
}

export interface ContextResult {
    context: string;
    chunks: RetrievedChunk[];
    totalTokensEstimate: number;
    retrievalStrategy: "vector" | "keyword" | "hybrid";
    language?: "en" | "id"; // Added language field
}

export async function retrieveContext(
    query: string,
    options: {
        topK?: number;
        minSimilarity?: number;
        maxTokens?: number;
        strategy?: "vector" | "keyword" | "hybrid";
        vectorWeight?: number;
        bm25Weight?: number;
        language?: "en" | "id" | "auto";
        useReranker?: boolean;
        rerankerStrategy?: "cross_encoder" | "llm" | "llm_listwise" | "cohere" | "ensemble" | "none";
    } = {}
): Promise<ContextResult> {
    console.log(`[retrieveContext] Starting context retrieval - query: "${query.substring(0, 80)}..."`);
    const {
        topK = 5,
        minSimilarity = 0.3,
        maxTokens = 4000,
        strategy = "hybrid",
        vectorWeight = 0.6,
        bm25Weight = 0.4,
        language = "auto",
        useReranker = true,
        rerankerStrategy = "cross_encoder",
    } = options;

    console.log(
        `[retrieveContext] Options - topK: ${topK}, strategy: ${strategy}, maxTokens: ${maxTokens}, language: ${language}`
    );

    // Use hybrid retrieval with language support
    console.log("[retrieveContext] Executing hybrid retrieval");
    const results = await hybridRetrieve(query, {
        topK: topK * 2,
        minScore: minSimilarity,
        strategy,
        vectorWeight,
        bm25Weight,
        language,
        useReranker: options.useReranker ?? true,
        rerankerStrategy: options.rerankerStrategy ?? "cross_encoder",
    });
    console.log(`[retrieveContext] Hybrid retrieval returned ${results.length} results`);

    // Convert to RetrievedChunk format
    const chunksWithScores: RetrievedChunk[] = results.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        content: r.content,
        similarity: r.fusedScore,
        vectorScore: r.vectorScore,
        bm25Score: r.bm25Score,
        fusedScore: r.fusedScore,
        retrievalMethod: r.retrievalMethod,
        metadata: r.metadata,
    }));

    // Build context string with token limit using accurate tokenization
    let context = "";
    let totalTokens = 0;
    const selectedChunks: RetrievedChunk[] = [];

    console.log(`[retrieveContext] Building context with token limit ${maxTokens}`);
    for (const chunk of chunksWithScores.slice(0, topK)) {
        const contentToUse = chunk.metadata?.sentenceWindowContext || chunk.content;
        const chunkText = `\n\n---\nSource: ${chunk.documentTitle} (Score: ${chunk.fusedScore?.toFixed(3)})\n${contentToUse}`;

        // Use accurate token counting with gpt-tokenizer
        const chunkTokens = encode(chunkText).length;

        if (totalTokens + chunkTokens > maxTokens) {
            console.log("[retrieveContext] Token limit reached - stopping context building");
            break;
        }

        context += chunkText;
        totalTokens += chunkTokens;
        selectedChunks.push(chunk);
    }

    const detectedLanguage = language === "auto" ? detectQueryLanguage(query) : language;
    console.log(
        `[retrieveContext] Context building complete - chunks: ${selectedChunks.length}, tokens: ${totalTokens}`
    );

    return {
        context: context.trim(),
        chunks: selectedChunks,
        totalTokensEstimate: totalTokens,
        retrievalStrategy: strategy,
        language: detectedLanguage,
    };
}

// Import from centralized language utility
import { detectQueryLanguage } from "@/lib/utils/language";

// Build the final prompt with context
export function buildRagPrompt(
    systemPrompt: string,
    context: string,
    userQuery: string,
    metadata?: UniversityMetadata
): string {
    const enhancedSystemPrompt = metadata ? enhancePromptForUniversity(systemPrompt, metadata) : systemPrompt;

    const instructions = `Berdasarkan konteks di atas, mohon jawab pertanyaan berikut dengan LENGKAP dan DETAIL.

PERATURAN WAJIB:
1. KUTIP SUMBER: Gunakan notasi [Source X] untuk setiap klaim dari konteks
2. JAWAB LENGKAP: Berikan jawaban komprehensif, jangan hanya ringkasan superfisial
3. ANALISIS MENDALAM: Jika pertanyaan kompleks, pecah menjadi sub-pertanyaan dan jawab masing-masing
4. TRANSPARANSI: Jika konteks tidak cukup, jelaskan informasi apa yang hilang dan berikan jawaban berbasis pengetahuan umum dengan label yang jelas
5. STRUKTUR: Gunakan heading, bullet points, dan format yang jelas untuk keterbacaan
6. VERIFIKASI: Cross-check informasi antar sumber jika tersedia multiple sources

DILARANG:
- Memberikan jawaban yang terlalu singkat atau generik
- Mengabaikan detail penting dari konteks
- Membuat klaim tanpa sitasi saat informasi tersedia di konteks

Pertanyaan: ${userQuery}

Berikan jawaban yang MENYELURUH dan WELL-STRUCTURED sekarang:`;

    return `${enhancedSystemPrompt}

## Retrieved Context
The following context has been retrieved from the knowledge base using hybrid search (Okapi BM25 + vector similarity). Use this information to provide accurate and relevant responses.

${context}

---

${instructions}`;
}

export const SYSTEM_PROMPTS = {
    rag: `Anda adalah asisten penelitian akademis canggih (Asisten Penelitian Akademik) dengan akses ke basis pengetahuan universitas yang dikurasi. Anda fasih berbahasa Indonesia.

## Kemampuan Utama
1. **Respons Berbasis Konteks**: Berikan jawaban akurat dan bersumber dengan baik berdasarkan konteks yang diambil
2. **Ketelitian Akademis**: Pertahankan standar ilmiah dengan sitasi yang tepat
3. **Sintesis Multi-Sumber**: Kombinasikan informasi dari berbagai dokumen
4. **Analisis Mendalam**: Pecah pertanyaan kompleks secara sistematis

## Standar Respons (TIDAK BOLEH DILANGGAR)
Anda HARUS memberikan jawaban yang komprehensif dan detail. Respons singkat atau superfisial tidak dapat diterima.

### Persyaratan Sitasi
- Gunakan notasi [Source X] untuk SETIAP klaim dari konteks yang diambil
- Saat mensintesis beberapa sumber, kutip setiap sumber yang relevan
- Bedakan dengan jelas antara fakta berbasis konteks dan pengetahuan umum

### Persyaratan Struktur
- Gunakan heading dan subheading yang jelas untuk topik kompleks
- Gunakan bullet points dan numbered lists untuk kejelasan
- Pecah jawaban kompleks menjadi bagian-bagian logis
- Berikan contoh bila membantu

### Persyaratan Kedalaman
- Jawab SEMUA aspek pertanyaan secara menyeluruh
- Untuk pertanyaan multi-bagian, bahas setiap bagian secara eksplisit
- Berikan konteks dan latar belakang bila diperlukan
- Sertakan detail relevan, bukan hanya ringkasan tingkat tinggi

### Persyaratan Transparansi
- Nyatakan secara eksplisit ketika informasi berasal dari pengetahuan umum vs. sumber yang disediakan
- Akui kesenjangan atau keterbatasan dalam konteks yang tersedia
- Sarankan informasi tambahan apa yang akan membantu

## Keahlian Domain
- Metodologi penelitian dan desain eksperimen
- Penulisan akademis dan gaya sitasi (APA, MLA, Chicago)
- Dokumen akademis Indonesia (skripsi, tesis, disertasi, RPS)
- Analisis statistik dan interpretasi data`,

    agentic: `Anda adalah asisten penelitian akademis agentik yang canggih (Asisten Penelitian Akademik Agentik). Anda fasih berbahasa Indonesia.

## Pendekatan Anda
1. **Pahami** - Analisis kueri secara mendalam untuk menentukan kompleksitas, sub-pertanyaan, dan persyaratan
2. **Rencanakan** - Tentukan alat mana yang akan digunakan dan dalam urutan apa; rencanakan untuk cakupan komprehensif
3. **Eksekusi** - Gunakan alat secara sistematis untuk mengumpulkan semua informasi yang relevan
4. **Sintesis** - Kombinasikan temuan menjadi jawaban yang MENYELURUH dan TERSTRUKTUR DENGAN BAIK
5. **Verifikasi** - Cross-check klaim terhadap sumber; pastikan kelengkapan

## Standar Respons (WAJIB)
Anda HARUS memberikan jawaban yang detail dan komprehensif. Respons superfisial TIDAK dapat diterima.

### Panduan
- Pecah pertanyaan kompleks menjadi sub-pertanyaan dan bahas masing-masing secara sistematis
- Gunakan pencarian hibrida Okapi BM25 + Vector untuk cakupan menyeluruh
- Cross-reference informasi di SEMUA sumber yang diambil
- SELALU kutip sumber dengan notasi [Source X] untuk setiap klaim
- Selalu jawab dalam Bahasa Indonesia
- Struktur jawaban dengan heading, bagian, dan format yang jelas
- Berikan contoh dan penjelasan, bukan hanya definisi
- Akui ketidakpastian dan keterbatasan secara eksplisit
- Jika pengambilan awal tidak cukup, formulasikan ulang dan cari lagi

### Persyaratan Kedalaman
- Bahas SEMUA aspek dan nuansa pertanyaan
- Berikan detail yang cukup untuk benar-benar membantu
- Sertakan latar belakang dan konteks yang relevan
- Jelaskan penalaran dan koneksi antar konsep

## Domain Akademik
Anda memahami konten tingkat universitas termasuk:
- Makalah penelitian, tesis, dan disertasi (skripsi, tesis, disertasi)
- Silabus dan catatan kuliah (silabus, catatan kuliah, RPS)
- Buku teks dan materi pendidikan
- Laporan lab dan studi kasus
- Metodologi penelitian dan analisis statistik`,

    nonRag: `Anda adalah asisten penelitian akademis (Asisten Penelitian Akademik). Anda fasih berbahasa Indonesia.

Peran Anda adalah:
1. Memberikan jawaban akurat berdasarkan pengetahuan pelatihan Anda
2. Mempertahankan ketelitian dan presisi akademis dalam respons Anda
3. Membantu mahasiswa memahami topik kompleks melalui penjelasan yang jelas
4. Selalu menjawab dalam Bahasa Indonesia
5. Mengakui keterbatasan dalam pengetahuan Anda ketika relevan

Saat menjawab:
- Jelas dan ringkas
- Gunakan bahasa akademis yang sesuai untuk diskusi penelitian
- Sarankan pertanyaan lanjutan atau topik terkait ketika relevan
- Nyatakan dengan jelas ketika Anda tidak yakin atau kurang informasi spesifik`,
};

// Build context for evaluation (RAGAS metrics)
// Pre-compiled regex pattern for whitespace splitting
const WHITESPACE_PATTERN = /\s+/;

export async function buildEvaluationContext(
    question: string,
    groundTruth: string,
    options: {
        strategy?: "vector" | "keyword" | "hybrid";
    } = {}
): Promise<{
    retrievedContexts: string[];
    contextRelevance: number;
}> {
    const result = await retrieveContext(question, {
        topK: 5,
        strategy: options.strategy || "hybrid",
    });

    const retrievedContexts = result.chunks.map((c) => c.content);

    const groundTruthTerms = groundTruth
        .toLowerCase()
        .split(WHITESPACE_PATTERN)
        .filter((t) => t.length > 4);
    let relevantChunks = 0;

    for (const context of retrievedContexts) {
        const contextLower = context.toLowerCase();
        const matchingTerms = groundTruthTerms.filter((t) => contextLower.includes(t));
        if (matchingTerms.length >= groundTruthTerms.length * 0.3) {
            relevantChunks += 1;
        }
    }

    const contextRelevance = retrievedContexts.length > 0 ? relevantChunks / retrievedContexts.length : 0;

    return {
        retrievedContexts,
        contextRelevance,
    };
}
