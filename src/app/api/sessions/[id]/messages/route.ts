import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";

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
