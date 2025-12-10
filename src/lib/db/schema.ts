/**
 * Database Schema for Academic Research RAG Chatbot
 *
 * This schema supports a comprehensive RAG (Retrieval-Augmented Generation) system
 * designed for academic research with the following key capabilities:
 *
 * 1. **Vector + Keyword Hybrid Search**: Combines pgvector embeddings with BM25 keyword search
 *    to overcome limitations of single-method retrieval (semantic-only misses specific terms,
 *    keyword-only misses context)
 *
 * 2. **Agentic Multi-Step Reasoning**: Stores agent execution traces (agentSteps table) to
 *    enable debugging, evaluation, and understanding of how the AI reasoned through complex queries
 *
 * 3. **Comprehensive Evaluation (RAGAS)**: Tracks faithfulness, relevancy, context precision/recall,
 *    hallucination rates, and academic rigor metrics for empirical performance measurement
 *
 * 4. **Ablation Studies**: Systematically tests different RAG configurations (vector vs hybrid,
 *    with/without reranking, chunking strategies) to identify optimal architecture
 *
 * 5. **Guardrails & Safety**: Logs all content policy violations, PII detection, prompt injection
 *    attempts, and negative user reactions for compliance and UX improvement
 *
 * 6. **Statistical Rigor**: Stores statistical analysis results (t-tests, ANOVA, bootstrap CI)
 *    for academic publication-quality evaluation
 *
 * WHY these design decisions:
 * - JSONB for metadata: Flexible schema evolution without migrations as research needs change
 * - Cascading deletes: Ensures referential integrity when documents/sessions are removed
 * - Separate chunks table: Enables independent retrieval/reranking without loading full documents
 * - GIN index on content: Fast full-text search for BM25 keyword retrieval
 * - Vector column with 1536 dimensions: Matches text-embedding-3-small model output
 *
 * @module schema
 */

import { sql } from "drizzle-orm";
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

/**
 * Documents table: Stores original uploaded documents with metadata
 *
 * WHY this design:
 * - Separates raw content from processed chunks to enable reprocessing with different strategies
 * - Tracks processing status to handle async document ingestion pipeline
 * - Stores OCR settings (useMistralOcr) for reproducibility of extraction results
 * - Chunking strategy field enables A/B testing different chunking approaches per document
 *
 * Processing pipeline: upload → extract text → chunk → embed → store chunks
 */
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

/**
 * Document Chunks table: Stores processed text segments with embeddings for retrieval
 *
 * WHY this design matters for research:
 * - **Hybrid Search Architecture**: Combines vector (embedding) + keyword (keywords array) + full-text (GIN index)
 *   to solve the "semantic gap" problem where pure vector search misses specific terms
 *
 * - **1536-dimension embeddings**: Matches text-embedding-3-small output; smaller than 3-large but sufficient
 *   for academic text and 3x faster with minimal quality loss (per OpenAI benchmarks)
 *
 * - **GIN trigram index**: Enables fuzzy full-text search for BM25 Okapi scoring, critical for handling
 *   academic terminology variations (e.g., "metodologi" vs "metode")
 *
 * - **Chunk metadata preservation**: Stores headings, sections, page numbers to enable citation and context
 *   awareness during retrieval (e.g., "this comes from the methodology section")
 *
 * - **Cascading deletes**: When a document is removed, all chunks automatically deleted to prevent orphaned data
 *
 * - **startOffset/endOffset**: Enables reconstruction of original context and sentence window chunking
 *   where we retrieve a sentence but show surrounding context
 */
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
    (table) => [index("content_search_idx").using("gin", sql`${table.content} gin_trgm_ops`)]
);

/**
 * Guardrail Logs table: Tracks all content policy and safety violations
 *
 * WHY this is critical for academic/university deployment:
 * - **Student Privacy (PII)**: Detects and logs when students accidentally share NIK, student IDs, phone numbers
 *   - Required for GDPR/Indonesia privacy law compliance
 *   - Enables audit trail if data breach investigation needed
 *
 * - **Academic Integrity**: Logs attempts to cheat ("do my homework", "write my thesis")
 *   - Provides evidence for academic misconduct cases
 *   - Helps identify patterns of policy violations
 *
 * - **Prompt Injection Prevention**: Detects jailbreak attempts ("ignore previous instructions")
 *   - Protects against malicious users trying to manipulate the system
 *   - Research value: understand adversarial attack patterns
 *
 * - **Negative Reaction Detection**: Tracks user frustration, confusion, disappointment
 *   - UX research: identify where chatbot fails to meet user needs
 *   - Enables proactive intervention (e.g., offer human support when frustration detected)
 *
 * - **Severity Levels**: Enable escalation workflows (critical → immediate alert, medium → review queue)
 *
 * - **Cascading deletes**: When session deleted, all guardrail logs also removed (privacy)
 */
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

