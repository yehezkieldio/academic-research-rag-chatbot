# 🏗️ Arsitektur Sistem - Academic RAG Chatbot

> Dokumentasi arsitektur sistem Agentic RAG 4-layer untuk layanan akademik bilingual (Indonesia/Inggris).

---

## 📋 Daftar Isi

1. [Gambaran Umum Arsitektur](#1-gambaran-umum-arsitektur)
2. [Arsitektur High-Level](#2-arsitektur-high-level)
3. [Layer 1: Domain-Aware Ingestion](#3-layer-1-domain-aware-ingestion)
4. [Layer 2: Hybrid Retrieval](#4-layer-2-hybrid-retrieval)
5. [Layer 3: Neural Reranking](#5-layer-3-neural-reranking)
6. [Layer 4: Agentic Orchestration](#6-layer-4-agentic-orchestration)
7. [Diagram Alur Data](#7-diagram-alur-data)
8. [Justifikasi Arsitektur](#8-justifikasi-arsitektur)

---

## 1. Gambaran Umum Arsitektur

Sistem mengimplementasikan pipeline **multi-stage Agentic Retrieval-Augmented Generation (RAG)** yang dirancang untuk domain akademik bilingual (Indonesia/Inggris). Berbeda dengan arsitektur tradisional yang mengandalkan full-text search engine database-native, sistem ini memisahkan logika keyword scoring dari storage layer.

### Strategi Utama: "Vector-First Candidate Generation"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VECTOR-FIRST STRATEGY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. High-Recall Semantic Search (pgvector) → Candidate Pool (3×K)            │
│ 2. In-Memory Okapi BM25 → High-Precision Keyphrase Scoring                  │
│ 3. Reciprocal Rank Fusion (RRF) → Unified Ranking                           │
│ 4. Neural Reranking → Final Top-K Selection                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arsitektur High-Level

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
├─────────────────────┬─────────────────────────┬─────────────────────────────┤
│   Chat Interface    │  Knowledge Base UI      │     Evaluation Dashboard    │
│        (/)          │      (/manage)          │        (/evaluation)        │
│                     │                         │                             │
│   ┌──────────────┐  │                         │    ┌────────────────────┐   │
│   │   Zustand    │  │                         │    │  Evaluation Store  │   │
│   │    Store     │  │                         │    │  (Zustand + Immer) │   │
│   └──────────────┘  │                         │    └────────────────────┘   │
└──────────┬──────────┴───────────┬─────────────┴─────────────┬───────────────┘
           │                      │                           │
           ▼                      ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API LAYER (AI SDK 5.x)                                 │
├─────────────────────┬─────────────────────────┬─────────────────────────────┤
│    /api/chat        │    /api/documents/*     │      /api/evaluation/*      │
│    (streamText)     │    (Upload/Process)     │      (Metrics/Ablation)     │
│  toUIMessage        │                         │      (Statistical Analysis) │
│  StreamResponse     │                         │                             │
└──────────┬──────────┴───────────┬─────────────┴─────────────┬───────────────┘
           │                      │                           │
           ▼                      ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG PIPELINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────────────┐  │
│  │ Guardrails  │→ │ Agentic RAG  │→ │ Retrieval │→ │     Re-ranker       │  │
│  │   (Input)   │  │   (Tools +   │  │  (Hybrid) │  │     (Ensemble)      │  │
│  │ + Negative  │  │   stopWhen)  │  │ Okapi BM25│  │                     │  │
│  │  Reaction   │  │              │  │ + Vector  │  │                     │  │
│  └─────────────┘  └──────────────┘  └───────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer 1: Domain-Aware Ingestion

### Tujuan
Menangani kompleksitas struktural teks akademik (tesis, jurnal) melalui **Hierarchical & Semantic Chunking Strategy**.

### Komponen

#### 3.1 Structure Detection
```typescript
// Pattern matching untuk bagian akademik
const ACADEMIC_SECTION_PATTERNS = [
    "Abstract", "Abstrak",
    "Pendahuluan", "Introduction",
    "Metodologi", "Methods",
    "Hasil", "Results",
    "Pembahasan", "Discussion",
    "Daftar Pustaka", "References"
];
```

#### 3.2 Semantic Segmentation
```typescript
// Bukan fixed-window splitting, melainkan similarity-based
const SEMANTIC_THRESHOLD = 0.5; // Break jika similarity < threshold

// Menghitung cosine similarity antara kalimat berurutan
const similarity = cosineSimilarity(sentenceEmbedding[i], sentenceEmbedding[i+1]);
if (similarity < SEMANTIC_THRESHOLD) {
    // Buat chunk baru
}
```

#### 3.3 Language Detection
```typescript
// Deteksi bahasa di level chunk
function detectDocumentLanguage(text: string): "en" | "id" {
    // Indonesian markers: ber-, meng-, di-, ter-
    const indonesianPatterns = /(ber|meng|di|ter|ke|se)[a-z]/gi;
    // ...
}
```

### Implementasi File
| File | Fungsi |
|------|--------|
| `lib/rag/chunking.ts` | Semantic, recursive, sentence-window chunking |
| `lib/rag/document-processor.ts` | PDF/TXT/MD parsing, OCR |
| `lib/utils/language.ts` | Stemming Indonesia, stopwords |

---

## 4. Layer 2: Hybrid Retrieval

### Tujuan
Mengatasi keterbatasan vendor lock-in dengan memindahkan logika ranking ke application layer.

### Strategi: Vector-First + Local BM25

```
┌───────────────────────────────────────────────────────────────────┐
│                    HYBRID RETRIEVAL FLOW                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Query ──► [1. pgvector Cosine Distance] ──► Candidate Pool (3×K) │
│                         │                                          │
│                         ▼                                          │
│            [2. In-Memory Okapi BM25] ──► BM25 Scores              │
│                         │                                          │
│                         ▼                                          │
│        [3. Reciprocal Rank Fusion (k=60)] ──► Fused Ranking       │
│                         │                                          │
│                         ▼                                          │
│                   Top-K Results                                    │
└───────────────────────────────────────────────────────────────────┘
```

### 4.1 Vector Candidate Generation (Recall Optimization)
```sql
-- pgvector query dengan cosine distance
SELECT chunk_id, content, 1 - (embedding <=> query_embedding) as score
FROM document_chunks
WHERE embedding IS NOT NULL
ORDER BY embedding <=> query_embedding
LIMIT 30; -- Oversample 3×K
```

### 4.2 Okapi BM25 Scoring (Precision Optimization)

**Formula BM25:**
$$\text{BM25}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{\text{avgdl}})}$$

**Parameter:**
| Parameter | Nilai | Alasan |
|-----------|-------|--------|
| k1 | 1.2 | Term frequency saturation untuk dokumen panjang |
| b | 0.75 | Length normalization standard |
| delta | 1 | BM25+ modification |

**Local IDF:**
Berbeda dengan BM25 standar, sistem menghitung **Local IDF** dari candidate pool (bukan seluruh korpus), berfungsi sebagai "contextual differentiator".

### 4.3 Reciprocal Rank Fusion (RRF)

**Formula:**
$$\text{RRF}(d) = \sum_{r \in R} \frac{1}{k + r(d)}$$

**Dengan Weighted Version:**
$$\text{RRF}_{weighted}(d) = \alpha \cdot \frac{1}{k + r_{vector}(d)} + \beta \cdot \frac{1}{k + r_{bm25}(d)}$$

| Parameter | Nilai Default |
|-----------|---------------|
| k | 60 |
| α (vectorWeight) | 0.6 |
| β (bm25Weight) | 0.4 |

### Implementasi File
| File | Fungsi |
|------|--------|
| `lib/rag/hybrid-retrieval.ts` | Vector search, BM25, RRF fusion |

---

## 5. Layer 3: Neural Reranking

### Tujuan
Memfilter semantic "drift" (dokumen yang berbagi keyword tetapi makna berbeda).

### Strategi Reranking

| Strategi | Penggunaan | Latency |
|----------|------------|---------|
| **Cross-Encoder** | Query latency-sensitive | Rendah |
| **LLM Listwise** | Query kompleks agentic | Tinggi |
| **Ensemble** | Kombinasi keduanya | Sedang |

### 5.1 Cross-Encoder Strategy
```typescript
// Menggunakan distilled BERT model untuk scoring query-passage pairs
const CROSS_ENCODER_MODEL = "ms-marco-TinyBERT-L-2-v2";

async function crossEncoderRerank(query: string, passages: string[]): Promise<Score[]> {
    // Score setiap pasangan query-passage
}
```

### 5.2 LLM Listwise Reranking
```typescript
// LLM menerima top-10 dokumen dan menghasilkan JSON ranking dengan reasoning
const LISTWISE_PROMPT = `
Berikan ranking dokumen berikut berdasarkan relevansi dengan query:
Query: {query}
Documents: {documents}

Output format: { "ranking": [...], "reasoning": "..." }
`;
```

### Implementasi File
| File | Fungsi |
|------|--------|
| `lib/rag/reranker.ts` | Cross-encoder, LLM, ensemble reranking |

---

## 6. Layer 4: Agentic Orchestration

### Tujuan
Menangani query akademik yang kompleks dan multi-langkah melalui workflow agentic.

### Komponen Agentic

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AGENTIC WORKFLOW                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User Query ──► [Query Decomposition] ──► Sub-Queries                │
│                         │                                             │
│                         ▼                                             │
│              [Parallel Tool Execution]                                │
│              ┌─────────────────────────┐                             │
│              │ • search_documents      │                             │
│              │ • expand_query          │                             │
│              │ • decompose_query       │                             │
│              │ • verify_claim          │                             │
│              │ • synthesize_answer     │                             │
│              └─────────────────────────┘                             │
│                         │                                             │
│                         ▼                                             │
│                  [Answer Synthesis]                                   │
│                         │                                             │
│                         ▼                                             │
│                [Output Guardrails]                                    │
│                         │                                             │
│                         ▼                                             │
│                  Final Response                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.1 Agent Tools

| Tool | Fungsi | Schema |
|------|--------|--------|
| `search_documents` | Hybrid retrieval dengan RRF | `{ query, strategy, topK }` |
| `expand_query` | Ekspansi sinonim akademik (EN/ID) | `{ query }` |
| `decompose_query` | Dekomposisi pertanyaan kompleks | `{ query, maxSubQuestions }` |
| `verify_claim` | Verifikasi klaim terhadap konteks | `{ claim, context }` |
| `synthesize_answer` | Sintesis multi-source dengan citation | `{ question, sources }` |

### 6.2 AI SDK 5.x Best Practices

```typescript
// Menggunakan stopWhen (bukan maxSteps yang deprecated)
const { text, steps, reasoning, usage } = await generateText({
    model: getModelForTask("chat"),
    system: AGENTIC_SYSTEM_PROMPT,
    prompt: query,
    tools: agentTools,
    stopWhen: stepCountIs(maxSteps), // AI SDK 5.x best practice
    experimental_telemetry: telemetryConfig,
    onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        // Capture setiap reasoning step dengan timing dan token usage
    },
});
```

### 6.3 Safety Guardrails

| Jenis | Deteksi |
|-------|---------|
| **Input Validation** | PII (NIK, SSN), Prompt Injection |
| **Hallucination Check** | Self-Correction loop untuk verifikasi klaim |
| **Negative Reaction** | Sentiment analysis untuk escalation |
| **Output Validation** | Citation verification |

### Implementasi File
| File | Fungsi |
|------|--------|
| `lib/rag/agentic-rag.ts` | Agent tools, workflow, streaming |
| `lib/rag/guardrails.ts` | Input/output validation, PII, toxicity |

---

## 7. Diagram Alur Data

```
1. User Input → Guardrails (PII/Toxicity Check)
           │
           ▼
2. Query Processor → Decompose Query (jika Agentic) ATAU Expand Synonyms (En/Id)
           │
           ▼
3. Retrieval Engine:
   • Path A: Postgres (pgvector) → Top-30 Chunks via Cosine Similarity
   • Path B: In-Memory Engine → Tokenize Candidates → Calculate Local BM25
           │
           ▼
4. Fusion Layer: RRF Algorithm menggabungkan Vector Rank + BM25 Rank
           │
           ▼
5. Reranker: Cross-Encoder filter Top-30 ke Top-5
           │
           ▼
6. Synthesis: LLM menghasilkan jawaban dengan [Citation] tags
           │
           ▼
7. Output Guardrail: Verifikasi Citations & Hallucinations → Final Response
```

---

## 8. Justifikasi Arsitektur

### Mengapa bukan Postgres FTS (tsvector)?
> "Dengan mengimplementasikan BM25 di application layer, sistem mencapai **database agility**. Vector store dapat di-swap (misalnya dari Postgres ke Qdrant atau Milvus) tanpa kehilangan kapabilitas keyword-search, karena logika keyword merupakan bagian dari kode aplikasi, bukan database engine."

### Mengapa Local IDF (BM25 pada Candidates)?
> "Global IDF memerlukan pemeliharaan inverted index dari seluruh korpus, yang mahal secara komputasi untuk di-update. Pendekatan **Local IDF** kami memanfaatkan vector engine untuk mendefinisikan 'semantic neighborhood', kemudian menggunakan BM25 untuk discriminate specificity di dalam neighborhood tersebut. Ini mendekati perilaku global search dengan overhead yang jauh lebih rendah."

### Mengapa Agentic RAG?
> "Query akademik sering bersifat multi-faceted. RAG standar gagal pada query 'Bandingkan dan Kontras'. Dekomposisi agentic kami memungkinkan sistem mengambil informasi yang berbeda (misalnya 'Metodologi X' dan 'Metodologi Y') secara paralel, menyintesis jawaban koheren yang tidak dapat dicapai oleh single-step retrieval."

---

*Dokumentasi arsitektur ini berdasarkan analisis mendalam terhadap source code sistem dan dokumentasi akademik terkait.*
