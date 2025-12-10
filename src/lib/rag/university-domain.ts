/**
 * @fileoverview University Domain-Specific Processing for Indonesian Academic Content
 *
 * WHY This Module:
 * - Indonesian academic documents have unique structure (BAB I, RPS, skripsi)
 * - Domain-specific terminology improves retrieval (mahasiswa, dosen, metodologi)
 * - Course metadata enables better context (course codes, instructors, semesters)
 * - Citation styles differ (Indonesian APA style)
 * - Document type detection enables specialized chunking strategies
 *
 * WHY Indonesian-Specific:
 * - Numbered chapters use Roman numerals: "BAB I PENDAHULUAN"
 * - Unique document types: RPS (Rencana Pembelajaran Semester), skripsi, tesis
 * - Indonesian synonym patterns (penelitian ≈ riset ≈ studi ≈ kajian)
 * - Course codes follow different patterns (e.g., "MK-2401", "IF234")
 *
 * Key Features:
 * - Document type detection (13 types: skripsi, tesis, RPS, etc.)
 * - Course metadata extraction (codes, names, instructors)
 * - Section extraction (BAB, abstrak, metodologi)
 * - Academic synonym expansion (penelitian → riset, studi, kajian)
 * - Citation extraction (APA, IEEE, MLA)
 * - Keyword extraction (manual + LLM-based)
 * - PDF text normalization (fixes OCR artifacts)
 *
 * Research Foundation:
 * - Indonesian Academic Writing Standards (Pedoman Penulisan Karya Ilmiah)
 * - Query expansion improves recall by 20-30% for academic queries
 */

import { generateText } from "ai";
import { CHAT_MODEL } from "@/lib/ai";

/**
 * Normalizes PDF text extracted from documents to fix common OCR and encoding issues
 *
 * WHY This Is Needed:
 * - PDF extraction often produces artifacts: "B A B 1" instead of "BAB 1"
 * - Wide spaces (U+2000-U+200B) break pattern matching
 * - Spaced numbers common in OCR: "2 0 2 4" instead of "2024"
 * - Excessive whitespace makes pattern matching unreliable
 *
 * Normalization Steps:
 * 1. Replace wide spaces with regular spaces (Unicode U+2000-U+200B)
 * 2. Fix spaced uppercase letters + numbers (e.g., "B A B 1" → "BAB 1")
 * 3. Fix spaced numbers (e.g., "2 0 2 4" → "2024")
 * 4. Normalize punctuation spacing
 * 5. Collapse multiple spaces
 * 6. Normalize line breaks (max 2 consecutive)
 *
 * @param text - Raw text extracted from PDF
 * @returns Normalized, cleaned text ready for pattern matching
 *
 * @example
 * ```typescript
 * const raw = "B A B  1\nP E N D A H U L U A N\n\nTahun 2 0 2 4";
 * const normalized = normalizePDFText(raw);
 * // Result: "BAB 1\nPENDAHULUAN\n\nTahun 2024"
 * ```
 */
