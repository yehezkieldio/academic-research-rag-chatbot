import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

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
