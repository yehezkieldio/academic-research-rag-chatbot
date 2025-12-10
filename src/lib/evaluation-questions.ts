// Pertanyaan evaluasi akademis untuk domain universitas Indonesia
export const ACADEMIC_QUESTIONS = [
    {
        question: "Pertanyaan 1",
        groundTruth: "Ground truth untuk pertanyaan 1 dalam konteks akademik Universitas Mulia.",
    },
    // ... Tambahkan pertanyaan lainnya di sini
];

// Contoh pertanyaan untuk pengujian (Bahasa Indonesia)
export const SAMPLE_QUESTIONS_ID = [
    {
        question: "Pertanyaan 1",
        groundTruth: "Ground truth untuk pertanyaan 1 dalam konteks domain akademik Universitas Mulia.",
    },
    // Tambahkan pertanyaan Bahasa Indonesia lainnya sesuai kebutuhan
];

export type EvaluationQuestion = {
    question: string;
    groundTruth: string;
};
