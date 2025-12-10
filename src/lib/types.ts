/**
 * Extended document type categories covering all Indonesian university document types
 * across 12 major categories:
 * 1. Traditional Academic (syllabus, thesis, etc.)
 * 2. Informasi Akademik (CPL, kurikulum, kalender)
 * 3. Dokumen Regulasi (pedoman, SK, SOP)
 * 4. Administrasi Kampus (UKT, cuti, legalisir)
 * 5. Informasi Dosen (profil, publikasi)
 * 6. Penelitian & Pengabdian (hibah, jurnal)
 * 7. Kemahasiswaan (beasiswa, UKM)
 * 8. Sarana & Prasarana (lab, perpustakaan)
 * 9. PMB (jalur masuk, biaya)
 * 10. Keuangan (pembayaran, refund)
 * 11. Alumni (tracer study, ikatan)
 * 12. Humas & Publik (berita, pengumuman)
 */
export type ExtendedDocumentType =
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
    | "profil_prodi"
    | "cpl"
    | "kurikulum"
    | "daftar_matkul"
    | "kalender_akademik"
    | "ketentuan_krs"
    | "ketentuan_ip"
    | "syarat_kelulusan"
    | "aturan_ta"
    | "aturan_yudisium"
    // === 2. Dokumen Regulasi Resmi ===
    | "buku_pedoman_akademik"
    | "buku_pedoman_kemahasiswaan"
    | "peraturan_rektor"
    | "sk_akademik"
    | "sop"
    | "tata_tertib"
    | "panduan_etika"
    | "panduan_plagiarisme"
    // === 3. Informasi Administrasi Kampus ===
    | "prosedur_ukt"
    | "prosedur_cuti"
    | "prosedur_surat_aktif"
    | "prosedur_legalisir"
    | "prosedur_pindah_prodi"
    | "prosedur_magang"
    | "jam_layanan"
    | "formulir_administrasi"
    | "faq_layanan"
    // === 4. Informasi Dosen ===
    | "daftar_dosen"
    | "profil_dosen"
    | "jadwal_mengajar"
    | "publikasi_dosen"
    // === 5. Penelitian & Pengabdian ===
    | "daftar_penelitian"
    | "roadmap_penelitian"
    | "hibah_penelitian"
    | "pengabdian"
    | "jurnal_kampus"
    | "prosiding"
    | "call_for_papers"
    // === 6. Kemahasiswaan ===
    | "pengumuman_mahasiswa"
    | "beasiswa"
    | "lomba_kompetisi"
    | "ukm_organisasi"
    | "agenda_kampus"
    | "prestasi_mahasiswa"
    | "kerjasama_industri"
    | "layanan_konseling"
    // === 7. Sarana & Prasarana ===
    | "fasilitas_kampus"
    | "fasilitas_lab"
    | "jadwal_lab"
    | "peraturan_lab"
    | "perpustakaan"
    | "denah_kampus"
    | "layanan_it"
    // === 8. PMB (Penerimaan Mahasiswa Baru) ===
    | "jalur_penerimaan"
    | "syarat_pendaftaran"
    | "biaya_kuliah"
    | "kuota_prodi"
    | "panduan_pendaftaran"
    | "faq_pmb"
    | "jadwal_seleksi"
    | "prosedur_registrasi"
    // === 9. Keuangan & Pembayaran ===
    | "rincian_biaya"
    | "alur_pembayaran"
    | "rekening_kampus"
    | "prosedur_refund"
    | "keterlambatan_bayar"
    | "bantuan_biaya"
    // === 10. Alumni ===
    | "tracer_study"
    | "statistik_lulusan"
    | "lowongan_alumni"
    | "ikatan_alumni"
    // === 11. Humas & Publik ===
    | "berita_kampus"
    | "rilis_pers"
    | "artikel_publik"
    | "dokumentasi_kegiatan"
    | "pengumuman_resmi"
    // === Fallback ===
    | "other";

export interface DocumentMetadata {
    author?: string;
    pages?: number;
    wordCount?: number;
    chunksCount?: number;
    source?: string;
    tags?: string[];
    category?: string;
    courseCode?: string;
    department?: string;
    academicYear?: string;
    documentType?: ExtendedDocumentType;
    citations?: string[];
    keywords?: string[];
    // Extended metadata for administrative documents
    effectiveDate?: string; // For regulations, SK
    faculty?: string;
    semester?: string;
    instructor?: string;
    hasTableContent?: boolean; // For PDF-ified Excel documents
}

export interface DocumentChunkMetadata {
    pageNumber?: number;
    section?: string;
    headings?: string[];
    chunkingStrategy?: string;
    parentChunkId?: string;
    childChunkIds?: string[];
    sentenceWindowContext?: string; // Surrounding sentences for context
}

export interface GuardrailLogsDetails {
    rule: string;
    matchedContent?: string;
    action: "blocked" | "flagged" | "modified" | "allowed";
    originalContent?: string;
    modifiedContent?: string;
}

export interface RetrievedChunks {
    chunkId: string;
    documentTitle: string;
    content: string;
    similarity: number;
    retrievalMethod?: "vector" | "keyword" | "hybrid";
    bm25Score?: number;
}

export interface AblationStudyConfiguration {
    name: string;
    useRag: boolean;
    useReranker: boolean;
    rerankerStrategy?: string;
    retrievalStrategy: string;
    chunkingStrategy: string;
    useAgenticMode: boolean;
    useGuardrails: boolean;
    topK: number;
}

export interface AblationStudyResult {
    configName: string;
    metrics: Record<string, number>;
}

export interface StatisticalAnalysisResult {
    testName: string;
    statistic: number;
    pValue: number;
    significant: boolean;
    effectSize?: number;
    effectSizeInterpretation?: string;
    confidenceInterval?: { lower: number; upper: number; level: number };
    degreesOfFreedom?: number;
    sampleSize: number;
    interpretation: string;
    interpretationId: string;
}
