/**
 * @fileoverview DOCX Document Extraction Handler
 *
 * WHY mammoth:
 * - Best DOCX parser for text extraction (better than docx npm package)
 * - Handles complex formatting (headings, lists, tables)
 * - Good preservation of semantic structure
 * - Reliable handling of Indonesian characters
 *
 * WHY vs docxtemplater/docx:
 * - mammoth focuses on extraction (not generation)
 * - Better text quality (respects paragraph breaks)
 * - Simpler API for read-only use case
 *
 * Limitations:
 * - Tables are converted to linear text (structure lost)
 * - Images are ignored (text-only focus)
 * - Comments/track changes not extracted
 *
 * Key Features:
 * - Heading detection (numbered sections like \"1.1 Introduction\")
 * - Warning reporting for unsupported features
 * - Preserves paragraph structure
 * - Accurate word counting
 */

import mammoth from "mammoth";
import type { ExtractionResult } from "./types";

// Regex patterns (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;
const NUMBERED_HEADING_PATTERN = /^(?:\d+\.|\d+\.\d+\.?)\s+[A-Z]/;
const NUMBERING_PATTERN = /^(\d+\.)+/;

/**
 * Extract text and metadata from DOCX files using mammoth
 *
 * WHY Numbered Heading Detection:
 * - Indonesian academic documents use numbered sections ("1.1 Pendahuluan")
 * - Numbering depth indicates heading level (1.1.1 is deeper than 1.1)
 * - Enables hierarchical chunking strategies
 *
 * WHY extractRawText vs convertToHtml:
 * - Raw text is cleaner for RAG (no HTML parsing needed)
 * - Preserves paragraph structure without markup noise
 * - Faster extraction (no HTML generation overhead)
 *
 * Process:
 * 1. Convert ArrayBuffer to Node.js Buffer (mammoth requirement)
 * 2. Extract raw text with mammoth
 * 3. Detect numbered headings (1. Introduction, 1.1 Background)
 * 4. Determine heading levels from numbering depth
 * 5. Report warnings for unsupported features
 *
 * @param buffer - DOCX file as ArrayBuffer
 * @param fileName - Original filename for error messages
 * @returns ExtractionResult with text, headings, warnings, and metadata
 * @throws Error if DOCX parsing fails or no text content found
 */
export async function extractDocx(buffer: ArrayBuffer, fileName: string): Promise<ExtractionResult> {
    try {
        // Convert ArrayBuffer to Buffer for mammoth
        const nodeBuffer = Buffer.from(buffer);

        // Extract text with basic formatting preserved
        const result = await mammoth.extractRawText({ buffer: nodeBuffer });

        const fullText = result.value;

        if (!fullText || fullText.trim().length === 0) {
            throw new Error(`DOCX extraction failed: No text content found in ${fileName}`);
        }

        // Check for warnings (e.g., unsupported features)
        const hasWarnings = result.messages.length > 0;
        const warnings = result.messages.map((msg) => msg.message).join("; ");

        // Extract headings using simple heuristics
        const lines = fullText.split("\n");
        const headings: Array<{ text: string; level: number; position: number }> = [];
        let currentPosition = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            // Detect potential headings (short lines, potentially numbered or all caps)
            if (
                trimmed.length > 0 &&
                trimmed.length < 100 &&
                (NUMBERED_HEADING_PATTERN.test(trimmed) || // Numbered headings
                    (trimmed === trimmed.toUpperCase() && trimmed.length > 3)) // All caps
            ) {
                // Determine level based on numbering depth or position
                const numberingMatch = trimmed.match(NUMBERING_PATTERN);
                const level = numberingMatch ? numberingMatch[0].split(".").length : 1;
                headings.push({
                    text: trimmed,
                    level: Math.min(level, 6),
                    position: currentPosition,
                });
            }
            currentPosition += line.length + 1; // +1 for newline
        }

        return {
            text: fullText,
            metadata: {
                structure: {
                    headings: headings.length > 0 ? headings : undefined,
                },
                fileSize: buffer.byteLength,
                wordCount: fullText.split(WORD_SPLIT_PATTERN).filter((w) => w.length > 0).length,
                extractionMethod: "mammoth",
            },
            error: hasWarnings
                ? {
                      code: "DOCX_WARNINGS",
                      message: warnings,
                      recoverable: true,
                  }
                : undefined,
        };
    } catch (error) {
        // Strict failure: throw detailed error
        const errorMessage = error instanceof Error ? error.message : "Unknown DOCX extraction error";
        throw new Error(`DOCX extraction failed for ${fileName}: ${errorMessage}`);
    }
}
