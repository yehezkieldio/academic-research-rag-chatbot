import { eq } from "drizzle-orm";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { documentChunks, documents, type NewDocumentChunk } from "@/lib/db/schema";
import { type Chunk, type ChunkingStrategy, chunkDocument, enhanceForAcademic, extractHeadings } from "./chunking";
import { extractDocx } from "./handlers/docx";
import { extractPdf } from "./handlers/pdf";
import { extractMarkdown, extractText } from "./handlers/text";
import type { ExtractionResult } from "./handlers/types";
import { extractKeywords } from "./hybrid-retrieval";
import { extractUniversityMetadata } from "./university-domain";
import { detectDocumentLanguage } from "./utils/language";

export interface ProcessingResult {
    success: boolean;
    documentId: string;
    chunksCreated: number;
    chunkingStrategy: string;
    language?: "en" | "id";
    error?: string;
}

export interface ProcessingOptions {
    chunkingStrategy?: ChunkingStrategy;
    chunkSize?: number;
    chunkOverlap?: number;
    language?: "en" | "id" | "auto"; // Added language option
}

/**
 * Extract text and metadata from various file formats
 * @throws Error if extraction fails
 */
export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
    const fileType = file.type || file.name.split(".").pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();
    const fileName = file.name;

    try {
        switch (fileType) {
            case "application/pdf":
            case "pdf":
                return await extractPdf(buffer, fileName);

            case "text/plain":
            case "txt":
                return extractText(buffer, fileName);

            case "text/markdown":
            case "md":
                return extractMarkdown(buffer, fileName);

            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            case "docx":
                return await extractDocx(buffer, fileName);

            default:
                throw new Error(`Unsupported file type: ${fileType}. Supported formats: PDF, DOCX, TXT, MD`);
        }
    } catch (error) {
        // Re-throw with context
        const errorMessage = error instanceof Error ? error.message : "Unknown extraction error";
        throw new Error(`Failed to extract text from ${fileName}: ${errorMessage}`);
    }
}

async function createChunkRecords(
    documentId: string,
    chunks: Chunk[],
    detectedLanguage: "en" | "id",
    chunkingStrategy: string
): Promise<NewDocumentChunk[]> {
    const enhancedChunks = enhanceForAcademic(chunks, "");
    const chunkTexts = enhancedChunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    return enhancedChunks.map((chunk, i) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        metadata: {
            headings: chunk.metadata?.headings || extractHeadings(chunk.content),
            section: chunk.metadata?.section,
            chunkingStrategy,
            parentChunkId: chunk.metadata?.parentChunkId,
            childChunkIds: chunk.metadata?.childChunkIds,
            sentenceWindowContext: chunk.metadata?.sentenceWindowContext,
        },
        embedding: embeddings[i].embedding,
        keywords: extractKeywords(chunk.content, { language: detectedLanguage }),
    }));
}

/**
 * Insert chunks in batches within a transaction context.
 * @param tx - Transaction instance from db.transaction()
 * @param chunks - Chunks to insert
 */
async function insertChunksBatch(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    chunks: NewDocumentChunk[]
): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await tx.insert(documentChunks).values(batch);
    }
}

/**
 * Update document status. Can be used with or without a transaction context.
 * @param txOrDb - Transaction instance or db instance
 * @param documentId - Document ID to update
 * @param status - New processing status
 * @param data - Additional data to update
 */
async function updateDocumentStatus(
    txOrDb: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
    documentId: string,
    status: "processing" | "completed" | "failed",
    data?: { chunkingStrategy?: string; metadata?: Record<string, unknown>; error?: string }
): Promise<void> {
    const updateData: Record<string, unknown> = { processingStatus: status, updatedAt: new Date() };
    if (data?.chunkingStrategy) updateData.chunkingStrategy = data.chunkingStrategy;
    if (data?.metadata) updateData.metadata = data.metadata;
    if (data?.error) updateData.processingError = data.error;

    await txOrDb.update(documents).set(updateData).where(eq(documents.id, documentId));
}

/**
 * Process a document by chunking, embedding, and storing in the database.
 *
 * Uses database transactions to ensure atomicity:
 * - If chunk insertion or status update fails, all changes are rolled back
 * - Prevents "ghost chunks" from failed processing attempts
 * - Safe for retry after failure
 *
 * @param documentId - The document ID to process
 * @param options - Processing options (chunking strategy, chunk size, etc.)
 * @returns Processing result with success status and chunk count
 */
export async function processDocument(documentId: string, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const { chunkingStrategy = "recursive", chunkSize = 1000, chunkOverlap = 200, language = "auto" } = options;

    // Set processing status before transaction (allows visibility of "processing" state)
    await updateDocumentStatus(db, documentId, "processing");

    try {
        const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);

        if (!doc?.content) {
            throw new Error(doc ? "Document has no content to process" : "Document not found");
        }

        const detectedLanguage = language === "auto" ? detectDocumentLanguage(doc.content) : language;

        const chunks =
            chunkingStrategy === "semantic"
                ? await chunkDocument(doc.content, {
                      strategy: "semantic",
                      chunkSize,
                      semanticThreshold: 0.5,
                      minChunkSize: 100,
                      language: detectedLanguage,
                  })
                : await chunkDocument(doc.content, {
                      strategy: chunkingStrategy as ChunkingStrategy,
                      chunkSize,
                      chunkOverlap,
                      windowSize: 3,
                      levels: 2,
                      language: detectedLanguage,
                  });

        // Prepare chunk records outside transaction (embedding generation)
        const chunkRecords = await createChunkRecords(documentId, chunks, detectedLanguage, chunkingStrategy);
        const universityMetadata = await extractUniversityMetadata(doc.content);

        // Use transaction for chunk insertion and status update
        // This ensures atomicity: either all chunks are inserted AND status is updated,
        // or nothing is changed (automatic rollback on error)
        await db.transaction(async (tx) => {
            // Insert all chunks within transaction
            await insertChunksBatch(tx, chunkRecords);

            // Update document status within same transaction
            await updateDocumentStatus(tx, documentId, "completed", {
                chunkingStrategy,
                metadata: {
                    ...doc.metadata,
                    // @ts-expect-error doc.content is possibly null
                    wordCount: doc.content.split(" ").filter((w: string) => w.trim().length > 0).length,
                    documentType: universityMetadata.documentType as
                        | "syllabus"
                        | "lecture_notes"
                        | "research_paper"
                        | "textbook"
                        | "assignment"
                        | "other",
                    courseCode: universityMetadata.courseCode || doc.metadata?.courseCode,
                    keywords: universityMetadata.keywords,
                },
            });
        });

        return {
            success: true,
            documentId,
            chunksCreated: chunks.length,
            chunkingStrategy,
            language: detectedLanguage,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        // Update status to failed (outside transaction since main transaction rolled back)
        await updateDocumentStatus(db, documentId, "failed", { error: errorMessage });

        return {
            success: false,
            documentId,
            chunksCreated: 0,
            chunkingStrategy,
            error: errorMessage,
        };
    }
}
