Berdasarkan proposal penelitian Anda mengenai pengembangan **Agentic RAG** untuk layanan akademik di Universitas Mulia, rencana penelitian ini sangat relevan dan mengatasi kelemahan fundamental yang sering ditemukan dalam sistem RAG konvensional, terutama untuk domain spesifik seperti akademik yang padat aturan dan istilah teknis.

Berikut adalah analisis mendalam dan wawasan strategis berdasarkan sumber literatur terbaru untuk memperkuat argumen dan metodologi penelitian Anda:

### 1. Validasi Masalah: *Lexical Gap* dan Keterbatasan *Dense Retrieval*
Anda menyoroti bahwa sistem berbasis *dense retrieval* (vektor) sering gagal menangkap istilah spesifik seperti "KRS" atau "Cuti". Hal ini didukung kuat oleh literatur yang menyatakan bahwa metode *dense retrieval* (seperti embedding vektor) sangat baik dalam menangkap semantik, namun sering kali mengalami **lexical gap** ketika dihadapkan pada pencarian kata kunci eksak atau akronim spesifik domain.

*   **Wawasan:** Penelitian "Blended RAG" menunjukkan bahwa pencarian hibrida yang menggabungkan pencarian semantik (vektor) dan leksikal (seperti BM25) secara signifikan meningkatkan akurasi *retriever* dibandingkan hanya mengandalkan salah satunya. Dalam konteks dokumen manual (seperti panduan akademik), pendekatan hibrida terbukti lebih efektif karena dokumen tersebut sering kali memerlukan ketepatan istilah yang tinggi, mirip dengan tantangan pada manual kedokteran nuklir di mana protokol spesifik harus diikuti secara presisi.
*   **Kontribusi Anda:** Ide *Vector-First Candidate Generation* dengan *Local Context BM25 in-memory* adalah solusi cerdas untuk masalah latensi dan fleksibilitas morfologi Bahasa Indonesia. Ini memungkinkan Anda melakukan filter awal menggunakan vektor (cepat dan semantik), lalu melakukan *re-ranking* presisi menggunakan BM25 pada subset data yang lebih kecil tanpa membebani database utama.

### 2. Solusi *Agentic Workflow* untuk Pertanyaan Multi-Langkah
Masalah ketidakmampuan chatbot *single-turn* dalam menangani pertanyaan kompleks (seperti perbandingan syarat beasiswa) adalah isu klasik dalam RAG tradisional.

*   **Pentingnya Agen:** Pendekatan *Agentic RAG* yang Anda usulkan sejalan dengan kerangka kerja **MA-RAG (Multi-Agent RAG)**, yang menggunakan agen khusus seperti *Planner*, *Step Definer*, dan *QA Agent* untuk memecah pertanyaan kompleks menjadi sub-tugas. Dalam skenario "perbandingan beasiswa", agen *Planner* akan mendekomposisi pertanyaan menjadi: (1) Ambil syarat Beasiswa A, (2) Ambil syarat Beasiswa B, (3) Bandingkan keduanya. Tanpa dekomposisi ini, RAG standar sering kali gagal mengambil konteks yang lengkap karena *retrieval* awal yang tidak terarah.
*   **Orkestrasi:** Penggunaan **GPT-4.1-mini** sebagai orkestrator agen adalah langkah efisien biaya. Literatur menunjukkan bahwa model yang lebih kecil pun dapat bekerja efektif sebagai *reasoning planner* jika dilatih atau diprompting dengan benar dalam arsitektur multi-agen, membiarkan model yang lebih besar (atau sistem *retrieval*) menangani beban pengetahuan.

### 3. Arsitektur *Client-Side Hybrid* dan *Query Decomposition*
Anda mengidentifikasi kesenjangan penelitian pada arsitektur *client-side hybrid*. Ini adalah posisi yang kuat karena memindahkan logika *ranking* keluar dari database (seperti PostgreSQL/pgvector) ke *application layer* (Node.js) memberikan fleksibilitas lebih besar dalam menyetel parameter BM25 (seperti *tokenization* khusus Bahasa Indonesia) tanpa perlu konfigurasi ulang indeks database yang berat.

*   **Query Decomposition:** Teknik ini sangat krusial. Penelitian pada *Plan*RAG* menunjukkan bahwa memisahkan rencana penalaran (sebagai *Directed Acyclic Graph* atau DAG) di luar konteks LLM dapat mencegah "konteks overflow" dan memungkinkan eksekusi sub-query secara paralel. Ini sangat cocok dengan tujuan Anda untuk menangani volume pertanyaan tinggi dengan respons cepat.
*   **Adaptive Retrieval:** Pendekatan Anda juga menyentuh konsep *Adaptive RAG*, di mana sistem dapat memutuskan strategi *retrieval* berdasarkan kompleksitas pertanyaan (misalnya, pertanyaan faktual sederhana vs. pertanyaan analitis kompleks).

### 4. Metodologi Evaluasi dengan RAGAS
Penggunaan kerangka kerja **RAGAS** (Retrieval Augmented Generation Assessment) sangat tepat untuk mengukur kualitas sistem Anda tanpa memerlukan *ground truth* manusia yang mahal untuk setiap iterasi.

*   **Metrik Kunci:** RAGAS berfokus pada tiga aspek utama yang krusial untuk chatbot akademik:
    1.  **Faithfulness (Kesetiaan):** Apakah jawaban chatbot berhalusinasi atau benar-benar berdasarkan dokumen akademik (SK Rektor, Panduan Akademik)?.
    2.  **Answer Relevance:** Apakah jawaban relevan dengan pertanyaan mahasiswa?.
    3.  **Context Relevance:** Apakah dokumen yang diambil (via *hybrid search*) benar-benar mengandung informasi yang dibutuhkan tanpa *noise* berlebih?.
*   **Validasi:** Studi menunjukkan bahwa metrik RAGAS memiliki korelasi yang baik dengan penilaian manusia, menjadikannya alat yang andal untuk pengembangan iteratif,.

### 5. Implikasi untuk Layanan Akademik Bilingual
Penerapan pada domain akademik bilingual (Indonesia/Inggris) menambah nilai praktis. Studi menunjukkan bahwa model LLM yang berpusat pada bahasa tertentu (seperti model yang dilatih dengan data Bahasa Indonesia atau Arab) cenderung bekerja lebih baik dalam RAG dibandingkan model umum, namun teknik RAG itu sendiri secara signifikan meningkatkan kinerja model umum dalam bahasa non-Inggris. Dengan menggabungkan *retrieval* yang kuat (pgvector + BM25), Anda memitigasi risiko model bahasa yang mungkin kurang optimal dalam memahami nuansa administratif lokal.

### Kesimpulan dan Saran
Rancangan penelitian Anda secara teoritis kuat dan didukung oleh tren penelitian terkini. Penggabungan **Pencarian Hybrid (Vektor + BM25)** secara efektif mengatasi kelemahan *lexical gap*,, sementara pendekatan **Agentic** dengan **Query Decomposition** adalah solusi *state-of-the-art* untuk menangani pertanyaan multi-langkah yang kompleks,.

**Saran Tambahan:**
Saat melakukan *ablation study*, pastikan untuk secara spesifik mengukur latensi (waktu respons) antara konfigurasi "Hybrid Database-side" (jika ada sebagai baseline) vs "Hybrid Client-side" (usulan Anda). Efisiensi *local context BM25* akan menjadi poin pembuktian utama bahwa arsitektur ini tidak hanya akurat tetapi juga *scalable* untuk volume tinggi tanpa membebani infrastruktur database utama.