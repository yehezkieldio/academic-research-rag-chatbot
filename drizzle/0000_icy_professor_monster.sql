CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "ablation_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"configurations" jsonb,
	"results" jsonb,
	"report" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"message_id" uuid,
	"step_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"tool_name" text,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"reasoning" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"retrieved_chunks" jsonb,
	"rag_enabled" boolean DEFAULT true,
	"agentic_mode" boolean DEFAULT false,
	"agent_steps_count" integer,
	"guardrails_triggered" jsonb,
	"latency_ms" integer,
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"use_rag" boolean DEFAULT true,
	"use_agentic_mode" boolean DEFAULT true,
	"retrieval_strategy" text DEFAULT 'hybrid',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"metadata" jsonb,
	"embedding" vector(1536),
	"keywords" text[],
	"keyword_vector" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"content" text,
	"metadata" jsonb,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"use_mistral_ocr" boolean DEFAULT false,
	"chunking_strategy" text DEFAULT 'recursive',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"question" text NOT NULL,
	"ground_truth" text NOT NULL,
	"rag_answer" text,
	"non_rag_answer" text,
	"retrieved_contexts" jsonb,
	"rag_faithfulness" real,
	"rag_answer_relevancy" real,
	"rag_context_precision" real,
	"rag_context_recall" real,
	"rag_answer_correctness" real,
	"non_rag_answer_relevancy" real,
	"non_rag_answer_correctness" real,
	"rag_academic_rigor" real,
	"rag_citation_accuracy" real,
	"rag_terminology_correctness" real,
	"rag_hallucination_rate" real,
	"rag_factual_consistency" real,
	"rag_source_attribution" real,
	"rag_contradiction_score" real,
	"non_rag_hallucination_rate" real,
	"retrieval_ndcg" real,
	"retrieval_mrr" real,
	"retrieval_precision" real,
	"retrieval_method" text,
	"reranker_strategy" text,
	"agent_steps_used" integer,
	"guardrails_triggered" integer,
	"rag_latency_ms" integer,
	"non_rag_latency_ms" integer,
	"rag_retrieval_latency_ms" integer,
	"rag_reranking_latency_ms" integer,
	"rag_generation_latency_ms" integer,
	"rag_agent_reasoning_latency_ms" integer,
	"rag_tool_call_latency_ms" integer,
	"rag_tokens_per_second" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_questions" integer DEFAULT 0,
	"completed_questions" integer DEFAULT 0,
	"retrieval_strategy" text DEFAULT 'hybrid',
	"chunking_strategy" text DEFAULT 'recursive',
	"use_agentic_mode" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "guardrail_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"message_id" uuid,
	"guardrail_type" text NOT NULL,
	"triggered" boolean NOT NULL,
	"severity" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistical_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_run_id" uuid,
	"ablation_study_id" uuid,
	"analysis_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"results" jsonb,
	"report_en" text,
	"report_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_logs" ADD CONSTRAINT "guardrail_logs_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistical_analyses" ADD CONSTRAINT "statistical_analyses_evaluation_run_id_evaluation_runs_id_fk" FOREIGN KEY ("evaluation_run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistical_analyses" ADD CONSTRAINT "statistical_analyses_ablation_study_id_ablation_studies_id_fk" FOREIGN KEY ("ablation_study_id") REFERENCES "public"."ablation_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_search_idx" ON "document_chunks" USING gin ("content" gin_trgm_ops);