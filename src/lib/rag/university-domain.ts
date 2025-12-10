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
 * Supported Document Categories (12 domains, 50+ document types):
 * 1. Informasi Akademik: CPL, kurikulum, kalender akademik, KRS/KHS, IP/IPK
 * 2. Dokumen Regulasi: Buku Pedoman, Peraturan Rektor, SK, SOP, tata tertib
 * 3. Administrasi Kampus: UKT/SPP, cuti akademik, legalisir, pindah prodi, magang
 * 4. Informasi Dosen: profil dosen, jabatan fungsional, bidang keahlian, publikasi
 * 5. Penelitian & Pengabdian: hibah, roadmap, jurnal, prosiding, call for papers
 * 6. Kemahasiswaan: beasiswa, lomba, UKM, prestasi, konseling
 * 7. Sarana & Prasarana: fasilitas, laboratorium, perpustakaan, denah kampus
 * 8. PMB: jalur penerimaan, syarat pendaftaran, biaya kuliah, registrasi
 * 9. Keuangan: rincian biaya, alur pembayaran, refund, keterlambatan
 * 10. Alumni: tracer study, statistik lulusan, lowongan, ikatan alumni
 * 11. Humas & Publik: berita, rilis pers, pengumuman resmi
 * 12. Dokumen Akademik Tradisional: skripsi, tesis, RPS, modul, ujian
 *
 * Key Features:
 * - Document type detection (50+ types across 12 categories)
 * - PDF-ified Excel/table content handling
 * - Course metadata extraction (codes, names, instructors)
 * - Section extraction (BAB, abstrak, metodologi)
 * - Academic synonym expansion (penelitian → riset, studi, kajian)
 * - Citation extraction (APA, IEEE, MLA)
 * - Keyword extraction (manual + LLM-based)
 * - PDF text normalization (fixes OCR artifacts)
 * - Table structure detection for administrative documents
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

