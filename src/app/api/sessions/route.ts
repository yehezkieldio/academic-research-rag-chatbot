/**
 * @fileoverview API Route: Session Management
 *
 * WHY This Endpoint Exists:
 * - Manages chat session lifecycle (create, list, delete)
 * - Enables conversation history and continuity
 * - Supports multi-session management for organizing conversations
 *
 * Request/Response Flow:
 * - GET: Retrieve all sessions ordered by last update
 * - POST: Create new session with configuration
 * - DELETE: Remove all sessions and messages
 */

import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

/**
 * Generate a formatted timestamp title for sessions
 *
 * WHY: Provides user-friendly default titles instead of UUIDs
 * - Uses Indonesian locale for consistency with target users
 * - Includes date and time for easy identification
 *
 * @returns Formatted session title (e.g., "Chat - 10 Des 2025, 14:30")
 */
function generateTimestampTitle(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    };
    return `Chat - ${now.toLocaleDateString("id-ID", options)}`;
}

/**
 * GET /api/sessions
 *
 * WHY: Lists all chat sessions for sidebar display
 * - Orders by updatedAt to show recently active sessions first
 * - Enables session switching in UI
 *
 * Response:
 * - Success (200): { sessions: ChatSession[] }
 * - Error (500): { error: string }
 *
 * @returns JSON response with sessions array
 */
export async function GET() {
    try {
        const sessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));

        return Response.json({ sessions });
    } catch (error) {
        return Response.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }
}

/**
 * POST /api/sessions
 *
 * WHY: Creates new chat session with configuration
 * - Persists session settings (RAG mode, retrieval strategy)
 * - Generates user-friendly default titles
 * - Returns session ID for immediate use
 *
 * Request Body:
 * - title?: string - Custom session title or auto-generated
 * - useRag: boolean - Enable RAG mode (default: true)
 * - useAgenticMode: boolean - Enable agentic reasoning (default: true)
 * - retrievalStrategy: "vector" | "keyword" | "hybrid" - Retrieval method (default: "hybrid")
 *
 * Response:
 * - Success (200): { session: ChatSession } - Created session with ID
 * - Error (500): { error: string }
 *
 * @param request - Next.js request with JSON body
 * @returns JSON response with created session
 */
export async function POST(request: Request) {
    try {
        const { title, useRag = true, useAgenticMode = true, retrievalStrategy = "hybrid" } = await request.json();

        // Use provided title or generate timestamp-based title
        const sessionTitle = title?.trim() || generateTimestampTitle();

        const [session] = await db
            .insert(chatSessions)
            .values({
                title: sessionTitle,
                useRag,
                useAgenticMode,
                retrievalStrategy,
            })
            .returning();

        return Response.json({ session });
    } catch (error) {
        return Response.json({ error: "Failed to create session" }, { status: 500 });
    }
}

/**
 * DELETE /api/sessions
 *
 * WHY: Allows bulk deletion of all sessions
 * - Useful for cleanup during testing/development
 * - Cascades deletion to all messages
 *
 * Response:
 * - Success (200): { success: true }
 * - Error (500): { error: string }
 *
 * @returns JSON response indicating success or failure
 */
export async function DELETE() {
    try {
        // Delete all messages first
        await db.delete(chatMessages);

        // Delete all sessions
        await db.delete(chatSessions);

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to delete all sessions" }, { status: 500 });
    }
}
