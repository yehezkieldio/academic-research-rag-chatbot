/**
 * @fileoverview PDF Document Extraction Handler
 *
 * WHY unpdf:
 * - Pure JavaScript, works in both Node.js and browser
 * - No external dependencies on poppler/ghostscript
 * - Reliable text extraction with page-level granularity
 * - Good handling of Indonesian characters (UTF-8 support)
 *
 * WHY vs pdf-parse:
 * - unpdf has better TypeScript support
 * - Better handling of complex PDF layouts (academic papers)
 * - More reliable metadata extraction
 *
 * Limitations:
 * - Image extraction not implemented (text-only focus)
 * - Complex tables may lose structure (becomes linear text)
 * - Scanned PDFs require OCR (not supported, use preprocessing)
 *
 * Key Features:
 * - Page-level text extraction (tracks page breaks)
 * - Heading detection using heuristics (all-caps, title-case)
 * - Metadata extraction (title, author, page count)
 * - Accurate word counting
 */

import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { ExtractionResult } from "./types";

// Regex patterns (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;
const HAS_UPPERCASE_PATTERN = /[A-Z]/;
const TITLE_CASE_PATTERN = /^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$/;

/**
 * Extract text and metadata from PDF files using unpdf
 *
 * WHY Page-Level Extraction:
 * - Enables accurate page number attribution for citations
 * - Supports chunk-level metadata (which page does this chunk come from?)
 * - Helps with academic papers ("See page 5", "As shown on page 23")
 *
 * WHY Heading Detection Heuristics:
 * - PDFs don't have semantic markup (unlike DOCX)
 * - All-caps text is often a heading in academic papers
 * - Title-case short lines are likely section headings
 * - Imperfect but useful for structure detection
 *
 * Process:
 * 1. Load PDF document proxy
 * 2. Extract text from each page separately
 * 3. Track page breaks for chunking
 * 4. Detect headings using text analysis
 * 5. Extract metadata (page count, file size)
 *
 * @param buffer - PDF file as ArrayBuffer
 * @param fileName - Original filename for error messages
 * @returns ExtractionResult with text, page breaks, headings, and metadata
 * @throws Error if PDF parsing fails or no text content found
 */
export async function extractPdf(buffer: ArrayBuffer, fileName: string): Promise<ExtractionResult> {
    try {
        // Load the PDF document using unpdf
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const numPages = pdf.numPages;

        // Extract text from all pages individually to track page breaks
        const { text: pageTexts } = await extractText(pdf, { mergePages: false });

        // Calculate page breaks and build full text
        const pageBreaks: number[] = [];
        let currentOffset = 0;
        const textParts: string[] = [];

        for (let i = 0; i < pageTexts.length; i++) {
            const pageText = pageTexts[i];

            if (i > 0) {
                pageBreaks.push(currentOffset);
            }

            textParts.push(pageText);
            currentOffset += pageText.length + 2; // +2 for the newlines we'll add
        }

        const fullText = textParts.join("\n\n");

        if (!fullText || fullText.trim().length === 0) {
            throw new Error(`PDF extraction failed: No text content found in ${fileName}`);
        }

        // Extract metadata
        const { info } = await getMeta(pdf, { parseDates: true });

        // Detect potential headings from text analysis
        const headings: Array<{ text: string; level: number; position: number }> = [];
        let textOffset = 0;

        for (const pageText of pageTexts) {
            const lines = pageText.split("\n");

            for (const line of lines) {
                const trimmed = line.trim();

                // Heuristic: Short lines (< 80 chars) in all caps or title case might be headings
                if (trimmed.length > 0 && trimmed.length < 80) {
                    const isAllCaps = trimmed === trimmed.toUpperCase() && HAS_UPPERCASE_PATTERN.test(trimmed);
                    const isTitleCase = TITLE_CASE_PATTERN.test(trimmed);

                    if (isAllCaps || isTitleCase) {
                        headings.push({
                            text: trimmed,
                            level: isAllCaps ? 1 : 2,
                            position: textOffset,
                        });
                    }
                }

                textOffset += line.length + 1; // +1 for newline
            }

            textOffset += 1; // Additional newline between pages
        }

        return {
            text: fullText,
            metadata: {
                pages: numPages,
                structure: {
                    pageBreaks,
                    headings: headings.length > 0 ? headings : undefined,
                },
                fileSize: buffer.byteLength,
                wordCount: fullText.split(WORD_SPLIT_PATTERN).filter((w) => w.length > 0).length,
                hasImages: undefined, // unpdf doesn't easily expose image detection without extractImages
                extractionMethod: "unpdf",
            },
        };
    } catch (error) {
        // Strict failure: throw detailed error
        const errorMessage = error instanceof Error ? error.message : "Unknown PDF extraction error";
        throw new Error(`PDF extraction failed for ${fileName}: ${errorMessage}`);
    }
}