// Academic document types - Expanded to cover 12 Indonesian university document categories
export type AcademicDocumentType =
    // === Traditional Academic Documents ===
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
    // === 1. Informasi Akademik ===
    | "profil_prodi" // Profil program studi
    | "cpl" // Capaian Pembelajaran Lulusan
    | "kurikulum" // Struktur kurikulum
    | "daftar_matkul" // Daftar mata kuliah wajib/pilihan
    | "kalender_akademik" // Kalender akademik
    | "ketentuan_krs" // Ketentuan KRS/KHS
    | "ketentuan_ip" // Ketentuan IP/IPK
    | "syarat_kelulusan" // Syarat kelulusan
    | "aturan_ta" // Aturan skripsi/TA
    | "aturan_yudisium" // Aturan yudisium & wisuda
    // === 2. Dokumen Regulasi Resmi ===
    | "buku_pedoman_akademik" // Buku Pedoman Akademik
    | "buku_pedoman_kemahasiswaan" // Buku Pedoman Kemahasiswaan
    | "peraturan_rektor" // Peraturan Rektor
    | "sk_akademik" // SK (Surat Keputusan) akademik
    | "sop" // SOP akademik dan administrasi
    | "tata_tertib" // Tata tertib mahasiswa
    | "panduan_etika" // Panduan etika akademik
    | "panduan_plagiarisme" // Panduan plagiarisme dan sanksi
    // === 3. Informasi Administrasi Kampus ===
    | "prosedur_ukt" // Prosedur pembayaran UKT/SPP
    | "prosedur_cuti" // Prosedur cuti akademik
    | "prosedur_surat_aktif" // Prosedur surat aktif kuliah
    | "prosedur_legalisir" // Prosedur legalisir ijazah/transkrip
    | "prosedur_pindah_prodi" // Prosedur pindah prodi
    | "prosedur_magang" // Prosedur magang dan PKL
    | "jam_layanan" // Jam layanan biro-fakultas
    | "formulir_administrasi" // Formulir administrasi
    | "faq_layanan" // FAQ layanan akademik
    // === 4. Informasi Dosen ===
    | "daftar_dosen" // Daftar dosen per fakultas
    | "profil_dosen" // Profil dosen (jabatan, keahlian, riwayat)
    | "jadwal_mengajar" // Jadwal mengajar
    | "publikasi_dosen" // Publikasi ilmiah dosen
    // === 5. Penelitian & Pengabdian ===
    | "daftar_penelitian" // Daftar penelitian internal/eksternal
    | "roadmap_penelitian" // Roadmap penelitian prodi
    | "hibah_penelitian" // Program hibah penelitian
    | "pengabdian" // Proposal/pelaporan pengabdian
    | "jurnal_kampus" // Jurnal kampus (OJS)
    | "prosiding" // Prosiding konferensi kampus
    | "call_for_papers" // Event seminar & call for papers
    // === 6. Kemahasiswaan ===
    | "pengumuman_mahasiswa" // Pengumuman mahasiswa
    | "beasiswa" // Informasi beasiswa
    | "lomba_kompetisi" // Informasi lomba/kompetisi
    | "ukm_organisasi" // Informasi UKM/organisasi mahasiswa
    | "agenda_kampus" // Agenda kegiatan kampus
    | "prestasi_mahasiswa" // Prestasi mahasiswa
    | "kerjasama_industri" // Magang/kerja sama industri
    | "layanan_konseling" // Layanan konseling
    // === 7. Sarana & Prasarana ===
    | "fasilitas_kampus" // Deskripsi fasilitas kampus
    | "fasilitas_lab" // Fasilitas laboratorium
    | "jadwal_lab" // Jadwal penggunaan lab
    | "peraturan_lab" // Peraturan pemakaian lab
    | "perpustakaan" // Jam operasional & aturan perpustakaan
    | "denah_kampus" // Denah kampus / campus map
    | "layanan_it" // Layanan IT & helpdesk
    // === 8. PMB (Penerimaan Mahasiswa Baru) ===
    | "jalur_penerimaan" // Jalur penerimaan
    | "syarat_pendaftaran" // Syarat pendaftaran
    | "biaya_kuliah" // Biaya kuliah
    | "kuota_prodi" // Kuota program studi
    | "panduan_pendaftaran" // Panduan pendaftaran online
    | "faq_pmb" // FAQ calon mahasiswa
    | "jadwal_seleksi" // Jadwal seleksi
    | "prosedur_registrasi" // Prosedur registrasi ulang
    // === 9. Keuangan & Pembayaran ===
    | "rincian_biaya" // Rincian biaya kuliah
    | "alur_pembayaran" // Alur pembayaran resmi
    | "rekening_kampus" // Rekening resmi kampus
    | "prosedur_refund" // Prosedur refund
    | "keterlambatan_bayar" // Kebijakan keterlambatan pembayaran
    | "bantuan_biaya" // Bantuan/relief biaya siswa
    // === 10. Alumni ===
    | "tracer_study" // Tracer study
    | "statistik_lulusan" // Statistik lulusan
    | "lowongan_alumni" // Lowongan kerja alumni
    | "ikatan_alumni" // Jejaring alumni / ikatan alumni
    // === 11. Humas & Publik ===
    | "berita_kampus" // Berita kampus
    | "rilis_pers" // Rilis pers
    | "artikel_publik" // Artikel publik
    | "dokumentasi_kegiatan" // Dokumentasi kegiatan
    | "pengumuman_resmi" // Pengumuman resmi institusi
    // === Fallback ===
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
    context:
        | "general"
        | "research"
        | "programming"
        | "education"
        | "statistics"
        | "administration"
        | "finance"
        | "facilities"
        | "student_affairs";
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
    // === Administration & Services ===
    {
        terms: ["prosedur", "alur", "tata cara", "mekanisme", "langkah-langkah", "proses"],
        context: "administration",
    },
    {
        terms: ["persyaratan", "syarat", "ketentuan", "kriteria", "kualifikasi"],
        context: "administration",
    },
    {
        terms: ["formulir", "form", "blanko", "dokumen", "berkas"],
        context: "administration",
    },
    {
        terms: ["pendaftaran", "registrasi", "daftar", "enrollment"],
        context: "administration",
    },
    {
        terms: ["pengajuan", "permohonan", "permintaan", "aplikasi"],
        context: "administration",
    },
    {
        terms: ["persetujuan", "approval", "pengesahan", "validasi", "acc"],
        context: "administration",
    },
    {
        terms: ["jadwal", "schedule", "waktu", "tanggal", "kalender"],
        context: "administration",
    },
    {
        terms: ["deadline", "tenggat", "batas waktu", "due date"],
        context: "administration",
    },
    // === Finance ===
    {
        terms: ["pembayaran", "bayar", "payment", "transaksi", "transfer"],
        context: "finance",
    },
    {
        terms: ["biaya", "tarif", "uang", "fee", "cost", "harga"],
        context: "finance",
    },
    {
        terms: ["ukt", "spp", "biaya kuliah", "uang kuliah", "tuition"],
        context: "finance",
    },
    {
        terms: ["cicilan", "angsuran", "installment", "pembayaran bertahap"],
        context: "finance",
    },
    {
        terms: ["refund", "pengembalian", "restitusi", "reimburse"],
        context: "finance",
    },
    {
        terms: ["beasiswa", "bantuan", "scholarship", "subsidi", "keringanan"],
        context: "finance",
    },
    {
        terms: ["denda", "sanksi", "penalti", "keterlambatan"],
        context: "finance",
    },
    // === Academic Records ===
    {
        terms: ["krs", "kartu rencana studi", "pengisian krs", "isian krs"],
        context: "education",
    },
    {
        terms: ["khs", "kartu hasil studi", "transkrip", "nilai"],
        context: "education",
    },
    {
        terms: ["ipk", "ip", "indeks prestasi", "gpa", "nilai kumulatif"],
        context: "education",
    },
    {
        terms: ["sks", "kredit", "satuan kredit", "credit", "beban studi"],
        context: "education",
    },
    {
        terms: ["kelulusan", "lulus", "wisuda", "graduation", "yudisium"],
        context: "education",
    },
    {
        terms: ["cuti", "cuti akademik", "leave", "istirahat kuliah"],
        context: "education",
    },
    // === Student Affairs ===
    {
        terms: ["ukm", "organisasi", "himpunan", "bem", "ormawa"],
        context: "student_affairs",
    },
    {
        terms: ["lomba", "kompetisi", "perlombaan", "kejuaraan", "turnamen"],
        context: "student_affairs",
    },
    {
        terms: ["prestasi", "penghargaan", "achievement", "award", "juara"],
        context: "student_affairs",
    },
    {
        terms: ["magang", "pkl", "internship", "kerja praktek", "praktik industri"],
        context: "student_affairs",
    },
    {
        terms: ["konseling", "bimbingan", "counseling", "psikolog", "konsultasi"],
        context: "student_affairs",
    },
    // === Facilities ===
    {
        terms: ["laboratorium", "lab", "ruang lab", "fasilitas lab"],
        context: "facilities",
    },
    {
        terms: ["perpustakaan", "library", "pustaka", "ruang baca"],
        context: "facilities",
    },
    {
        terms: ["ruang kelas", "ruangan", "classroom", "auditorium", "gedung"],
        context: "facilities",
    },
    {
        terms: ["wifi", "internet", "jaringan", "network", "hotspot"],
        context: "facilities",
    },
    {
        terms: ["parkir", "kendaraan", "parking", "tempat parkir"],
        context: "facilities",
    },
    // === Personnel ===
    {
        terms: ["dosen", "pengajar", "lecturer", "instruktur", "guru besar", "profesor"],
        context: "education",
    },
    {
        terms: ["kaprodi", "ketua prodi", "koordinator", "kepala program studi"],
        context: "education",
    },
    {
        terms: ["dekan", "wakil dekan", "pimpinan fakultas"],
        context: "education",
    },
    {
        terms: ["rektor", "wakil rektor", "pimpinan universitas"],
        context: "education",
    },
    {
        terms: ["staff", "pegawai", "administrasi", "tata usaha", "tu"],
        context: "administration",
    },
    // === Documents & Certificates ===
    {
        terms: ["ijazah", "diploma", "sertifikat", "certificate"],
        context: "education",
    },
    {
        terms: ["transkrip", "transcript", "daftar nilai", "academic record"],
        context: "education",
    },
    {
        terms: ["legalisir", "legalisasi", "pengesahan", "authenticated copy"],
        context: "administration",
    },
    {
        terms: ["surat keterangan", "surat aktif", "surat pengantar", "surat rekomendasi"],
        context: "administration",
    },
    {
        terms: ["sk", "surat keputusan", "decree", "keputusan"],
        context: "administration",
    },
    // === PMB (Admissions) ===
    {
        terms: ["pmb", "penerimaan mahasiswa baru", "admisi", "seleksi masuk"],
        context: "education",
    },
    {
        terms: ["snbp", "snbt", "utbk", "sbmptn", "seleksi nasional"],
        context: "education",
    },
    {
        terms: ["jalur mandiri", "seleksi mandiri", "ujian mandiri"],
        context: "education",
    },
    {
        terms: ["kuota", "daya tampung", "kapasitas", "quota"],
        context: "education",
    },
    {
        terms: ["passing grade", "nilai minimum", "batas nilai"],
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

// === Traditional Academic Document Patterns ===
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

// === 1. Informasi Akademik Patterns ===
const INFORMASI_AKADEMIK_PATTERNS = {
    profil_prodi: /profil\s+(program\s+studi|prodi)|visi\s+(dan\s+)?misi\s+prodi|sejarah\s+program\s+studi/i,
    cpl: /capaian\s+pembelajaran\s+(lulusan)?|cpl|learning\s+outcomes?|kompetensi\s+lulusan/i,
    kurikulum: /struktur\s+kurikulum|kurikulum\s+\d{4}|susunan\s+mata\s+kuliah|kurikulum\s+program\s+studi/i,
    daftar_matkul: /daftar\s+mata\s+kuliah|mata\s+kuliah\s+(wajib|pilihan)|list\s+(of\s+)?courses/i,
    kalender_akademik: /kalender\s+akademik|jadwal\s+akademik|tahun\s+akademik\s+\d{4}/i,
    ketentuan_krs: /ketentuan\s+krs|pengisian\s+krs|kartu\s+rencana\s+studi|panduan\s+krs/i,
    ketentuan_ip: /ketentuan\s+ip|indeks\s+prestasi|perhitungan\s+ipk?|ip\s+kumulatif/i,
    syarat_kelulusan: /syarat\s+kelulusan|persyaratan\s+lulus|ketentuan\s+kelulusan|graduation\s+requirements/i,
    aturan_ta: /aturan\s+(skripsi|tugas\s+akhir|ta)|panduan\s+(skripsi|ta)|pedoman\s+penulisan\s+(skripsi|ta)/i,
    aturan_yudisium: /yudisium|wisuda|kelulusan|graduation\s+ceremony|prosesi\s+wisuda/i,
};

// === 2. Dokumen Regulasi Resmi Patterns ===
const REGULASI_PATTERNS = {
    buku_pedoman_akademik: /buku\s+pedoman\s+akademik|pedoman\s+akademik|academic\s+handbook/i,
    buku_pedoman_kemahasiswaan: /buku\s+pedoman\s+kemahasiswaan|pedoman\s+mahasiswa|student\s+handbook/i,
    peraturan_rektor: /peraturan\s+rektor|peraturan\s+universitas|rector['']?s?\s+regulation/i,
    sk_akademik: /surat\s+keputusan|sk\s+(rektor|dekan|akademik)|keputusan\s+(rektor|dekan)/i,
    sop: /sop\s+(akademik|administrasi)?|standar\s+operasional\s+prosedur|standard\s+operating\s+procedure/i,
    tata_tertib: /tata\s+tertib\s+(mahasiswa)?|peraturan\s+mahasiswa|code\s+of\s+conduct|aturan\s+kampus/i,
    panduan_etika: /panduan\s+etika|etika\s+akademik|academic\s+ethics|integritas\s+akademik/i,
    panduan_plagiarisme: /plagiarisme|plagiat|anti[\s-]?plagiarism|sanksi\s+plagiat|turnitin/i,
};

// === 3. Administrasi Kampus Patterns ===
const ADMINISTRASI_PATTERNS = {
    prosedur_ukt: /prosedur\s+(pembayaran\s+)?(ukt|spp)|uang\s+kuliah\s+tunggal|cara\s+bayar\s+ukt/i,
    prosedur_cuti: /prosedur\s+cuti|cuti\s+akademik|pengajuan\s+cuti|leave\s+of\s+absence/i,
    prosedur_surat_aktif: /surat\s+aktif\s+kuliah|surat\s+keterangan\s+mahasiswa|surat\s+keterangan\s+aktif/i,
    prosedur_legalisir: /legalisir|legalisasi|pengesahan\s+(ijazah|transkrip)|authenticated\s+copy/i,
    prosedur_pindah_prodi: /pindah\s+prodi|mutasi\s+(prodi|program\s+studi)|transfer\s+program/i,
    prosedur_magang: /prosedur\s+magang|magang|pkl|praktik\s+kerja\s+lapangan|internship/i,
    jam_layanan: /jam\s+(layanan|operasional)|jadwal\s+layanan|office\s+hours|service\s+hours/i,
    formulir_administrasi: /formulir|form\s+\w+|blanko|template\s+surat/i,
    faq_layanan: /faq|frequently\s+asked|pertanyaan\s+umum|tanya\s+jawab/i,
};

// === 4. Informasi Dosen Patterns ===
const DOSEN_PATTERNS = {
    daftar_dosen: /daftar\s+dosen|list\s+of\s+(lecturers?|faculty)|direktori\s+dosen/i,
    profil_dosen: /profil\s+dosen|biografi\s+dosen|cv\s+dosen|faculty\s+profile/i,
    jadwal_mengajar: /jadwal\s+mengajar|jadwal\s+dosen|teaching\s+schedule/i,
    publikasi_dosen: /publikasi\s+(ilmiah\s+)?dosen|karya\s+ilmiah\s+dosen|sinta|google\s+scholar|scopus/i,
};

// === 5. Penelitian & Pengabdian Patterns ===
const PENELITIAN_PATTERNS = {
    daftar_penelitian: /daftar\s+penelitian|research\s+list|riset\s+(internal|eksternal)/i,
    roadmap_penelitian: /roadmap\s+penelitian|peta\s+jalan\s+riset|research\s+roadmap/i,
    hibah_penelitian: /hibah\s+penelitian|research\s+grant|dana\s+hibah|pendanaan\s+riset/i,
    pengabdian: /pengabdian\s+(kepada\s+)?masyarakat|community\s+service|pkm/i,
    jurnal_kampus: /jurnal\s+(kampus|universitas)|ojs|open\s+journal|e-?journal/i,
    prosiding: /prosiding|proceedings?|seminar\s+(nasional|internasional)/i,
    call_for_papers: /call\s+for\s+papers?|cfp|submit\s+(your\s+)?paper/i,
};

// === 6. Kemahasiswaan Patterns ===
const KEMAHASISWAAN_PATTERNS = {
    pengumuman_mahasiswa: /pengumuman\s+(untuk\s+)?mahasiswa|student\s+announcement/i,
    beasiswa: /beasiswa|scholarship|bantuan\s+biaya\s+pendidikan|bidik\s+misi|kip[\s-]?kuliah/i,
    lomba_kompetisi: /lomba|kompetisi|perlombaan|competition|olimpiade|hackathon/i,
    ukm_organisasi: /ukm|unit\s+kegiatan\s+mahasiswa|organisasi\s+mahasiswa|bem|himpunan/i,
    agenda_kampus: /agenda\s+kampus|kegiatan\s+kampus|event\s+(calendar|kampus)/i,
    prestasi_mahasiswa: /prestasi\s+mahasiswa|achievement|penghargaan\s+mahasiswa|juara/i,
    kerjasama_industri: /kerjasama\s+industri|industry\s+partnership|mou|memorandum/i,
    layanan_konseling: /konseling|bimbingan\s+konseling|counseling|psikolog\s+kampus/i,
};

// === 7. Sarana & Prasarana Patterns ===
const FASILITAS_PATTERNS = {
    fasilitas_kampus: /fasilitas\s+kampus|sarana\s+(dan\s+)?prasarana|campus\s+facilities/i,
    fasilitas_lab: /fasilitas\s+laboratorium|lab\s+facilities|peralatan\s+lab/i,
    jadwal_lab: /jadwal\s+(penggunaan\s+)?lab|lab\s+schedule|booking\s+lab/i,
    peraturan_lab: /peraturan\s+(pemakaian\s+)?lab|tata\s+tertib\s+lab|lab\s+rules/i,
    perpustakaan: /perpustakaan|library|jam\s+(operasional\s+)?perpustakaan|peminjaman\s+buku/i,
    denah_kampus: /denah\s+kampus|peta\s+kampus|campus\s+map|site\s+plan/i,
    layanan_it: /layanan\s+it|helpdesk|help\s+desk|dukungan\s+teknis|it\s+support/i,
};

// === 8. PMB Patterns ===
const PMB_PATTERNS = {
    jalur_penerimaan: /jalur\s+penerimaan|jalur\s+masuk|admission\s+tracks?|snbp|snbt|mandiri/i,
    syarat_pendaftaran: /syarat\s+pendaftaran|persyaratan\s+daftar|admission\s+requirements/i,
    biaya_kuliah: /biaya\s+kuliah|tuition\s+fee|rincian\s+biaya|uang\s+pangkal/i,
    kuota_prodi: /kuota\s+(prodi|program\s+studi)|daya\s+tampung|kapasitas\s+mahasiswa/i,
    panduan_pendaftaran: /panduan\s+pendaftaran|cara\s+daftar|how\s+to\s+apply|registration\s+guide/i,
    faq_pmb: /faq\s+(pmb|pendaftaran|calon\s+mahasiswa)|tanya\s+jawab\s+(pmb|pendaftaran)/i,
    jadwal_seleksi: /jadwal\s+seleksi|selection\s+schedule|timeline\s+pmb/i,
    prosedur_registrasi: /prosedur\s+registrasi|registrasi\s+ulang|daftar\s+ulang|re-?registration/i,
};

// === 9. Keuangan Patterns ===
const KEUANGAN_PATTERNS = {
    rincian_biaya: /rincian\s+biaya|komponen\s+biaya|fee\s+structure|breakdown\s+biaya/i,
    alur_pembayaran: /alur\s+pembayaran|cara\s+pembayaran|payment\s+procedure|metode\s+bayar/i,
    rekening_kampus: /rekening\s+(resmi\s+)?(kampus|universitas)|bank\s+account|nomor\s+rekening/i,
    prosedur_refund: /prosedur\s+refund|pengembalian\s+biaya|refund\s+policy/i,
    keterlambatan_bayar: /keterlambatan\s+pembayaran|denda\s+keterlambatan|late\s+payment/i,
    bantuan_biaya: /bantuan\s+biaya|keringanan\s+biaya|financial\s+aid|relief\s+program/i,
};

// === 10. Alumni Patterns ===
const ALUMNI_PATTERNS = {
    tracer_study: /tracer\s+study|survei\s+lulusan|alumni\s+survey/i,
    statistik_lulusan: /statistik\s+lulusan|data\s+alumni|graduation\s+statistics/i,
    lowongan_alumni: /lowongan\s+(kerja\s+)?alumni|job\s+(vacancy|opening)|karir\s+alumni/i,
    ikatan_alumni: /ikatan\s+alumni|alumni\s+association|jejaring\s+alumni|ika/i,
};

// === 11. Humas & Publik Patterns ===
const HUMAS_PATTERNS = {
    berita_kampus: /berita\s+kampus|campus\s+news|kabar\s+kampus/i,
    rilis_pers: /rilis\s+pers|siaran\s+pers|press\s+release/i,
    artikel_publik: /artikel\s+(publik|kampus)|campus\s+article/i,
    dokumentasi_kegiatan: /dokumentasi\s+kegiatan|galeri\s+foto|photo\s+gallery|event\s+documentation/i,
    pengumuman_resmi: /pengumuman\s+resmi|official\s+announcement|maklumat/i,
};

// === PDF-ified Table Detection (for Excel-converted PDFs) ===
const TABLE_STRUCTURE_PATTERNS = {
    // Common table headers in administrative documents
    tableHeaders: /\b(no\.?|nomor|nama|nim|nip|tanggal|keterangan|status|jumlah|total)\s*\|/gi,
    // Column separators typical in PDF tables
    columnSeparators: /\s{2,}|\t|\|/g,
    // Numeric list patterns common in PDFs from spreadsheets
    numericRows: /^\s*\d+[.)]\s+\w+/gm,
    // Currency patterns (Indonesian Rupiah)
    currencyPatterns: /rp\.?\s*[\d.,]+|idr\s*[\d.,]+/gi,
    // Date patterns in tables
    datePatterns:
        /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}/gi,
};

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

