# 📐 Metodologi Penelitian - Academic RAG Chatbot

> Metodologi pengembangan sistem menggunakan pendekatan R&D dan RAD.

---

## 1. Pendekatan Metodologi

### Research and Development (R&D)
Penelitian ini menggunakan pendekatan **Research and Development (R&D)** yang berfokus pada:
- Pengembangan produk/sistem baru
- Validasi melalui pengujian sistematis
- Iterasi berdasarkan hasil evaluasi

### Rapid Application Development (RAD)
Dikombinasikan dengan **Rapid Application Development (RAD)**:
- Iterasi cepat dalam pengembangan
- Prototipe fungsional di setiap fase
- Feedback cycle pendek

---

## 2. Timeline Pengembangan (4 Minggu)

### Minggu 1: Foundation & Core RAG Pipeline
| Hari | Aktivitas |
|------|-----------|
| 1-2 | Database schema design (Drizzle + pgvector) |
| 3-4 | Basic document ingestion (PDF/TXT/MD parsing) |
| 5-7 | Simple RAG implementation, vector search, chat UI |

### Minggu 2: Advanced Retrieval & Agentic
| Hari | Aktivitas |
|------|-----------|
| 8-9 | Hybrid retrieval (BM25 + RRF) |
| 10-11 | Re-ranking module (cross-encoder, ensemble) |
| 12-14 | Agentic RAG dengan tools dan AI SDK 5.x |

### Minggu 3: Chunking & Guardrails
| Hari | Aktivitas |
|------|-----------|
| 15-16 | Semantic dan recursive chunking |
| 17-18 | Guardrails (PII, prompt injection, hallucination) |
| 19-21 | University domain tuning |

### Minggu 4: Evaluation & Analysis
| Hari | Aktivitas |
|------|-----------|
| 22-23 | RAGAS-based evaluation framework |
| 24-25 | Ablation study framework |
| 26-27 | Statistical analysis module |
| 28 | Polish, documentation, testing |

---

## 3. Desain Eksperimen

### 3.1 Variabel Independen
| Variabel | Level |
|----------|-------|
| Retrieval Strategy | Non-RAG, Vector, BM25, Hybrid |
| Re-ranking Method | None, Cross-encoder, LLM, Ensemble |
| Chunking Strategy | Fixed, Recursive, Semantic, Sentence-window |
| Agent Configuration | Single-step, Multi-step |

### 3.2 Variabel Dependen (Metrics)
| Kategori | Metrik |
|----------|--------|
| Retrieval | Precision@K, Recall@K, NDCG, MRR |
| Generation | Faithfulness, Answer Relevancy |
| Hallucination | Rate, Factual Consistency |
| Latency | Total, per-phase breakdown |

---

## 4. Evaluasi dengan RAGAS

### Framework LLM-as-a-Judge
Menggunakan model yang sama (GPT-4.1-mini) untuk:
- **Generasi** jawaban (chatbot)
- **Evaluasi** kualitas (judge)

### Justifikasi
1. **Konsistensi Eksperimen**: Minimalisir variabilitas arsitektur
2. **Mitigasi Self-Preference Bias**: Fokus pada peningkatan relatif (relative gain)
3. **Efisiensi Komputasi**: Tidak perlu model evaluator terpisah

---

## 5. Ablation Study

### Tujuan
Memahami kontribusi setiap komponen terhadap performa keseluruhan sistem.

### Konfigurasi (13 Configurations)
| Config | RAG | Retrieval | Rerank | Agent |
|--------|-----|-----------|--------|-------|
| Baseline | ❌ | - | - | ❌ |
| Vector Only | ✅ | vector | ❌ | ❌ |
| BM25 Only | ✅ | keyword | ❌ | ❌ |
| Hybrid (No Rerank) | ✅ | hybrid | ❌ | ❌ |
| Hybrid + Cross-Encoder | ✅ | hybrid | cross | ❌ |
| Hybrid + LLM Rerank | ✅ | hybrid | llm | ❌ |
| Hybrid + Ensemble | ✅ | hybrid | ensemble | ❌ |
| Agentic Mode | ✅ | hybrid | ensemble | ✅ |
| Full System | ✅ | hybrid | ensemble | ✅ |

---

## 6. Analisis Statistik

### 6.1 Uji Statistik
| Pengujian | Tujuan | Kapan Digunakan |
|-----------|--------|-----------------|
| Paired t-test | RAG vs Non-RAG | 2 kondisi berpasangan |
| Independent t-test | Antar konfigurasi | 2 grup independen |
| One-way ANOVA | Multiple configs | > 2 grup |
| Tukey HSD | Post-hoc | Setelah ANOVA signifikan |

### 6.2 Effect Size
| Metric | Formula | Interpretasi |
|--------|---------|--------------|
| Cohen's d | (M₁-M₂)/SDpooled | 0.2 kecil, 0.5 sedang, 0.8 besar |
| η² (eta squared) | SSbetween/SStotal | 0.01 kecil, 0.06 sedang, 0.14 besar |

---

## 7. Validitas dan Reliabilitas

### Validitas
- **Konstruk**: Metrik RAGAS tervalidasi oleh literatur
- **Internal**: Ablation study mengontrol variabel pengganggu
- **Eksternal**: Domain akademik Indonesia

### Reliabilitas
- **Konsistensi**: Model dan parameter tetap
- **Replikabilitas**: Kode dan dokumentasi tersedia
- **Azure Cloud**: Lingkungan eksekusi stabil

---

*Metodologi penelitian sistem Academic RAG Chatbot.*
