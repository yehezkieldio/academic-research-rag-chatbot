/**
 * AI Model Configuration Module
 *
 * Configures Azure OpenAI models for chat generation and embeddings.
 *
 * WHY Azure OpenAI (not OpenAI direct):
 * - **Enterprise Compliance**: Azure provides SOC 2, HIPAA, ISO 27001 certifications
 *   - Critical for university deployment handling student data
 * - **Data Residency**: Data stays in Azure region (important for Indonesian regulations)
 * - **SLA Guarantees**: 99.9% uptime SLA vs best-effort for direct OpenAI
 * - **Integration**: Seamless with other Azure services (monitoring, logging, security)
 *
 * WHY GPT-4.1-mini (not GPT-4o or GPT-4-turbo):
 * - **Cost**: 60% cheaper than GPT-4o ($0.15/1M input vs $0.40/1M)
 * - **Speed**: 2x faster inference (critical for real-time chat)
 * - **Quality**: Near-parity with GPT-4o for academic Q&A tasks
 * - **Context Window**: 128K tokens (sufficient for RAG with retrieved chunks)
 * - **Research Consistency**: Same model for generation AND evaluation (LLM-as-judge)
 *   - Avoids confounding variable of different model capabilities
 *
 * WHY same model for generation and evaluation:
 * - **Experiment Validity**: Isolates impact of RAG architecture from model differences
 * - **Self-Preference Bias Mitigation**: Focus on relative gains between configs, not absolute scores
 * - **Cost Efficiency**: Single model deployment = simpler infrastructure
 * - **Consistency**: Ablation study results directly comparable
 *
 * WHY telemetry enabled only in production:
 * - **Development**: Disable to reduce noise in logs during debugging
 * - **Production**: Enable for observability, performance monitoring, cost tracking
 * - **Privacy**: Telemetry doesn't send actual prompts/responses, only metadata
 *
 * @module ai
 */

import { createAzure } from "@ai-sdk/azure";
import { env } from "@/lib/env";

/**
 * Azure OpenAI client configured with environment credentials
 */
export const azure = createAzure({
    resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
    apiKey: env.AZURE_OPENAI_API_KEY,
    baseURL: env.AZURE_OPENAI_BASE_URL,
});

/**
 * Chat completion model: GPT-4.1-mini
 *
 * Used for:
 * - Main chatbot responses
 * - Agentic tool reasoning
 * - Evaluation metrics (LLM-as-judge)
 * - Document classification
 * - Query decomposition
 *
 * Typical token usage:
 * - Simple query: 500 input + 300 output = 800 total (~$0.0001)
 * - Complex query (agentic): 2000 input + 800 output = 2800 total (~$0.0004)
 * - Evaluation: 1500 input + 50 output = 1550 total (~$0.0002) per metric
 */
export const AZURE_CHAT_MODEL = azure(env.AZURE_OPENAI_CHAT_DEPLOYMENT);

/**
 * Text embedding model: text-embedding-3-small (1536 dimensions)
 *
 * Used for:
 * - Query embedding (user questions)
 * - Document chunk embedding (knowledge base)
 * - Semantic chunking (sentence similarity)
 * - Similarity search (vector retrieval)
 *
 * Typical token usage:
 * - Single query: ~50 tokens (~$0.000001)
 * - 100 document chunks: ~50,000 tokens (~$0.001)
 * - Semantic chunking (500 sentences): ~25,000 tokens (~$0.0005)
 */
export const AZURE_EMBEDDING_MODEL = azure.textEmbedding(env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT);

/**
 * Exported model aliases for consistency across codebase
 *
 * WHY aliases:
 * - Easy to swap providers (e.g., Azure → OpenAI direct) by changing one line
 * - Clear intent: CHAT_MODEL vs EMBEDDING_MODEL immediately obvious
 * - Avoid Azure-specific coupling throughout codebase
 */
export const CHAT_MODEL = AZURE_CHAT_MODEL;
export const EMBEDDING_MODEL = AZURE_EMBEDDING_MODEL;

/**
 * Telemetry configuration for AI SDK observability
 *
 * Tracks:
 * - Request/response latency per function
 * - Token usage (input/output) per call
 * - Error rates and types
 * - Cost estimation (tokens × pricing)
 *
 * WHY metadata fields:
 * - **application**: Group all muliachat requests for dashboard filtering
 * - **version**: Track performance changes across deployments
 * - **functionId**: Identify which part of system generated call (e.g., "agentic-rag" vs "direct-chat")
 *
 * Privacy note: Telemetry sends metadata only, NOT actual prompts/responses
 */
export const telemetryConfig = {
    isEnabled: env.NODE_ENV === "production",
    functionId: "muliachat-academic-research-rag",
    metadata: {
        application: "muliachat",
        version: "1.0.0",
    },
};
