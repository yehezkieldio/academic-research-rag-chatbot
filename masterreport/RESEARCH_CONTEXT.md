# 🔬 Konteks Penelitian - Academic RAG Chatbot

> Latar belakang penelitian, masalah yang ditangani, dan kontribusi ilmiah.

---

## 1. Informasi Publikasi

**Judul:**
> "Implementasi Agentic Retrieval-Augmented Generation (RAG) untuk Otomatisasi Layanan Mahasiswa di Universitas Mulia"

**Jenis Penelitian:** Penelitian Eksperimental Terapan
**Metodologi:** Research and Development (R&D) + Rapid Application Development (RAD)

---

## 2. Latar Belakang Masalah

### 2.1 Tantangan Layanan Akademik
Layanan informasi akademik di perguruan tinggi menghadapi tantangan skalabilitas:
- Ketergantungan pada metode tradisional dan staf administrasi
- Inefisiensi komunikasi dan keterlambatan respons
- Pertumbuhan populasi mahasiswa yang pesat

### 2.2 Keterbatasan LLM Standalone
Large Language Models (LLM) tanpa augmentasi pengetahuan:
- Rentan menghasilkan **halusinasi** (informasi tidak faktual)
- Gagal menjawab pertanyaan dengan **konteks lokal spesifik**
- Pengetahuan terbatas pada data pelatihan (outdated)

### 2.3 Keterbatasan RAG Konvensional
| Metode | Kelebihan | Kelemahan |
|--------|-----------|-----------|
| Dense Retrieval (Vector) | Semantik kuat | Lexical gap pada kata kunci spesifik |
| Keyword Search (BM25) | Kata kunci tepat | Gagal menangkap nuansa semantik |
| Single-step RAG | Cepat | Gagal pada query multi-langkah |

---

## 3. Rumusan Masalah

1. Bagaimana meningkatkan akurasi sistem QA akademis?
2. Apakah pendekatan **Agentic RAG** lebih efektif dari RAG tradisional?
3. Bagaimana performa sistem pada **Bahasa Indonesia**?
4. Apa **trade-off** antara akurasi dan latensi pada sistem agentic?

---

## 4. Research Questions (RQ)

| RQ | Pertanyaan | Variabel |
|----|------------|----------|
| RQ1 | Seberapa signifikan peningkatan akurasi RAG vs Non-RAG? | Faithfulness, Relevancy |
| RQ2 | Apakah hybrid retrieval lebih efektif dari single-method? | Precision, Recall |
| RQ3 | Bagaimana trade-off akurasi vs latency pada sistem agentik? | Metrics vs Latency |
| RQ4 | Bagaimana kontribusi setiap komponen terhadap performa? | Ablation Study |

---

## 5. Tujuan Penelitian

### Tujuan Umum
Mengembangkan sistem Agentic RAG untuk otomatisasi layanan akademik yang akurat dan andal.

### Tujuan Khusus
1. Mengembangkan arsitektur **Hybrid Retrieval** (Vector + BM25 + RRF)
2. Mengimplementasikan **Agentic Workflow** dengan multi-step reasoning
3. Mengevaluasi sistem menggunakan **RAGAS metrics** dan ablation study
4. Menganalisis performa secara statistik (t-test, ANOVA)

---

## 6. Hipotesis Penelitian

| Hipotesis | H₀ (Null) | H₁ (Alternatif) |
|-----------|-----------|-----------------|
| H1 | Tidak ada perbedaan signifikan RAG vs Non-RAG | RAG menghasilkan akurasi lebih tinggi |
| H2 | Hybrid tidak lebih baik dari single-method | Hybrid lebih akurat |
| H3 | Agentic sama dengan traditional RAG | Agentic lebih akurat untuk query kompleks |

---

## 7. Kontribusi Penelitian

### 7.1 Kontribusi Teoritis
- Framework **Agentic RAG** untuk domain akademik bilingual
- Pendekatan **Vector-First + Local BM25** untuk hybrid retrieval
- Metodologi evaluasi komprehensif dengan ablation study

### 7.2 Kontribusi Praktis
- Sistem chatbot siap produksi untuk layanan akademik
- Arsitektur **database-agnostic** (tidak terikat vendor)
- Dokumentasi lengkap untuk replikasi

---

## 8. Referensi Utama

1. Lewis et al. (2020) - "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
2. Es et al. (2023) - "RAGAS: Automated Evaluation of RAG"
3. Singh et al. (2025) - "Agentic RAG: A Survey"
4. Robertson & Zaragoza (2009) - "BM25 and Beyond"
5. Sawarkar et al. (2024) - "Blended RAG"

---

*Konteks penelitian sistem Academic RAG Chatbot.*
