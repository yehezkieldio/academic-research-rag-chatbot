# 📝 Panduan Penulisan Paper IMRAD - Academic RAG Chatbot

> Panduan untuk menulis paper akademik format IMRAD berdasarkan penelitian ini.

---

## 1. Struktur IMRAD

| Bagian | Konten | Proporsi |
|--------|--------|----------|
| **I**ntroduction | Latar belakang, masalah, tujuan | 15-20% |
| **M**ethods | Metodologi, desain, alat | 25-30% |
| **R**esults | Temuan, data, analisis | 25-30% |
| **A**nd **D**iscussion | Interpretasi, implikasi, limitasi | 20-25% |

---

## 2. Introduction (Pendahuluan)

### Konten yang Harus Ada
1. **Latar Belakang**: Pentingnya sistem QA akademis
2. **Masalah**: Keterbatasan LLM (halusinasi, outdated)
3. **Research Questions**: RQ1-RQ4
4. **Tujuan**: Pengembangan Agentic RAG

### Contoh Paragraf Pembuka
> "Sistem tanya-jawab berbasis Large Language Model (LLM) telah menunjukkan kemampuan luar biasa dalam memahami dan menghasilkan teks natural. Namun, LLM memiliki keterbatasan inheren: kecenderungan menghasilkan informasi yang tidak akurat (halusinasi) dan pengetahuan yang terbatas pada data pelatihan. Retrieval-Augmented Generation (RAG) menawarkan solusi dengan mengintegrasikan pengambilan dokumen relevan ke dalam proses generasi (Lewis et al., 2020)."

---

## 3. Methods (Metode)

### Konten yang Harus Ada
1. **System Architecture**: Diagram, layer description
2. **Dataset**: Sumber, jumlah, karakteristik
3. **Implementation**: Teknologi, parameter
4. **Evaluation Protocol**: Metrik, prosedur

### Tabel Konfigurasi
```
| Component | Technology             | Configuration   |
| --------- | ---------------------- | --------------- |
| LLM       | GPT-4.1-mini           | temperature=0.7 |
| Embedding | text-embedding-3-small | dim=1536        |
| Vector DB | PostgreSQL + pgvector  | IVFFlat index   |
| BM25      | Custom Okapi BM25      | k1=1.5, b=0.75  |
```

### Contoh Paragraf Metode
> "Sistem dikembangkan menggunakan arsitektur RAG agentik dengan hybrid retrieval. Dokumen diproses melalui pipeline ingestion yang mencakup parsing, chunking (semantic chunking dengan threshold similarity 0.5), dan embedding menggunakan model text-embedding-3-small (dimensi 1536)."

---

## 4. Results (Hasil)

### Konten yang Harus Ada
1. **Descriptive Statistics**: Mean, SD, CI
2. **Hypothesis Testing**: t-statistic, p-value, df
3. **Effect Size**: Cohen's d, η²
4. **Ablation Results**: Tabel perbandingan

### Format Pelaporan
```
t-test: t(df) = value, p < threshold, d = effect_size
ANOVA: F(df_between, df_within) = value, p < threshold, η² = effect_size
CI: M = value, 95% CI [lower, upper]
```

### Contoh Paragraf Hasil
> "Hasil evaluasi menunjukkan bahwa sistem RAG agentik (M = 0.847, SD = 0.089) secara signifikan lebih baik dibandingkan baseline Non-RAG (M = 0.623, SD = 0.142) dalam metrik Faithfulness, t(49) = 8.234, p < 0.001, d = 1.89 (efek besar)."

---

## 5. Discussion (Diskusi)

### Konten yang Harus Ada
1. **Interpretasi**: Mengapa RAG lebih baik?
2. **Comparison**: Vs prior work, RAGAS benchmarks
3. **Trade-offs**: Accuracy vs latency
4. **Limitations**: Dataset, evaluator bias
5. **Implications**: Praktis dan teoritis
6. **Future Work**: Extensions

### Contoh Paragraf Diskusi
> "Peningkatan signifikan pada metrik Faithfulness (d = 1.89) mengkonfirmasi hipotesis bahwa grounding jawaban pada konteks yang diambil secara efektif mengurangi halusinasi. Menariknya, sistem agentik menunjukkan trade-off yang jelas: meskipun lebih akurat (+18.2% Faithfulness), latency meningkat 340% dibandingkan RAG tradisional."

---

## 6. Visualisasi yang Disarankan

| Jenis | Kegunaan |
|-------|----------|
| Bar Chart | Perbandingan metrik antar config |
| Box Plot | Distribusi skor per config |
| Stacked Bar | Latency breakdown per fase |
| Heatmap | Korelasi antar metrik |
| Waterfall | Ablation impact |

---

## 7. Checklist Sebelum Submit

### Introduction
- [ ] Latar belakang jelas
- [ ] Rumusan masalah spesifik
- [ ] Research questions
- [ ] Tujuan terukur

### Methods
- [ ] Arsitektur terdokumentasi
- [ ] Dataset dijelaskan
- [ ] Parameter lengkap
- [ ] Protokol reproducible

### Results
- [ ] Descriptive statistics
- [ ] Appropriate tests
- [ ] Effect sizes
- [ ] Confidence intervals

### Discussion
- [ ] Interpretasi logis
- [ ] Comparison prior work
- [ ] Limitations acknowledged
- [ ] Future work

---

*Panduan penulisan paper IMRAD untuk Academic RAG Chatbot.*
