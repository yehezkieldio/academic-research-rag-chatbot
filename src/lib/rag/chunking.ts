import { cosineSimilarity } from "ai";
import { generateEmbedding } from "@/lib/ai/embeddings";

export type ChunkingStrategy = "recursive" | "semantic" | "sentence_window" | "hierarchical";

export interface ChunkOptions {
    strategy?: ChunkingStrategy;
    chunkSize?: number;
    chunkOverlap?: number;
    separators?: string[];
    // Semantic chunking options
    semanticThreshold?: number; // Similarity threshold for semantic boundaries
    minChunkSize?: number; // Minimum chunk size for semantic
    // Sentence window options
    windowSize?: number; // Number of sentences for context window
    // Hierarchical options
    levels?: number; // Number of hierarchy levels
    language?: "en" | "id" | "auto"; // Added language option
}

export interface Chunk {
    content: string;
    index: number;
    startOffset: number;
    endOffset: number;
    metadata?: {
        pageNumber?: number;
        section?: string;
        headings?: string[];
        chunkingStrategy?: ChunkingStrategy;
        parentChunkId?: string;
        childChunkIds?: string[];
        sentenceWindowContext?: string;
        semanticScore?: number;
        activeHeading?: string;
        offsetSafetyWarning?: boolean;
    };
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
    strategy: "recursive",
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n\n", "\n\n", "\n", ". ", " ", ""],
    semanticThreshold: 0.5,
    minChunkSize: 100,
    windowSize: 3,
    levels: 2,
    language: "en", // Default language set to English
};

// Academic-specific separators
const ACADEMIC_SEPARATORS = [
    "\n\n\n", // Major sections
    "\n\n", // Paragraphs
    /(?<=\.)\s+(?=[A-Z])/, // Sentence boundaries
    "\n", // Line breaks
    /(?<=:)\s+/, // After colons (definitions)
    /(?<=;)\s+/, // After semicolons
    ". ", // Standard sentences
    " ", // Words
    "", // Characters
];

const INDONESIAN_ACADEMIC_SEPARATORS = [
    "\n\n\n", // Major sections (Bab)
    /\n(?=BAB\s+[IVXLCDM]+)/i, // Indonesian chapter markers
    "\n\n", // Paragraphs
    /(?<=\.)\s+(?=[A-Z])/, // Sentence boundaries
    "\n",
    /(?<=:)\s+/,
    /(?<=;)\s+/,
    ". ",
    " ",
    "",
];

// Regex patterns for performance (defined at module scope)
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+(?=[A-Z])/;
const HIERARCHICAL_SEPARATOR_REGEX = /\n(?=BAB\s+[IVXLCDM]+)/i;

const EN_SECTION_PATTERNS = {
    abstract: /^abstract/i,
    introduction: /^introduction/i,
    methodology: /^method(ology|s)?/i,
    results: /^results?/i,
    discussion: /^discussion/i,
    conclusion: /^conclusion/i,
    references: /^references?|bibliography/i,
} as const;

const ID_SECTION_PATTERNS = {
    abstrak: /^abstrak/i,
    pendahuluan: /^(bab\s+[i1][\s:.]*)?(pendahuluan|latar\s+belakang)/i,
    tinjauan_pustaka: /^(bab\s+[ii2][\s:.]*)?(tinjauan\s+pustaka|kajian\s+pustaka)/i,
    metode: /^(bab\s+[iii3][\s:.]*)?(metode|metodologi)/i,
    hasil: /^(bab\s+[iv4][\s:.]*)?(hasil|pembahasan)/i,
    kesimpulan: /^(bab\s+[v5][\s:.]*)?(kesimpulan|simpulan|penutup)/i,
    daftar_pustaka: /^(daftar\s+pustaka|referensi|bibliografi)/i,
    lampiran: /^lampiran/i,
} as const;

