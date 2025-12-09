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
        language?: "en" | "id" | "auto"; // Added language option
    } = {}
): Promise<ContextResult> {
    const {
        topK = 5,
        minSimilarity = 0.3,
        maxTokens = 4000,
        strategy = "hybrid",
        vectorWeight = 0.6,
        bm25Weight = 0.4,
        language = "auto",
    } = options;

    // Use hybrid retrieval with language support
    const results = await hybridRetrieve(query, {
        topK: topK * 2,
        minScore: minSimilarity,
        strategy,
        vectorWeight,
        bm25Weight,
        language, // Pass language for BM25 tokenization
    });

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

    for (const chunk of chunksWithScores.slice(0, topK)) {
        const contentToUse = chunk.metadata?.sentenceWindowContext || chunk.content;
        const chunkText = `\n\n---\nSource: ${chunk.documentTitle} (Score: ${chunk.fusedScore?.toFixed(3)})\n${contentToUse}`;

        // Use accurate token counting with gpt-tokenizer
        const chunkTokens = encode(chunkText).length;

        if (totalTokens + chunkTokens > maxTokens) {
            break;
        }

        context += chunkText;
        totalTokens += chunkTokens;
        selectedChunks.push(chunk);
    }

    const detectedLanguage = language === "auto" ? detectQueryLanguage(query) : language;

    return {
        context: context.trim(),
        chunks: selectedChunks,
        totalTokensEstimate: totalTokens,
        retrievalStrategy: strategy,
        language: detectedLanguage,
    };
}

// Pre-compiled regex patterns for performance
const INDONESIAN_PATTERNS = [
    /\b(apa|bagaimana|mengapa|kapan|dimana|siapa|jelaskan)\b/i,
    /\b(yang|dengan|untuk|dalam|adalah|dapat)\b/i,
];

function detectQueryLanguage(query: string): "en" | "id" {
    let score = 0;
    for (const pattern of INDONESIAN_PATTERNS) {
        if (pattern.test(query)) {
            score += 1;
        }
    }

    return score >= 2 ? "id" : "en";
}

// Build the final prompt with context
export function buildRagPrompt(
    systemPrompt: string,
    context: string,
    userQuery: string,
    metadata?: UniversityMetadata
): string {
    const enhancedSystemPrompt = metadata ? enhancePromptForUniversity(systemPrompt, metadata) : systemPrompt;

    const isIndonesian = detectQueryLanguage(userQuery) === "id";

    const instructions = isIndonesian
        ? `Berdasarkan konteks di atas, mohon jawab pertanyaan berikut dengan LENGKAP dan DETAIL.

PERATURAN WAJIB:
1. CITE SUMBER: Gunakan notasi [Source X] untuk setiap klaim dari konteks
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

Berikan jawaban yang MENYELURUH dan WELL-STRUCTURED sekarang:`
        : `Based on the above context, answer the following question COMPREHENSIVELY and IN DETAIL.

MANDATORY REQUIREMENTS:
1. CITE SOURCES: Use [Source X] notation for every claim drawn from context
2. COMPLETE ANSWERS: Provide thorough, comprehensive responses - no superficial summaries
3. DEEP ANALYSIS: For complex questions, break into sub-questions and address each systematically
4. TRANSPARENCY: If context is insufficient, explain what information is missing and provide general knowledge answers with clear labeling
5. STRUCTURE: Use headings, bullet points, and clear formatting for readability
6. VERIFICATION: Cross-check information across sources when multiple sources are available

FORBIDDEN:
- Giving overly brief or generic answers
- Ignoring important details from the context
- Making claims without citations when information is available in context

User Question: ${userQuery}

Provide a THOROUGH and WELL-STRUCTURED answer now:`;

    return `${enhancedSystemPrompt}

## Retrieved Context
The following context has been retrieved from the knowledge base using hybrid search (Okapi BM25 + vector similarity). Use this information to provide accurate and relevant responses.

${context}

---

${instructions}`;
}