/**
 * All pattern groups for document type detection
 * Organized by category for maintainability
 */
const ALL_PATTERN_GROUPS: Record<string, Record<string, RegExp>> = {
    ...{ informasi_akademik: INFORMASI_AKADEMIK_PATTERNS },
    ...{ regulasi: REGULASI_PATTERNS },
    ...{ administrasi: ADMINISTRASI_PATTERNS },
    ...{ dosen: DOSEN_PATTERNS },
    ...{ penelitian: PENELITIAN_PATTERNS },
    ...{ kemahasiswaan: KEMAHASISWAAN_PATTERNS },
    ...{ fasilitas: FASILITAS_PATTERNS },
    ...{ pmb: PMB_PATTERNS },
    ...{ keuangan: KEUANGAN_PATTERNS },
    ...{ alumni: ALUMNI_PATTERNS },
    ...{ humas: HUMAS_PATTERNS },
};

/**
 * Helper function to match document type from pattern groups
 * Reduces complexity by centralizing pattern matching logic
 */
function matchDocumentTypeFromPatterns(content: string): AcademicDocumentType | null {
    for (const patterns of Object.values(ALL_PATTERN_GROUPS)) {
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(content)) {
                return type as AcademicDocumentType;
            }
        }
    }
    return null;
}

/**
 * Helper function to detect traditional Indonesian document types
 */
