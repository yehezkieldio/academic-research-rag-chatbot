// Academic evaluation questions for Indonesian university domain
export const ACADEMIC_QUESTIONS = [
    {
        question: "Pertanyaan 1",
        groundTruth: "Ground truth untuk pertanyaan 1 dalam konteks akademik Universitas Mulia.",
    },
    // ... Add more questions here
];

// Sample questions for testing (English)
export const SAMPLE_QUESTIONS_EN = [
    {
        question: "Question 1",
        groundTruth: "Ground truth for question 1 in the context of Universitas Mulia academic domain.",
    },
    // Add more English questions if needed
];

export type EvaluationQuestion = {
    question: string;
    groundTruth: string;
};
