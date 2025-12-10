Codebase ini adalah bagian dari proyek yang akan jadi publikasi ilmiah kami dengan rincian sebagai berikut:

Judul Publikasi:

"Implementasi Agentic Retrieval-Augmented Generation (RAG) untuk Otomatisasi Layanan Mahasiswa di Universitas Mulia"

Jenis Penelitian:

Penelitian Eksperimental Terapan

Keterbatasan Solusi Lama:

Retrieval-Augmented Generation (RAG) standar sering melewatkan kata kunci spesifik, sementara pencarian keyword biasa gagal memahami konteks semantik.

Metodologi Penelitian:

Penelitian ini menggunakan pendekatan kuantitatif melalui Ablation Study (Studi Ablasi) otomatis. Studi Ablasi itu metode untuk memahami kinerja sistem dengan menghapus atau memodifikasi komponen tertentu secara sistematis untuk melihat dampaknya terhadap kinerja keseluruhan.

Isu Utama:

Chatbot domain spesifik seperti akademik tradisional dan LLM standar sering mengalami halusinasi dan gagal menjawab pertanyaan spesifik konteks lokal domain seperti aturan KRS, dll.

Model Hosting: Microsoft Azure OpenAI

Model Chat: gpt-4.1-mini

Model Embedding: text-embedding-3-small

Penelitian ini menggunakan model dan layanan Microsoft Azure OpenAI karena lingkungan cloud menyediakan konsistensi kinerja, skalabilitas, serta konfigurasi model yang terstandarisasi untuk keperluan eksperimen terkontrol. Penggunaan model-model melalui Azure memungkinkan replikasi hasil karena versi model, parameter, dan pipeline inferensi berada pada lingkungan eksekusi yang stabil dan terdokumentasi. Pendekatan ini juga menghilangkan variasi performa yang dapat muncul pada deployment lokal, seperti perbedaan hardware atau optimisasi runtime, sehingga seluruh perbandingan antar konfigurasi pada Studi Ablasi dapat berjalan secara adil dan bebas bias teknis.