function detectIndonesianTraditionalType(content: string): AcademicDocumentType | null {
    if (INDONESIAN_DOCUMENT_PATTERNS[0].test(content)) return "rps";
    if (INDONESIAN_DOCUMENT_PATTERNS[1].test(content)) return "modul_kuliah";
    if (INDONESIAN_DOCUMENT_PATTERNS[2].test(content) && INDONESIAN_DOCUMENT_PATTERNS[3].test(content))
        return "skripsi";
    if (INDONESIAN_DOCUMENT_PATTERNS[4].test(content) && INDONESIAN_DOCUMENT_PATTERNS[5].test(content)) return "tesis";
    if (INDONESIAN_DOCUMENT_PATTERNS[6].test(content) && INDONESIAN_DOCUMENT_PATTERNS[7].test(content))
        return "disertasi";
    if (INDONESIAN_DOCUMENT_PATTERNS[8].test(content)) return "lab_report";
    if (INDONESIAN_DOCUMENT_PATTERNS[9].test(content) && INDONESIAN_DOCUMENT_PATTERNS[10].test(content)) return "exam";
    if (INDONESIAN_DOCUMENT_PATTERNS[11].test(content) && INDONESIAN_DOCUMENT_PATTERNS[12].test(content))
        return "assignment";
    return null;
}

