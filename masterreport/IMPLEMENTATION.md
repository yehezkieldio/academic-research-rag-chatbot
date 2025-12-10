# 💻 Implementasi - Academic RAG Chatbot

> Detail implementasi teknis dan struktur kode sistem Agentic RAG untuk layanan akademik.

---

## 📋 Daftar Isi

1. [Struktur Proyek](#1-struktur-proyek)
2. [Core RAG Pipeline](#2-core-rag-pipeline)
3. [Frontend Implementation](#3-frontend-implementation)
4. [Backend API Routes](#4-backend-api-routes)
5. [Database Layer](#5-database-layer)
6. [Kode Kunci](#6-kode-kunci)

---

## 1. Struktur Proyek

```
academic-research-rag-chatbot/
├── src/
│   ├── app/                         # Next.js 15 App Router
│   │   ├── api/                     # API Routes
│   │   │   ├── chat/                # Chat streaming endpoint
│   │   │   ├── documents/           # Document CRUD
│   │   │   └── evaluation/          # Evaluation & ablation
│   │   ├── evaluation/              # Evaluation dashboard page
│   │   ├── manage/                  # Knowledge base management page
│   │   ├── globals.css              # Tailwind CSS globals
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Home/Chat page
│   ├── components/
│   │   ├── chat/                    # Chat UI components
│   │   ├── evaluation/              # Evaluation UI components
│   │   ├── manage/                  # Document management UI
│   │   ├── sidebar.tsx              # Navigation sidebar
│   │   └── ui/                      # shadcn/ui primitives
│   └── lib/
│       ├── ai/                      # AI configuration
│       │   ├── index.ts             # Model setup, telemetry
│       │   └── embeddings.ts        # Embedding generation
│       ├── db/                      # Database layer
│       │   ├── index.ts             # Drizzle connection
│       │   └── schema.ts            # Database schema
│       ├── rag/                     # Core RAG modules
│       │   ├── agentic-rag.ts       # Agentic workflow (831 lines)
│       │   ├── hybrid-retrieval.ts  # Vector + BM25 (764 lines)
│       │   ├── evaluation.ts        # RAGAS metrics (1280 lines)
│       │   ├── guardrails.ts        # Safety guardrails
│       │   ├── reranker.ts          # Neural reranking
│       │   ├── chunking.ts          # Chunking strategies
│       │   ├── context-builder.ts   # Prompt construction
│       │   ├── document-processor.ts# Document parsing
│       │   └── university-domain.ts # Domain-specific logic
│       ├── statistics/              # Statistical analysis
│       │   └── statistical-analysis.ts
│       ├── stores/                  # Zustand state management
│       ├── evaluation-questions.ts  # Predefined questions
│       ├── types.ts                 # TypeScript types
│       └── utils.ts                 # Utility functions
├── drizzle/                         # Database migrations
├── scripts/                         # Utility scripts
│   └── run-statistical-analysis.ts  # CLI statistical analysis
├── .academic/                       # Academic documentation
└── masterreport/                    # This documentation
```

---

## 2. Core RAG Pipeline

### 2.1 Agentic RAG (`lib/rag/agentic-rag.ts`)

**Ukuran File:** 831 lines

**Komponen Utama:**

```typescript
// Agent Step Interface
interface AgentStep {
    stepIndex: number;
    stepType: "reasoning" | "tool_call" | "retrieval" | "synthesis" | "reranking";
    action: string;
    toolName?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
    reasoning?: string;
    durationMs: number;
    timestamp: number;
    tokenUsage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

// Result Interface
interface AgenticRagResult {
    answer: string;
    steps: AgentStep[];
    retrievedChunks: RetrievalResult[];
    guardrails: {
        input?: GuardrailResult;
        output?: GuardrailResult;
        negativeReaction?: NegativeReactionResult;
    };
    language: "id"; // Selalu Indonesian
    totalLatencyMs: number;
    reasoning?: string[];
}
```

**Agent Tools:**
| Tool | Deskripsi |
|------|-----------|
| `search_documents` | Hybrid retrieval (vector + BM25 + RRF) |
| `expand_query` | Ekspansi sinonim akademik |
| `decompose_query` | Dekomposisi query kompleks |
| `verify_claim` | Verifikasi klaim vs konteks |
| `synthesize_answer` | Sintesis dengan citation |

### 2.2 Hybrid Retrieval (`lib/rag/hybrid-retrieval.ts`)

**Ukuran File:** 764 lines

**Fungsi Utama:**

```typescript
// Main retrieval function
async function hybridRetrieve(
    query: string,
    options: HybridRetrievalOptions = {}
): Promise<RetrievalResult[]>

// Result interface
interface RetrievalResult {
    id: string;
    documentId: string;
    content: string;
    documentTitle: string;
    vectorScore: number;   // Cosine similarity (0-1)
    bm25Score: number;     // Okapi BM25 score
    fusedScore: number;    // RRF fused score
    retrievalMethod: "vector" | "keyword" | "hybrid";
    metadata?: {
        pageNumber?: number;
        section?: string;
        headings?: string[];
    };
}

// Configuration options
interface HybridRetrievalOptions {
    topK?: number;              // Default: 10
    minScore?: number;          // Default: 0.01
    vectorWeight?: number;      // Default: 0.6
    bm25Weight?: number;        // Default: 0.4
    strategy?: "vector" | "keyword" | "hybrid";
    rrfK?: number;              // Default: 60
    language?: "en" | "id" | "auto";
    useReranker?: boolean;
    rerankerStrategy?: RerankerStrategy;
    rerankerTopK?: number;
    rerankerMinScore?: number;
}
```

**BM25 Implementation:**

```typescript
// Okapi BM25 parameters
const BM25_K1 = 1.2;    // Term frequency saturation
const BM25_B = 0.75;    // Length normalization
const BM25_DELTA = 1;   // BM25+ modification

function calculateOkapiBM25(
    queryTerms: string[],
    docTerms: string[],
    avgDocLength: number,
    docFrequencies: Map<string, number>,
    totalDocs: number,
    queryTermFreqs?: Map<string, number>
): number {
    // Full BM25 calculation including IDF
}

// RRF Fusion
function reciprocalRankFusion(
    rankings: { id: string; rank: number }[][],
    k = 60
): Map<string, number> {
    // Combine multiple rankings
}
```

### 2.3 Evaluation Module (`lib/rag/evaluation.ts`)

**Ukuran File:** 1280 lines

**Metrics Interface:**

```typescript
interface EvaluationMetrics {
    // Core RAGAS
    faithfulness: number;        // Klaim didukung konteks
    answerRelevancy: number;     // Relevansi jawaban
    contextPrecision: number;    // Precision konteks
    contextRecall: number;       // Recall konteks

    // Retrieval quality
    precision: number;
    recall: number;
    f1Score: number;
    ndcg: number;                // Normalized DCG
    mrr: number;                 // Mean Reciprocal Rank

    // Domain-specific
    academicRigor: number;
    citationAccuracy: number;
    terminologyCorrectness: number;

    // Hallucination
    hallucinationRate: number;
    factualConsistency: number;
    sourceAttribution: number;
    contradictionScore: number;

    // Latency
    totalLatencyMs: number;
    retrievalLatencyMs: number;
    rerankingLatencyMs: number;
    generationLatencyMs: number;
    agentReasoningLatencyMs: number;
    toolCallLatencyMs: number;
    planningLatencyMs: number;
    synthesisLatencyMs: number;

    // Efficiency
    tokenEfficiency: number;
    tokensPerSecond: number;
    totalAgentSteps: number;
    avgStepLatencyMs: number;
}
```

**Ablation Configurations:**

```typescript
interface AblationConfig {
    name: string;
    description: string;
    useRag: boolean;
    useReranker: boolean;
    rerankerStrategy?: RerankerStrategy;
    retrievalStrategy: "vector" | "keyword" | "hybrid";
    chunkingStrategy: "recursive" | "semantic" | "sentence_window" | "hierarchical";
    useAgenticMode: boolean;
    useGuardrails: boolean;
    topK: number;
    language: "en" | "id" | "auto";
}

// 13 predefined configurations untuk ablation study
const ABLATION_CONFIGURATIONS: AblationConfig[] = [
    { name: "Baseline (No RAG)", useRag: false, ... },
    { name: "Vector Only", useRag: true, retrievalStrategy: "vector", ... },
    { name: "BM25 Only", useRag: true, retrievalStrategy: "keyword", ... },
    { name: "Hybrid (No Rerank)", useRag: true, retrievalStrategy: "hybrid", ... },
    { name: "Hybrid + Cross-Encoder", ... },
    { name: "Hybrid + LLM Rerank", ... },
    { name: "Hybrid + Ensemble", ... },
    { name: "Agentic Mode", useAgenticMode: true, ... },
    { name: "Full System", ... },
    // ...
];
```

---

## 3. Frontend Implementation

### 3.1 State Management (Zustand)

**Chat Store:**
```typescript
// lib/stores/chat-store.ts
interface ChatStore {
    sessions: ChatSession[];
    settings: ChatSettings;
    // Actions
    addMessage: (sessionId: string, message: Message) => void;
    updateSettings: (settings: Partial<ChatSettings>) => void;
    // ...
}

export const useChatStore = create<ChatStore>()(
    persist(
        immer((set, get) => ({
            sessions: [],
            settings: defaultSettings,
            // Actions...
        })),
        {
            name: "academic-rag-chat",
            storage: createJSONStorage(() => localStorage)
        }
    )
);
```

### 3.2 UI Components

**Komponen Utama:**
| Komponen | Lokasi | Fungsi |
|----------|--------|--------|
| `ChatInterface` | `components/chat/` | UI chat dengan streaming |
| `MessageBubble` | `components/chat/` | Render pesan dengan citation |
| `EvaluationDashboard` | `components/evaluation/` | Metrics visualization |
| `DocumentManager` | `components/manage/` | Upload dan manage dokumen |
| `Sidebar` | `components/sidebar.tsx` | Navigation |

---

## 4. Backend API Routes

### 4.1 Chat API (`/api/chat`)

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
    const { messages, sessionId, useRag, useAgenticMode, ... } = await request.json();

    if (useAgenticMode) {
        // Run agentic workflow
        const result = await runAgenticRag({
            query: lastMessage.content,
            sessionId,
            language: "id",
            enableGuardrails: true,
        });

        return toUIMessageStreamResponse(/* ... */);
    } else {
        // Standard RAG flow
        const context = await retrieveContext(query, options);
        const prompt = buildRagPrompt(query, context);

        return streamText({
            model: CHAT_MODEL,
            system: SYSTEM_PROMPTS.academic,
            prompt,
            // ...
        });
    }
}
```

### 4.2 Evaluation API (`/api/evaluation`)

```typescript
// app/api/evaluation/ablation/route.ts
export async function POST(request: Request) {
    const { configurations, testQuestions, runStatisticalAnalysis } = await request.json();

    // Run ablation study across all configurations
    const results: Record<string, AblationResult> = {};

    for (const config of configurations) {
        results[config.name] = await runAblationConfig(config, testQuestions);
    }

    // Statistical analysis
    if (runStatisticalAnalysis) {
        const analysis = analyzeResults(results);
        return Response.json({ results, statisticalAnalysis: analysis });
    }

    return Response.json({ results });
}
```

---

## 5. Database Layer

### 5.1 Schema (Drizzle ORM)

```typescript
// lib/db/schema.ts

// Documents table
export const documents = pgTable("documents", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content"),
    fileType: text("file_type"),
    fileSize: integer("file_size"),
    status: text("status").default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    metadata: jsonb("metadata"),
});

// Document chunks with pgvector
export const documentChunks = pgTable("document_chunks", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }), // OpenAI embedding
    chunkIndex: integer("chunk_index"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
});

// Evaluation sessions
export const evaluationSessions = pgTable("evaluation_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status").default("pending"),
    metrics: jsonb("metrics"),
    ablationResults: jsonb("ablation_results"),
    createdAt: timestamp("created_at").defaultNow(),
});

