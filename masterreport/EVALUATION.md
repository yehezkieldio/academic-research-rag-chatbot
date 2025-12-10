# 📊 Kerangka Evaluasi - Academic RAG Chatbot

> Dokumentasi kerangka evaluasi RAGAS dan metrik yang digunakan.

---

## 1. RAGAS Framework

### Definisi
**RAGAS** (Retrieval-Augmented Generation Assessment) adalah kerangka evaluasi otomatis untuk sistem RAG tanpa memerlukan ground truth manusia untuk setiap iterasi.

### Referensi
> Es, S., et al. (2023). "RAGAS: Automated Evaluation of Retrieval Augmented Generation"

---

## 2. Metrik Evaluasi

### 2.1 Core RAGAS Metrics

| Metrik | Formula | Deskripsi |
|--------|---------|-----------|
| **Faithfulness** | $\frac{|\text{Claims}_{supported}|}{|\text{Claims}_{total}|}$ | Proporsi klaim yang didukung konteks |
| **Answer Relevancy** | $\frac{1}{n} \sum_{i=1}^{n} \text{cosine}(E_q, E_{q_i'})$ | Relevansi jawaban terhadap pertanyaan |
| **Context Precision** | $\frac{|\text{Relevant}_{retrieved@K}|}{K}$ | Presisi konteks yang diambil |
| **Context Recall** | $\frac{|\text{Relevant}_{retrieved}|}{|\text{Relevant}_{total}|}$ | Recall konteks yang diambil |

### 2.2 Retrieval Metrics

| Metrik | Deskripsi |
|--------|-----------|
| **Precision@K** | Proporsi dokumen relevan dalam top-K |
| **Recall@K** | Proporsi dokumen relevan yang terambil |
| **NDCG** | Normalized Discounted Cumulative Gain |
| **MRR** | Mean Reciprocal Rank |

### 2.3 Domain-Specific Metrics

| Metrik | Range | Deskripsi |
|--------|-------|-----------|
| `academicRigor` | 0-1 | Ketepatan terminologi akademik |
| `citationAccuracy` | 0-1 | Akurasi referensi sumber |
| `terminologyCorrectness` | 0-1 | Penggunaan istilah yang benar |

### 2.4 Hallucination Metrics

| Metrik | Interpretasi |
|--------|--------------|
| `hallucinationRate` | 0-1 (lower is better) |
| `factualConsistency` | 0-1 (NLI-based) |
| `sourceAttribution` | 0-1 (proper attribution) |
| `contradictionScore` | 0-1 (higher is better) |

### 2.5 Latency Metrics

| Metrik | Unit | Deskripsi |
|--------|------|-----------|
| `totalLatencyMs` | ms | Total waktu respons |
| `retrievalLatencyMs` | ms | Waktu retrieval |
| `rerankingLatencyMs` | ms | Waktu re-ranking |
| `generationLatencyMs` | ms | Waktu generasi LLM |
| `agentReasoningLatencyMs` | ms | Waktu penalaran agent |

---

## 3. Ablation Study

### Tujuan
Memahami kontribusi setiap komponen dengan menghapus/memodifikasi secara sistematis.

### Konfigurasi (13 configs)
1. Baseline (No RAG)
2. Vector Only
3. BM25 Only
4. Hybrid (No Rerank)
5. Hybrid + Cross-Encoder
6. Hybrid + LLM Rerank
7. Hybrid + Ensemble
8. Agentic Mode
9. Full System
10. Indonesian Optimized
11-13. Variasi lainnya

### Contoh Hasil
| Configuration | Faithfulness | Relevancy | Latency (ms) |
|---------------|--------------|-----------|--------------|
| Baseline | 0.45 | 0.50 | 300 |
| Vector Only | 0.65 | 0.68 | 600 |
| Hybrid | 0.72 | 0.75 | 700 |
| Full System | 0.88 | 0.85 | 2500 |

---

## 4. Evaluation Protocol

### 4.1 Test Dataset
- Jumlah pertanyaan: 30-50 (untuk signifikansi statistik)
- Kategori: research_methodology, academic_writing, statistics, etc.
- Tingkat kesulitan: easy, medium, hard
- Bahasa: Indonesian (id)

### 4.2 Proses Evaluasi
1. Load test questions dengan ground truth
2. Run setiap konfigurasi ablation
3. Calculate RAGAS metrics per pertanyaan
4. Aggregate dan hitung statistik
5. Run statistical tests (t-test, ANOVA)

### 4.3 Dashboard UI
Navigasi ke `/evaluation` untuk:
- Metrics visualization
- Ablation comparison charts
- Hallucination analysis
- Domain metrics

---

## 5. LLM-as-a-Judge

### Pendekatan
Menggunakan model yang sama (GPT-4.1-mini) untuk generasi dan evaluasi.

### Mitigasi Bias
- Fokus pada **relative gain** antar konfigurasi
- Bukan nilai absolut skor
- Konsistensi lingkungan eksperimen

---

*Kerangka evaluasi sistem Academic RAG Chatbot.*
