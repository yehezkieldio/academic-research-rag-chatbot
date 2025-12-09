import { generateText } from "ai";
import { CHAT_MODEL } from "@/lib/ai";

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

const ACADEMIC_SYNONYMS: Record<string, string[]> = {
    // English terms
    hypothesis: ["theory", "proposition", "assumption", "conjecture"],
    methodology: ["methods", "approach", "procedure", "technique"],
    analysis: ["examination", "evaluation", "assessment", "study"],
    conclusion: ["findings", "results", "outcome", "summary"],
    "literature review": ["background", "prior work", "related work", "state of the art"],
    experiment: ["study", "trial", "test", "investigation"],
    data: ["evidence", "information", "findings", "results"],
    significant: ["notable", "important", "meaningful", "substantial"],
    correlation: ["relationship", "association", "connection", "link"],
    variable: ["factor", "parameter", "element", "component"],
    // Indonesian terms
    hipotesis: ["teori", "dugaan", "asumsi", "perkiraan"],
    metodologi: ["metode", "pendekatan", "prosedur", "teknik", "cara"],
    analisis: ["pembahasan", "evaluasi", "pengkajian", "telaah", "kajian"],
    kesimpulan: ["simpulan", "konklusi", "ringkasan", "temuan"],
    "tinjauan pustaka": ["kajian pustaka", "studi literatur", "landasan teori", "kerangka teori"],
    penelitian: ["riset", "studi", "kajian", "investigasi", "pengkajian"],
    signifikan: ["bermakna", "penting", "berarti", "nyata"],
    korelasi: ["hubungan", "keterkaitan", "relasi", "asosiasi"],
    variabel: ["faktor", "parameter", "unsur", "komponen"],
    dampak: ["pengaruh", "efek", "akibat", "implikasi"],
    implementasi: ["penerapan", "pelaksanaan", "eksekusi"],
    evaluasi: ["penilaian", "assessment", "pengukuran", "asesmen"],
};