// Chat sessions
export const chatSessions = pgTable("chat_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title"),
    messages: jsonb("messages"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 5.2 Vector Search Query

```typescript
// Vector similarity search dengan pgvector
const vectorResults = await db
    .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        metadata: documentChunks.metadata,
        embedding: documentChunks.embedding,
        documentTitle: documents.title,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(and(
        isNotNull(documentChunks.embedding),
        sql`${documentChunks.embedding} IS NOT NULL`
    ))
    .orderBy(sql`${documentChunks.embedding} <=> ${queryEmbedding}`)
    .limit(topK * 3); // Oversample for BM25 reranking
```

---

## 6. Kode Kunci

### 6.1 AI SDK 5.x Integration

```typescript
// lib/ai/index.ts
import { createAzure } from "@ai-sdk/azure";
import { wrapLanguageModel, extractReasoningMiddleware } from "ai";

const azure = createAzure({
    apiKey: ENV.AZURE_OPENAI_API_KEY,
    resourceName: ENV.AZURE_OPENAI_RESOURCE_NAME,
});

export const CHAT_MODEL = wrapLanguageModel({
    model: azure(ENV.AZURE_OPENAI_CHAT_DEPLOYMENT),
    middleware: extractReasoningMiddleware({ tagName: "think" }),
});

export const telemetryConfig = {
    isRecording: true,
    functionId: "academic-rag",
    metadata: {
        projectName: "academic-rag-chatbot",
        environment: process.env.NODE_ENV,
    },
};
```

### 6.2 Embedding Generation

```typescript
// lib/ai/embeddings.ts
import { embed } from "ai";

export async function generateEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({
        model: azure.embedding(ENV.AZURE_OPENAI_EMBEDDING_DEPLOYMENT),
        value: text,
    });
    return embedding; // 1536-dimensional vector
}
```

### 6.3 Statistical Analysis

```typescript
// lib/statistics/statistical-analysis.ts

// Paired t-test
export function pairedTTest(
    group1: number[],
    group2: number[]
): StatisticalTestResult {
    const differences = group1.map((v, i) => v - group2[i]);
    const meanDiff = mean(differences);
    const stdDiff = std(differences);
    const n = differences.length;

    const tStatistic = meanDiff / (stdDiff / Math.sqrt(n));
    const df = n - 1;
    const pValue = tDistribution(tStatistic, df);

    return {
        testName: "Paired t-Test",
        statistic: tStatistic,
        pValue,
        degreesOfFreedom: df,
        significant: pValue < 0.05,
        effectSize: cohensD(group1, group2),
        // ...
    };
}

// One-way ANOVA
export function oneWayANOVA(groups: number[][]): ANOVAResult {
    // Between-group variance
    // Within-group variance
    // F-statistic calculation
    // Post-hoc Tukey HSD if significant
}

// Effect size calculations
export function cohensD(group1: number[], group2: number[]): number {
    const pooledStd = Math.sqrt(
        ((group1.length - 1) * variance(group1) +
         (group2.length - 1) * variance(group2)) /
        (group1.length + group2.length - 2)
    );
    return (mean(group1) - mean(group2)) / pooledStd;
}
```

---

*Dokumentasi implementasi ini berdasarkan analisis source code sistem Academic RAG Chatbot.*
