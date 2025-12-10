/**
 * Centralized language detection utilities
 * System is Indonesian-only, so this always returns "id"
 * This module exists to document the design decision and provide a single source of truth
 */

export type Language = "id";

/**
 * Detects the language of a query.
 * Currently hardcoded to Indonesian as the system is Indonesian-only.
 *
 * @param _query - The query text (ignored in current implementation)
 * @returns Always returns "id" for Indonesian
 */
export function detectQueryLanguage(_query: string): Language {
    // System is Indonesian-only by design
    return "id";
}

/**
 * Detects the language of document content.
 * Uses heuristics to identify Indonesian vs English text.
 *
 * @param content - The text content to analyze
 * @returns "id" for Indonesian (currently the only supported language)
 */
export function detectDocumentLanguage(content: string): Language {
    // For now, all content is processed as Indonesian
    // Future enhancement: add actual detection logic if multilingual support is needed

    const indonesianIndicators = [
        /\b(yang|dengan|untuk|dalam|adalah|dapat|telah|sudah|akan|dari)\b/gi,
        /\b(berdasarkan|menurut|menunjukkan|menggunakan|terhadap|merupakan|dilakukan)\b/gi,
        /\b(mahasiswa|dosen|universitas|fakultas|jurusan|skripsi|tesis|disertasi)\b/gi,
        /\b(pendahuluan|tinjauan|pustaka|metode|penelitian|hasil|pembahasan|kesimpulan|saran)\b/gi,
    ];

    let score = 0;
    for (const pattern of indonesianIndicators) {
        const matches = content.match(pattern);
        score += matches ? matches.length : 0;
    }

    // Threshold for Indonesian detection - if we have 10+ Indonesian words, it's Indonesian
    // Otherwise, still treat as Indonesian (system default)
    return "id";
}

/**
 * Get language-specific stop words for text processing
 *
 * @param _language - The language code (currently unused, Indonesian only)
 * @returns Set of stop words for the language
 */
export function getStopWords(_language: Language): Set<string> {
    // Indonesian stop words
    return new Set([
        "dan",
        "atau",
        "yang",
        "di",
        "ke",
        "dari",
        "ini",
        "itu",
        "dengan",
        "untuk",
        "pada",
        "adalah",
        "sebagai",
        "dalam",
        "tidak",
        "akan",
        "dapat",
        "telah",
        "oleh",
        "juga",
        "sudah",
        "saat",
        "setelah",
        "bisa",
        "ada",
        "mereka",
        "kami",
        "kita",
        "saya",
        "anda",
        "ia",
        "dia",
        "kamu",
        "beliau",
        "tersebut",
        "hal",
        "antara",
        "lain",
        "seperti",
        "serta",
        "bahwa",
        "karena",
        "secara",
        "namun",
        "tetapi",
        "hanya",
        "jika",
        "maka",
        "agar",
        "ketika",
        "hingga",
        "sampai",
        "masih",
        "pun",
        "lagi",
        "sangat",
        "lebih",
        "kurang",
        "hampir",
        "selalu",
        "sering",
        "kadang",
        "jarang",
        "begitu",
        "demikian",
        "yakni",
        "yaitu",
        "penelitian",
        "berdasarkan",
        "menurut",
        "menunjukkan",
        "menggunakan",
        "terhadap",
        "melalui",
        "terdapat",
        "merupakan",
        "dilakukan",
        "diperoleh",
        "apa",
        "siapa",
        "dimana",
        "kapan",
        "mengapa",
        "bagaimana",
        "berapa",
    ]);
}

/**
 * Simple Indonesian stemming
 * Removes common prefixes and suffixes
 *
 * @param word - The word to stem
 * @returns Stemmed word
 */
export function stemIndonesian(word: string): string {
    let stem = word.toLowerCase();

    // Remove suffixes first
    const suffixes = ["kan", "an", "i", "lah", "kah", "nya"];
    for (const suffix of suffixes) {
        if (stem.endsWith(suffix) && stem.length > suffix.length + 2) {
            stem = stem.slice(0, -suffix.length);
            break;
        }
    }

    // Remove prefixes
    const prefixes = ["meng", "mem", "men", "me", "peng", "pem", "pen", "pe", "di", "ter", "ber", "ke", "se"];
    for (const prefix of prefixes) {
        if (stem.startsWith(prefix) && stem.length > prefix.length + 2) {
            stem = stem.slice(prefix.length);
            break;
        }
    }

    return stem;
}
