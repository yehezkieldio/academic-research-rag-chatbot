import { db } from "@/lib/db";
import { documents, type NewDocument } from "@/lib/db/schema";
import type { ChunkingStrategy } from "@/lib/rag/chunking";
import { extractTextFromFile, processDocument } from "@/lib/rag/document-processor";
import type { AcademicDocumentType } from "@/lib/rag/university-domain";
import { detectDocumentType, extractAcademicKeywords, extractCourseInfo } from "@/lib/rag/university-domain";
import { detectDocumentLanguage } from "@/lib/rag/utils/language";

const FILE_NAME_EXTENSION_REGEX = /\.[^/.]+$/;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const category = formData.get("category") as string | null;
        const tags = formData.get("tags") as string | null;
        const chunkingStrategy = (formData.get("chunkingStrategy") as ChunkingStrategy) || "recursive";
        const documentType = (formData.get("documentType") as string) || "auto";
        const languageHint = (formData.get("languageHint") as "auto" | "en" | "id") || "auto";
        const useMistralOcr = formData.get("useMistralOcr") === "true";

        if (!file) {
            return Response.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        if (!(allowedTypes.includes(file.type) || ["pdf", "txt", "md", "docx"].includes(fileExt || ""))) {
            return Response.json({ error: "Unsupported file type" }, { status: 400 });
        }

        // Extract text from file - returns ExtractionResult with text and metadata
        const extractionResult = await extractTextFromFile(file);
        const content = extractionResult.text;

        // Detect document type and language
        const detectedType =
            documentType === "auto" ? await detectDocumentType(content) : (documentType as AcademicDocumentType);
        const detectedLanguage = languageHint === "auto" ? detectDocumentLanguage(content) : languageHint;

        // Extract metadata from content
        const courseInfo = extractCourseInfo(content);
        const keywords = await extractAcademicKeywords(content);

        // Map AcademicDocumentType to DocumentMetadata.documentType
        const mappedDocType = (() => {
            switch (detectedType) {
                case "syllabus":
                case "lecture_notes":
                case "research_paper":
                case "textbook":
                case "assignment":
                    return detectedType;
                case "rps":
                case "modul_kuliah":
                    return "lecture_notes";
                case "exam":
                case "skripsi":
                case "tesis":
                case "disertasi":
                case "thesis":
                case "dissertation":
                case "lab_report":
                case "case_study":
                    return "other";
                default:
                    return "other";
            }
        })();

        // Create document record
        const newDoc: NewDocument = {
            title: file.name.replace(FILE_NAME_EXTENSION_REGEX, ""),
            fileName: file.name,
            fileType: fileExt || file.type,
            fileSize: file.size,
            content,
            metadata: {
                category: category || undefined,
                tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
                documentType: mappedDocType,
                courseCode: courseInfo.courseCode,
                department: courseInfo.courseName,
                keywords,
                // Include extraction metadata if available
                pages: extractionResult.metadata?.pages,
                wordCount: extractionResult.metadata?.wordCount,
            },
            chunkingStrategy,
            useMistralOcr,
            processingStatus: "pending",
        };

        const [insertedDoc] = await db.insert(documents).values(newDoc).returning();

        // Start background processing with proper types
        processDocument(insertedDoc.id, {
            chunkingStrategy,
            language: detectedLanguage,
        }).catch((error) => {
            console.error("Background processing error:", error);
        });

        return Response.json({
            success: true,
            document: insertedDoc,
            language: detectedLanguage,
            message:
                detectedLanguage === "id"
                    ? "Dokumen berhasil diunggah dan sedang diproses"
                    : "Document uploaded and processing started",
        });
    } catch (error) {
        console.error("Upload error:", error);
        return Response.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
    }
}