// Main chunking function
export async function chunkDocument(text: string, options: ChunkOptions = {}): Promise<Chunk[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const language = opts.language === "auto" || !opts.language ? detectChunkingLanguage(text) : opts.language;

    if (language === "id" && opts.strategy === "recursive") {
        opts.separators = INDONESIAN_ACADEMIC_SEPARATORS as string[];
    }

    switch (opts.strategy) {
        case "semantic":
            return await semanticChunking(text, opts);
        case "sentence_window":
            return sentenceWindowChunking(text, opts);
        case "hierarchical":
            return hierarchicalChunking(text, opts, language);
        default:
            return recursiveChunking(text, opts);
    }
}

export function recursiveChunking(text: string, options: ChunkOptions = {}): Chunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: Chunk[] = [];

    function recursiveSplit(input: string, separators: string[]): string[] {
        if (input.length <= opts.chunkSize) {
            return [input];
        }

        const separator = separators[0];
        const nextSeparators = separators.slice(1);

        if (!separator) {
            const result: string[] = [];
            for (let i = 0; i < input.length; i += opts.chunkSize - opts.chunkOverlap) {
                result.push(input.slice(i, i + opts.chunkSize));
            }
            return result;
        }

        const parts = input.split(separator);
        const result: string[] = [];
        let currentChunk = "";

        for (const part of parts) {
            const potentialChunk = currentChunk ? currentChunk + separator + part : part;

            if (potentialChunk.length <= opts.chunkSize) {
                currentChunk = potentialChunk;
            } else {
                if (currentChunk) {
                    result.push(currentChunk);
                }

                if (part.length > opts.chunkSize && nextSeparators.length > 0) {
                    result.push(...recursiveSplit(part, nextSeparators));
                    currentChunk = "";
                } else {
                    currentChunk = part;
                }
            }
        }

        if (currentChunk) {
            result.push(currentChunk);
        }

        return result;
    }

    const splitResults = recursiveSplit(text, opts.separators);
    let currentOffset = 0;

    for (const splitContent of splitResults) {
        const content = splitContent.trim();
        if (content.length > 0) {
            const startOffset = text.indexOf(content, currentOffset);
            chunks.push({
                content,
                index: chunks.length,
                startOffset: startOffset >= 0 ? startOffset : currentOffset,
                endOffset: startOffset >= 0 ? startOffset + content.length : currentOffset + content.length,
                metadata: {
                    chunkingStrategy: "recursive",
                },
            });
            currentOffset = startOffset >= 0 ? startOffset + content.length : currentOffset + content.length;
        }
    }

    return chunks;
}

interface SemanticChunkMeta {
    startOffset: number;
    endOffset: number;
    offsetWarning: boolean;
}

function createSemanticChunk(
    content: string,
    index: number,
    offsets: SemanticChunkMeta,
    semanticScore: number,
    activeHeading: string | undefined
): Chunk {
    return {
        content,
        index,
        startOffset: offsets.startOffset,
        endOffset: offsets.endOffset,
        metadata: {
            chunkingStrategy: "semantic",
            semanticScore,
            activeHeading,
            offsetSafetyWarning: offsets.offsetWarning,
        },
    };
}

