import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

/**
 * Generate a formatted timestamp title for sessions
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

export async function GET() {
    try {
        const sessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));

        return Response.json({ sessions });
    } catch (error) {
        return Response.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }
}

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