/**
 * Helper function to detect traditional English document types
 */
function detectEnglishTraditionalType(content: string): AcademicDocumentType | null {
    if (ENGLISH_DOCUMENT_PATTERNS[0].test(content)) return "syllabus";
    if (ENGLISH_DOCUMENT_PATTERNS[1].test(content)) return "lecture_notes";
    if (ENGLISH_DOCUMENT_PATTERNS[2].test(content)) return "research_paper";
    if (ENGLISH_DOCUMENT_PATTERNS[3].test(content)) return "textbook";
    if (ENGLISH_DOCUMENT_PATTERNS[4].test(content)) return "assignment";
    if (ENGLISH_DOCUMENT_PATTERNS[5].test(content) && ENGLISH_DOCUMENT_PATTERNS[6].test(content)) return "exam";
    if (ENGLISH_DOCUMENT_PATTERNS[7].test(content)) return content.includes("dissertation") ? "dissertation" : "thesis";
    if (ENGLISH_DOCUMENT_PATTERNS[8].test(content)) return "lab_report";
    if (ENGLISH_DOCUMENT_PATTERNS[9].test(content)) return "case_study";
    return null;
}

/** All valid document types for LLM fallback */
const ALL_DOCUMENT_TYPES: AcademicDocumentType[] = [
    // Traditional
    "syllabus",
    "lecture_notes",
    "research_paper",
    "textbook",
    "assignment",
    "exam",
    "thesis",
    "dissertation",
    "skripsi",
    "tesis",
    "disertasi",
    "modul_kuliah",
    "rps",
    "lab_report",
    "case_study",
    // Informasi Akademik
    "profil_prodi",
    "cpl",
    "kurikulum",
    "daftar_matkul",
    "kalender_akademik",
    "ketentuan_krs",
    "ketentuan_ip",
    "syarat_kelulusan",
    "aturan_ta",
    "aturan_yudisium",
    // Regulasi
    "buku_pedoman_akademik",
    "buku_pedoman_kemahasiswaan",
    "peraturan_rektor",
    "sk_akademik",
    "sop",
    "tata_tertib",
    "panduan_etika",
    "panduan_plagiarisme",
    // Administrasi
    "prosedur_ukt",
    "prosedur_cuti",
    "prosedur_surat_aktif",
    "prosedur_legalisir",
    "prosedur_pindah_prodi",
    "prosedur_magang",
    "jam_layanan",
    "formulir_administrasi",
    "faq_layanan",
    // Dosen
    "daftar_dosen",
    "profil_dosen",
    "jadwal_mengajar",
    "publikasi_dosen",
    // Penelitian
    "daftar_penelitian",
    "roadmap_penelitian",
    "hibah_penelitian",
    "pengabdian",
    "jurnal_kampus",
    "prosiding",
    "call_for_papers",
    // Kemahasiswaan
    "pengumuman_mahasiswa",
    "beasiswa",
    "lomba_kompetisi",
    "ukm_organisasi",
    "agenda_kampus",
    "prestasi_mahasiswa",
    "kerjasama_industri",
    "layanan_konseling",
    // Fasilitas
    "fasilitas_kampus",
    "fasilitas_lab",
    "jadwal_lab",
    "peraturan_lab",
    "perpustakaan",
    "denah_kampus",
    "layanan_it",
    // PMB
    "jalur_penerimaan",
    "syarat_pendaftaran",
    "biaya_kuliah",
    "kuota_prodi",
    "panduan_pendaftaran",
    "faq_pmb",
    "jadwal_seleksi",
    "prosedur_registrasi",
    // Keuangan
    "rincian_biaya",
    "alur_pembayaran",
    "rekening_kampus",
    "prosedur_refund",
    "keterlambatan_bayar",
    "bantuan_biaya",
    // Alumni
    "tracer_study",
    "statistik_lulusan",
    "lowongan_alumni",
    "ikatan_alumni",
    // Humas
    "berita_kampus",
    "rilis_pers",
    "artikel_publik",
    "dokumentasi_kegiatan",
    "pengumuman_resmi",
    // Fallback
    "other",
];