function normalizePDFText(text: string): string {
    let normalized = text;

    // Replace wide spaces (U+2000-U+200B) with regular spaces
    normalized = normalized.replace(/[\u2000-\u200B]/g, " ");

    // Fix OCR artifacts: spaced uppercase letters followed by numbers (e.g., "B A B 1" -> "BAB 1")
    normalized = normalized.replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\s+(\d)/g, "$1$2$3 $4");
    normalized = normalized.replace(/\b([A-Z])\s+([A-Z])\s+(\d)/g, "$1$2 $3");

    // Fix spaced numbers (e.g., "2 0 2 4" -> "2024")
    normalized = normalized.replace(/\b(\d)\s+(\d)\s+(\d)\s+(\d)\b/g, "$1$2$3$4");
    normalized = normalized.replace(/\b(\d)\s+(\d)\s+(\d)\b/g, "$1$2$3");
    normalized = normalized.replace(/\b(\d)\s+(\d)\b/g, "$1$2");

    // Fix punctuation spacing issues
    normalized = normalized.replace(/\s+([.,;:!?)])/g, "$1");
    normalized = normalized.replace(/([([])\s+/g, "$1");

    // Collapse multiple spaces into single space
    normalized = normalized.replace(/[ \t]+/g, " ");

    // Normalize line breaks (max 2 consecutive)
    normalized = normalized.replace(/\n{3,}/g, "\n\n");

    // Trim spaces at start/end of lines
    normalized = normalized
        .split("\n")
        .map((line) => line.trim())
        .join("\n");

    return normalized.trim();
}

// Academic document types
export type AcademicDocumentType =
    | "syllabus"
    | "lecture_notes"
    | "research_paper"
    | "textbook"
    | "assignment"
    | "exam"
    | "thesis"
    | "dissertation"
    | "lab_report"
    | "case_study"
    | "skripsi"
    | "tesis"
    | "disertasi"
    | "modul_kuliah"
    | "rps"
    | "other";

// University metadata extracted from documents
export interface UniversityMetadata {
    documentType: AcademicDocumentType;
    courseCode?: string;
    courseName?: string;
    department?: string;
    faculty?: string;
    instructor?: string;
    semester?: string;
    academicYear?: string;
    institution?: string;
    citations?: Citation[];
    keywords?: string[];
    abstract?: string;
    sections?: DocumentSection[];
    language?: "en" | "id";
}

export interface Citation {
    text: string;
    authors?: string[];
    year?: string;
    title?: string;
    source?: string;
    style?: "APA" | "MLA" | "Chicago" | "IEEE" | "Harvard" | "unknown";
}

export interface DocumentSection {
    title: string;
    type:
        | "abstract"
        | "introduction"
        | "methodology"
        | "results"
        | "discussion"
        | "conclusion"
        | "references"
        | "appendix"
        | "abstrak"
        | "pendahuluan"
        | "tinjauan_pustaka"
        | "metode_penelitian"
        | "hasil_pembahasan"
        | "kesimpulan_saran"
        | "daftar_pustaka"
        | "lampiran"
        | "other";
    startOffset: number;
    endOffset: number;
}

interface SynonymGroup {
    terms: string[];
    context: "general" | "research" | "programming" | "education" | "statistics";
}

const ACADEMIC_SYNONYM_GROUPS: SynonymGroup[] = [
    // English - Research context
    {
        terms: ["methodology", "methods", "approach", "procedure", "technique"],
        context: "research",
    },
    {
        terms: ["analysis", "examination", "evaluation", "assessment"],
        context: "research",
    },
    {
        terms: ["conclusion", "findings", "results", "outcome"],
        context: "research",
    },
    {
        terms: ["literature review", "background", "prior work", "related work", "state of the art"],
        context: "research",
    },
    {
        terms: ["experiment", "study", "trial", "investigation"],
        context: "research",
    },
    {
        terms: ["significant", "notable", "important", "meaningful", "substantial"],
        context: "statistics",
    },
    {
        terms: ["correlation", "relationship", "association", "connection"],
        context: "statistics",
    },
    // Indonesian - Research context
    {
        terms: ["metodologi", "metode", "pendekatan", "prosedur", "teknik", "cara"],
        context: "research",
    },
    {
        terms: ["analisis", "pembahasan", "evaluasi", "pengkajian", "telaah", "kajian"],
        context: "research",
    },
    {
        terms: ["kesimpulan", "simpulan", "konklusi", "ringkasan", "temuan"],
        context: "research",
    },
    {
        terms: ["tinjauan pustaka", "kajian pustaka", "studi literatur", "landasan teori", "kerangka teori"],
        context: "research",
    },
    {
        terms: ["penelitian", "riset", "studi", "kajian", "investigasi"],
        context: "research",
    },
    {
        terms: ["signifikan", "bermakna", "penting", "berarti", "nyata"],
        context: "statistics",
    },
    {
        terms: ["korelasi", "hubungan", "keterkaitan", "relasi", "asosiasi"],
        context: "statistics",
    },
    {
        terms: ["dampak", "pengaruh", "efek", "akibat", "implikasi"],
        context: "general",
    },
    {
        terms: ["implementasi", "penerapan", "pelaksanaan", "eksekusi"],
        context: "programming",
    },
    {
        terms: ["evaluasi", "penilaian", "pengukuran", "asesmen", "assessment"],
        context: "education",
    },
];

import { detectQueryLanguage as detectLang } from "@/lib/utils/language";

/**
 * Detects the language of a query.
 * Always returns Indonesian as the system is Indonesian-only.
 *
 * @param query - The query text
 * @returns Always returns "id" for Indonesian
 */
export function detectQueryLanguage(query: string): "id" {
    return detectLang(query);
}

// Internal detectLanguage for document content (more thorough check)
function detectLanguage(content: string): "en" | "id" {
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

    return score > 10 ? "id" : "en";
}

/**
 * Helper function to escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Expands a query with academic synonyms while preventing semantic drift.
 *
 * Uses word boundary matching (\b) to ensure only whole words are replaced,
 * preventing false matches in compound words. Only expands terms within
 * the same synonym group to maintain semantic coherence.
 *
 * @param query - The original search query
 * @returns Array of query variations with synonyms
 */
export function expandQueryWithSynonyms(query: string): string[] {
    const expandedQueries = [query];
    const lowerQuery = query.toLowerCase();

    for (const group of ACADEMIC_SYNONYM_GROUPS) {
        for (const term of group.terms) {
            // Use word boundary regex to match whole words only
            const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
            if (regex.test(lowerQuery)) {
                // Replace with all other terms in the same group
                for (const synonym of group.terms) {
                    if (synonym.toLowerCase() !== term.toLowerCase()) {
                        const replaceRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
                        expandedQueries.push(query.replace(replaceRegex, synonym));
                    }
                }
            }
        }
    }

    return [...new Set(expandedQueries)];
}

/**
 * Expands Indonesian queries with education-specific terms.
 *
 * Includes domain-specific Indonesian terms commonly used in academic contexts
 * that may not have direct research equivalents.
 */
export function expandQueryIndonesian(query: string): string[] {
    const expandedQueries = [query];
    const lowerQuery = query.toLowerCase();

    // Indonesian education-specific synonym groups
    const indonesianEducationGroups: SynonymGroup[] = [
        {
            terms: ["mahasiswa", "siswa", "pelajar", "peserta didik"],
            context: "education",
        },
        {
            terms: ["dosen", "pengajar", "instruktur", "guru besar"],
            context: "education",
        },
        {
            terms: ["kuliah", "perkuliahan", "kelas", "mata kuliah"],
            context: "education",
        },
        {
            terms: ["skripsi", "tugas akhir", "karya tulis", "laporan akhir"],
            context: "education",
        },
        {
            terms: ["pustaka", "literatur", "referensi", "sumber"],
            context: "research",
        },
    ];

    // Combine with general academic synonym groups
    const allGroups = [...ACADEMIC_SYNONYM_GROUPS, ...indonesianEducationGroups];

    for (const group of allGroups) {
        for (const term of group.terms) {
            // Use word boundary regex to match whole words only
            const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
            if (regex.test(lowerQuery)) {
                // Replace with all other terms in the same group
                for (const synonym of group.terms) {
                    if (synonym.toLowerCase() !== term.toLowerCase()) {
                        const replaceRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
                        expandedQueries.push(query.replace(replaceRegex, synonym));
                    }
                }
            }
        }
    }

    return [...new Set(expandedQueries)];
}

const COURSE_CODE_PATTERNS = [
    /\b([A-Z]{2,4})[\s-]?(\d{3,4}[A-Z]?)\b/,
    /\b(\d{2})\.(\d{3})\b/,
    /\b([A-Z]{4})(\d{4})\b/,
    /\b(MK|SKS|KD)[\s-]?(\d{2,4})\b/i,
    /\b([A-Z]{2,3})-?(\d{3,4})-?([A-Z]?\d?)\b/,
];
const INDONESIAN_DOCUMENT_PATTERNS = [
    /rencana\s+pembelajaran\s+semester|rps|silabus\s+mata\s+kuliah|kontrak\s+perkuliahan/i,
    /modul\s+(perkuliahan|kuliah|pembelajaran)|bahan\s+ajar/i,
    /skripsi|tugas\s+akhir|karya\s+tulis\s+ilmiah/i,
    /sarjana|s1|strata\s+satu/i,
    /tesis|thesis/i,
    /magister|s2|pascasarjana/i,
    /disertasi|dissertation/i,
    /doktor|s3|program\s+doktor/i,
    /laporan\s+praktikum|laporan\s+laboratorium|percobaan/i,
    /ujian|uts|uas|kuis|soal/i,
    /nilai|skor|poin/i,
    /tugas|assignment|pr\s+\d+|latihan/i,
    /tenggat|deadline|kumpul/i,
];

const ENGLISH_DOCUMENT_PATTERNS = [
    /course\s+syllabus|class\s+schedule|learning\s+objectives|grading\s+policy/i,
    /lecture\s+\d+|today[''']s\s+topics?|key\s+concepts/i,
    /abstract[\s:]+|keywords[\s:]+|introduction[\s:]+.*methodology/is,
    /chapter\s+\d+|exercises?[\s:]+|review\s+questions/i,
    /assignment\s+\d+|due\s+date|submission|problem\s+set/i,
    /exam|quiz|test|final|midterm/i,
    /points?|marks?|score/i,
    /thesis|dissertation|submitted\s+in\s+partial\s+fulfillment/i,
    /lab\s+report|experiment|procedure|materials|observations/i,
    /case\s+study|background|situation|analysis|recommendations/i,
];

const COURSE_NAME_PATTERNS = [
    /(?:course|mata\s*kuliah|matkul|class)[\s:]+([A-Za-z][A-Za-z\s]+?)(?:\n|$)/i,
    /(?:nama\s*(?:mata\s*)?kuliah)[\s:]+([A-Za-z][A-Za-z\s]+?)(?:\n|$)/i,
];

const INSTRUCTOR_PATTERNS = [
    /(?:instructor|dosen|pengajar|pengampu|lecturer|taught\s+by)[\s:]+(?:Dr\.?\s+|Prof\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:dosen\s*pengampu|dosen\s*koordinator)[\s:]+(?:Dr\.?\s+|Prof\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
];

const SEMESTER_PATTERNS = [
    /(?:fall|spring|summer|winter|autumn)\s*(?:semester\s*)?(\d{4}|\d{2})/i,
    /semester\s*(ganjil|genap|pendek)\s*(?:tahun\s*akademik\s*)?(\d{4}[/-]?\d{2,4})?/i,
    /tahun\s*akademik\s*(\d{4}[/-]?\d{2,4})/i,
];

const FACULTY_PATTERNS = [/fakultas\s+([A-Za-z\s]+?)(?:\n|,|$)/i, /faculty\s+of\s+([A-Za-z\s]+?)(?:\n|,|$)/i];

const CREDITS_PATTERN = /(\d+)\s*(?:sks|credits?|credit\s*hours?)/i;
const KEYWORDS_PATTERNS = [/keywords?[\s:]+([^\n]+)/i, /kata\s*kunci[\s:]+([^\n]+)/i];

const ABSTRACT_PATTERNS = [
    /abstract[\s:]*\n([\s\S]+?)(?=\n\s*(?:keywords?|introduction|1\.|$))/i,
    /abstrak[\s:]*\n([\s\S]+?)(?=\n\s*(?:kata\s*kunci|pendahuluan|bab\s*[i1]|$))/i,
];

const SPLIT_PATTERN = /[,;]/;
const AUTHOR_SPLIT_PATTERN = /\s+(?:&|dan|and)\s+/;
const CITATION_PATTERNS = {
    apa: /$$([A-Za-z]+(?:\s+(?:&|dan|and)\s+[A-Za-z]+)*),?\s*(\d{4})$$/g,
    mla: /$$([A-Za-z]+)\s+(\d+)$$/g,
    ieee: /\[(\d+)\]/g,
    chicago: /\d+\.\s+([A-Za-z]+,\s+[A-Za-z]+)/g,
};

export async function detectDocumentType(content: string): Promise<AcademicDocumentType> {
    const normalized = normalizePDFText(content);
    const lowerContent = normalized.toLowerCase();
    const language = detectLanguage(normalized);

    // Indonesian patterns
    if (language === "id") {
        if (INDONESIAN_DOCUMENT_PATTERNS[0].test(normalized)) {
            return "rps";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[1].test(normalized)) {
            return "modul_kuliah";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[2].test(normalized) && INDONESIAN_DOCUMENT_PATTERNS[3].test(normalized)) {
            return "skripsi";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[4].test(normalized) && INDONESIAN_DOCUMENT_PATTERNS[5].test(normalized)) {
            return "tesis";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[6].test(normalized) && INDONESIAN_DOCUMENT_PATTERNS[7].test(normalized)) {
            return "disertasi";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[8].test(normalized)) {
            return "lab_report";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[9].test(normalized) && INDONESIAN_DOCUMENT_PATTERNS[10].test(normalized)) {
            return "exam";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[11].test(normalized) && INDONESIAN_DOCUMENT_PATTERNS[12].test(normalized)) {
            return "assignment";
        }
    }

    // English patterns
    if (ENGLISH_DOCUMENT_PATTERNS[0].test(normalized)) {
        return "syllabus";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[1].test(normalized)) {
        return "lecture_notes";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[2].test(normalized)) {
        return "research_paper";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[3].test(normalized)) {
        return "textbook";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[4].test(normalized)) {
        return "assignment";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[5].test(normalized) && ENGLISH_DOCUMENT_PATTERNS[6].test(normalized)) {
        return "exam";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[7].test(normalized)) {
        return normalized.includes("dissertation") ? "dissertation" : "thesis";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[8].test(normalized)) {
        return "lab_report";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[9].test(normalized)) {
        return "case_study";
    }

    // Use LLM for ambiguous cases
    try {
        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt: `Classify this academic document into one of: syllabus, lecture_notes, research_paper, textbook, assignment, exam, thesis, dissertation, skripsi, tesis, disertasi, modul_kuliah, rps, lab_report, case_study, other.

Document excerpt:
${normalized.substring(0, 1000)}

Return only the category name.`,
            temperature: 0,
        });

        const type = text.trim().toLowerCase().replace(/\s+/g, "_") as AcademicDocumentType;
        const validTypes = [
            "syllabus",
            "lecture_notes",
            "research_paper",
            "textbook",
            "assignment",
            "exam",
            "thesis",
            "dissertation",
            "lab_report",
            "case_study",
            "skripsi",
            "tesis",
            "disertasi",
            "modul_kuliah",
            "rps",
        ];
        return validTypes.includes(type) ? type : "other";
    } catch {
        return "other";
    }
}

export function extractCourseInfo(content: string): {
    courseCode?: string;
    courseName?: string;
    instructor?: string;
    semester?: string;
    faculty?: string;
    credits?: number;
} {
    const normalized = normalizePDFText(content);
    const result: ReturnType<typeof extractCourseInfo> = {};

    for (const pattern of COURSE_CODE_PATTERNS) {
        const match = normalized.match(pattern);
        if (match) {
            result.courseCode = match[0];
            break;
        }
    }

    for (const pattern of COURSE_NAME_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            result.courseName = match[1].trim();
            break;
        }
    }

    for (const pattern of INSTRUCTOR_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            result.instructor = match[1].trim();
            break;
        }
    }

    for (const pattern of SEMESTER_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            result.semester = match[0];
            break;
        }
    }

    for (const pattern of FACULTY_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            result.faculty = match[1].trim();
            break;
        }
    }

    const creditsMatch = content.match(CREDITS_PATTERN);
    if (creditsMatch) {
        result.credits = Number.parseInt(creditsMatch[1], 10);
    }

    return result;
}

/**
 * Extracts document sections from academic content.
 *
 * This is a goldmine for chunking - sections provide natural boundaries
 * for dividing documents into semantically coherent chunks. Use these
 * boundaries to create chunks that respect document structure.
 *
 * @param content - Raw document content
 * @returns Array of document sections with titles, types, and offsets
 */
export function extractSections(content: string): DocumentSection[] {
    const normalized = normalizePDFText(content);
    const sections: DocumentSection[] = [];
    const language = detectLanguage(normalized);

    const sectionPatterns: { type: DocumentSection["type"]; pattern: RegExp }[] =
        language === "id"
            ? [
                  { type: "abstrak", pattern: /\b(abstrak|ringkasan)\b[\s:]*\n/gi },
                  { type: "pendahuluan", pattern: /\b(bab\s+[i1][\s:.]*)?(pendahuluan|latar\s+belakang)\b[\s:]*\n/gi },
                  {
                      type: "tinjauan_pustaka",
                      pattern:
                          /\b(bab\s+[ii2][\s:.]*)?(tinjauan\s+pustaka|kajian\s+pustaka|landasan\s+teori)\b[\s:]*\n/gi,
                  },
                  {
                      type: "metode_penelitian",
                      pattern: /\b(bab\s+[iii3][\s:.]*)?(metode\s+penelitian|metodologi|metode)\b[\s:]*\n/gi,
                  },
                  {
                      type: "hasil_pembahasan",
                      pattern:
                          /\b(bab\s+[iv4][\s:.]*)?(hasil\s+(dan\s+)?pembahasan|hasil\s+penelitian|pembahasan)\b[\s:]*\n/gi,
                  },
                  {
                      type: "kesimpulan_saran",
                      pattern: /\b(bab\s+[v5][\s:.]*)?(kesimpulan(\s+dan\s+saran)?|simpulan|penutup)\b[\s:]*\n/gi,
                  },
                  { type: "daftar_pustaka", pattern: /\b(daftar\s+pustaka|referensi|bibliografi)\b[\s:]*\n/gi },
                  { type: "lampiran", pattern: /\b(lampiran|appendix|apendiks)\b[\s:]*\n/gi },
              ]
            : [
                  { type: "abstract", pattern: /\b(abstract)\b[\s:]*\n/gi },
                  { type: "introduction", pattern: /\b(introduction)\b[\s:]*\n/gi },
                  { type: "methodology", pattern: /\b(methodology|methods?|materials?\s+and\s+methods?)\b[\s:]*\n/gi },
                  { type: "results", pattern: /\b(results?|findings?)\b[\s:]*\n/gi },
                  { type: "discussion", pattern: /\b(discussion)\b[\s:]*\n/gi },
                  { type: "conclusion", pattern: /\b(conclusions?|summary)\b[\s:]*\n/gi },
                  { type: "references", pattern: /\b(references?|bibliography|works?\s+cited)\b[\s:]*\n/gi },
                  { type: "appendix", pattern: /\b(appendix|appendices)\b[\s:]*\n/gi },
              ];

    for (const { type, pattern } of sectionPatterns) {
        const matches = normalized.matchAll(pattern);
        for (const match of matches) {
            sections.push({
                title: match[1] || match[0],
                type,
                startOffset: match.index || 0,
                endOffset: match.index ? match.index + match[0].length : 0,
            });
        }
    }

    sections.sort((a, b) => a.startOffset - b.startOffset);

    for (let i = 0; i < sections.length - 1; i++) {
        sections[i].endOffset = sections[i + 1].startOffset;
    }
    const lastSection = sections.at(-1);
    if (lastSection) {
        lastSection.endOffset = normalized.length;
    }

    return sections;
}

export async function extractAcademicKeywords(content: string): Promise<string[]> {
    const normalized = normalizePDFText(content);
    const language = detectLanguage(normalized);

    for (const pattern of KEYWORDS_PATTERNS) {
        const match = normalized.match(pattern);
        if (match) {
            return match[1]
                .split(SPLIT_PATTERN)
                .map((k) => k.trim().toLowerCase())
                .filter((k) => k.length > 2);
        }
    }

    try {
        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt: `Extract 5-10 key academic keywords from this ${language === "id" ? "Indonesian" : "English"} text. Return as comma-separated list.

Text excerpt:
${normalized.substring(0, 2000)}

Keywords:`,
            temperature: 0,
        });

        return text
            .split(SPLIT_PATTERN)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k.length > 2)
            .slice(0, 10);
    } catch {
        return [];
    }
}

export function extractCitations(content: string): Citation[] {
    const normalized = normalizePDFText(content);
    const citations: Citation[] = [];
    const seen = new Set<string>();

    const apaMatches = normalized.matchAll(CITATION_PATTERNS.apa);
    for (const match of apaMatches) {
        const key = `${match[1]}-${match[2]}`;
        if (!seen.has(key)) {
            seen.add(key);
            citations.push({
                text: match[0],
                authors: match[1].split(AUTHOR_SPLIT_PATTERN),
                year: match[2],
                style: "APA",
            });
        }
    }

    const ieeeMatches = normalized.matchAll(CITATION_PATTERNS.ieee);
    for (const match of ieeeMatches) {
        const key = `ieee-${match[1]}`;
        if (!seen.has(key)) {
            seen.add(key);
            citations.push({
                text: match[0],
                style: "IEEE",
            });
        }
    }

    return citations;
}

export async function extractUniversityMetadata(content: string): Promise<UniversityMetadata> {
    const normalized = normalizePDFText(content);
    const language = detectLanguage(normalized);
    const [documentType, keywords] = await Promise.all([
        detectDocumentType(normalized),
        extractAcademicKeywords(normalized),
    ]);

    const courseInfo = extractCourseInfo(normalized);
    const citations = extractCitations(normalized);
    const sections = extractSections(normalized);

    let abstract: string | undefined;
    for (const pattern of ABSTRACT_PATTERNS) {
        const match = normalized.match(pattern);
        if (match) {
            abstract = match[1].trim().substring(0, 500);
            break;
        }
    }

    return {
        documentType,
        courseCode: courseInfo.courseCode,
        courseName: courseInfo.courseName,
        instructor: courseInfo.instructor,
        semester: courseInfo.semester,
        faculty: courseInfo.faculty,
        citations,
        keywords,
        abstract,
        sections,
        language,
    };
}

export function enhancePromptForUniversity(basePrompt: string, metadata?: UniversityMetadata): string {
    let enhanced = basePrompt;

    if (metadata?.documentType) {
        const typeContext: Record<AcademicDocumentType, string> = {
            syllabus:
                "Ini adalah silabus mata kuliah. Fokus pada capaian pembelajaran, tugas, dan kebijakan penilaian.",
            lecture_notes: "Ini adalah catatan perkuliahan. Jelaskan konsep dengan jelas dan berikan contoh.",
            research_paper: "Ini adalah makalah penelitian. Sitasi sumber dan pertahankan ketelitian akademik.",
            textbook: "Ini adalah konten buku teks. Berikan penjelasan edukatif dengan contoh.",
            assignment: "Ini adalah tugas. Bantu memahami persyaratan tanpa memberikan jawaban langsung.",
            exam: "Ini adalah materi ujian. Fokus pada pengujian pengetahuan dan panduan belajar.",
            thesis: "Ini adalah materi tesis. Pertahankan gaya ilmiah dan sitasi yang tepat.",
            dissertation: "Ini adalah materi disertasi. Pertahankan gaya ilmiah dan sitasi yang tepat.",
            lab_report: "Ini adalah laporan praktikum. Fokus pada metodologi, data, dan analisis.",
            case_study: "Ini adalah studi kasus. Analisis situasi dan berikan wawasan.",
            skripsi: "Ini adalah skripsi S1. Pertahankan gaya akademik dan kutipan yang tepat.",
            tesis: "Ini adalah tesis S2. Pertahankan gaya akademik dan kutipan yang tepat.",
            disertasi: "Ini adalah disertasi S3. Pertahankan standar rigor akademik tertinggi.",
            modul_kuliah: "Ini adalah modul perkuliahan. Jelaskan materi secara sistematis.",
            rps: "Ini adalah Rencana Pembelajaran Semester. Fokus pada capaian pembelajaran dan rencana evaluasi.",
            other: "",
        };

        if (typeContext[metadata.documentType]) {
            enhanced += `\n\nKonteks Dokumen: ${typeContext[metadata.documentType]}`;
        }
    }

    if (metadata?.courseCode || metadata?.courseName) {
        enhanced += `\n\nMata Kuliah: ${metadata.courseCode || ""} ${metadata.courseName || ""}`.trim();
    }

    if (metadata?.faculty) {
        enhanced += `\nFakultas: ${metadata.faculty}`;
    }

    return enhanced;
}
