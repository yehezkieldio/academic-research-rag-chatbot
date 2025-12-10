import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";

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

        const [session] = await db
            .insert(chatSessions)
            .values({
                title: title || "New Chat",
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