// Semantic chunking - splits based on topic/meaning changes
export async function semanticChunking(text: string, options: ChunkOptions = {}): Promise<Chunk[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return [];

    // Batch generate embeddings to avoid N+1 problem
    const embeddings = await batchGenerateEmbeddings(sentences);

    // Find semantic breakpoints
    const breakpoints: number[] = [0];
    for (let i = 1; i < sentences.length; i++) {
        const similarity = cosineSimilarity(embeddings[i - 1], embeddings[i]);
        if (similarity < opts.semanticThreshold) {
            breakpoints.push(i);
        }
    }
    breakpoints.push(sentences.length);

    // Extract headings with offsets for context awareness
    const headingsWithOffsets = extractHeadingsWithOffsets(text);
    const chunks: Chunk[] = [];
    let currentOffset = 0;

    // Create chunks from breakpoints
    for (let i = 0; i < breakpoints.length - 1; i++) {
        const start = breakpoints[i];
        const end = breakpoints[i + 1];
        const chunkSentences = sentences.slice(start, end);
        const content = chunkSentences.join(" ").trim();

        if (content.length >= opts.minChunkSize) {
            const { startOffset, offsetWarning } = safeOffsetTracking(text, content, currentOffset, currentOffset);
            const endOffset = startOffset >= 0 ? startOffset + content.length : currentOffset + content.length;

            // Calculate average semantic coherence score
            let avgSimilarity = 1;
            if (chunkSentences.length > 1) {
                let totalSim = 0;
                for (let j = start; j < end - 1; j++) {
                    totalSim += cosineSimilarity(embeddings[j], embeddings[j + 1]);
                }
                avgSimilarity = totalSim / (end - start - 1);
            }

            const activeHeading = findActiveHeading(startOffset, headingsWithOffsets);
            chunks.push(
                createSemanticChunk(
                    content,
                    chunks.length,
                    { startOffset, endOffset, offsetWarning },
                    avgSimilarity,
                    activeHeading
                )
            );

            currentOffset = endOffset;
        }
    }

    // If chunks are too large, recursively split them
    const finalChunks: Chunk[] = [];
    for (const chunk of chunks) {
        if (chunk.content.length > opts.chunkSize * 1.5) {
            const subChunks = recursiveChunking(chunk.content, { ...opts, strategy: "recursive" });
            for (const sub of subChunks) {
                finalChunks.push({
                    ...sub,
                    index: finalChunks.length,
                    startOffset: chunk.startOffset + sub.startOffset,
                    endOffset: chunk.startOffset + sub.endOffset,
                    metadata: {
                        ...sub.metadata,
                        chunkingStrategy: "semantic",
                        semanticScore: chunk.metadata?.semanticScore,
                    },
                });
            }
        } else {
            chunk.index = finalChunks.length;
            finalChunks.push(chunk);
        }
    }

    return finalChunks;
}

// Sentence window chunking - stores sentences with surrounding context
export function sentenceWindowChunking(text: string, options: ChunkOptions = {}): Chunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: Chunk[] = [];

    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return [];

    let currentOffset = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        // Get window context
        const windowStart = Math.max(0, i - opts.windowSize);
        const windowEnd = Math.min(sentences.length, i + opts.windowSize + 1);
        const windowContext = sentences.slice(windowStart, windowEnd).join(" ");

        const startOffset = text.indexOf(sentence, currentOffset);

        chunks.push({
            content: sentence,
            index: chunks.length,
            startOffset: startOffset >= 0 ? startOffset : currentOffset,
            endOffset: startOffset >= 0 ? startOffset + sentence.length : currentOffset + sentence.length,
            metadata: {
                chunkingStrategy: "sentence_window",
                sentenceWindowContext: windowContext,
            },
        });

        currentOffset = startOffset >= 0 ? startOffset + sentence.length : currentOffset + sentence.length;
    }

    return chunks;
}