/**
 * Agent Steps table: Records execution trace of agentic RAG multi-step reasoning
 *
 * WHY agentic mode exists and why we log every step:
 * - **Complex Query Decomposition**: Academic questions often require multiple sub-queries
 *   (e.g., "Compare methodology A and B" → search A, search B, compare)
 *   Logging enables debugging: did agent search for both? Was decomposition correct?
 *
 * - **Tool Usage Patterns**: Identifies which tools (search_documents, expand_query, verify_claim)
 *   are actually useful vs underutilized → guides future tool development
 *
 * - **Latency Profiling**: durationMs per step reveals bottlenecks (e.g., reranking too slow)
 *   → optimize hot paths for production deployment
 *
 * - **Research Evaluation**: Agent step traces enable fine-grained analysis:
 *   - Did agent retrieve relevant docs? (check toolOutput for search_documents)
 *   - Did agent follow logical reasoning chain? (check stepIndex ordering)
 *   - How many steps typical for different query types? (aggregate by query complexity)
 *
 * - **Explainability**: Users can see "why" chatbot gave this answer by viewing retrieval decisions
 *   → builds trust in academic setting where citation transparency is critical
 *
 * - **Debugging Failed Queries**: When user complains "wrong answer", step trace shows exactly
 *   where pipeline failed (bad retrieval? wrong synthesis? insufficient tool calls?)
 */
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

/**
 * Evaluation Runs table: Manages systematic RAG system evaluation with RAGAS metrics
 *
 * WHY we need structured evaluation runs (not just ad-hoc testing):
 * - **Academic Rigor**: Research publication requires reproducible, quantitative evaluation
 *   Can't just say "it works well" - need metrics (faithfulness, relevancy scores)
 *
 * - **Configuration Tracking**: Each run locks in specific settings (retrieval strategy, chunking, agentic mode)
 *   Enables fair comparison: "hybrid retrieval scored 0.85 faithfulness vs 0.72 for vector-only"
 *
 * - **Progress Monitoring**: totalQuestions/completedQuestions enables real-time progress UI
 *   Important because evaluation runs take 5-30 minutes (LLM-as-judge is slow)
 *
 * - **Failure Recovery**: Status tracking allows resuming failed runs without re-evaluating completed questions
 *   Critical when evaluating 100+ questions - don't want to restart from scratch on timeout
 *
 * - **Temporal Analysis**: createdAt/completedAt enable studying performance over time
 *   (e.g., "did adding more documents improve retrieval quality?")
 *
 * - **Experiment Provenance**: Name + description document experimental conditions for lab notebook
 *   (e.g., "Evaluation after adding 50 thesis documents, testing semantic chunking hypothesis")
 */
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

/**
 * Evaluation Questions table: Stores individual question evaluations with comprehensive metrics
 *
 * WHY we track both RAG and non-RAG answers:
 * - **Baseline Comparison**: Shows value-add of RAG system (e.g., "RAG faithfulness 0.89 vs non-RAG 0.45")
 * - **Cost-Benefit Analysis**: If non-RAG scores similarly, maybe RAG complexity not justified
 * - **Research Validity**: Academic paper reviewers will ask "how do you know RAG helps?"
 *
 * WHY these specific metrics matter:
 * - **Faithfulness**: Does answer stick to retrieved sources? (Critical for academic credibility)
 * - **Answer Relevancy**: Does answer actually address the question? (User satisfaction)
 * - **Context Precision**: Were retrieved chunks actually useful? (Retrieval quality)
 * - **Context Recall**: Did we retrieve all relevant info? (Coverage completeness)
 * - **Hallucination Rate**: Does model make up facts? (Academic integrity violation)
 * - **Citation Accuracy**: Are sources properly attributed? (Research standard)
 *
 * WHY we track latency separately per phase:
 * - **Retrieval Latency**: Identify if database slow (need index optimization?)
 * - **Reranking Latency**: Cross-encoder can be bottleneck (consider caching?)
 * - **Generation Latency**: LLM inference time (consider streaming for UX?)
 * - **Agent Reasoning Latency**: Multi-step overhead (worth the quality gain?)
 *
 * WHY tokens/second metric:
 * - **Streaming UX**: If < 10 tokens/sec, feels laggy to users
 * - **Cost Optimization**: Azure OpenAI charges per token - optimize token efficiency
 *
 * WHY store raw answers (ragAnswer, nonRagAnswer):
 * - **Qualitative Analysis**: Metrics don't tell full story - need manual inspection
 * - **Error Analysis**: When metrics low, inspect actual answers to understand failure modes
 * - **User Feedback**: Show actual outputs to domain experts for validation
 */
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

