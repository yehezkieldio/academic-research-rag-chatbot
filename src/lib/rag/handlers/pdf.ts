import * as pdfjsLib from "pdfjs-dist";
import type { ExtractionResult } from "./types";

// Configure PDF.js worker
if (typeof window === "undefined") {
    // Node.js environment - use legacy build for compatibility
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.mjs");
} else {
    // Browser environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Regex pattern for word counting (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;

/**
 * Extract text and metadata from PDF files using pdfjs-dist
 * @throws Error if PDF parsing fails
 */
export async function extractPdf(buffer: ArrayBuffer, fileName: string): Promise<ExtractionResult> {
    try {
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
        });

        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        // Extract text from all pages
        const textParts: string[] = [];
        const pageBreaks: number[] = [];
        const headings: Array<{ text: string; level: number; position: number }> = [];
        let currentOffset = 0;
        let hasImages = false;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // Extract text content
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item) => {
                    if ("str" in item && "height" in item) {
                        // Check for potential headings based on font size
                        if (item.height > 14) {
                            headings.push({
                                text: item.str.trim(),
                                level: Math.floor((item.height - 10) / 4) + 1,
                                position: currentOffset,
                            });
                        }
                        return item.str;
                    }
                    return "";
                })
                .join(" ");

            // Track page break position
            if (pageNum > 1) {
                pageBreaks.push(currentOffset);
            }

            textParts.push(pageText);
            currentOffset += pageText.length + 2; // +2 for the newlines we'll add

            // Check for images
            const ops = await page.getOperatorList();
            if (ops.fnArray.includes(pdfjsLib.OPS.paintImageXObject)) {
                hasImages = true;
            }

            // Clean up page resources
            page.cleanup();
        }

        const fullText = textParts.join("\n\n");

        if (!fullText || fullText.trim().length === 0) {
            throw new Error(`PDF extraction failed: No text content found in ${fileName}`);
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
                hasImages,
                extractionMethod: "pdfjs-dist",
            },
        };
    } catch (error) {
        // Strict failure: throw detailed error
        const errorMessage = error instanceof Error ? error.message : "Unknown PDF extraction error";
        throw new Error(`PDF extraction failed for ${fileName}: ${errorMessage}`);
    }
}
