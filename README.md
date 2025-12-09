# MuliaChat: Academic Research RAG Chatbot

Ini adalah repositori implementasi MuliaChat, sebuah chatbot akademik yang memanfaatkan Retrieval-Augmented Generation (RAG) untuk memberikan jawaban yang akurat dan relevan berdasarkan dokumen akademik.

Ini adalah bagian dari proyek yang akan jadi publikasi ilmiah kami dengan rincian sebagai berikut:

Judul Publikasi: "Implementasi Agentic Retrieval-Augmented Generation (RAG) untuk Otomatisasi Layanan Mahasiswa di Universitas Mulia"

Jenis Penelitian: Penelitian Eksperimental Terapan

Isu Utama: Chatbot domain spesifik seperti akademik tradisional dan LLM standar sering mengalami halusinasi dan gagal menjawab pertanyaan spesifik konteks lokal domain seperti aturan KRS, dll.

Keterbatasan Solusi Lama: RAG standar (Vector) sering melewatkan kata kunci spesifik, sementara pencarian keyword (BM25) biasa gagal memahami konteks semantik.

Metodologi:
Penelitian ini menggunakan pendekatan kuantitatif melalui Ablation Study (Studi Ablasi) otomatis.
Studi Ablasi itu metode untuk memahami kinerja sistem dengan menghapus atau memodifikasi komponen tertentu secara sistematis untuk melihat dampaknya terhadap kinerja keseluruhan.

Desain Eksperimen: Menguji sistem dengan membandingkan 4 konfigurasi berbeda untuk mengisolasi dampak setiap fitur:Baseline: Tanpa RAG (No Retrieval).

1. Vector-Only: RAG Standar.
2. Hybrid: Vector + BM25 (Tanpa Agent).
3. Agentic RAG: Hybrid + Reasoning + Re-ranking (Solusi yang diusulkan).

Analisis Data:

- Menggunakan Paired t-tests untuk menguji signifikansi perbedaan performa antar konfigurasi.
- Menggunakan ANOVA untuk perbandingan multi-grup.
- Menghitung Confidence Intervals (95%) untuk validitas data.

*Evaluasi dan Metrik*
Kualitas sistem tidak dinilai secara manual, melainkan menggunakan kerangka evaluasi otomatis:

Framework: Menggunakan RAGAS (Retrieval Augmented Generation Assessment).

Metrik Utama:
- Faithfulness: Mengukur seberapa akurat jawaban berdasarkan dokumen sumber (anti-halusinasi).
- Answer Relevancy: Relevansi jawaban terhadap pertanyaan pengguna.
- Context Precision: Ketepatan dokumen yang diambil oleh sistem retrieval.
- Hallucination Rate: Persentase klaim yang tidak terverifikasi atau berkontradiksi dengan sumber.
- Academic Rigor Score: Skor khusus untuk menilai akurasi sitasi dan penggunaan terminologi akademik.

