WARNING: This report is an old report and may not reflect the latest changes in the codebase, use this only as a reference.

# Academic RAG Chatbot System
# Sistem Chatbot RAG Akademik

> A comprehensive Retrieval-Augmented Generation system for academic research with agentic capabilities, hybrid retrieval, and advanced evaluation metrics.
>
> Sistem Retrieval-Augmented Generation komprehensif untuk penelitian akademis dengan kemampuan agentik, pengambilan hibrida, dan metrik evaluasi canggih.

---

## Table of Contents / Daftar Isi

1. [Executive Summary](#executive-summary)
2. [Features Overview](#features-overview)
3. [Technology Stack](#technology-stack)
4. [Environment Configuration](#environment-configuration)
5. [System Architecture](#system-architecture)
6. [Research Methodology](#research-methodology)
7. [Core Modules](#core-modules)
8. [Evaluation Framework](#evaluation-framework)
9. [Statistical Analysis](#statistical-analysis)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Bilingual Support](#bilingual-support)
13. [Best Practices Implementation](#best-practices-implementation)
14. [Future Work](#future-work)
15. [References](#references)
16. [Paper Helper / Panduan Penulisan Paper](#paper-helper-panduan-penulisan-paper)

---

## Executive Summary

### English

This Academic RAG Chatbot is a production-ready system designed for research comparing traditional RAG approaches with agentic multi-step reasoning. The system supports both English and Indonesian (Bahasa Indonesia) queries, features hybrid retrieval using Vector similarity and Okapi BM25 with Reciprocal Rank Fusion (RRF), and includes comprehensive evaluation capabilities using RAGAS metrics, hallucination detection, and domain-specific academic metrics.

Key capabilities:
- **Agentic RAG** with tool-based reasoning using Vercel AI SDK 5.x
- **Hybrid Retrieval** combining vector embeddings and Okapi BM25
- **Re-ranking** with cross-encoder, LLM-based, and ensemble methods
- **Comprehensive Guardrails** including negative reaction handling
- **Multiple Chunking Strategies** (semantic, recursive, sentence-window)
- **RAGAS-based Evaluation** with ablation study support
- **Statistical Analysis** with paired t-tests, ANOVA, and confidence intervals
- **Response Time/Latency Metrics** for agentic system performance analysis
- **Zustand State Management** for optimized React performance

### Bahasa Indonesia

Chatbot RAG Akademik ini adalah sistem siap produksi yang dirancang untuk penelitian membandingkan pendekatan RAG tradisional dengan penalaran multi-langkah agentik. Sistem ini mendukung kueri dalam Bahasa Inggris dan Indonesia, menampilkan pengambilan hibrida menggunakan kesamaan Vektor dan Okapi BM25 dengan Reciprocal Rank Fusion (RRF), serta mencakup kemampuan evaluasi komprehensif menggunakan metrik RAGAS, deteksi halusinasi, dan metrik akademis domain-spesifik.

---

## Features Overview

### Core Features

| Feature                  | Description                                         | Implementation                           |
| ------------------------ | --------------------------------------------------- | ---------------------------------------- |
| **Agentic RAG**          | Multi-tool agent with reasoning capabilities        | `lib/rag/agentic-rag.ts`                 |
| **Hybrid Retrieval**     | Vector + Okapi BM25 with RRF fusion                 | `lib/rag/hybrid-retrieval.ts`            |
| **Re-ranking**           | Cross-encoder, LLM, ensemble methods                | `lib/rag/reranker.ts`                    |
| **Guardrails**           | Input/output validation, negative reaction handling | `lib/rag/guardrails.ts`                  |
| **Multi-Chunking**       | Semantic, recursive, sentence-window                | `lib/rag/chunking.ts`                    |
| **OCR Support**          | Mistral OCR for scanned documents                   | `lib/rag/document-processor.ts`          |
| **Evaluation Suite**     | RAGAS + hallucination + latency metrics             | `lib/rag/evaluation.ts`                  |
| **Statistical Analysis** | t-tests, ANOVA, confidence intervals                | `lib/statistics/statistical-analysis.ts` |
| **State Management**     | Zustand stores with persistence                     | `lib/stores/*.ts`                        |

### User Interfaces

1. **Chat Interface** (`/`): Conversational AI with RAG toggle, agent reasoning display
2. **Knowledge Base Management** (`/manage`): Document upload, processing status, library management
3. **Evaluation Dashboard** (`/evaluation`): Metrics visualization, ablation studies, comparison charts

---

## Technology Stack

### Frontend

| Technology   | Version   | Purpose                           |
| ------------ | --------- | --------------------------------- |
| Next.js      | 15.x/16.x | React framework with App Router   |
| React        | 19.x      | UI component library              |
| Tailwind CSS | 4.x       | Utility-first styling             |
| shadcn/ui    | Latest    | Component library                 |
| Recharts     | 2.x       | Data visualization                |
| Lucide React | Latest    | Icon system                       |
| **Zustand**  | 5.x       | State management with persistence |

### Backend

| Technology        | Version | Purpose                                          |
| ----------------- | ------- | ------------------------------------------------ |
| **Vercel AI SDK** | **5.x** | LLM integration with tools, streaming, telemetry |
| Azure OpenAI      | -       | Primary LLM provider                             |
| Drizzle ORM       | Latest  | Type-safe database access                        |
| PostgreSQL        | 15+     | Primary database                                 |
| pgvector          | 0.5+    | Vector similarity search                         |

### AI/ML Components

| Component  | Implementation                                | Purpose                   |
| ---------- | --------------------------------------------- | ------------------------- |
| Embeddings | Azure OpenAI ada-002 / text-embedding-3-small | 1536-dimensional vectors  |
| Chat Model | GPT-4 / GPT-4o-mini                           | Response generation       |
| OCR        | Mistral Pixtral                               | Document image processing |
| Re-ranking | Cross-encoder + LLM + Ensemble                | Result refinement         |

### AI SDK Best Practices Implemented

| Practice                        | Implementation                                         |
| ------------------------------- | ------------------------------------------------------ |
| `stopWhen` with `stepCountIs()` | Controls multi-step agent loops                        |
| `onStepFinish` callback         | Captures tool calls, results, and token usage per step |
| `convertToModelMessages()`      | Proper message conversion for UI streams               |
| `toUIMessageStreamResponse()`   | Streaming responses with headers                       |
| `experimental_telemetry`        | OpenTelemetry integration for observability            |
| Typed tool errors               | `NoSuchToolError`, `InvalidToolInputError` handling    |
| Language model middleware       | `wrapLanguageModel` with `extractReasoningMiddleware`  |

---

## Environment Configuration

\`\`\`env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL=postgresql://user:password@host:5432/academic_rag

# ===========================================
# AZURE OPENAI CONFIGURATION
# ===========================================
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_RESOURCE_NAME=your-resource-name
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
USE_AZURE_OPENAI=true

# ===========================================
# VERCEL AI GATEWAY (Fallback - No key needed)
# ===========================================
# Supported: openai/*, anthropic/*, fireworks/*, etc.

# ===========================================
# MISTRAL OCR (Optional)
# ===========================================
MISTRAL_API_KEY=your-mistral-api-key

# ===========================================
# RE-RANKING SERVICE (Optional)
# ===========================================
COHERE_API_KEY=your-cohere-api-key

# ===========================================
# APPLICATION SETTINGS
# ===========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
\`\`\`

---

## System Architecture

### High-Level Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────┬─────────────────────┬─────────────────────────────────┤
│   Chat Interface │  Knowledge Base UI  │     Evaluation Dashboard        │
│      (/)         │     (/manage)       │        (/evaluation)            │
│                  │                     │                                 │
│   ┌──────────┐   │                     │    ┌───────────────────────┐    │
│   │ Zustand  │   │                     │    │   Evaluation Store    │    │
│   │  Store   │   │                     │    │   (Zustand + Immer)   │    │
│   └──────────┘   │                     │    └───────────────────────┘    │
└────────┬────────┴──────────┬──────────┴──────────────┬──────────────────┘
         │                   │                          │
         ▼                   ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (AI SDK 5.x)                         │
├─────────────────┬─────────────────────┬─────────────────────────────────┤
│  /api/chat      │  /api/documents/*   │     /api/evaluation/*           │
│  (streamText)   │  (Upload/Process)   │     (Metrics/Ablation)          │
│  toUIMessage    │                     │     (Statistical Analysis)      │
│  StreamResponse │                     │                                 │
└────────┬────────┴──────────┬──────────┴──────────────┬──────────────────┘
         │                   │                          │
         ▼                   ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────────┐  │
│  │  Guardrails │→ │ Agentic RAG  │→ │ Retrieval │→ │    Re-ranker    │  │
│  │   (Input)   │  │   (Tools +   │  │ (Hybrid)  │  │   (Ensemble)    │  │
│  │  + Negative │  │  stopWhen)   │  │ Okapi BM25│  │                 │  │
│  │   Reaction  │  │              │  │ + Vector  │  │                 │  │
│  └─────────────┘  └──────────────┘  └───────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
\`\`\`

### Agentic RAG with AI SDK 5.x

\`\`\`typescript
// Using stopWhen instead of deprecated maxSteps
const { text, steps, reasoning, usage } = await generateText({
  model: getModelForTask("chat"),
  system: AGENTIC_SYSTEM_PROMPT,
  prompt: query,
  tools: agentTools,
  stopWhen: stepCountIs(maxSteps), // AI SDK 5.x best practice
  experimental_telemetry: telemetryConfig,
  onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
    // Capture each reasoning step with timing and token usage
  },
});
\`\`\`

---

## Research Methodology

### Development Methodology

This project followed a **Rapid Application Development (RAD)** approach combined with **Research & Development (R&D) prototyping** over a **4-week sprint cycle**, optimized for academic research system development.

#### Development Timeline (4 Weeks)

**Week 1: Foundation & Core RAG Pipeline**
- **Days 1-2**: Database schema design with Drizzle ORM + PGVector
  - Set up PostgreSQL with pgvector extension
  - Design document, chunk, and session schemas
  - Implement migration scripts
- **Days 3-4**: Basic document ingestion pipeline
  - PDF/TXT/MD parsing
  - Fixed-size chunking implementation
  - Embedding generation with Azure OpenAI
- **Days 5-7**: Simple RAG implementation
  - Vector similarity search
  - Basic context construction
  - Chat interface with streaming responses

**Week 2: Advanced Retrieval & Agentic Capabilities**
- **Days 8-9**: Hybrid retrieval system
  - Okapi BM25 keyword search implementation
  - Reciprocal Rank Fusion (RRF) for result fusion
  - Language-aware tokenization (EN/ID)
- **Days 10-11**: Re-ranking module
  - Cross-encoder simulation
  - LLM-based relevance scoring
  - Ensemble re-ranking strategy
- **Days 12-14**: Agentic RAG with tools
  - Tool definitions (search, expand, decompose, verify, synthesize)
  - AI SDK 5.x integration with `stopWhen` and `onStepFinish`
  - Multi-step reasoning implementation

**Week 3: Chunking Strategies & Guardrails**
- **Days 15-16**: Advanced chunking strategies
  - Semantic chunking with embedding similarity
  - Recursive chunking with overlap
  - Sentence-window retrieval
  - Parent-child document structure
- **Days 17-18**: Comprehensive guardrails
  - Input validation (PII, prompt injection)
  - Output validation (hallucination detection)
  - Negative reaction handling (EN/ID)
  - Academic integrity checks
- **Days 19-21**: University domain tuning
  - Academic terminology extraction
  - Citation and reference parsing
  - Course/syllabus structure recognition
  - Indonesian academic synonym expansion

**Week 4: Evaluation & Statistical Analysis**
- **Days 22-23**: RAGAS-based evaluation framework
  - Faithfulness, relevancy, precision, recall metrics
  - Hallucination-specific metrics
  - Domain-specific academic metrics
  - Response time/latency tracking for agentic systems
- **Days 24-25**: Ablation study framework
  - 13 predefined configurations
  - Automated comparison pipeline
  - Metric aggregation and ranking
- **Days 26-27**: Statistical analysis module
  - Paired t-tests (RAG vs Non-RAG)
  - One-way ANOVA (multiple configurations)
  - Effect size calculations (Cohen's d, η²)
  - Confidence interval computation
- **Day 28**: UI polish, documentation, testing

#### RAD Approach Benefits

1. **Iterative Prototyping**: Each week delivered a functional prototype
2. **Rapid Feedback Cycles**: Daily testing and refinement
3. **Modular Architecture**: Components developed independently and integrated
4. **Research-Focused**: Evaluation metrics built alongside features

#### R&D Prototyping Strategy

- **Hypothesis-Driven Development**: Each module tests specific research questions
- **Comparative Analysis**: Built-in A/B testing for methodologies
- **Metrics-First Approach**: Evaluation framework guides feature development
- **Academic Rigor**: Statistical validation for all claims

### Experimental Design

This system supports rigorous academic research comparing RAG methodologies with:

#### Independent Variables

1. **Retrieval Strategy**: Non-RAG, Vector-only, BM25-only, Hybrid (RRF)
2. **Re-ranking Method**: None, Cross-encoder, LLM-based, Ensemble
3. **Chunking Strategy**: Fixed-size, Recursive, Semantic, Sentence-window
4. **Agent Configuration**: Single-step, Multi-step agentic

#### Dependent Variables (Metrics)

1. **Retrieval Quality**: Precision@K, Recall@K, NDCG, MRR
2. **Generation Quality**: Faithfulness, Answer Relevancy, Context Precision/Recall
3. **Hallucination Metrics**: Hallucination Rate, Factual Consistency, Source Attribution
4. **Domain-Specific**: Academic Rigor, Citation Accuracy, Terminology Correctness
5. **Latency Metrics**: Total, Retrieval, Reranking, Generation, Agent Reasoning, Tool Call

### Statistical Analysis

\`\`\`typescript
// Paired t-test for RAG vs Non-RAG comparison
const tTestResult = pairedTTest(ragScores, nonRagScores);

// One-way ANOVA for multiple configurations
const anovaResult = oneWayAnova(configurationGroups);

// Cohen's d effect size
const effectSize = cohensD(group1, group2);

// 95% Confidence Intervals
const ci = confidenceInterval(scores, 0.95);

// Bootstrap confidence intervals for non-normal distributions
const bootstrapCI = bootstrapConfidenceInterval(scores, 1000, 0.95);
\`\`\`

---

## Core Modules

### 1. Agentic RAG (`lib/rag/agentic-rag.ts`)

Implements multi-step reasoning with tools:

- `search_documents`: Hybrid retrieval with Okapi BM25 + Vector
- `expand_query`: Academic synonym expansion (EN/ID)
- `decompose_query`: Complex question decomposition
- `verify_claim`: Hallucination prevention
- `synthesize_answer`: Multi-source synthesis with citations

### 2. Hybrid Retrieval (`lib/rag/hybrid-retrieval.ts`)

Okapi BM25 implementation:

$$\text{BM25}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{\text{avgdl}})}$$

With Reciprocal Rank Fusion:

$$\text{RRF}(d) = \sum_{r \in R} \frac{1}{k + r(d)}$$

### 3. Guardrails (`lib/rag/guardrails.ts`)

Comprehensive validation including:

- PII detection (SSN, NIK, credit cards, etc.)
- Prompt injection prevention (EN/ID patterns)
- Academic integrity checks
- **Negative reaction handling** (frustration, disappointment, confusion)
- Hallucination detection
- Citation verification

### 4. State Management (`lib/stores/`)

Zustand stores with persistence:

\`\`\`typescript
// Chat store with immer middleware
export const useChatStore = create<ChatStore>()(
  persist(
    immer((set, get) => ({
      sessions: [],
      settings: defaultSettings,
      // Actions...
    })),
    { name: "academic-rag-chat", storage: createJSONStorage(() => localStorage) }
  )
);
\`\`\`

### 5. Evaluation (`lib/rag/evaluation.ts`)

RAGAS metrics plus:

- Response time tracking (per-phase latency)
- Hallucination-specific metrics
- Domain-specific academic metrics
- Ablation study configurations

### 6. Statistical Analysis (`lib/statistics/statistical-analysis.ts`)

- Paired and independent t-tests
- Welch's t-test for unequal variances
- One-way ANOVA with Tukey HSD post-hoc
- Cohen's d and eta-squared effect sizes
- Parametric and bootstrap confidence intervals
- Bilingual reporting (EN/ID)

---

## API Reference

### Chat API

\`\`\`typescript
POST /api/chat
Content-Type: application/json

{
  "messages": UIMessage[],
  "sessionId": string,
  "useRag": boolean,
  "useAgenticMode": boolean,
  "retrievalStrategy": "vector" | "keyword" | "hybrid",
  "enableGuardrails": boolean
}

// Response (Agentic mode)
{
  "content": string,
  "steps": AgentStep[],
  "retrievedChunks": RetrievedChunk[],
  "latencyMs": number,
  "language": "en" | "id",
  "reasoning": string,
  "guardrails": { input: GuardrailResult, output: GuardrailResult }
}

// Response (Streaming mode)
// Returns toUIMessageStreamResponse() with headers
\`\`\`

### Evaluation API

\`\`\`typescript
POST /api/evaluation/ablation
{
  "configurations": AblationConfig[],
  "testQuestions": TestQuestion[],
  "runStatisticalAnalysis": boolean
}

// Response
{
  "results": Record<string, EvaluationMetrics>,
  "statisticalAnalysis": {
    "tTests": Record<string, TTestResult>,
    "anova": ANOVAResult,
    "confidenceIntervals": Record<string, ConfidenceInterval>
  }
}
\`\`\`

---

## Best Practices Implementation

### AI SDK 5.x Best Practices

| Practice                             | Status | Implementation                             |
| ------------------------------------ | ------ | ------------------------------------------ |
| Use `stopWhen` instead of `maxSteps` | ✅      | `stopWhen: stepCountIs(5)`                 |
| Use `onStepFinish` for step tracking | ✅      | Captures tool calls, results, usage        |
| Use `convertToModelMessages()`       | ✅      | In chat API route                          |
| Use `toUIMessageStreamResponse()`    | ✅      | For streaming responses                    |
| Enable telemetry                     | ✅      | `experimental_telemetry` config            |
| Handle typed errors                  | ✅      | `NoSuchToolError`, `InvalidToolInputError` |
| Use language model middleware        | ✅      | `wrapLanguageModel`                        |

### React Best Practices

| Practice                          | Status | Implementation                         |
| --------------------------------- | ------ | -------------------------------------- |
| Use Zustand for state             | ✅      | `lib/stores/chat-store.ts`             |
| Persist state properly            | ✅      | `persist` middleware with `partialize` |
| Memoize components                | ✅      | `memo()` for `MessageBubble`           |
| Use `useCallback` for handlers    | ✅      | Event handlers memoized                |
| Use `useMemo` for computed values | ✅      | Settings panel memoized                |
| Immer for immutable updates       | ✅      | `immer` middleware in stores           |

---

## Future Work

1. **Multi-modal RAG**: Support for image-based queries
2. **Collaborative filtering**: User preference learning
3. **Active learning**: Automatic training data generation
4. **Cross-lingual retrieval**: EN-ID semantic matching
5. **Real-time evaluation**: Live metric dashboards
6. **A/B testing framework**: Built-in experiment management

---

## References

### Academic References

1. Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." NeurIPS.
2. Yao, S., et al. (2022). "ReAct: Synergizing Reasoning and Acting in Language Models." ICLR.
3. Es, S., et al. (2023). "RAGAS: Automated Evaluation of Retrieval Augmented Generation." arXiv.
4. Robertson, S., & Zaragoza, H. (2009). "The Probabilistic Relevance Framework: BM25 and Beyond." Foundations and Trends in IR.

### Technical Documentation

- [Vercel AI SDK Documentation](https://sdk.vercel.ai)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PGVector Documentation](https://github.com/pgvector/pgvector)
- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)

---

## Paper Helper / Panduan Penulisan Paper

> Bagian ini menyediakan formula, terminologi, struktur tabel, dan rekomendasi untuk membantu penulisan paper akademik dalam format IMRAD (Introduction, Methods, Results, And Discussion).

---

### Mathematical Formulas & Explanations

#### 1. Okapi BM25 Scoring

**Formula:**

$$
\text{BM25}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}
$$

**Where:**
- $$D$$ = Document being scored
- $$Q$$ = Query with terms $$q_1, q_2, ..., q_n$$
- $$f(q_i, D)$$ = Term frequency of $$q_i$$ in document $$D$$
- $$|D|$$ = Length of document $$D$$ (in words)
- $$\text{avgdl}$$ = Average document length in the corpus
- $$k_1$$ = Term frequency saturation parameter (typically 1.2-2.0)
- $$b$$ = Length normalization parameter (typically 0.75)

**IDF Component:**

$$
\text{IDF}(q_i) = \ln\left(\frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} + 1\right)
$$

**Where:**
- $$N$$ = Total number of documents in corpus
- $$n(q_i)$$ = Number of documents containing term $$q_i$$

**Explanation for Paper:**
> "BM25 menghitung skor relevansi dokumen berdasarkan frekuensi term dengan saturasi (term tidak akan mendominasi jika muncul terlalu sering) dan normalisasi panjang dokumen. Parameter $$k_1$$ mengontrol saturasi frekuensi term, sedangkan $$b$$ mengontrol seberapa besar pengaruh panjang dokumen terhadap skor."

---

#### 2. Cosine Similarity (Vector Search)

**Formula:**

$$
\text{cosine}(\vec{A}, \vec{B}) = \frac{\vec{A} \cdot \vec{B}}{||\vec{A}|| \cdot ||\vec{B}||} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \cdot \sqrt{\sum_{i=1}^{n} B_i^2}}
$$

**Where:**
- $$\vec{A}$$ = Query embedding vector (dimensi 1536 untuk OpenAI ada-002)
- $$\vec{B}$$ = Document chunk embedding vector
- $$n$$ = Vector dimension (1536)

**Explanation for Paper:**
> "Cosine similarity mengukur kesamaan orientasi antara dua vektor dalam ruang berdimensi tinggi, menghasilkan nilai antara -1 (berlawanan) hingga 1 (identik). Untuk embedding semantik, nilai mendekati 1 menunjukkan kesamaan makna yang tinggi."

---

#### 3. Reciprocal Rank Fusion (RRF)

**Formula:**

$$
\text{RRF}(d) = \sum_{r \in R} \frac{1}{k + r(d)}
$$

**Where:**
- $$d$$ = Document being scored
- $$R$$ = Set of rankings (Vector ranking, BM25 ranking)
- $$r(d)$$ = Rank of document $$d$$ in ranking $$r$$
- $$k$$ = Smoothing constant (typically 60)

**With Weights:**

$$
\text{RRF}_\text{weighted}(d) = \alpha \cdot \frac{1}{k + r_\text{vector}(d)} + \beta \cdot \frac{1}{k + r_\text{bm25}(d)}
$$

**Explanation for Paper:**
> "RRF menggabungkan hasil dari beberapa sistem pengambilan tanpa memerlukan normalisasi skor. Konstanta $$k$$ mencegah dokumen peringkat atas mendominasi, memungkinkan kontribusi bermakna dari dokumen peringkat menengah."

---

#### 4. RAGAS Metrics

##### Faithfulness

$$
\text{Faithfulness} = \frac{|\text{Claims}_\text{supported}|}{|\text{Claims}_\text{total}|}
$$

**Explanation:**
> "Faithfulness mengukur proporsi klaim dalam jawaban yang didukung oleh konteks yang diambil. Nilai 1.0 menunjukkan semua klaim dapat diverifikasi dari konteks."

##### Answer Relevancy

$$
\text{Relevancy} = \frac{1}{n} \sum_{i=1}^{n} \text{cosine}(E_q, E_{q_i'})
$$

**Where:**
- $$E_q$$ = Embedding of original question
- $$E_{q_i'}$$ = Embedding of question generated from answer (reverse engineering)
- $$n$$ = Number of generated questions

**Explanation:**
> "Answer Relevancy mengukur seberapa relevan jawaban terhadap pertanyaan dengan membangkitkan pertanyaan dari jawaban dan membandingkan kesamaannya dengan pertanyaan asli."

##### Context Precision

$$
\text{Precision@K} = \frac{|\text{Relevant}_{\text{retrieved@K}}|}{K}
$$

##### Context Recall

$$
\text{Recall} = \frac{|\text{Relevant}_\text{retrieved}|}{|\text{Relevant}_\text{total}|}
$$

##### NDCG (Normalized Discounted Cumulative Gain)

$$
\text{DCG@K} = \sum_{i=1}^{K} \frac{2^{rel_i} - 1}{\log_2(i + 1)}
$$

$$
\text{NDCG@K} = \frac{\text{DCG@K}}{\text{IDCG@K}}
$$

**Where:**
- $$rel_i$$ = Relevance score of document at position $$i$$
- $$\text{IDCG}$$ = Ideal DCG (perfect ranking)

---

#### 5. Statistical Analysis Formulas

##### Paired t-Test

$$
t = \frac{\bar{d}}{s_d / \sqrt{n}}
$$

**Where:**
- $$\bar{d}$$ = Mean of differences (RAG score - Non-RAG score)
- $$s_d$$ = Standard deviation of differences
- $$n$$ = Number of paired observations

**Degrees of Freedom:** $$df = n - 1$$

##### Cohen's d (Effect Size)

$$
d = \frac{\bar{X}_1 - \bar{X}_2}{s_\text{pooled}}
$$

$$
s_\text{pooled} = \sqrt{\frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1 + n_2 - 2}}
$$

**Interpretation:**
| Cohen's d | Interpretation              |
| --------- | --------------------------- |
| 0.2       | Small effect / Efek kecil   |
| 0.5       | Medium effect / Efek sedang |
| 0.8       | Large effect / Efek besar   |

##### One-Way ANOVA

$$
F = \frac{\text{MS}_\text{between}}{\text{MS}_\text{within}} = \frac{\sum n_j(\bar{X}_j - \bar{X})^2 / (k-1)}{\sum\sum(X_{ij} - \bar{X}_j)^2 / (N-k)}
$$

**Where:**
- $$k$$ = Number of groups (configurations)
- $$N$$ = Total number of observations
- $$\bar{X}_j$$ = Mean of group $$j$$
- $$\bar{X}$$ = Grand mean

##### Eta-Squared (Effect Size for ANOVA)

$$
\eta^2 = \frac{\text{SS}_\text{between}}{\text{SS}_\text{total}}
$$

**Interpretation:**
| $$\eta^2$$ | Interpretation |
| ---------- | -------------- |
| 0.01       | Small effect   |
| 0.06       | Medium effect  |
| 0.14       | Large effect   |

##### 95% Confidence Interval

$$
\text{CI}_{95\%} = \bar{X} \pm t_{0.025, df} \cdot \frac{s}{\sqrt{n}}
$$

---

### Table Structures for Paper

#### Table 1: System Configuration Comparison
\`\`\`
| Configuration | Retrieval | Re-ranking | Chunking | Agent |
| ------------- | --------- | ---------- | -------- | ----- |
| Baseline      | None      | None       | Fixed    | No    |
| Vector-Only   | Vector    | None       | Fixed    | No    |
| BM25-Only     | BM25      | None       | Fixed    | No    |
| Hybrid        | RRF       | None       | Fixed    | No    |
| Hybrid+Rerank | RRF       | Ensemble   | Semantic | No    |
| Agentic-Full  | RRF       | Ensemble   | Semantic | Yes   |
\`\`\`

#### Table 2: Evaluation Metrics Results
\`\`\`
| Metric             | Non-RAG | RAG  | Agentic | p-value | Cohen's d |
| ------------------ | ------- | ---- | ------- | ------- | --------- |
| Faithfulness       | x.xx    | x.xx | x.xx    | < 0.05  | x.xx      |
| Answer Relevancy   | x.xx    | x.xx | x.xx    | < 0.05  | x.xx      |
| Context Precision  | -       | x.xx | x.xx    | < 0.05  | x.xx      |
| Hallucination Rate | x.xx    | x.xx | x.xx    | < 0.05  | x.xx      |
| Avg Latency (ms)   | xxx     | xxx  | xxx     | < 0.05  | x.xx      |
\`\`\`

#### Table 3: Ablation Study Results
\`\`\`
| Component Removed    | Faithfulness | Relevancy | Precision | Delta (%) |
| -------------------- | ------------ | --------- | --------- | --------- |
| Full System          | x.xx         | x.xx      | x.xx      | baseline  |
| - Re-ranking         | x.xx         | x.xx      | x.xx      | -x.x%     |
| - Semantic Chunk     | x.xx         | x.xx      | x.xx      | -x.x%     |
| - BM25 (Vector only) | x.xx         | x.xx      | x.xx      | -x.x%     |
| - Agent Tools        | x.xx         | x.xx      | x.xx      | -x.x%     |
\`\`\`

#### Table 4: Latency Breakdown (Agentic System)
\`\`\`
| Phase          | Mean (ms) | P50 | P95 | P99 |
| -------------- | --------- | --- | --- | --- |
| Retrieval      | xxx       | xxx | xxx | xxx |
| Re-ranking     | xxx       | xxx | xxx | xxx |
| Agent Planning | xxx       | xxx | xxx | xxx |
| Tool Execution | xxx       | xxx | xxx | xxx |
| Generation     | xxx       | xxx | xxx | xxx |
| **Total**      | xxx       | xxx | xxx | xxx |
\`\`\`

#### Table 5: Indonesian vs English Performance
\`\`\`
| Language   | Faithfulness | Relevancy | BM25 Recall | Vector Recall |
| ---------- | ------------ | --------- | ----------- | ------------- |
| English    | x.xx         | x.xx      | x.xx        | x.xx          |
| Indonesian | x.xx         | x.xx      | x.xx        | x.xx          |
| Mixed      | x.xx         | x.xx      | x.xx        | x.xx          |
\`\`\`

---

### Academic Terminology / Terminologi Akademis

#### English Terms

| Term                                     | Definition                                                                                     | Indonesian                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Retrieval-Augmented Generation (RAG)** | A technique that enhances LLM responses by retrieving relevant documents from a knowledge base | Generasi yang Diperkuat Pengambilan |
| **Agentic RAG**                          | RAG system with autonomous tool-using capabilities and multi-step reasoning                    | RAG Agentik                         |
| **Hybrid Retrieval**                     | Combining multiple retrieval methods (e.g., vector + keyword)                                  | Pengambilan Hibrida                 |
| **Re-ranking**                           | Second-stage ranking to improve retrieval precision                                            | Pemeringkatan Ulang                 |
| **Chunking**                             | Splitting documents into smaller segments for embedding                                        | Pemecahan Dokumen                   |
| **Embedding**                            | Dense vector representation of text                                                            | Representasi Vektor                 |
| **Hallucination**                        | LLM generating information not grounded in source material                                     | Halusinasi                          |
| **Faithfulness**                         | Degree to which generated content is supported by retrieved context                            | Kesetiaan                           |
| **Ablation Study**                       | Systematic removal of components to measure individual contributions                           | Studi Ablasi                        |
| **Ground Truth**                         | Reference answers used for evaluation                                                          | Jawaban Referensi                   |
| **Semantic Similarity**                  | Measure of meaning similarity between texts                                                    | Kesamaan Semantik                   |
| **Lexical Matching**                     | Word-level matching (e.g., BM25)                                                               | Pencocokan Leksikal                 |
| **Latency**                              | Response time from query to answer                                                             | Latensi                             |
| **Throughput**                           | Number of queries processed per unit time                                                      | Throughput                          |

#### Indonesian Academic Phrases

| Bahasa Indonesia                          | English                                        | Usage Context |
| ----------------------------------------- | ---------------------------------------------- | ------------- |
| "Penelitian ini bertujuan untuk..."       | "This research aims to..."                     | Introduction  |
| "Berdasarkan hasil evaluasi..."           | "Based on the evaluation results..."           | Results       |
| "Terdapat perbedaan signifikan antara..." | "There is a significant difference between..." | Results       |
| "Hasil menunjukkan bahwa..."              | "The results show that..."                     | Results       |
| "Dibandingkan dengan baseline..."         | "Compared to the baseline..."                  | Discussion    |
| "Studi ablasi menunjukkan..."             | "The ablation study shows..."                  | Discussion    |
| "Keterbatasan penelitian ini meliputi..." | "The limitations of this study include..."     | Discussion    |
| "Implikasi dari temuan ini adalah..."     | "The implications of these findings are..."    | Discussion    |

---

### IMRAD Structure Guide

#### Introduction (Pendahuluan)

**Content to Include:**
1. **Background/Latar Belakang:**
   - Pentingnya sistem tanya-jawab akademis
   - Keterbatasan LLM standalone (halusinasi, outdated knowledge)
   - Potensi RAG untuk domain akademis

2. **Problem Statement/Rumusan Masalah:**
   - Bagaimana meningkatkan akurasi sistem QA akademis?
   - Apakah pendekatan agentik lebih efektif dari RAG tradisional?
   - Bagaimana performa sistem pada bahasa Indonesia?

3. **Research Questions/Pertanyaan Penelitian:**
   - RQ1: Seberapa signifikan peningkatan akurasi RAG vs Non-RAG?
   - RQ2: Apakah hybrid retrieval lebih efektif dari single-method?
   - RQ3: Bagaimana trade-off akurasi vs latency pada sistem agentik?

4. **Objectives/Tujuan:**
   - Mengembangkan sistem RAG agentik untuk domain akademis
   - Mengevaluasi berbagai strategi retrieval dan chunking
   - Menganalisis performa sistem secara statistik

**Sample Opening Paragraph:**
> "Sistem tanya-jawab berbasis Large Language Model (LLM) telah menunjukkan kemampuan luar biasa dalam memahami dan menghasilkan teks natural. Namun, LLM memiliki keterbatasan inherent: kecenderungan menghasilkan informasi yang tidak akurat (halusinasi) dan pengetahuan yang terbatas pada data pelatihan. Retrieval-Augmented Generation (RAG) menawarkan solusi dengan mengintegrasikan pengambilan dokumen relevan ke dalam proses generasi (Lewis et al., 2020)."

---

#### Methods (Metode)

**Content to Include:**

1. **System Architecture:**
   - Diagram arsitektur (gunakan ASCII dari REPORT.md)
   - Komponen: Ingestion, Retrieval, Generation, Evaluation

2. **Dataset:**
   - Sumber dokumen akademis (silabus, materi kuliah, jurnal)
   - Jumlah dokumen, chunks, total tokens
   - Distribusi bahasa (EN/ID)

3. **Implementation Details:**
   \`\`\`
   | Component | Technology             | Configuration   |
   | --------- | ---------------------- | --------------- |
   | LLM       | GPT-4o-mini            | temperature=0.7 |
   | Embedding | text-embedding-ada-002 | dim=1536        |
   | Vector DB | PostgreSQL + pgvector  | IVFFlat index   |
   | BM25      | Custom Okapi BM25      | k1=1.5, b=0.75  |
   \`\`\`

4. **Evaluation Protocol:**
   - Test set: n pertanyaan dengan ground truth
   - Metrics: RAGAS (Faithfulness, Relevancy, Precision, Recall)
   - Statistical tests: Paired t-test, ANOVA

5. **Ablation Configurations:**
   - List semua konfigurasi yang diuji
   - Baseline dan variasi

**Sample Methods Paragraph:**
> "Sistem dikembangkan menggunakan arsitektur RAG agentik dengan hybrid retrieval. Dokumen diproses melalui pipeline ingestion yang mencakup parsing, chunking (semantic chunking dengan threshold similarity 0.7), dan embedding menggunakan model text-embedding-ada-002 (dimensi 1536). Retrieval dilakukan dengan menggabungkan vector similarity search (cosine similarity pada pgvector) dan Okapi BM25 (k1=1.5, b=0.75) menggunakan Reciprocal Rank Fusion dengan k=60."

---

#### Results (Hasil)

**Content to Include:**

1. **Descriptive Statistics:**
   \`\`\`
   | Metric | Mean | SD | Min | Max | 95% CI |
   \`\`\`

2. **Hypothesis Testing:**
   - H0: Tidak ada perbedaan signifikan antara RAG dan Non-RAG
   - H1: RAG menghasilkan akurasi lebih tinggi
   - Report: t-statistic, df, p-value, effect size

3. **ANOVA Results (Multiple Configurations):**
   - F-statistic, p-value, η²
   - Post-hoc Tukey HSD jika signifikan

4. **Visualization Recommendations:**
   - Bar chart: Comparison of metrics across configurations
   - Box plot: Distribution of scores per configuration
   - Line chart: Latency breakdown per phase
   - Heatmap: Correlation between metrics

5. **Key Findings Summary:**
   - Bullet points of significant results
   - Highlight unexpected findings

**Sample Results Paragraph:**
> "Hasil evaluasi menunjukkan bahwa sistem RAG agentik (M = 0.847, SD = 0.089) secara signifikan lebih baik dibandingkan baseline Non-RAG (M = 0.623, SD = 0.142) dalam metrik Faithfulness, t(49) = 8.234, p < 0.001, d = 1.89 (efek besar). Studi ablasi mengkonfirmasi bahwa komponen re-ranking memberikan kontribusi terbesar terhadap peningkatan presisi (+12.3%), diikuti oleh semantic chunking (+8.7%) dan hybrid retrieval (+6.2%)."

---

#### Discussion (Diskusi)

**Content to Include:**

1. **Interpretation of Results:**
   - Mengapa RAG lebih baik dari Non-RAG?
   - Mengapa agentic lebih akurat tapi lebih lambat?
   - Temuan tentang bahasa Indonesia

2. **Comparison with Prior Work:**
   - Bandingkan dengan hasil Lewis et al. (2020)
   - Bandingkan dengan RAGAS benchmarks

3. **Trade-offs Analysis:**
   - Accuracy vs Latency
   - Complexity vs Performance
   - Cost considerations

4. **Limitations:**
   - Dataset size dan domain specificity
   - Single LLM provider
   - Evaluation metrics limitations

5. **Implications:**
   - Praktis: Rekomendasi untuk deployment
   - Teoritis: Kontribusi terhadap pemahaman RAG

6. **Future Work:**
   - Multi-modal RAG (gambar, tabel)
   - Fine-tuning untuk domain spesifik
   - Real-time learning

**Sample Discussion Paragraph:**
> "Peningkatan signifikan pada metrik Faithfulness (d = 1.89) mengkonfirmasi hipotesis bahwa grounding jawaban pada konteks yang diambil secara efektif mengurangi halusinasi. Menariknya, sistem agentik menunjukkan trade-off yang jelas: meskipun lebih akurat (+18.2% Faithfulness), latency meningkat 340% dibandingkan RAG tradisional. Hal ini disebabkan oleh multi-step reasoning yang memerlukan beberapa panggilan LLM. Untuk aplikasi real-time, RAG tradisional dengan re-ranking mungkin menawarkan keseimbangan optimal."

---

### Result Presentation Recommendations / Rekomendasi Penyajian Hasil

#### Visualisasi yang Disarankan

1. **Perbandingan Metrik (Bar Chart)**
   \`\`\`
   Sumbu X: Configurations (Non-RAG, RAG, Agentic)
   Sumbu Y: Score (0-1)
   Groups: Faithfulness, Relevancy, Precision
   Include: Error bars (95% CI)
   \`\`\`

2. **Distribusi Skor (Box Plot)**
   \`\`\`
   Sumbu X: Configurations
   Sumbu Y: Score
   Show: Median, Q1, Q3, outliers
   \`\`\`

3. **Latency Breakdown (Stacked Bar)**
   \`\`\`
   Sumbu X: Configurations
   Sumbu Y: Time (ms)
   Stacks: Retrieval, Reranking, Generation, Agent
   \`\`\`

4. **Correlation Heatmap**
   \`\`\`
   Variables: All metrics
   Color scale: -1 (red) to +1 (blue)
   Annotate: Correlation coefficients
   \`\`\`

5. **Ablation Impact (Waterfall Chart)**
   \`\`\`
   Start: Full system score
   Show: Impact of removing each component
   End: Baseline score
   \`\`\`

#### Reporting Guidelines

**Statistical Significance:**
\`\`\`
Format: t(df) = value, p < threshold, d = effect_size
Example: t(49) = 8.234, p < 0.001, d = 1.89
\`\`\`

**ANOVA Results:**
\`\`\`
Format: F(df_between, df_within) = value, p < threshold, η² = effect_size
Example: F(4, 245) = 12.567, p < 0.001, η² = 0.17
\`\`\`

**Confidence Intervals:**
\`\`\`
Format: M = value, 95% CI [lower, upper]
Example: M = 0.847, 95% CI [0.812, 0.882]
\`\`\`

**Effect Size Interpretation:**
\`\`\`
Always include interpretation: "efek kecil/sedang/besar"
Example: "d = 1.89 menunjukkan efek yang sangat besar"
\`\`\`

---

### Code Snippets for Paper

#### Embedding Generation
\`\`\`python
# Pseudocode untuk paper
def generate_embedding(text: str) -> Vector:
    """
    Menghasilkan embedding 1536-dimensi menggunakan
    model text-embedding-ada-002
    """
    response = openai.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response.data[0].embedding
\`\`\`

#### Hybrid Retrieval
\`\`\`python
# Pseudocode untuk paper
def hybrid_search(query: str, k: int = 10) -> List[Document]:
    # Vector search
    query_embedding = generate_embedding(query)
    vector_results = vector_db.similarity_search(
        query_embedding, k=k*2
    )

    # BM25 search
    bm25_results = bm25_index.search(query, k=k*2)

    # Reciprocal Rank Fusion
    fused = reciprocal_rank_fusion(
        [vector_results, bm25_results],
        k=60
    )

    return fused[:k]
\`\`\`

#### Statistical Analysis
\`\`\`python
# Code untuk paper
from scipy import stats

# Paired t-test
t_stat, p_value = stats.ttest_rel(rag_scores, non_rag_scores)

# Cohen's d
pooled_std = np.sqrt(((n1-1)*s1**2 + (n2-1)*s2**2) / (n1+n2-2))
cohens_d = (mean1 - mean2) / pooled_std

# One-way ANOVA
f_stat, p_value = stats.f_oneway(*groups)
\`\`\`

---

### Checklist Sebelum Submit

#### Introduction
- [ ] Latar belakang jelas dan relevan
- [ ] Rumusan masalah spesifik
- [ ] Research questions terformulasi dengan baik
- [ ] Tujuan penelitian terukur
- [ ] Struktur paper dijelaskan

#### Methods
- [ ] Arsitektur sistem terdokumentasi
- [ ] Dataset dijelaskan (sumber, ukuran, karakteristik)
- [ ] Parameter dan konfigurasi lengkap
- [ ] Metrics evaluasi didefinisikan
- [ ] Protokol eksperimen reproducible

#### Results
- [ ] Descriptive statistics lengkap
- [ ] Statistical tests appropriate
- [ ] Effect sizes dilaporkan
- [ ] Confidence intervals disertakan
- [ ] Visualisasi mendukung narasi

#### Discussion
- [ ] Interpretasi hasil logis
- [ ] Perbandingan dengan prior work
- [ ] Limitations diakui
- [ ] Implications dijelaskan
- [ ] Future work disarankan

#### General
- [ ] Konsistensi terminologi
- [ ] Referensi lengkap dan konsisten
- [ ] Tabel dan gambar dinomori
- [ ] Abstract merangkum semua bagian
- [ ] Proofreading completed

---
