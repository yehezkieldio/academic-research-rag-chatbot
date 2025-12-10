/**
 * Evaluation Questions Store
 *
 * This module provides the single source of truth for evaluation questions used in:
 * - Standard evaluation runs
 * - Ablation studies
 * - Statistical analysis
 *
 * Questions can come from:
 * 1. Database (evaluationQuestions table) - Primary source for custom evaluations
 * 2. Predefined questions below - Fallback and default dataset
 */

export type EvaluationQuestion = {
    question: string;
    groundTruth: string;
    category?: EvaluationCategory;
    difficulty?: "easy" | "medium" | "hard";
    language?: "id" | "en";
};

export type EvaluationCategory =
    | "research_methodology"
    | "academic_writing"
    | "statistical_analysis"
    | "literature_review"
    | "data_collection"
    | "thesis_structure"
    | "citation_referencing"
    | "general_academic";

/**
 * Predefined academic evaluation questions for Indonesian university domain.
 * These questions cover various aspects of academic research and methodology.
 */
export const ACADEMIC_QUESTIONS: EvaluationQuestion[] = [
    // Research Methodology
    {
        question: "Apa yang dimaksud dengan metodologi penelitian kualitatif dan kapan sebaiknya digunakan?",
        groundTruth:
            "Metodologi penelitian kualitatif adalah pendekatan penelitian yang berfokus pada pemahaman mendalam tentang fenomena sosial melalui pengumpulan data non-numerik seperti wawancara, observasi, dan analisis dokumen. Metode ini sebaiknya digunakan ketika peneliti ingin memahami makna, persepsi, dan pengalaman subjektif partisipan, mengeksplorasi fenomena yang belum banyak diteliti, atau membangun teori baru dari data lapangan (grounded theory).",
        category: "research_methodology",
        difficulty: "medium",
        language: "id",
    },
    {
        question: "Jelaskan perbedaan antara pendekatan deduktif dan induktif dalam penelitian.",
        groundTruth:
            "Pendekatan deduktif dimulai dari teori atau hipotesis umum, kemudian mengujinya dengan data empiris untuk mengkonfirmasi atau menolak teori tersebut (top-down). Pendekatan induktif dimulai dari observasi dan data spesifik, kemudian membangun pola dan teori berdasarkan temuan tersebut (bottom-up). Penelitian kuantitatif umumnya menggunakan pendekatan deduktif, sedangkan penelitian kualitatif cenderung menggunakan pendekatan induktif.",
        category: "research_methodology",
        difficulty: "medium",
        language: "id",
    },
    {
        question: "Bagaimana cara menentukan ukuran sampel yang tepat dalam penelitian kuantitatif?",
        groundTruth:
            "Penentuan ukuran sampel dalam penelitian kuantitatif dapat dilakukan melalui beberapa metode: (1) Rumus Slovin untuk populasi terbatas dengan tingkat error tertentu, (2) Tabel Krejcie dan Morgan berdasarkan ukuran populasi, (3) Power analysis dengan mempertimbangkan effect size, alpha, dan power yang diinginkan, (4) Aturan praktis minimal 30 sampel per kelompok untuk distribusi normal. Faktor yang mempengaruhi termasuk tingkat kepercayaan, margin of error, variabilitas populasi, dan jenis analisis statistik.",
        category: "research_methodology",
        difficulty: "hard",
        language: "id",
    },

    // Academic Writing
    {
        question: "Jelaskan struktur penulisan abstrak yang baik dalam karya ilmiah.",
        groundTruth:
            "Abstrak yang baik memiliki struktur IMRAD terkompresi: (1) Latar belakang dan tujuan penelitian (1-2 kalimat), (2) Metodologi yang digunakan termasuk desain penelitian dan sampel (2-3 kalimat), (3) Hasil utama penelitian dengan data kuantitatif jika ada (2-3 kalimat), (4) Kesimpulan dan implikasi (1-2 kalimat). Abstrak idealnya 150-300 kata, ditulis dalam satu paragraf, menggunakan kalimat aktif, dan tidak mengandung sitasi atau singkatan yang tidak umum.",
        category: "academic_writing",
        difficulty: "medium",
        language: "id",
    },
    {
        question: "Apa saja komponen yang harus ada dalam bab pendahuluan skripsi?",
        groundTruth:
            "Bab pendahuluan skripsi harus memuat: (1) Latar belakang masalah yang menjelaskan konteks, fenomena, dan gap penelitian, (2) Rumusan masalah dalam bentuk pertanyaan penelitian yang spesifik dan dapat dijawab, (3) Tujuan penelitian yang selaras dengan rumusan masalah, (4) Manfaat penelitian baik teoritis maupun praktis, (5) Batasan atau ruang lingkup penelitian, dan (6) Sistematika penulisan. Pendahuluan harus menggunakan pola funnel dari umum ke spesifik.",
        category: "thesis_structure",
        difficulty: "easy",
        language: "id",
    },

    // Statistical Analysis
    {
        question: "Kapan sebaiknya menggunakan uji parametrik versus non-parametrik?",
        groundTruth:
            "Uji parametrik digunakan ketika data memenuhi asumsi: (1) distribusi normal, (2) homogenitas varians, (3) skala interval atau rasio, dan (4) sampel yang cukup besar (n>30). Contoh: t-test, ANOVA, regresi. Uji non-parametrik digunakan ketika asumsi tersebut tidak terpenuhi, data ordinal/nominal, atau sampel kecil. Contoh: Mann-Whitney U, Kruskal-Wallis, Spearman. Uji parametrik umumnya lebih powerful jika asumsi terpenuhi, sedangkan non-parametrik lebih robust terhadap outlier.",
        category: "statistical_analysis",
        difficulty: "hard",
        language: "id",
    },
    {
        question: "Jelaskan konsep validitas dan reliabilitas dalam instrumen penelitian.",
        groundTruth:
            "Validitas adalah sejauh mana instrumen mengukur apa yang seharusnya diukur, meliputi: validitas isi (expert judgment), validitas konstruk (analisis faktor), dan validitas kriteria (korelasi dengan standar). Reliabilitas adalah konsistensi hasil pengukuran, diukur dengan: test-retest (stabilitas), split-half (konsistensi internal), dan Cronbach's alpha (α>0.7 dianggap reliabel). Instrumen harus valid dan reliabel; instrumen reliabel belum tentu valid, tetapi instrumen valid harus reliabel.",
        category: "research_methodology",
        difficulty: "medium",
        language: "id",
    },

    // Literature Review
    {
        question: "Jelaskan tahapan dalam melakukan systematic literature review.",
        groundTruth:
            "Tahapan systematic literature review: (1) Merumuskan pertanyaan penelitian dengan framework PICO/SPIDER, (2) Mengembangkan protokol pencarian dan menentukan database (Scopus, WoS, PubMed), (3) Menetapkan kriteria inklusi dan eksklusi, (4) Melakukan pencarian dan screening judul/abstrak, (5) Full-text screening artikel terpilih, (6) Ekstraksi data dengan form standar, (7) Menilai kualitas metodologis dengan tool seperti CASP atau JBI, (8) Sintesis naratif atau meta-analisis, (9) Menyusun laporan sesuai PRISMA guidelines.",
        category: "literature_review",
        difficulty: "hard",
        language: "id",
    },
    {
        question: "Apa perbedaan antara literature review naratif dan systematic review?",
        groundTruth:
            "Literature review naratif bersifat deskriptif, tidak memiliki protokol ketat, seleksi artikel subjektif, dan bertujuan memberikan overview umum topik. Systematic review memiliki protokol terstandar, pencarian komprehensif dan reproducible, kriteria inklusi/eksklusi jelas, penilaian kualitas artikel, dan sintesis sistematis. Systematic review meminimalkan bias dan lebih transparan dalam proses seleksi. Narrative review cocok untuk eksplorasi awal, sedangkan systematic review untuk evidence-based decision making.",
        category: "literature_review",
        difficulty: "medium",
        language: "id",
    },

    // Citation and Referencing
    {
        question: "Bagaimana cara mensitasi sumber dalam format APA edisi ke-7?",
        groundTruth:
            "Format APA 7th edition untuk sitasi: In-text citation menggunakan (Penulis, Tahun) atau Penulis (Tahun). Untuk 1-2 penulis, tulis semua nama. Untuk 3+ penulis, gunakan 'et al.' dari sitasi pertama. Referensi di daftar pustaka: Buku - Penulis, A. A. (Tahun). Judul buku (edisi). Penerbit. Jurnal - Penulis, A. A., & Penulis, B. B. (Tahun). Judul artikel. Nama Jurnal, Volume(Issue), halaman. https://doi.org/xxx. Website dengan DOI lebih diutamakan daripada URL.",
        category: "citation_referencing",
        difficulty: "medium",
        language: "id",
    },

    // Data Collection
    {
        question: "Apa saja teknik pengumpulan data dalam penelitian kualitatif?",
        groundTruth:
            "Teknik pengumpulan data kualitatif meliputi: (1) Wawancara mendalam (in-depth interview) - terstruktur, semi-terstruktur, atau tidak terstruktur, (2) Observasi - partisipan atau non-partisipan, (3) Focus Group Discussion (FGD) - 6-12 partisipan, (4) Analisis dokumen - dokumen primer dan sekunder, (5) Catatan lapangan (field notes), (6) Visual methods - foto, video. Triangulasi sumber data meningkatkan kredibilitas temuan. Data direkam, ditranskrip, dan dikodekan untuk analisis tematik.",
        category: "data_collection",
        difficulty: "medium",
        language: "id",
    },

    // General Academic
    {
        question: "Apa yang dimaksud dengan plagiarisme dan bagaimana cara menghindarinya?",
        groundTruth:
            "Plagiarisme adalah penggunaan ide, kata, atau karya orang lain tanpa pengakuan yang tepat. Jenis-jenisnya: (1) Copy-paste langsung tanpa kutipan, (2) Parafrase tanpa sitasi, (3) Self-plagiarism - menggunakan karya sendiri sebelumnya, (4) Mosaic plagiarism - menggabungkan berbagai sumber tanpa atribusi. Cara menghindari: sitasi semua sumber dengan benar, gunakan tanda kutip untuk kutipan langsung, parafrase dengan pemahaman sendiri dan tetap sitasi, gunakan software pendeteksi plagiarisme, dan kelola referensi dengan tools seperti Mendeley atau Zotero.",
        category: "academic_writing",
        difficulty: "easy",
        language: "id",
    },
];

/**
 * Sample questions for quick testing (subset of ACADEMIC_QUESTIONS)
 */
export const SAMPLE_QUESTIONS_ID: EvaluationQuestion[] = ACADEMIC_QUESTIONS.slice(0, 5);

/**
 * Get questions by category
 */
export function getQuestionsByCategory(category: EvaluationCategory): EvaluationQuestion[] {
    return ACADEMIC_QUESTIONS.filter((q) => q.category === category);
}

/**
 * Get questions by difficulty level
 */
export function getQuestionsByDifficulty(difficulty: "easy" | "medium" | "hard"): EvaluationQuestion[] {
    return ACADEMIC_QUESTIONS.filter((q) => q.difficulty === difficulty);
}

/**
 * Get a random subset of questions for evaluation
 */
export function getRandomQuestions(count: number): EvaluationQuestion[] {
    const shuffled = [...ACADEMIC_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get all available questions
 */
export function getAllQuestions(): EvaluationQuestion[] {
    return ACADEMIC_QUESTIONS;
}