// Hierarchical chunking - creates parent-child relationships
export function hierarchicalChunking(text: string, options: ChunkOptions = {}, language: "en" | "id" = "en"): Chunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: Chunk[] = [];

    const largeSeparators =
        language === "id" ? ["\n\n\n", HIERARCHICAL_SEPARATOR_REGEX as unknown as string, "\n\n"] : ["\n\n\n", "\n\n"];

    const largeChunks = recursiveChunking(text, {
        ...opts,
        chunkSize: opts.chunkSize * 3,
        separators: largeSeparators,
    });

    for (const largeChunk of largeChunks) {
        const parentId = `parent_${chunks.length}`;
        const childIds: string[] = [];

        chunks.push({
            ...largeChunk,
            index: chunks.length,
            metadata: {
                ...largeChunk.metadata,
                chunkingStrategy: "hierarchical",
            },
        });

        const childChunks = recursiveChunking(largeChunk.content, {
            ...opts,
            chunkSize: opts.chunkSize,
            strategy: "recursive",
        });

        for (const childChunk of childChunks) {
            const childId = `child_${chunks.length}`;
            childIds.push(childId);

            chunks.push({
                content: childChunk.content,
                index: chunks.length,
                startOffset: largeChunk.startOffset + childChunk.startOffset,
                endOffset: largeChunk.startOffset + childChunk.endOffset,
                metadata: {
                    ...childChunk.metadata,
                    chunkingStrategy: "hierarchical",
                    parentChunkId: parentId,
                },
            });
        }

        const parentChunk = chunks.find(
            (c) => c.metadata?.chunkingStrategy === "hierarchical" && c.startOffset === largeChunk.startOffset
        );
        if (parentChunk?.metadata) {
            parentChunk.metadata.childChunkIds = childIds;
        }
    }

    return chunks;
}

async function batchGenerateEmbeddings(sentences: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    try {
        const batchResults = await Promise.all(
            sentences.map((sentence) =>
                generateEmbedding(sentence).catch(() => ({
                    embedding: new Array(1536).fill(0),
                }))
            )
        );

        for (const result of batchResults) {
            embeddings.push(result.embedding);
        }
    } catch {
        for (const sentence of sentences) {
            embeddings.push(new Array(1536).fill(0));
        }
    }

    return embeddings;
}

function extractHeadingsWithOffsets(text: string): Array<{ heading: string; offset: number }> {
    const headingsWithOffsets: Array<{ heading: string; offset: number }> = [];

    const headingPatterns = [
        /^#{1,6}\s+(.+)$/gm,
        /^(.+)\n[=]+$/gm,
        /^(.+)\n[-]+$/gm,
        /^[A-Z][A-Z\s]+:?$/gm,
        /^\d+\.\s+[A-Z][^.]+$/gm,
        /^(?:Chapter|Section|Part)\s+\d+/gim,
        /^(?:BAB|Bab)\s+[IVXLCDMivxlcdm]+/gm,
        /^(?:Abstract|Abstrak|Introduction|Pendahuluan|Conclusion|Kesimpulan|References|Daftar Pustaka)/gim,
    ];

    for (const pattern of headingPatterns) {
        pattern.lastIndex = 0;
        // eslint-disable-next-line no-cond-assign
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
            const heading = (match[1] || match[0]).trim();
            if (heading && !headingsWithOffsets.some((h) => h.heading === heading)) {
                headingsWithOffsets.push({
                    heading,
                    offset: match.index,
                });
            }
        }
    }

    return headingsWithOffsets.sort((a, b) => a.offset - b.offset);
}

function findActiveHeading(
    offset: number,
    headingsWithOffsets: Array<{ heading: string; offset: number }>
): string | undefined {
    let activeHeading: string | undefined;

    for (const { heading, offset: hOffset } of headingsWithOffsets) {
        if (hOffset <= offset) {
            activeHeading = heading;
        } else {
            break;
        }
    }

    return activeHeading;
}

function safeOffsetTracking(
    text: string,
    content: string,
    searchStartOffset: number,
    lastFoundOffset: number
): { startOffset: number; offsetWarning: boolean } {
    const foundIndex = text.indexOf(content, searchStartOffset);
    const startOffset = foundIndex >= 0 ? foundIndex : lastFoundOffset + content.length;

    const offsetJump = Math.abs(startOffset - lastFoundOffset);
    const offsetWarning = offsetJump > 2000 && foundIndex >= 0;

    if (offsetWarning) {
        console.warn(
            `[Offset Safety] Unexpected jump of ${offsetJump} chars at index ~${startOffset}. ` +
                `This may indicate duplicate content or text modification. Content: ${content.slice(0, 50)}...`
        );
    }

    return { startOffset, offsetWarning };
}

