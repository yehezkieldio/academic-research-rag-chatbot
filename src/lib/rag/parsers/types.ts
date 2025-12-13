/**
 * @fileoverview Type Definitions for ASCII Report Parser
 *
 * WHY This Module:
 * - Structured representation of parsed ASCII reports
 * - Enables type-safe manipulation of tables, key-value pairs, and sections
 * - Supports serialization to LLM-ready natural language text
 *
 * Key Structures:
 * - ParsedTable: ASCII table with headers and rows
 * - KeyValuePair: Metadata extracted from "Key: Value" patterns
 * - ParsedSection: Content blocks separated by delimiters
 * - ParsedReport: Complete parsed document structure
 */

/**
 * Represents a parsed ASCII table
 *
 * @property headers - Column header names
 * @property rows - Array of row data, each row is an object mapping header to value
 * @property title - Optional table title (extracted from preceding text)
 */
export interface ParsedTable {
    headers: string[];
    rows: Record<string, string>[];
    title?: string;
}

/**
 * Represents a key-value metadata pair
 *
 * @property key - The metadata key (e.g., "Semester", "Program Studi")
 * @property value - The corresponding value
 */
export interface KeyValuePair {
    key: string;
    value: string;
}

/**
 * Represents a section of the report separated by delimiters
 *
 * @property title - Section title (if detected)
 * @property content - Raw content within the section
 * @property tables - Tables found within this section
 * @property metadata - Key-value pairs found within this section
 */
export interface ParsedSection {
    title?: string;
    content: string;
    tables: ParsedTable[];
    metadata: KeyValuePair[];
}

/**
 * Complete parsed report structure
 *
 * @property sections - All parsed sections
 * @property globalMetadata - Key-value pairs found outside sections (header area)
 * @property rawText - Original raw text before parsing
 */
export interface ParsedReport {
    sections: ParsedSection[];
    globalMetadata: KeyValuePair[];
    rawText: string;
}

/**
 * Result from ASCII report parsing and serialization
 *
 * @property isStructuredReport - Whether the input was detected as a structured report
 * @property parsedReport - The structured parsed data (if detected)
 * @property serializedText - LLM-ready natural language text
 * @property originalText - Original input text
 */
export interface AsciiReportParserResult {
    isStructuredReport: boolean;
    parsedReport?: ParsedReport;
    serializedText: string;
    originalText: string;
}
