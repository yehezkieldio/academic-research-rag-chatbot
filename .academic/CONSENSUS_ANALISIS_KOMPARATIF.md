Dari consensus.app

Berikut adalah analisis komparatif paper Anda dengan literatur chatbot RAG lain, menyoroti research gap, keunikan, dan relevansi riset Anda.

## Research Gap & Novelty

Sebagian besar penelitian RAG chatbot fokus pada dua pendekatan utama: dense retrieval (vector-only) dan hybrid retrieval berbasis database (misal, Postgres FTS atau Elasticsearch)  (, 0). Namun, riset-riset tersebut umumnya:

- Mengandalkan full-text search di database, yang kurang fleksibel untuk morfologi bahasa non-Inggris seperti Bahasa Indonesia  (, 0).
- Tidak mengatasi masalah lexical gap pada istilah lokal/akronim (misal: "KRS", "Cuti") karena dense retrieval cenderung gagal pada exact match  (, 0).
- Jarang mengeksplorasi arsitektur client-side hybrid, khususnya BM25 in-memory pada kandidat hasil vector search, sehingga beban database tetap tinggi  (, 0).
- Minim membahas agentic orchestration (query decomposition, parallel tool execution) untuk domain edukasi bilingual  (, 0).

Paper Anda mengisi gap ini dengan:

- Mengusulkan arsitektur Vector-First Hybrid dengan BM25 in-memory, sehingga logika ranking leksikal tidak membebani database dan lebih mudah dikustomisasi untuk Bahasa Indonesia.
- Menunjukkan efektivitas query decomposition agentic untuk pertanyaan multi-langkah, yang jarang dieksplorasi di chatbot edukasi  (, 0).
- Menyediakan evaluasi ablation study yang membandingkan empat konfigurasi sistem, bukan sekadar baseline vector vs hybrid  (, 0).

## Perbandingan Aspek Teknis

| Aspek               | Paper Anda                                     | RAG Chatbot Lain  (, 0)                  | Citations |
| ------------------- | ---------------------------------------------- | ---------------------------------------- | --------- |
| Hybrid Retrieval    | BM25 in-memory (client-side) + vector          | DB-native (Elasticsearch/FTS) + vector   | (, 0)     |
| Bahasa & Morfologi  | Fokus Bahasa Indonesia, deteksi otomatis       | Umumnya Bahasa Inggris                   | (, 0)     |
| Query Decomposition | Agentic, parallel tool execution               | Single-turn, minim agentic orchestration | (, 0)     |
| Evaluasi            | RAGAS, ablation study, latency                 | Umumnya hanya accuracy/recall            | (, 0)     |
| Domain              | Layanan akademik, dokumen internal universitas | Umum, publik, atau dokumen hukum         | (, 0)     |

## Kelebihan & Relevansi

- **Fleksibilitas**: Client-side BM25 memudahkan adaptasi ke bahasa lokal tanpa reindexing database  (, 0).
- **Akurasi**: Hybrid vector-leksikal meningkatkan recall pada istilah spesifik universitas  (, 0).
- **Scalability**: Tidak membebani database operasional, cocok untuk institusi dengan resource terbatas  (, 0).
- **Praktis**: Otomatisasi layanan 24/7, mengurangi beban staf, dan mudah diintegrasikan ke sistem kampus.

## Kesimpulan

Paper Anda menawarkan solusi yang lebih relevan dan praktis untuk konteks universitas di Indonesia, mengisi gap yang belum banyak dieksplorasi oleh riset chatbot RAG lain, baik dari sisi arsitektur, bahasa, maupun evaluasi.

### Referensi
1. Lewis et al., 2020. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.
2. Karpukhin et al., 2020. Dense Passage Retrieval for Open-Domain Question Answering.
3. Thakur et al., 2021. BEIR: A Heterogeneous Benchmark for Information Retrieval.
4. Suryawanshi et al., 2022. Challenges in Multilingual Information Retrieval.
5. Xiong et al., 2021. Approximate Nearest Neighbor Negative Contrastive Learning for Dense Text Retrieval.
6. Lin et al., 2021. Pyserini: An Information Retrieval Toolkit.
7. Yao et al., 2023. ReAct: Synergizing Reasoning and Acting in Language Models.

_These papers were sourced and synthesized using Consensus, an AI-powered search engine for research. Try it at https://consensus.app_

## References

