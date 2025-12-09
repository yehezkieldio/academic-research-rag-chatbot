/**
 * Document extraction result with text, metadata, and error information
 */
export interface ExtractionResult {
    /** Extracted text content */
    text: string;
    /** Metadata about the document structure and extraction */
    metadata: ExtractionMetadata;
    /** Error information if extraction partially failed */
    error?: ExtractionError;
}

/**
 * Metadata captured during document extraction
 */
export interface ExtractionMetadata {
    /** Number of pages in the document */
    pages?: number;
    /** Document structure information (headings, sections) */
    structure?: DocumentStructure;
    /** Encoding information for text files */
    encoding?: string;
    /** File size in bytes */
    fileSize?: number;
    /** Word count */
    wordCount?: number;
    /** Whether the document contains tables */
    hasTables?: boolean;
    /** Whether the document contains images */
    hasImages?: boolean;
    /** Extraction method used */
    extractionMethod?: string;
}

/**
 * Document structure information
 */
export interface DocumentStructure {
    /** Page breaks and their offsets in the text */
    pageBreaks?: number[];
    /** Section headings with their levels and positions */
    headings?: Array<{
        text: string;
        level: number;
        position: number;
    }>;
    /** Table of contents if available */
    tableOfContents?: string[];
}

/**
 * Error information for extraction failures
 */
export interface ExtractionError {
    /** Error code for categorization */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Original error object if available */
    originalError?: unknown;
    /** Whether the error is recoverable */
    recoverable: boolean;
}

/**
 * Supported file types for extraction
 */
export type SupportedFileType = "pdf" | "docx" | "txt" | "md";

/**
 * Handler function signature for document extraction
 */
export type ExtractionHandler = (buffer: ArrayBuffer, fileName: string) => Promise<ExtractionResult>;