/**
 * Ablation Studies table: Systematically tests RAG components to identify what contributes to performance
 *
 * WHY ablation studies are critical for research publication:
 * - **Scientific Method**: Can't claim "agentic RAG is better" without testing what happens when you remove it
 * - **Causality**: Isolates which component (reranking? hybrid search? agentic mode?) actually improves results
 * - **Peer Review Defense**: Reviewers will ask "how do you know X component helps vs just adding complexity?"
 *
 * Example ablation configurations tested:
 * 1. Baseline: No RAG (pure LLM) → establishes if RAG adds value at all
 * 2. Vector-only retrieval → tests if keyword search component necessary
 * 3. BM25-only retrieval → tests if embedding component necessary
 * 4. Hybrid without reranking → tests if reranking worth the latency cost
 * 5. Full system → all features enabled (target performance)
 *
 * WHY store as JSONB configurations array:
 * - **Flexible Experiments**: Easy to add new ablation dimensions without schema migration
 * - **Complex Configs**: Each config has ~10 parameters (topK, strategy, chunking, reranker, etc.)
 * - **Reproducibility**: Full config stored ensures exact reproduction of experiment conditions
 *
 * WHY generate markdown report:
 * - **Research Paper Material**: Report becomes table/figure in publication methodology section
 * - **Stakeholder Communication**: Non-technical stakeholders understand "17% improvement" more than raw metrics
 * - **Decision Support**: Management asks "should we deploy agentic mode?" - report shows cost/benefit
 *
 * Statistical rigor: Results later analyzed with paired t-tests (see statisticalAnalyses table)
 * to determine if performance differences are statistically significant (p < 0.05)
 */
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

/**
 * Statistical Analyses table: Stores rigorous statistical significance tests for research validity
 *
 * WHY we need statistical testing (not just eyeballing metric differences):
 * - **Academic Standard**: Publication requires p-values, confidence intervals, effect sizes
 * - **Random Variation**: Metric difference could be noise - is it statistically significant?
 * - **Reproducibility**: Statistical tests quantify how confident we are in observed differences
 *
 * WHY these specific test types:
 * - **Paired t-test**: Compare same questions across two conditions (e.g., with vs without reranking)
 *   - Used when: Same questions evaluated in both configs → paired data
 *   - Tests: "Is mean faithfulness difference significantly different from zero?"
 *
 * - **Independent t-test**: Compare different question sets (e.g., easy vs hard questions)
 *   - Used when: Different evaluation runs with different questions
 *
 * - **ANOVA**: Compare 3+ configurations simultaneously (e.g., recursive vs semantic vs hierarchical chunking)
 *   - Tests: "Do any chunking strategies differ significantly?"
 *   - Follow-up: Post-hoc tests identify which pairs differ
 *
 * - **Bootstrap CI**: When data distribution unknown/non-normal, bootstrap provides robust confidence intervals
 *   - Used when: Small sample size or metric has weird distribution
 *
 * WHY effect size matters (not just p-value):
 * - **Practical Significance**: p < 0.05 but effect size = 0.01 → technically significant but practically useless
 * - **Publication Quality**: Modern stats requires reporting effect sizes (Cohen's d, etc.)
 * - **Design Decisions**: Large effect size → prioritize this feature; small effect → maybe not worth complexity
 *
 * WHY bilingual reports (reportEn + reportId):
 * - International publication needs English, but Indonesian stakeholders need Indonesian
 * - Auto-generated interpretation: "The difference is statistically significant (p=0.003) with a large effect size (d=0.82)"
 */
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

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type EvaluationQuestion = typeof evaluationQuestions.$inferSelect;
export type GuardrailLog = typeof guardrailLogs.$inferSelect;
export type AgentStep = typeof agentSteps.$inferSelect;
export type AblationStudy = typeof ablationStudies.$inferSelect;
export type StatisticalAnalysis = typeof statisticalAnalyses.$inferSelect;