// Helper: Split text into sentences
function splitIntoSentences(text: string): string[] {
    // Handle academic text patterns
    const processed = text
        // Protect common abbreviations (English)
        .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Fig|et al|i\.e|e\.g|vs|etc)\./gi, (match) => match.replace(".", "<<<DOT>>>"))
        .replace(/\b(No|Hal|Hlm|Jl|Bpk|Ibu|Sdr|Sdri|S\.Pd|S\.T|M\.T|M\.Pd|M\.Sc|Ph\.D)\./gi, (match) =>
            match.replace(".", "<<<DOT>>>")
        )
        // Protect decimal numbers
        .replace(/(\d+)\.(\d+)/g, "$1<<<DOT>>>$2");

    // Split on sentence boundaries
    const sentences = processed
        .split(SENTENCE_BOUNDARY_REGEX)
        .map((s) => s.replace(/<<<DOT>>>/g, ".").trim())
        .filter((s) => s.length > 0);

    return sentences;
}

// Extract headings and structure from text
export function extractHeadings(text: string): string[] {
    const headingPatterns = [
        /^#{1,6}\s+(.+)$/gm, // Markdown headings
        /^(.+)\n[=]+$/gm, // Underline headings (=)
        /^(.+)\n[-]+$/gm, // Underline headings (-)
        /^[A-Z][A-Z\s]+:?$/gm, // ALL CAPS headings
        /^\d+\.\s+[A-Z][^.]+$/gm, // Numbered sections
        /^(?:Chapter|Section|Part)\s+\d+/gim, // Chapter/Section markers
        /^(?:Abstract|Introduction|Conclusion|References|Bibliography|Appendix)/gim, // Academic sections
    ];

    const headings: string[] = [];

    for (const pattern of headingPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            headings.push(match[1] || match[0]);
        }
    }

    return [...new Set(headings)];
}

// Split document by pages (for PDFs)
export function splitByPages(text: string, pageDelimiter = "\f"): string[] {
    return text.split(pageDelimiter).filter((page) => page.trim().length > 0);
}

function detectChunkingLanguage(text: string): "en" | "id" {
    const indonesianIndicators = [
        /\b(yang|dengan|untuk|dalam|adalah|dapat|telah|sudah|akan)\b/gi,
        /\b(berdasarkan|menurut|menunjukkan|menggunakan|terhadap|merupakan)\b/gi,
    ];

    let score = 0;
    for (const pattern of indonesianIndicators) {
        const matches = text.match(pattern);
        score += matches ? matches.length : 0;
    }

    return score > 5 ? "id" : "en";
}

export function enhanceForAcademic(chunks: Chunk[], originalText: string): Chunk[] {
    const language = detectChunkingLanguage(originalText);
    const sectionPatterns = language === "id" ? ID_SECTION_PATTERNS : EN_SECTION_PATTERNS;
    const headingsWithOffsets = extractHeadingsWithOffsets(originalText);

    return chunks.map((chunk) => {
        const enhanced = { ...chunk };

        const headings = extractHeadings(chunk.content);
        if (headings.length > 0) {
            enhanced.metadata = {
                ...enhanced.metadata,
                headings,
            };
        }

        // Add active heading context from document structure
        const activeHeading = findActiveHeading(chunk.startOffset, headingsWithOffsets);
        if (activeHeading && !enhanced.metadata?.activeHeading) {
            enhanced.metadata = {
                ...enhanced.metadata,
                activeHeading,
            };
        }

        for (const [section, pattern] of Object.entries(sectionPatterns)) {
            if (pattern.test(chunk.content.trim())) {
                enhanced.metadata = {
                    ...enhanced.metadata,
                    section,
                };
                break;
            }
        }

        return enhanced;
    });
}
