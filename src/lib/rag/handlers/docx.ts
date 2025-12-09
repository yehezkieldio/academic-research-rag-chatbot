import mammoth from "mammoth";
import type { ExtractionResult } from "./types";

// Regex patterns (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;
const NUMBERED_HEADING_PATTERN = /^(?:\d+\.|\d+\.\d+\.?)\s+[A-Z]/;
const NUMBERING_PATTERN = /^(\d+\.)+/;

/**
 * Extract text and metadata from DOCX files using mammoth
 * @throws Error if DOCX parsing fails
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
