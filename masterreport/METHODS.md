# 🔧 Metode Teknis - Academic RAG Chatbot

> Penjelasan detail metode teknis yang digunakan dalam sistem.

---

## 1. Retrieval-Augmented Generation (RAG)

### Definisi
RAG adalah teknik yang meningkatkan respons LLM dengan mengambil informasi relevan dari basis pengetahuan eksternal sebelum menghasilkan jawaban.

### Arsitektur RAG
```
Query → [Retriever] → Context → [Generator] → Answer
```

### Keunggulan
- Mengurangi halusinasi
- Pengetahuan dapat diperbarui
- Sumber dapat diverifikasi

---

## 2. Okapi BM25

### Formula
$$\text{BM25}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{\text{avgdl}})}$$

**Keterangan:**
- $D$ = Dokumen
- $Q$ = Query dengan terms $q_1, q_2, ..., q_n$
- $f(q_i, D)$ = Frekuensi term $q_i$ dalam dokumen
- $k_1 = 1.2$ (term frequency saturation)
- $b = 0.75$ (length normalization)

### IDF Component
$$\text{IDF}(q_i) = \ln\left(\frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} + 1\right)$$

---

## 3. Cosine Similarity (Vector Search)

### Formula
$$\text{cosine}(\vec{A}, \vec{B}) = \frac{\vec{A} \cdot \vec{B}}{||\vec{A}|| \cdot ||\vec{B}||}$$

### Implementasi
- Query embedding: 1536 dimensi
- Document chunk embedding: 1536 dimensi
- Model: text-embedding-3-small (Azure OpenAI)

---

## 4. Reciprocal Rank Fusion (RRF)

### Formula
$$\text{RRF}(d) = \sum_{r \in R} \frac{1}{k + r(d)}$$

**Keterangan:**
- $d$ = Dokumen
- $R$ = Set of rankings (Vector, BM25)
- $r(d)$ = Rank dokumen dalam ranking $r$
- $k = 60$ (smoothing constant)

### Weighted Version
$$\text{RRF}_{weighted}(d) = \alpha \cdot \frac{1}{k + r_{vector}(d)} + \beta \cdot \frac{1}{k + r_{bm25}(d)}$$

---

## 5. Agentic Workflow

### Komponen Agent
1. **LLM Core**: Mesin penalaran
2. **Memory**: Jangka pendek dan panjang
3. **Planning**: Refleksi dan kritik diri
4. **Tools**: Akses ke sumber eksternal

### Tools
| Tool | Fungsi |
|------|--------|
| `search_documents` | Hybrid retrieval |
| `expand_query` | Ekspansi sinonim |
| `decompose_query` | Dekomposisi query |
| `verify_claim` | Verifikasi klaim |
| `synthesize_answer` | Sintesis jawaban |

---

## 6. Re-ranking

### Cross-Encoder
- Model: ms-marco-TinyBERT-L-2-v2
- Input: Query-passage pair
- Output: Relevance score

### LLM Listwise
- Input: Top-10 dokumen
- Output: JSON ranking dengan reasoning

### Ensemble
- Kombinasi cross-encoder + LLM
- Weighted average scores

---

## 7. Semantic Chunking

### Prinsip
Memecah dokumen berdasarkan **kesamaan semantik** antar kalimat berurutan.

### Algoritma
```
1. Hitung embedding setiap kalimat
2. Hitung cosine similarity kalimat berurutan
3. Jika similarity < threshold (0.5): buat chunk baru
4. Else: gabungkan ke chunk saat ini
```

---

## 8. Guardrails

### Input Validation
- PII detection (NIK, SSN, Credit Card)
- Prompt injection prevention
- Toxicity filtering

### Output Validation
- Hallucination check
- Citation verification
- Source attribution

---

*Metode teknis sistem Academic RAG Chatbot.*
