import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function GET() {
    try {
        const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));

        return Response.json({ documents: docs });
    } catch (error) {
        console.error("Error fetching documents:", error);
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}

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
