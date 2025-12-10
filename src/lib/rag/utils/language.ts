/**
 * Detect document language based on content patterns
 * Always returns Indonesian as the system is Indonesian-only
 */
export function detectDocumentLanguage(_content: string): "id" {
    // Always return Indonesian - system is Indonesian-only
    return "id";
}
