/**
 * @fileoverview API Route: Session Detail Operations
 *
 * WHY This Endpoint Exists:
 * - Provides CRUD operations for individual chat sessions
 * - Enables session retrieval, title updates, and deletion
 * - Supports conversation management UI
 *
 * Request/Response Flow:
 * - GET: Retrieve single session by ID
 * - PUT: Update session title
 * - DELETE: Remove session and associated messages
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

/**
 * GET /api/sessions/[id]
 *
 * WHY: Fetches session metadata for display/editing
 *
 * Path Parameters:
 * - id: string - Session ID
 *
 * Response:
 * - Success (200): { session: ChatSession }
 * - Error (404): { error: string } - Session not found
 * - Error (500): { error: string }
 *
 * @param _request - Next.js request object (unused)
 * @param params - Route parameters with session ID
 * @returns JSON response with session data
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));

        if (!session) {
            return Response.json({ error: "Session not found" }, { status: 404 });
        }

        return Response.json({ session });
    } catch (error) {
        return Response.json({ error: "Failed to fetch session" }, { status: 500 });
    }
}

/**
 * PUT /api/sessions/[id]
 *
 * WHY: Allows renaming sessions for better organization
 * - Updates session title and last modified timestamp
 * - Enables meaningful conversation labels
 *
 * Path Parameters:
 * - id: string - Session ID
 *
 * Request Body:
 * - title: string - New session title
 *
 * Response:
 * - Success (200): { session: ChatSession } - Updated session
 * - Error (404): { error: string } - Session not found
 * - Error (500): { error: string }
 *
 * @param request - Next.js request with JSON body
 * @param params - Route parameters with session ID
 * @returns JSON response with updated session
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { title } = await request.json();

        const [session] = await db
            .update(chatSessions)
            .set({
                title,
                updatedAt: new Date(),
            })
            .where(eq(chatSessions.id, id))
            .returning();

        if (!session) {
            return Response.json({ error: "Session not found" }, { status: 404 });
        }

        return Response.json({ session });
    } catch (error) {
        return Response.json({ error: "Failed to update session" }, { status: 500 });
    }
}

/**
 * DELETE /api/sessions/[id]
 *
 * WHY: Removes individual sessions
 * - Cascades deletion to associated messages
 * - Prevents orphaned message records
 *
 * Path Parameters:
 * - id: string - Session ID
 *
 * Response:
 * - Success (200): { success: true }
 * - Error (404): { error: string } - Session not found
 * - Error (500): { error: string }
 *
 * @param _request - Next.js request object (unused)
 * @param params - Route parameters with session ID
 * @returns JSON response indicating success or failure
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Delete messages first (though cascade should handle this)
        await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));

        // Delete session
        const [deleted] = await db.delete(chatSessions).where(eq(chatSessions.id, id)).returning();

        if (!deleted) {
            return Response.json({ error: "Session not found" }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to delete session" }, { status: 500 });
    }
}
