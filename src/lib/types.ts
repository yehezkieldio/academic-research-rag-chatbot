export interface DocumentMetadata {
    author?: string;
    pages?: number;
    wordCount?: number;
    chunksCount?: number;
    source?: string;
    tags?: string[];
    category?: string;
    courseCode?: string;
    department?: string;
    academicYear?: string;
    documentType?: "syllabus" | "lecture_notes" | "research_paper" | "textbook" | "assignment" | "other";
    citations?: string[];
    keywords?: string[];
}

export interface DocumentChunkMetadata {
    pageNumber?: number;
    section?: string;
    headings?: string[];
    chunkingStrategy?: string;
    parentChunkId?: string;
    childChunkIds?: string[];
    sentenceWindowContext?: string; // Surrounding sentences for context
}

export interface GuardrailLogsDetails {
    rule: string;
    matchedContent?: string;
    action: "blocked" | "flagged" | "modified" | "allowed";
    originalContent?: string;
    modifiedContent?: string;
}

export interface RetrievedChunks {
    chunkId: string;
    documentTitle: string;
    content: string;
    similarity: number;
    retrievalMethod?: "vector" | "keyword" | "hybrid";
    bm25Score?: number;
}

export interface AblationStudyConfiguration {
    name: string;
    useRag: boolean;
    useReranker: boolean;
    rerankerStrategy?: string;
    retrievalStrategy: string;
    chunkingStrategy: string;
    useAgenticMode: boolean;
    useGuardrails: boolean;
    topK: number;
}

export interface AblationStudyResult {
    configName: string;
    metrics: Record<string, number>;
}

export interface StatisticalAnalysisResult {
    testName: string;
    statistic: number;
    pValue: number;
    significant: boolean;
    effectSize?: number;
    effectSizeInterpretation?: string;
    confidenceInterval?: { lower: number; upper: number; level: number };
    degreesOfFreedom?: number;
    sampleSize: number;
    interpretation: string;
    interpretationId: string;
}
