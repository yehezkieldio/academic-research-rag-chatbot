# ⚙️ Spesifikasi Teknis - Academic RAG Chatbot

> Dokumentasi spesifikasi teknis, konfigurasi, dan parameter sistem.

---

## 1. Stack Teknologi

### Frontend
| Teknologi | Versi | Tujuan |
|-----------|-------|--------|
| Next.js | 15.x | React framework dengan App Router |
| React | 19.x | UI component library |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | Latest | Component library |
| Zustand | 5.x | State management |

### Backend
| Teknologi | Versi | Tujuan |
|-----------|-------|--------|
| Vercel AI SDK | 5.x | LLM integration, tools, streaming |
| Azure OpenAI | - | Primary LLM provider |
| Drizzle ORM | Latest | Type-safe database access |
| PostgreSQL | 15+ | Primary database |
| pgvector | 0.5+ | Vector similarity search |

### AI/ML Components
| Komponen | Implementasi | Spesifikasi |
|----------|--------------|-------------|
| Embeddings | text-embedding-3-small | 1536 dimensi |
| Chat Model | GPT-4.1-mini | Inferensi dan evaluasi |
| Re-ranking | Cross-encoder + LLM + Ensemble | Result refinement |

---

## 2. Konfigurasi Environment

```env
# DATABASE
DATABASE_URL=postgresql://user:password@host:5432/academic_rag

# AZURE OPENAI
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_RESOURCE_NAME=your-resource-name
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4-1-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# APPLICATION
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 3. Parameter RAG

### Hybrid Retrieval
| Parameter | Nilai Default | Deskripsi |
|-----------|---------------|-----------|
| `topK` | 10 | Jumlah dokumen final |
| `vectorWeight` | 0.6 | Bobot vector similarity |
| `bm25Weight` | 0.4 | Bobot BM25 score |
| `rrfK` | 60 | RRF smoothing constant |
| `strategy` | "hybrid" | vector/keyword/hybrid |

### BM25 Hyperparameters
| Parameter | Nilai | Justifikasi |
|-----------|-------|-------------|
| `k1` | 1.2 | Term frequency saturation |
| `b` | 0.75 | Length normalization |

### Reranker
| Parameter | Nilai Default |
|-----------|---------------|
| `rerankerStrategy` | "cross_encoder" |
| `rerankerTopK` | 5 |
| `rerankerMinScore` | 0.3 |

### Agentic
| Parameter | Nilai Default |
|-----------|---------------|
| `maxSteps` | 5 |
| `enableGuardrails` | true |
| `language` | "id" |

---

## 4. Database Schema

| Tabel | Kolom Utama | Tujuan |
|-------|-------------|--------|
| `documents` | id, title, content, metadata | Master dokumen |
| `document_chunks` | id, document_id, content, embedding | Chunks + vectors |
| `chat_sessions` | id, title, messages | Riwayat chat |
| `evaluation_sessions` | id, name, metrics | Hasil evaluasi |

---

## 5. Performance Specifications

### Latency Targets
| Fase | Target | P50 |
|------|--------|-----|
| Vector Search | < 100ms | ~50ms |
| BM25 Scoring | < 50ms | ~30ms |
| Reranking | < 500ms | ~300ms |
| LLM Generation | < 2000ms | ~1500ms |
| Total (RAG) | < 3000ms | ~2000ms |
| Total (Agentic) | < 5000ms | ~4000ms |

### Resource Requirements
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| PostgreSQL | v15+ | v16+ |
| Node.js | v20+ | v22+ |

---

## 6. AI SDK 5.x Best Practices

| Practice | Status | Implementasi |
|----------|--------|--------------|
| `stopWhen` | ✅ | `stepCountIs(5)` |
| `onStepFinish` | ✅ | Step tracking |
| `toUIMessageStreamResponse()` | ✅ | Streaming |
| `experimental_telemetry` | ✅ | OpenTelemetry |
| Typed errors | ✅ | `NoSuchToolError` |

---

*Spesifikasi teknis sistem Academic RAG Chatbot.*