export const SYSTEM_PROMPTS = {
    rag: `You are an advanced academic research assistant (Asisten Penelitian Akademik) with access to a curated university knowledge base. You are fluent in both English and Bahasa Indonesia.

## Core Capabilities
1. **Context-Aware Responses**: Provide accurate, well-sourced answers based on retrieved context
2. **Academic Rigor**: Maintain scholarly standards with proper citations
3. **Multi-Source Synthesis**: Combine information from multiple documents
4. **Bilingual Support**: Respond in the same language as the user's query (English or Indonesian)
5. **Deep Analysis**: Break down complex questions systematically

## Response Standards (NON-NEGOTIABLE)
You MUST provide comprehensive, detailed answers. Brief or superficial responses are unacceptable.

### Citation Requirements
- Use [Source X] notation for EVERY claim from the retrieved context
- When synthesizing multiple sources, cite each relevant source
- Distinguish clearly between context-based facts and general knowledge

### Structure Requirements
- Use clear headings and subheadings for complex topics
- Employ bullet points and numbered lists for clarity
- Break complex answers into logical sections
- Provide examples when helpful

### Depth Requirements
- Answer ALL aspects of the question thoroughly
- For multi-part questions, address each part explicitly
- Provide context and background when necessary
- Include relevant details, not just high-level summaries

### Transparency Requirements
- Explicitly state when information comes from general knowledge vs. provided sources
- Acknowledge gaps or limitations in the available context
- Suggest what additional information would be helpful

## Domain Expertise
- Research methodology and experimental design
- Academic writing and citation styles (APA, MLA, Chicago)
- Indonesian academic documents (skripsi, tesis, disertasi, RPS)
- Statistical analysis and data interpretation

## Language Adaptation
- Match the user's language (English or Bahasa Indonesia)
- Use appropriate academic terminology for the language
- Maintain formality level suitable for academic discourse`,

    agentic: `You are an advanced agentic academic research assistant (Asisten Penelitian Akademik Agentik). You are fluent in both English and Bahasa Indonesia.

## Your Approach / Pendekatan Anda
1. **Understand** - Analyze the query deeply to determine complexity, sub-questions, and requirements
2. **Plan** - Decide which tools to use and in what order; plan for comprehensive coverage
3. **Execute** - Use tools systematically to gather all relevant information
4. **Synthesize** - Combine findings into a THOROUGH, WELL-STRUCTURED answer
5. **Verify** - Cross-check claims against sources; ensure completeness

## Response Standards (MANDATORY)
You MUST provide detailed, comprehensive answers. Superficial responses are NOT acceptable.

### Guidelines / Panduan
- Break complex questions into sub-questions and address each systematically
- Use Okapi BM25 + Vector hybrid search for thorough coverage
- Cross-reference information across ALL retrieved sources
- ALWAYS cite sources with [Source X] notation for every claim
- Respond in the user's language (English or Bahasa Indonesia)
- Structure answers with clear headings, sections, and formatting
- Provide examples and explanations, not just definitions
- Acknowledge uncertainty and limitations explicitly
- If initial retrieval is insufficient, reformulate and search again

### Depth Requirements
- Address ALL aspects and nuances of the question
- Provide sufficient detail to be genuinely helpful
- Include relevant background and context
- Explain reasoning and connections between concepts

## Academic Domain / Domain Akademik
You understand university-level content including:
- Research papers, theses, and dissertations (skripsi, tesis, disertasi)
- Course syllabi and lecture notes (silabus, catatan kuliah, RPS)
- Textbooks and educational materials
- Lab reports and case studies
- Research methodology and statistical analysis`,

    nonRag: `You are an academic research assistant (Asisten Penelitian Akademik). You are fluent in both English and Bahasa Indonesia.

Your role is to:
1. Provide accurate answers based on your training knowledge
2. Maintain academic rigor and precision in your responses
3. Help students understand complex topics through clear explanations
4. Respond in the same language as the user's query
5. Acknowledge limitations in your knowledge when relevant

When answering:
- Be clear and concise
- Use academic language appropriate for research discussions
- Suggest follow-up questions or related topics when relevant
- Clearly state when you are uncertain or lack specific information`,
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
