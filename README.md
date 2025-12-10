Codebase ini adalah bagian dari proyek yang akan jadi publikasi ilmiah kami dengan rincian sebagai berikut:

Judul Publikasi:

"Implementasi Agentic Retrieval-Augmented Generation (RAG) untuk Otomatisasi Layanan Mahasiswa di Universitas Mulia"

Jenis Penelitian:

Penelitian Eksperimental Terapan

Keterbatasan Solusi Lama:

Retrieval-Augmented Generation (RAG) standar sering melewatkan kata kunci spesifik, sementara pencarian keyword biasa gagal memahami konteks semantik.

Metodologi Penelitian:

Penelitian ini adalah penelitian Research and Development (R&D) dan Rapid Application Development

Penelitian ini menggunakan pendekatan kuantitatif melalui Ablation Study (Studi Ablasi) otomatis. Studi Ablasi itu metode untuk memahami kinerja sistem dengan menghapus atau memodifikasi komponen tertentu secara sistematis untuk melihat dampaknya terhadap kinerja keseluruhan.

Penelitian ini menerapkan metode Research and Development (R&D) dengan pendekatan pengembangan perangkat lunak Rapid Application Development (RAD). Pemilihan RAD didasari oleh kebutuhan iterasi cepat dalam menyempurnakan pipeline retrieval dan prompt engineering pada arsitektur Agentic RAG.

Isu Utama:

Chatbot domain spesifik seperti akademik tradisional dan LLM standar sering mengalami halusinasi dan gagal menjawab pertanyaan spesifik konteks lokal domain seperti aturan KRS, dll.

Model Hosting: Microsoft Azure OpenAI

Model Chat: gpt-4.1-mini

Model Evaluasi: gpt-4.1-mini

Model Embedding: text-embedding-3-small

Penelitian ini menggunakan model Microsoft Azure OpenAI GPT-4.1-mini baik sebagai mesin inferensi utama (Chatbot) maupun sebagai evaluator (LLM-as-a-Judge). Pemilihan model ini didasarkan pada dua faktor utama:

1. Kapabilitas Model: GPT-4.1-mini memiliki kemampuan penalaran dan 'instruction following' yang setara atau melebihi model generasi sebelumnya (GPT-4o), menjadikannya evaluator yang kompeten untuk domain akademik.
2. Konsistensi Eksperimen: Menggunakan model yang sama untuk generasi dan evaluasi meminimalisir variabilitas arsitektur, sehingga metrik yang dihasilkan (seperti Faithfulness dan Answer Relevancy) secara akurat mencerminkan peningkatan kinerja yang dihasilkan oleh arsitektur Agentic RAG, bukan perbedaan kemampuan model.

Evaluasi dilakukan menggunakan pendekatan LLM-as-a-Judge (RAGAS) dengan model yang sama untuk sistem dan evaluator. Pendekatan ini dipilih untuk menjaga konsistensi lingkungan eksperimen dan efisiensi komputasi. Untuk memitigasi bias preferensi diri (Self-Preference Bias), penelitian ini berfokus pada pengukuran peningkatan relatif (relative gain) antar konfigurasi ablasi (misalnya: dampak penambahan komponen Agentic terhadap baseline), daripada berfokus pada nilai absolut skor metrik.

Penelitian ini menggunakan model dan layanan Microsoft Azure OpenAI karena lingkungan cloud menyediakan konsistensi kinerja, skalabilitas, serta konfigurasi model yang terstandarisasi untuk keperluan eksperimen terkontrol. Penggunaan model-model melalui Azure memungkinkan replikasi hasil karena versi model, parameter, dan pipeline inferensi berada pada lingkungan eksekusi yang stabil dan terdokumentasi. Pendekatan ini juga menghilangkan variasi performa yang dapat muncul pada deployment lokal, seperti perbedaan hardware atau optimisasi runtime, sehingga seluruh perbandingan antar konfigurasi pada Studi Ablasi dapat berjalan secara adil dan bebas bias teknis.

