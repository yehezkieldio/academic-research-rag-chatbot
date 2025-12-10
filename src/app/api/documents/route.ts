/**
 * @fileoverview API Route: Document Management
 *
 * WHY This Endpoint Exists:
 * - Provides CRUD operations for document metadata
 * - Enables document list display in management UI
 * - Supports document deletion with cascade to chunks and embeddings
 *
 * Request/Response Flow:
 * 1. GET: Retrieve all documents ordered by creation date
 * 2. DELETE: Remove document and associated chunks from vector store
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

/**
 * GET /api/documents
 *
 * WHY: Fetches document metadata for display in management interface
 * - Orders by creation date (newest first) for better UX
 * - Returns full document objects including metadata and processing status
 *
 * Response:
 * - Success (200): { documents: Document[] } - Array of document objects
 * - Error (500): { error: string } - Database query failure
 *
 * @returns JSON response with documents array
 */
export async function GET() {
    try {
        const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));

        return Response.json({ documents: docs });
    } catch (error) {
        console.error("Error fetching documents:", error);
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}

/**
 * DELETE /api/documents
 *
 * WHY: Allows users to remove uploaded documents from the system
 * - Deletes document metadata and associated chunks/embeddings
 * - Prevents orphaned data in vector store
 *
 * Query Parameters:
 * - id: string (required) - Document ID to delete
 *
 * Response:
 * - Success (200): { success: true }
 * - Error (400): { error: string } - Missing document ID
 * - Error (500): { error: string } - Deletion failure
 *
 * @param request - Request with URL search params
 * @returns JSON response indicating success or failure
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return Response.json({ error: "Document ID required" }, { status: 400 });
        }

        await db.delete(documents).where(eq(documents.id, id));

        return Response.json({ success: true });
    } catch (error) {
        console.error("Error deleting document:", error);
        return Response.json({ error: "Failed to delete document" }, { status: 500 });
    }
}
