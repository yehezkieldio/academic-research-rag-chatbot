import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import type {
    AblationStudyConfiguration,
    AblationStudyResult,
    DocumentChunkMetadata,
    DocumentMetadata,
    GuardrailLogsDetails,
    RetrievedChunks,
    StatisticalAnalysisResult,
} from "@/lib/types";

export const documents = pgTable("documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // pdf, txt, md, docx
    fileSize: integer("file_size").notNull(),
    content: text("content"), // Raw extracted text
    metadata: jsonb("metadata").$type<DocumentMetadata>(),
    processingStatus: text("processing_status").notNull().default("pending"), // pending, processing, completed, failed
    processingError: text("processing_error"),
    useMistralOcr: boolean("use_mistral_ocr").default(false),
    chunkingStrategy: text("chunking_strategy").default("recursive"), // recursive, semantic, sentence_window
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentChunks = pgTable(
    "document_chunks",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        documentId: uuid("document_id")
            .references(() => documents.id, { onDelete: "cascade" })
            .notNull(),
        content: text("content").notNull(),
        chunkIndex: integer("chunk_index").notNull(),
        startOffset: integer("start_offset"),
        endOffset: integer("end_offset"),
        metadata: jsonb("metadata").$type<DocumentChunkMetadata>(),
        embedding: vector("embedding", { dimensions: 1536 }),
        keywords: text("keywords").array(), // Extracted keywords for BM25
        keywordVector: text("keyword_vector"), // TF-IDF vector as JSON
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [index("content_search_idx").using("gin", table.content)]
);

export const guardrailLogs = pgTable("guardrail_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").references(() => chatSessions.id, { onDelete: "cascade" }),
    messageId: uuid("message_id"),
    guardrailType: text("guardrail_type").notNull(), // input_validation, output_validation, pii_detection, etc.
    triggered: boolean("triggered").notNull(),
    severity: text("severity"), // low, medium, high, critical
    details: jsonb("details").$type<GuardrailLogsDetails>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentSteps = pgTable("agent_steps", {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
        .references(() => chatSessions.id, { onDelete: "cascade" })
        .notNull(),
    messageId: uuid("message_id"),
    stepIndex: integer("step_index").notNull(),
    stepType: text("step_type").notNull(), // tool_call, reasoning, retrieval, synthesis
    toolName: text("tool_name"), // search_documents, decompose_query, etc.
    toolInput: jsonb("tool_input"),
    toolOutput: jsonb("tool_output"),
    reasoning: text("reasoning"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title"),
    useRag: boolean("use_rag").default(true),
    useAgenticMode: boolean("use_agentic_mode").default(true),
    retrievalStrategy: text("retrieval_strategy").default("hybrid"), // vector, keyword, hybrid
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
        .references(() => chatSessions.id, { onDelete: "cascade" })
        .notNull(),
    role: text("role").notNull(), // user, assistant, system
    content: text("content").notNull(),
    retrievedChunks: jsonb("retrieved_chunks").$type<RetrievedChunks[]>(),
    ragEnabled: boolean("rag_enabled").default(true),
    agenticMode: boolean("agentic_mode").default(false),
    agentStepsCount: integer("agent_steps_count"),
    guardrailsTriggered: jsonb("guardrails_triggered").$type<string[]>(),
    latencyMs: integer("latency_ms"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evaluationRuns = pgTable("evaluation_runs", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"), // pending, running, completed, failed
    totalQuestions: integer("total_questions").default(0),
    completedQuestions: integer("completed_questions").default(0),
    retrievalStrategy: text("retrieval_strategy").default("hybrid"),
    chunkingStrategy: text("chunking_strategy").default("recursive"),
    useAgenticMode: boolean("use_agentic_mode").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
});

export const evaluationQuestions = pgTable("evaluation_questions", {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
        .references(() => evaluationRuns.id, { onDelete: "cascade" })
        .notNull(),
    question: text("question").notNull(),
    groundTruth: text("ground_truth").notNull(),
    ragAnswer: text("rag_answer"),
    nonRagAnswer: text("non_rag_answer"),
    retrievedContexts: jsonb("retrieved_contexts").$type<string[]>(),

    // Core RAGAS metrics
    ragFaithfulness: real("rag_faithfulness"),
    ragAnswerRelevancy: real("rag_answer_relevancy"),
    ragContextPrecision: real("rag_context_precision"),
    ragContextRecall: real("rag_context_recall"),
    ragAnswerCorrectness: real("rag_answer_correctness"),
    nonRagAnswerRelevancy: real("non_rag_answer_relevancy"),
    nonRagAnswerCorrectness: real("non_rag_answer_correctness"),
    ragAcademicRigor: real("rag_academic_rigor"),
    ragCitationAccuracy: real("rag_citation_accuracy"),
    ragTerminologyCorrectness: real("rag_terminology_correctness"),
    ragHallucinationRate: real("rag_hallucination_rate"),
    ragFactualConsistency: real("rag_factual_consistency"),
    ragSourceAttribution: real("rag_source_attribution"),
    ragContradictionScore: real("rag_contradiction_score"),
    nonRagHallucinationRate: real("non_rag_hallucination_rate"),
    retrievalNdcg: real("retrieval_ndcg"),
    retrievalMrr: real("retrieval_mrr"),
    retrievalPrecision: real("retrieval_precision"),

    // Metadata
    retrievalMethod: text("retrieval_method"),
    rerankerStrategy: text("reranker_strategy"),
    agentStepsUsed: integer("agent_steps_used"),
    guardrailsTriggered: integer("guardrails_triggered"),
    ragLatencyMs: integer("rag_latency_ms"),
    nonRagLatencyMs: integer("non_rag_latency_ms"),
    ragRetrievalLatencyMs: integer("rag_retrieval_latency_ms"),
    ragRerankingLatencyMs: integer("rag_reranking_latency_ms"),
    ragGenerationLatencyMs: integer("rag_generation_latency_ms"),
    ragAgentReasoningLatencyMs: integer("rag_agent_reasoning_latency_ms"),
    ragToolCallLatencyMs: integer("rag_tool_call_latency_ms"),
    ragTokensPerSecond: real("rag_tokens_per_second"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ablationStudies = pgTable("ablation_studies", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    configurations: jsonb("configurations").$type<AblationStudyConfiguration[]>(),
    results: jsonb("results").$type<AblationStudyResult[]>(),
    report: text("report"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
});

export const statisticalAnalyses = pgTable("statistical_analyses", {
    id: uuid("id").defaultRandom().primaryKey(),
    evaluationRunId: uuid("evaluation_run_id").references(() => evaluationRuns.id, { onDelete: "cascade" }),
    ablationStudyId: uuid("ablation_study_id").references(() => ablationStudies.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(), // paired_ttest, independent_ttest, anova, bootstrap_ci
    metricName: text("metric_name").notNull(),
    results: jsonb("results").$type<StatisticalAnalysisResult>(),
    reportEn: text("report_en"),
    reportId: text("report_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
