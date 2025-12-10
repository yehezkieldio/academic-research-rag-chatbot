/**
 * @fileoverview API Route: Document Upload
 *
 * WHY This Endpoint Exists:
 * - Handles file upload for academic documents (PDF, TXT, MD)
 * - Extracts text content and metadata (course info, keywords, document type)
 * - Initiates background processing for chunking and embedding generation
 *
 * Supported Document Types (12 categories, 77+ types):
 * 1. Traditional Academic: syllabus, thesis, skripsi, RPS, modul
 * 2. Informasi Akademik: CPL, kurikulum, kalender, KRS, kelulusan
 * 3. Dokumen Regulasi: pedoman, peraturan rektor, SK, SOP, tata tertib
 * 4. Administrasi: UKT, cuti, legalisir, magang, formulir
 * 5. Informasi Dosen: profil, publikasi, jadwal mengajar
 * 6. Penelitian: hibah, roadmap, jurnal, prosiding
 * 7. Kemahasiswaan: beasiswa, lomba, UKM, prestasi
 * 8. Fasilitas: lab, perpustakaan, denah kampus
 * 9. PMB: jalur masuk, biaya, kuota, pendaftaran
 * 10. Keuangan: pembayaran, refund, rekening
 * 11. Alumni: tracer study, statistik, ikatan alumni
 * 12. Humas: berita, rilis pers, pengumuman
 *
 * Request/Response Flow:
 * 1. Validate file type and size
 * 2. Extract text content
 * 3. Detect document type (syllabus, lecture notes, research paper, etc.)
 * 4. Extract academic metadata (course code, keywords, language)
 * 5. Create database record with pending status
 * 6. Trigger background processing (chunking → embedding → vector store)
 * 7. Return success with document metadata
 *
 * Integration Points:
 * - Frontend: DocumentUploader component handles multipart/form-data
 * - Document Processor: Background worker for chunking and embedding
 * - Vector Store: Qdrant for semantic search
 */

import { db } from "@/lib/db";
import { documents, type NewDocument } from "@/lib/db/schema";
import type { ChunkingStrategy } from "@/lib/rag/chunking";
import { extractTextFromFile, processDocument } from "@/lib/rag/document-processor";
import type { AcademicDocumentType } from "@/lib/rag/university-domain";
import { detectDocumentType, extractAcademicKeywords, extractCourseInfo } from "@/lib/rag/university-domain";
import { detectDocumentLanguage } from "@/lib/rag/utils/language";
import type { ExtendedDocumentType } from "@/lib/types";

/**
 * Regular expression to extract file extension
 */
const FILE_NAME_EXTENSION_REGEX = /\.[^/.]+$/;

/**
 * POST /api/documents/upload
 *
 * WHY Async Processing:
 * - Document processing (chunking, embedding) can take 30-60 seconds for large files
 * - Immediate response improves UX - user doesn't wait for full processing
 * - Background processing prevents timeout issues in serverless environments
 *
 * Request Body (multipart/form-data):
 * - file: File (required) - Document file to upload (PDF, TXT, MD)
 * - category?: string - Document category for organization
 * - tags?: string - Comma-separated tags
 * - chunkingStrategy: ChunkingStrategy - Algorithm for text splitting (default: "recursive")
 * - documentType: string - Manual type override or "auto" for detection
 * - languageHint: "auto" | "en" | "id" - Language hint for processing (default: "auto")
 *
 * Response:
 * - Success (200): {
 *     success: true,
 *     document: Document,
 *     language: "en" | "id",
 *     message: string
 *   }
 * - Error (400): { error: string } - Invalid file type or missing file
 * - Error (500): { error: string } - Processing error
 *
 * Supported File Types:
 * - PDF: Text-based PDFs
 * - TXT: Plain text files
 * - MD: Markdown files
 *
 * @param request - Next.js request with multipart form data
 * @returns JSON response with document metadata and processing status
 * @throws Error - When file extraction or metadata processing fails
 *
 * @example
 * ```typescript
 * // Frontend usage
 * const formData = new FormData();
 * formData.append('file', file);
 * formData.append('chunkingStrategy', 'recursive');
 *
 * const response = await fetch('/api/documents/upload', {
 *   method: 'POST',
 *   body: formData
 * });
 * ```
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const category = formData.get("category") as string | null;
        const tags = formData.get("tags") as string | null;
        const chunkingStrategy = (formData.get("chunkingStrategy") as ChunkingStrategy) || "recursive";
        const documentType = (formData.get("documentType") as string) || "auto";
        const languageHint = (formData.get("languageHint") as "auto" | "en" | "id") || "auto";

        if (!file) {
            return Response.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        if (!(allowedTypes.includes(file.type) || ["pdf", "txt", "md"].includes(fileExt || ""))) {
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
        // All AcademicDocumentType values are now valid ExtendedDocumentType values
        const mappedDocType = detectedType as ExtendedDocumentType;

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
