import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { ExtractionResult } from "./types";

// Regex patterns (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;
const HAS_UPPERCASE_PATTERN = /[A-Z]/;
const TITLE_CASE_PATTERN = /^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$/;

/**
 * Extract text and metadata from PDF files using unpdf
 * @throws Error if PDF parsing fails
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
