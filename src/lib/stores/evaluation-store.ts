import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface EvaluationMetrics {
    faithfulness: number;
    answerRelevancy: number;
    contextPrecision: number;
    contextRecall: number;
    answerCorrectness: number;
    // Latency metrics
    totalLatencyMs: number;
    retrievalLatencyMs: number;
    generationLatencyMs: number;
    // Hallucination metrics
    hallucinationRate: number;
    factualConsistency: number;
    sourceAttribution: number;
    // Domain metrics
    academicRigor: number;
    citationAccuracy: number;
    terminologyCorrectness: number;
}

export interface EvaluationRun {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    status: "pending" | "running" | "completed" | "failed";
    config: {
        useRag: boolean;
        useAgenticMode: boolean;
        retrievalStrategy: string;
        chunkingStrategy: string;
        rerankerType: string;
    };
    metrics?: EvaluationMetrics;
    questionCount: number;
    completedQuestions: number;
}

export interface AblationConfig {
    id: string;
    name: string;
    nameId: string; // Indonesian name
    description: string;
    config: Record<string, unknown>;
}

interface EvaluationStore {
    // State
    evaluations: EvaluationRun[];
    activeEvaluationId: string | null;
    isRunning: boolean;
    progress: number;

    // Ablation studies
    ablationConfigs: AblationConfig[];
    ablationResults: Record<string, EvaluationMetrics>;

    // Statistical results
    statisticalResults: {
        tTestResults?: Record<string, { tStatistic: number; pValue: number; significant: boolean }>;
        anovaResults?: { fStatistic: number; pValue: number; significant: boolean };
        confidenceIntervals?: Record<string, { lower: number; upper: number; mean: number }>;
    };

    // Actions
    createEvaluation: (name: string, config: EvaluationRun["config"]) => string;
    updateEvaluation: (id: string, updates: Partial<EvaluationRun>) => void;
    deleteEvaluation: (id: string) => void;
    setActiveEvaluation: (id: string | null) => void;
    setProgress: (progress: number) => void;
    setRunning: (running: boolean) => void;

    addAblationResult: (configId: string, metrics: EvaluationMetrics) => void;
    setStatisticalResults: (results: EvaluationStore["statisticalResults"]) => void;
    clearResults: () => void;
}

export const useEvaluationStore = create<EvaluationStore>()(
    persist(
        immer((set) => ({
            // Initial state
            evaluations: [],
            activeEvaluationId: null,
            isRunning: false,
            progress: 0,
            ablationConfigs: [
                {
                    id: "baseline",
                    name: "Baseline (No RAG)",
                    nameId: "Baseline (Tanpa RAG)",
                    description: "Direct LLM without retrieval",
                    config: { useRag: false, useAgenticMode: false },
                },
                {
                    id: "vector-only",
                    name: "Vector Only",
                    nameId: "Vektor Saja",
                    description: "Pure semantic similarity search",
                    config: { useRag: true, retrievalStrategy: "vector" },
                },
                {
                    id: "bm25-only",
                    name: "Okapi BM25 Only",
                    nameId: "Okapi BM25 Saja",
                    description: "Pure keyword-based retrieval",
                    config: { useRag: true, retrievalStrategy: "keyword" },
                },
                {
                    id: "hybrid-rrf",
                    name: "Hybrid (RRF)",
                    nameId: "Hibrida (RRF)",
                    description: "Vector + BM25 with Reciprocal Rank Fusion",
                    config: { useRag: true, retrievalStrategy: "hybrid" },
                },
                {
                    id: "agentic-full",
                    name: "Full Agentic RAG",
                    nameId: "RAG Agentik Penuh",
                    description: "Multi-step reasoning with tools",
                    config: { useRag: true, useAgenticMode: true, retrievalStrategy: "hybrid" },
                },
                {
                    id: "indonesian-optimized",
                    name: "Indonesian Optimized",
                    nameId: "Dioptimalkan Bahasa Indonesia",
                    description: "Tuned for Bahasa Indonesia queries",
                    config: { useRag: true, language: "id", retrievalStrategy: "hybrid" },
                },
            ],
            ablationResults: {},
            statisticalResults: {},

            // Actions
            createEvaluation: (name, config) => {
                const id = crypto.randomUUID();
                set((state) => {
                    state.evaluations.push({
                        id,
                        name,
                        createdAt: Date.now(),
                        status: "pending",
                        config,
                        questionCount: 0,
                        completedQuestions: 0,
                    });
                    state.activeEvaluationId = id;
                });
                return id;
            },

            updateEvaluation: (id, updates) => {
                set((state) => {
                    const evaluation = state.evaluations.find((e: EvaluationRun) => e.id === id);
                    if (evaluation) {
                        Object.assign(evaluation, updates);
                    }
                });
            },

            deleteEvaluation: (id) => {
                set((state) => {
                    state.evaluations = state.evaluations.filter((e: EvaluationRun) => e.id !== id);
                    if (state.activeEvaluationId === id) {
                        state.activeEvaluationId = null;
                    }
                });
            },

            setActiveEvaluation: (id) => {
                set((state) => {
                    state.activeEvaluationId = id;
                });
            },

            setProgress: (progress) => {
                set((state) => {
                    state.progress = progress;
                });
            },

            setRunning: (running) => {
                set((state) => {
                    state.isRunning = running;
                });
            },

            addAblationResult: (configId, metrics) => {
                set((state) => {
                    state.ablationResults[configId] = metrics;
                });
            },

            setStatisticalResults: (results) => {
                set((state) => {
                    state.statisticalResults = results;
                });
            },

            clearResults: () => {
                set((state) => {
                    state.ablationResults = {};
                    state.statisticalResults = {};
                });
            },
        })),
        {
            name: "academic-rag-evaluation",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                evaluations: state.evaluations.slice(-20),
                ablationResults: state.ablationResults,
                statisticalResults: state.statisticalResults,
            }),
        }
    )
);
