import type { ExtractionResult } from "./types";

// Regex patterns (defined at module level for performance)
const WORD_SPLIT_PATTERN = /\s+/;
const MARKDOWN_HEADING_PATTERN = /^(#{1,6})\s+(.+)$/gm;

/**
 * Detect text encoding from buffer
 */
function detectEncoding(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);

    // Check for BOM (Byte Order Mark)
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return "utf-8";
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return "utf-16le";
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return "utf-16be";
    }

    // Default to UTF-8
    return "utf-8";
}

/**
 * Extract markdown headings
 */
function extractMarkdownHeadings(text: string): Array<{ text: string; level: number; position: number }> {
    const headings: Array<{ text: string; level: number; position: number }> = [];
    let match = MARKDOWN_HEADING_PATTERN.exec(text);

    while (match !== null) {
        headings.push({
            text: match[2].trim(),
            level: match[1].length,
            position: match.index,
        });
        match = MARKDOWN_HEADING_PATTERN.exec(text);
    }

    return headings;
}

/**
 * Extract text from plain text files
 * @throws Error if text extraction fails
 */
export function extractText(buffer: ArrayBuffer, fileName: string): ExtractionResult {
    try {
        const encoding = detectEncoding(buffer);
        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(buffer);

        if (!text || text.trim().length === 0) {
            throw new Error(`Text extraction failed: No content found in ${fileName}`);
        }

        return {
            text,
            metadata: {
                encoding,
                fileSize: buffer.byteLength,
                wordCount: text.split(WORD_SPLIT_PATTERN).filter((w) => w.length > 0).length,
                extractionMethod: "text-decoder",
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown text extraction error";
        throw new Error(`Text extraction failed for ${fileName}: ${errorMessage}`);
    }
}

/**
 * Extract text and structure from markdown files
 * @throws Error if markdown extraction fails
 */
export function extractMarkdown(buffer: ArrayBuffer, fileName: string): ExtractionResult {
    try {
        const encoding = detectEncoding(buffer);
        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(buffer);

        if (!text || text.trim().length === 0) {
            throw new Error(`Markdown extraction failed: No content found in ${fileName}`);
        }

        const headings = extractMarkdownHeadings(text);

        return {
            text,
            metadata: {
                encoding,
                structure: {
                    headings: headings.length > 0 ? headings : undefined,
                },
                fileSize: buffer.byteLength,
                wordCount: text.split(WORD_SPLIT_PATTERN).filter((w) => w.length > 0).length,
                extractionMethod: "markdown-parser",
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown markdown extraction error";
        throw new Error(`Markdown extraction failed for ${fileName}: ${errorMessage}`);
    }
}
