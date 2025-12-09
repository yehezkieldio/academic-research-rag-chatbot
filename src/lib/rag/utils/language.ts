/**
 * Detect document language based on content patterns
 * Supports English (en) and Indonesian (id)
 */
export function detectDocumentLanguage(content: string): "en" | "id" {
    const indonesianPatterns = [
        /\b(yang|dengan|untuk|dalam|adalah|dapat|telah|sudah|akan|dari)\b/gi,
        /\b(berdasarkan|menurut|menunjukkan|menggunakan|terhadap|merupakan)\b/gi,
        /\b(mahasiswa|dosen|universitas|fakultas|jurusan|skripsi|tesis)\b/gi,
    ];

    let score = 0;
    for (const pattern of indonesianPatterns) {
        const matches = content.match(pattern);
        score += matches ? matches.length : 0;
    }

    // Threshold: if more than 10 Indonesian keyword matches, classify as Indonesian
    return score > 10 ? "id" : "en";
}