export async function detectDocumentType(content: string): Promise<AcademicDocumentType> {
    const normalized = normalizePDFText(content);
    const language = detectLanguage(normalized);

    // Check for PDF-ified table content (Excel conversions)
    const hasTableStructure =
        TABLE_STRUCTURE_PATTERNS.tableHeaders.test(normalized) ||
        (normalized.match(TABLE_STRUCTURE_PATTERNS.numericRows)?.length ?? 0) > 5;

    // Try pattern-based detection first (fastest)
    const patternMatch = matchDocumentTypeFromPatterns(normalized);
    if (patternMatch) return patternMatch;

    // Try traditional document patterns based on language
    if (language === "id") {
        const indonesianMatch = detectIndonesianTraditionalType(normalized);
        if (indonesianMatch) return indonesianMatch;
    }

    const englishMatch = detectEnglishTraditionalType(normalized);
    if (englishMatch) return englishMatch;

    // Fallback to LLM for ambiguous cases
    try {
        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt: `Classify this Indonesian academic/university document into one of these categories:
${ALL_DOCUMENT_TYPES.join(", ")}

Document excerpt:
${normalized.substring(0, 1500)}

${hasTableStructure ? "Note: This document contains table/spreadsheet-like structure (likely converted from Excel)." : ""}

Return only the category name, nothing else.`,
            temperature: 0,
        });

        const type = text.trim().toLowerCase().replace(/\s+/g, "_") as AcademicDocumentType;
        return ALL_DOCUMENT_TYPES.includes(type) ? type : "other";
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

