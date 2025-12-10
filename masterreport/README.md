# 📚 Master Report - Academic RAG Chatbot System

> Dokumentasi komprehensif untuk sistem Chatbot RAG Akademik dengan kemampuan Agentic, Hybrid Retrieval, dan Metrik Evaluasi RAGAS.

---

## 📋 Daftar Isi

| No | Dokumen | Deskripsi |
|----|---------|-----------|
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Arsitektur sistem dan desain teknis 4-layer |
| 2 | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Detail implementasi dan struktur kode |
| 3 | [TECHNICAL.md](./TECHNICAL.md) | Spesifikasi teknis dan konfigurasi |
| 4 | [ACADEMIC.md](./ACADEMIC.md) | Konteks akademik dan domain universitas |
| 5 | [RESEARCH_CONTEXT.md](./RESEARCH_CONTEXT.md) | Konteks penelitian dan latar belakang |
| 6 | [METHODOLOGY.md](./METHODOLOGY.md) | Metodologi penelitian (RAD + R&D) |
| 7 | [METHODS.md](./METHODS.md) | Metode teknis (RAG, BM25, RRF, dll) |
| 8 | [EVALUATION.md](./EVALUATION.md) | Kerangka kerja evaluasi dan metrik RAGAS |
| 9 | [STATISTICAL_ANALYSIS.md](./STATISTICAL_ANALYSIS.md) | Analisis statistik (t-test, ANOVA, Cohen's d) |
| 10 | [EMPIRICAL_EVIDENCE_VALIDATION.md](./EMPIRICAL_EVIDENCE_VALIDATION.md) | Validasi bukti empiris |
| 11 | [IMRAD_PAPER_CONTENT_HELPER.md](./IMRAD_PAPER_CONTENT_HELPER.md) | Panduan penulisan paper format IMRAD |
| 12 | [SUGGESTED_EVALUATION_QUESTIONS.md](./SUGGESTED_EVALUATION_QUESTIONS.md) | Pertanyaan evaluasi yang disarankan |

---

## 🎯 Ringkasan Proyek

**Judul Publikasi:**
> "Implementasi Agentic Retrieval-Augmented Generation (RAG) untuk Otomatisasi Layanan Mahasiswa di Universitas Mulia"

**Jenis Penelitian:** Penelitian Eksperimental Terapan (Research and Development)

### Permasalahan Utama

1. **Lexical Gap:** RAG berbasis vektor sering gagal menangkap kata kunci spesifik seperti "KRS" atau "Cuti"
2. **Halusinasi LLM:** LLM standar rentan menghasilkan informasi tidak akurat tanpa grounding
3. **Kompleksitas Query:** Pertanyaan akademik sering bersifat multi-langkah dan memerlukan penalaran

### Solusi yang Dikembangkan

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARSITEKTUR 4-LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Domain-Aware Ingestion (Semantic Chunking)             │
│ Layer 2: Hybrid Retrieval (Vector-First + Local BM25 + RRF)     │
│ Layer 3: Neural Reranking (Cross-Encoder + LLM Listwise)        │
│ Layer 4: Agentic Orchestration & Guardrails                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Teknologi

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| Frontend | Next.js + React | 15.x / 19.x |
| Styling | Tailwind CSS | 4.x |
| Backend | Vercel AI SDK | 5.x |
| Database | PostgreSQL + pgvector | 15+ / 0.5+ |
| ORM | Drizzle ORM | Latest |
| LLM Provider | Azure OpenAI | - |
| Model Chat | GPT-4.1-mini | - |
| Model Embedding | text-embedding-3-small | 1536-dim |
| State Management | Zustand | 5.x |

---

## 📊 Fitur Utama

### Retrieval & Generation
- ✅ **Agentic RAG** dengan multi-step reasoning dan tools
- ✅ **Hybrid Retrieval** (Vector + Okapi BM25 + RRF)
- ✅ **Re-ranking** (Cross-Encoder, LLM-based, Ensemble)
- ✅ **Semantic Chunking** dengan threshold similarity

### Evaluation & Analysis
- ✅ **RAGAS Metrics** (Faithfulness, Answer Relevancy, Context Precision/Recall)
- ✅ **Ablation Study** dengan 13 konfigurasi
- ✅ **Statistical Analysis** (t-test, ANOVA, Cohen's d, Confidence Intervals)
- ✅ **Hallucination Detection** dan mitigasi

### Safety & Quality
- ✅ **Input/Output Guardrails** (PII, Prompt Injection, Toxicity)
- ✅ **Negative Reaction Handling** (Bahasa Indonesia/Inggris)
- ✅ **Citation Management** dengan verifikasi sumber

---

## 🔬 Metodologi Penelitian

| Aspek | Detail |
|-------|--------|
| **Pendekatan** | Research and Development (R&D) + Rapid Application Development (RAD) |
| **Durasi** | 4 minggu sprint cycle |
| **Evaluasi** | LLM-as-a-Judge (RAGAS) dengan Ablation Study |
| **Analisis Statistik** | Paired t-test, One-way ANOVA, Effect Size (Cohen's d, η²) |

---

## 📁 Struktur Proyek

```
academic-research-rag-chatbot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes (chat, evaluation, documents)
│   │   ├── evaluation/         # UI Evaluasi
│   │   └── manage/             # UI Manajemen Knowledge Base
│   ├── components/             # React Components
│   │   ├── chat/               # Komponen Chat
│   │   ├── evaluation/         # Komponen Evaluasi
│   │   └── ui/                 # shadcn/ui Components
│   └── lib/
│       ├── ai/                 # AI Model Configuration
│       ├── db/                 # Database Schema (Drizzle)
│       ├── rag/                # Core RAG Pipeline
│       │   ├── agentic-rag.ts        # Multi-step Agent
│       │   ├── hybrid-retrieval.ts    # Vector + BM25 + RRF
│       │   ├── evaluation.ts          # RAGAS Metrics
│       │   ├── guardrails.ts          # Safety Guardrails
│       │   ├── reranker.ts            # Neural Reranking
│       │   └── chunking.ts            # Semantic Chunking
│       └── statistics/         # Statistical Analysis
├── .academic/                  # Dokumentasi Akademik
├── scripts/                    # Utility Scripts
└── masterreport/               # 📌 Anda di sini
```

---

## 📖 Cara Menggunakan Dokumentasi

1. **Untuk Pengembang:** Mulai dari [ARCHITECTURE.md](./ARCHITECTURE.md) dan [IMPLEMENTATION.md](./IMPLEMENTATION.md)
2. **Untuk Peneliti:** Fokus pada [METHODOLOGY.md](./METHODOLOGY.md), [METHODS.md](./METHODS.md), dan [STATISTICAL_ANALYSIS.md](./STATISTICAL_ANALYSIS.md)
3. **Untuk Penulisan Paper:** Gunakan [IMRAD_PAPER_CONTENT_HELPER.md](./IMRAD_PAPER_CONTENT_HELPER.md)
4. **Untuk Evaluasi:** Lihat [EVALUATION.md](./EVALUATION.md) dan [SUGGESTED_EVALUATION_QUESTIONS.md](./SUGGESTED_EVALUATION_QUESTIONS.md)

---

## 📚 Referensi Utama

1. Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." NeurIPS.
2. Es, S., et al. (2023). "RAGAS: Automated Evaluation of Retrieval Augmented Generation."
3. Robertson, S., & Zaragoza, H. (2009). "The Probabilistic Relevance Framework: BM25 and Beyond."
4. Singh, A., et al. (2025). "Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG."

---

*Dokumentasi ini dihasilkan dari analisis mendalam terhadap codebase Academic RAG Chatbot System.*
