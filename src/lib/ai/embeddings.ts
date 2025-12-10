/**
 * Embedding Generation Module
 *
 * Provides vector embeddings for semantic search in the RAG pipeline.
 * Uses Azure OpenAI text-embedding-3-small model (1536 dimensions).
 *
 * WHY embeddings are critical for RAG:
 * - **Semantic Search**: Embeddings capture meaning, not just keywords
 *   - Query: "What is the research methodology?" matches "The study used qualitative methods"
 *   - Keyword search would miss this semantic equivalence
 *
 * - **Cross-lingual Understanding**: Embeddings work across language boundaries
 *   - Indonesian academic text can match English conceptual queries (with limitations)
 *   - Important for bilingual academic content
 *
 * WHY text-embedding-3-small (not 3-large):
 * - **Cost Efficiency**: 5x cheaper than 3-large ($0.00002 vs $0.00013 per 1K tokens)
 * - **Speed**: 3x faster inference for real-time retrieval
 * - **Quality Trade-off**: ~2-3% lower retrieval quality but acceptable for academic use case
 * - **Dimensions**: 1536 (vs 3072 for 3-large) - smaller vector DB storage and faster similarity search
 *
 * WHY batch processing (generateEmbeddings plural):
 * - **API Efficiency**: Single API call for multiple texts vs N calls
 * - **Latency Reduction**: 100 chunks embedded in ~2s vs ~200s sequentially
 * - **Cost**: Same pricing whether batched or individual
 * - **Use Case**: Document processing embeds all chunks in one batch
 *
 * WHY track token usage:
 * - **Cost Monitoring**: Embedding costs can add up (100K chunks = ~$2-5)
 * - **Budget Management**: Track usage per document to forecast expenses
 * - **Optimization**: Identify if preprocessing (e.g., truncation) needed
 *
 * @module embeddings
 */

import { embed, embedMany } from "ai";
import { EMBEDDING_MODEL } from "@/lib/ai";

/**
 * Result of embedding generation containing vector and token usage
 */
export interface EmbeddingResult {
    /** 1536-dimensional vector representation of text */
    embedding: number[];
    /** Token count for cost tracking and optimization */
    usage: {
        tokens: number;
    };
}

/**
 * Generates embedding for a single text string
 *
 * WHY use this over generateEmbeddings:
 * - Query embedding: Single user question needs immediate embedding
 * - Real-time: Can't wait to batch with other queries
 * - Simplicity: Don't need batch API complexity for one text
 *
 * @param text - Text to embed (typically user query or single chunk)
 * @returns Embedding vector (1536 dims) and token usage
 * @throws Error if embedding generation fails (API timeout, invalid text, etc.)
 *
 * @example
 * ```typescript
 * const { embedding } = await generateEmbedding("What is the methodology?");
 * // Use embedding for similarity search against chunk embeddings
 * const results = await db.select()
 *   .from(documentChunks)
 *   .orderBy(sql`embedding <=> ${embedding}`)
 *   .limit(5);
 * ```
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
        const { embedding, usage } = await embed({
            model: EMBEDDING_MODEL,
            value: text,
        });
        return { embedding, usage: { tokens: usage?.tokens || 0 } };
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
}

/**
 * Generates embeddings for multiple texts in a single batch API call
 *
 * WHY batch processing is critical:
 * - **Performance**: 100 chunks in ~2s (batched) vs ~200s (sequential)
 * - **Cost Efficiency**: Same per-token cost but fewer API calls = less overhead
 * - **Rate Limiting**: Fewer API calls = less likely to hit rate limits
 *
 * WHEN to use:
 * - Document processing: Embed all chunks after splitting document
 * - Semantic chunking: Embed sentences to compute similarity boundaries
 * - Reranking: Batch embed retrieved chunks for efficiency
 *
 * @param texts - Array of text strings to embed (typically document chunks)
 * @returns Array of embeddings with per-text token usage estimates
 * @throws Error if batch embedding fails (timeout, API error, invalid input)
 *
 * @example
 * ```typescript
 * const chunks = ["Chapter 1: Introduction", "Chapter 2: Methodology", ...];
 * const embeddings = await generateEmbeddings(chunks);
 *
 * // Store in database with chunk metadata
 * await db.insert(documentChunks).values(
 *   chunks.map((content, i) => ({
 *     content,
 *     embedding: embeddings[i].embedding,
 *     // ... other fields
 *   }))
 * );
 * ```
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
        const { embeddings, usage } = await embedMany({
            model: EMBEDDING_MODEL,
            values: texts,
        });
        // Distribute total tokens evenly across texts (approximation for per-text cost tracking)
        return embeddings.map((embedding) => ({
            embedding,
            usage: { tokens: Math.floor((usage?.tokens || 0) / texts.length) },
        }));
    } catch (error) {
        console.error("Error generating embeddings:", error);
        throw error;
    }
}