export function detectQueryLanguage(query: string): "en" | "id" {
    const indonesianIndicators = [
        /\b(yang|dengan|untuk|dalam|adalah|dapat|telah|sudah|akan|dari)\b/gi,
        /\b(berdasarkan|menurut|menunjukkan|menggunakan|terhadap|merupakan|dilakukan)\b/gi,
        /\b(apa|bagaimana|mengapa|kapan|dimana|siapa|apakah)\b/gi,
        /\b(mahasiswa|dosen|universitas|fakultas|jurusan|skripsi|tesis|disertasi)\b/gi,
        /\b(jelaskan|sebutkan|uraikan|bandingkan|analisis)\b/gi,
    ];

    let score = 0;
    for (const pattern of indonesianIndicators) {
        const matches = query.match(pattern);
        score += matches ? matches.length : 0;
    }

    return score >= 2 ? "id" : "en";
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

export function expandQueryIndonesian(query: string): string[] {
    const expandedQueries = [query];
    const lowerQuery = query.toLowerCase();

    // Indonesian academic synonyms
    const indonesianSynonyms: Record<string, string[]> = {
        hipotesis: ["teori", "dugaan", "asumsi", "perkiraan"],
        metodologi: ["metode", "pendekatan", "prosedur", "teknik", "cara"],
        analisis: ["pembahasan", "evaluasi", "pengkajian", "telaah", "kajian"],
        kesimpulan: ["simpulan", "konklusi", "ringkasan", "temuan"],
        penelitian: ["riset", "studi", "kajian", "investigasi"],
        signifikan: ["bermakna", "penting", "berarti", "nyata"],
        korelasi: ["hubungan", "keterkaitan", "relasi", "asosiasi"],
        variabel: ["faktor", "parameter", "unsur", "komponen"],
        dampak: ["pengaruh", "efek", "akibat", "implikasi"],
        implementasi: ["penerapan", "pelaksanaan", "eksekusi"],
        evaluasi: ["penilaian", "pengukuran", "asesmen"],
        mahasiswa: ["siswa", "pelajar", "peserta didik"],
        dosen: ["pengajar", "instruktur", "guru besar"],
        kuliah: ["perkuliahan", "kelas", "mata kuliah"],
        skripsi: ["tugas akhir", "karya tulis", "laporan akhir"],
        pustaka: ["literatur", "referensi", "sumber"],
    };

    for (const [term, synonyms] of Object.entries(indonesianSynonyms)) {
        if (lowerQuery.includes(term)) {
            for (const synonym of synonyms) {
                expandedQueries.push(query.replace(new RegExp(term, "gi"), synonym));
            }
        }
        for (const synonym of synonyms) {
            if (lowerQuery.includes(synonym)) {
                expandedQueries.push(query.replace(new RegExp(synonym, "gi"), term));
            }
        }
    }

    return [...new Set(expandedQueries)];
}

export function expandQueryWithSynonyms(query: string): string[] {
    const expandedQueries = [query];
    const lowerQuery = query.toLowerCase();

    for (const [term, synonyms] of Object.entries(ACADEMIC_SYNONYMS)) {
        if (lowerQuery.includes(term)) {
            for (const synonym of synonyms) {
                expandedQueries.push(query.replace(new RegExp(term, "gi"), synonym));
            }
        }
        for (const synonym of synonyms) {
            if (lowerQuery.includes(synonym)) {
                expandedQueries.push(query.replace(new RegExp(synonym, "gi"), term));
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
    const lowerContent = content.toLowerCase();
    const language = detectLanguage(content);

    // Indonesian patterns
    if (language === "id") {
        if (INDONESIAN_DOCUMENT_PATTERNS[0].test(content)) {
            return "rps";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[1].test(content)) {
            return "modul_kuliah";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[2].test(content) && INDONESIAN_DOCUMENT_PATTERNS[3].test(content)) {
            return "skripsi";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[4].test(content) && INDONESIAN_DOCUMENT_PATTERNS[5].test(content)) {
            return "tesis";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[6].test(content) && INDONESIAN_DOCUMENT_PATTERNS[7].test(content)) {
            return "disertasi";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[8].test(content)) {
            return "lab_report";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[9].test(content) && INDONESIAN_DOCUMENT_PATTERNS[10].test(content)) {
            return "exam";
        }
        if (INDONESIAN_DOCUMENT_PATTERNS[11].test(content) && INDONESIAN_DOCUMENT_PATTERNS[12].test(content)) {
            return "assignment";
        }
    }

    // English patterns
    if (ENGLISH_DOCUMENT_PATTERNS[0].test(content)) {
        return "syllabus";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[1].test(content)) {
        return "lecture_notes";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[2].test(content)) {
        return "research_paper";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[3].test(content)) {
        return "textbook";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[4].test(content)) {
        return "assignment";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[5].test(content) && ENGLISH_DOCUMENT_PATTERNS[6].test(content)) {
        return "exam";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[7].test(content)) {
        return content.includes("dissertation") ? "dissertation" : "thesis";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[8].test(content)) {
        return "lab_report";
    }
    if (ENGLISH_DOCUMENT_PATTERNS[9].test(content)) {
        return "case_study";
    }

    // Use LLM for ambiguous cases
    try {
        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt: `Classify this academic document into one of: syllabus, lecture_notes, research_paper, textbook, assignment, exam, thesis, dissertation, skripsi, tesis, disertasi, modul_kuliah, rps, lab_report, case_study, other.

Document excerpt:
${content.substring(0, 1000)}

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
    const result: ReturnType<typeof extractCourseInfo> = {};

    for (const pattern of COURSE_CODE_PATTERNS) {
        const match = content.match(pattern);
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

export function extractSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const language = detectLanguage(content);

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
        const matches = content.matchAll(pattern);
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
        lastSection.endOffset = content.length;
    }

    return sections;
}

export async function extractAcademicKeywords(content: string): Promise<string[]> {
    const language = detectLanguage(content);

    for (const pattern of KEYWORDS_PATTERNS) {
        const match = content.match(pattern);
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
${content.substring(0, 2000)}

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
    const citations: Citation[] = [];
    const seen = new Set<string>();

    const apaMatches = content.matchAll(CITATION_PATTERNS.apa);
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

    const ieeeMatches = content.matchAll(CITATION_PATTERNS.ieee);
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
    const language = detectLanguage(content);
    const [documentType, keywords] = await Promise.all([detectDocumentType(content), extractAcademicKeywords(content)]);

    const courseInfo = extractCourseInfo(content);
    const citations = extractCitations(content);
    const sections = extractSections(content);

    let abstract: string | undefined;
    for (const pattern of ABSTRACT_PATTERNS) {
        const match = content.match(pattern);
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
    const isIndonesian = metadata?.language === "id";

    if (metadata?.documentType) {
        const typeContext: Record<AcademicDocumentType, string> = {
            syllabus: isIndonesian
                ? "Ini adalah silabus mata kuliah. Fokus pada capaian pembelajaran, tugas, dan kebijakan penilaian."
                : "This is a course syllabus. Focus on learning objectives, assignments, and grading policies.",
            lecture_notes: isIndonesian
                ? "Ini adalah catatan perkuliahan. Jelaskan konsep dengan jelas dan berikan contoh."
                : "These are lecture notes. Explain concepts clearly and provide examples.",
            research_paper: isIndonesian
                ? "Ini adalah makalah penelitian. Sitasi sumber dan pertahankan ketelitian akademik."
                : "This is a research paper. Cite sources and maintain academic rigor.",
            textbook: isIndonesian
                ? "Ini adalah konten buku teks. Berikan penjelasan edukatif dengan contoh."
                : "This is textbook content. Provide educational explanations with examples.",
            assignment: isIndonesian
                ? "Ini adalah tugas. Bantu memahami persyaratan tanpa memberikan jawaban langsung."
                : "This is an assignment. Help understand the requirements without giving direct answers.",
            exam: isIndonesian
                ? "Ini adalah materi ujian. Fokus pada pengujian pengetahuan dan panduan belajar."
                : "This is exam material. Focus on testing knowledge and providing study guidance.",
            thesis: "This is thesis material. Maintain scholarly tone and proper citations.",
            dissertation: "This is dissertation material. Maintain scholarly tone and proper citations.",
            lab_report: isIndonesian
                ? "Ini adalah laporan praktikum. Fokus pada metodologi, data, dan analisis."
                : "This is a lab report. Focus on methodology, data, and analysis.",
            case_study: isIndonesian
                ? "Ini adalah studi kasus. Analisis situasi dan berikan wawasan."
                : "This is a case study. Analyze the situation and provide insights.",
            skripsi: "Ini adalah skripsi S1. Pertahankan gaya akademik dan kutipan yang tepat.",
            tesis: "Ini adalah tesis S2. Pertahankan gaya akademik dan kutipan yang tepat.",
            disertasi: "Ini adalah disertasi S3. Pertahankan standar rigor akademik tertinggi.",
            modul_kuliah: "Ini adalah modul perkuliahan. Jelaskan materi secara sistematis.",
            rps: "Ini adalah Rencana Pembelajaran Semester. Fokus pada capaian pembelajaran dan rencana evaluasi.",
            other: "",
        };

        if (typeContext[metadata.documentType]) {
            enhanced += `\n\nDocument Context: ${typeContext[metadata.documentType]}`;
        }
    }

    if (metadata?.courseCode || metadata?.courseName) {
        const courseLabel = isIndonesian ? "Mata Kuliah" : "Course";
        enhanced += `\n\n${courseLabel}: ${metadata.courseCode || ""} ${metadata.courseName || ""}`.trim();
    }

    if (metadata?.faculty) {
        enhanced += `\nFakultas/Faculty: ${metadata.faculty}`;
    }

    return enhanced;
}