/**
 * Context descriptions for all document types.
 * Used to enhance prompts with document-specific guidance.
 */
const DOCUMENT_TYPE_CONTEXTS: Record<AcademicDocumentType, string> = {
    // === Traditional Academic Documents ===
    syllabus: "Ini adalah silabus mata kuliah. Fokus pada capaian pembelajaran, tugas, dan kebijakan penilaian.",
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

    // === 1. Informasi Akademik ===
    profil_prodi: "Ini adalah profil program studi. Berikan informasi tentang visi, misi, dan keunggulan prodi.",
    cpl: "Ini adalah dokumen Capaian Pembelajaran Lulusan (CPL). Jelaskan kompetensi yang harus dicapai lulusan.",
    kurikulum: "Ini adalah struktur kurikulum. Jelaskan alur mata kuliah dan persyaratan kredit.",
    daftar_matkul: "Ini adalah daftar mata kuliah. Berikan informasi tentang mata kuliah wajib dan pilihan.",
    kalender_akademik: "Ini adalah kalender akademik. Fokus pada tanggal-tanggal penting dan jadwal kegiatan.",
    ketentuan_krs: "Ini adalah ketentuan KRS. Jelaskan prosedur pengisian dan batas SKS.",
    ketentuan_ip: "Ini adalah ketentuan IP/IPK. Jelaskan cara perhitungan dan standar akademik.",
    syarat_kelulusan: "Ini adalah syarat kelulusan. Jelaskan persyaratan untuk dapat lulus dari program studi.",
    aturan_ta: "Ini adalah aturan skripsi/tugas akhir. Jelaskan prosedur dan format penulisan.",
    aturan_yudisium: "Ini adalah aturan yudisium dan wisuda. Jelaskan persyaratan dan prosedur kelulusan.",

    // === 2. Dokumen Regulasi Resmi ===
    buku_pedoman_akademik: "Ini adalah buku pedoman akademik. Berikan panduan komprehensif tentang aturan akademik.",
    buku_pedoman_kemahasiswaan: "Ini adalah buku pedoman kemahasiswaan. Jelaskan hak dan kewajiban mahasiswa.",
    peraturan_rektor: "Ini adalah peraturan rektor. Berikan informasi tentang kebijakan resmi universitas.",
    sk_akademik: "Ini adalah Surat Keputusan akademik. Jelaskan keputusan resmi yang berlaku.",
    sop: "Ini adalah SOP akademik/administrasi. Jelaskan langkah-langkah prosedur yang benar.",
    tata_tertib: "Ini adalah tata tertib mahasiswa. Jelaskan aturan dan sanksi yang berlaku.",
    panduan_etika: "Ini adalah panduan etika akademik. Jelaskan standar integritas akademik.",
    panduan_plagiarisme: "Ini adalah panduan plagiarisme. Jelaskan definisi, deteksi, dan sanksi plagiat.",

    // === 3. Informasi Administrasi Kampus ===
    prosedur_ukt: "Ini adalah prosedur pembayaran UKT/SPP. Jelaskan cara dan jadwal pembayaran.",
    prosedur_cuti: "Ini adalah prosedur cuti akademik. Jelaskan syarat dan cara mengajukan cuti.",
    prosedur_surat_aktif: "Ini adalah prosedur surat aktif kuliah. Jelaskan cara mengurus surat keterangan.",
    prosedur_legalisir: "Ini adalah prosedur legalisir. Jelaskan cara legalisir ijazah dan transkrip.",
    prosedur_pindah_prodi: "Ini adalah prosedur pindah prodi. Jelaskan syarat dan alur perpindahan.",
    prosedur_magang: "Ini adalah prosedur magang/PKL. Jelaskan persyaratan dan tahapan magang.",
    jam_layanan: "Ini adalah informasi jam layanan. Berikan jadwal operasional layanan kampus.",
    formulir_administrasi: "Ini adalah formulir administrasi. Jelaskan cara pengisian dan pengajuan.",
    faq_layanan: "Ini adalah FAQ layanan akademik. Jawab pertanyaan umum tentang layanan kampus.",

    // === 4. Informasi Dosen ===
    daftar_dosen: "Ini adalah daftar dosen. Berikan informasi tentang dosen per fakultas/prodi.",
    profil_dosen: "Ini adalah profil dosen. Berikan informasi tentang keahlian dan riwayat pendidikan.",
    jadwal_mengajar: "Ini adalah jadwal mengajar dosen. Berikan informasi jadwal kuliah.",
    publikasi_dosen: "Ini adalah publikasi ilmiah dosen. Berikan informasi karya akademik dosen.",

    // === 5. Penelitian & Pengabdian ===
    daftar_penelitian: "Ini adalah daftar penelitian. Berikan informasi tentang proyek riset.",
    roadmap_penelitian: "Ini adalah roadmap penelitian. Jelaskan arah dan prioritas riset prodi.",
    hibah_penelitian: "Ini adalah informasi hibah penelitian. Jelaskan program pendanaan riset.",
    pengabdian: "Ini adalah dokumen pengabdian masyarakat. Jelaskan program dan kegiatan PKM.",
    jurnal_kampus: "Ini adalah jurnal kampus. Berikan informasi tentang publikasi jurnal.",
    prosiding: "Ini adalah prosiding konferensi. Berikan informasi tentang paper yang dipresentasikan.",
    call_for_papers: "Ini adalah call for papers. Berikan informasi tentang submission dan deadline.",

    // === 6. Kemahasiswaan ===
    pengumuman_mahasiswa: "Ini adalah pengumuman mahasiswa. Sampaikan informasi penting untuk mahasiswa.",
    beasiswa: "Ini adalah informasi beasiswa. Jelaskan jenis, syarat, dan cara mendaftar beasiswa.",
    lomba_kompetisi: "Ini adalah informasi lomba/kompetisi. Berikan detail tentang kompetisi yang tersedia.",
    ukm_organisasi: "Ini adalah informasi UKM/organisasi. Jelaskan organisasi mahasiswa yang aktif.",
    agenda_kampus: "Ini adalah agenda kegiatan kampus. Berikan jadwal event dan kegiatan.",
    prestasi_mahasiswa: "Ini adalah informasi prestasi mahasiswa. Berikan informasi pencapaian mahasiswa.",
    kerjasama_industri: "Ini adalah informasi kerjasama industri. Jelaskan program magang dan partnership.",
    layanan_konseling: "Ini adalah layanan konseling. Jelaskan layanan bimbingan yang tersedia.",

    // === 7. Sarana & Prasarana ===
    fasilitas_kampus: "Ini adalah informasi fasilitas kampus. Jelaskan sarana yang tersedia.",
    fasilitas_lab: "Ini adalah informasi fasilitas laboratorium. Jelaskan peralatan dan kapasitas lab.",
    jadwal_lab: "Ini adalah jadwal penggunaan lab. Berikan informasi booking dan jam operasional.",
    peraturan_lab: "Ini adalah peraturan laboratorium. Jelaskan tata tertib dan prosedur keselamatan.",
    perpustakaan: "Ini adalah informasi perpustakaan. Jelaskan layanan, jam buka, dan aturan peminjaman.",
    denah_kampus: "Ini adalah denah/peta kampus. Bantu navigasi lokasi di dalam kampus.",
    layanan_it: "Ini adalah layanan IT/helpdesk. Jelaskan dukungan teknis yang tersedia.",

    // === 8. PMB (Penerimaan Mahasiswa Baru) ===
    jalur_penerimaan: "Ini adalah informasi jalur penerimaan. Jelaskan berbagai jalur masuk yang tersedia.",
    syarat_pendaftaran: "Ini adalah syarat pendaftaran. Jelaskan dokumen dan kriteria yang diperlukan.",
    biaya_kuliah: "Ini adalah informasi biaya kuliah. Jelaskan rincian biaya pendidikan.",
    kuota_prodi: "Ini adalah informasi kuota prodi. Berikan data daya tampung program studi.",
    panduan_pendaftaran: "Ini adalah panduan pendaftaran. Jelaskan langkah-langkah mendaftar.",
    faq_pmb: "Ini adalah FAQ PMB. Jawab pertanyaan umum calon mahasiswa.",
    jadwal_seleksi: "Ini adalah jadwal seleksi. Berikan timeline proses penerimaan.",
    prosedur_registrasi: "Ini adalah prosedur registrasi ulang. Jelaskan tahapan daftar ulang.",

    // === 9. Keuangan & Pembayaran ===
    rincian_biaya: "Ini adalah rincian biaya kuliah. Jelaskan komponen-komponen biaya.",
    alur_pembayaran: "Ini adalah alur pembayaran. Jelaskan cara dan metode pembayaran.",
    rekening_kampus: "Ini adalah informasi rekening kampus. Berikan nomor rekening resmi.",
    prosedur_refund: "Ini adalah prosedur refund. Jelaskan cara pengajuan pengembalian biaya.",
    keterlambatan_bayar: "Ini adalah kebijakan keterlambatan pembayaran. Jelaskan denda dan konsekuensi.",
    bantuan_biaya: "Ini adalah informasi bantuan biaya. Jelaskan program keringanan yang tersedia.",

    // === 10. Alumni ===
    tracer_study: "Ini adalah tracer study. Berikan hasil survei keterserapan lulusan.",
    statistik_lulusan: "Ini adalah statistik lulusan. Berikan data alumni dan pencapaian mereka.",
    lowongan_alumni: "Ini adalah informasi lowongan kerja alumni. Berikan peluang karir yang tersedia.",
    ikatan_alumni: "Ini adalah informasi ikatan alumni. Jelaskan jejaring dan kegiatan alumni.",

    // === 11. Humas & Publik ===
    berita_kampus: "Ini adalah berita kampus. Sampaikan informasi terkini tentang kampus.",
    rilis_pers: "Ini adalah rilis pers. Berikan pernyataan resmi dari institusi.",
    artikel_publik: "Ini adalah artikel publik. Berikan konten informatif tentang kampus.",
    dokumentasi_kegiatan: "Ini adalah dokumentasi kegiatan. Berikan gambaran aktivitas kampus.",
    pengumuman_resmi: "Ini adalah pengumuman resmi institusi. Sampaikan informasi penting.",

    // === Fallback ===
    other: "",
};

export function enhancePromptForUniversity(basePrompt: string, metadata?: UniversityMetadata): string {
    let enhanced = basePrompt;

    if (metadata?.documentType) {
        const context = DOCUMENT_TYPE_CONTEXTS[metadata.documentType];
        if (context) {
            enhanced += `\n\nKonteks Dokumen: ${context}`;
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
