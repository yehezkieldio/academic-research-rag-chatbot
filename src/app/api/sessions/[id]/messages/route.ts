/**
 * @fileoverview API Route: Session Messages
 *
 * WHY This Endpoint Exists:
 * - Retrieves conversation history for a session
 * - Enables message display in chronological order
 * - Supports conversation replay and analysis
 *
 * Request/Response Flow:
 * 1. Fetch all messages for given session ID
 * 2. Order by creation timestamp (ascending)
 * 3. Return messages with metadata (RAG chunks, agent steps, latency)
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";

/**
 * GET /api/sessions/[id]/messages
 *
 * WHY Chronological Order:
 * - Messages must be displayed in conversation order
 * - Ascending sort ensures correct temporal sequence
 *
 * Path Parameters:
 * - id: string - Session ID
 *
 * Response:
 * - Success (200): { messages: ChatMessage[] } - Array of messages with full metadata
 * - Error (500): { error: string }
 *
 * Message Metadata Includes:
 * - role: "user" | "assistant" | "system"
 * - content: Message text
 * - retrievedChunks: Document chunks used for RAG
 * - agentSteps: Agentic reasoning steps (if applicable)
 * - latencyMs: Response generation time
 * - createdAt: Timestamp
 *
 * @param _request - Next.js request object (unused)
 * @param params - Route parameters with session ID
 * @returns JSON response with messages array
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.sessionId, id))
            .orderBy(asc(chatMessages.createdAt));

        return Response.json({ messages });
    } catch (error) {
        return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}
