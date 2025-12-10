/**
 * @fileoverview Type Definitions for Document Extraction
 *
 * WHY This Module:
 * - Unified interface for heterogeneous document formats (PDF, DOCX, TXT, MD)
 * - Structured metadata enables format-specific optimizations
 * - Error handling with recoverability information
 * - Extensible design for future format support
 *
 * Key Design Decisions:
 * - ExtractionResult: Combines text + metadata + optional errors
 * - ExtractionMetadata: Rich structure information (pages, headings, encoding)
 * - DocumentStructure: Enables chunk-level attribution (page numbers, sections)
 * - ExtractionError: Distinguishes recoverable vs fatal errors
 */

/**
 * Document extraction result with text, metadata, and error information
 *
 * WHY This Structure:
 * - text: Primary extraction output (what we need for RAG)
 * - metadata: Enables advanced chunking strategies (respect page/section boundaries)
 * - error: Partial failures are acceptable (extract what we can, warn about rest)
 *
 * @property text - Extracted text content (may be empty if extraction failed)
 * @property metadata - Structural and statistical metadata
 * @property error - Optional error information for partial failures
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
