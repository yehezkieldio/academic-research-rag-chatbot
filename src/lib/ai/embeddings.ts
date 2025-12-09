import { embed, embedMany } from "ai";
import { EMBEDDING_MODEL } from "@/lib/ai";

export interface EmbeddingResult {
    embedding: number[];
    usage: {
        tokens: number;
    };
}

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

export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
        const { embeddings, usage } = await embedMany({
            model: EMBEDDING_MODEL,
            values: texts,
        });
        return embeddings.map((embedding) => ({
            embedding,
            usage: { tokens: Math.floor((usage?.tokens || 0) / texts.length) },
        }));
    } catch (error) {
        console.error("Error generating embeddings:", error);
        throw error;
    }
}
