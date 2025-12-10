Analisis Komparatif Model dan Kerangka Kerja Retrieval-Augmented Generation (RAG)

1.0 Pendahuluan: Mendefinisikan Paradigma Retrieval-Augmented Generation

Large Language Models (LLM) menunjukkan kemampuan luar biasa dalam berbagai tugas Pemrosesan Bahasa Alami (NLP), tetapi arsitektur dasarnya memiliki keterbatasan inheren. Pengetahuan mereka bersifat statis—terkunci pada data saat pelatihan—dan rentan terhadap "halusinasi", yaitu generasi informasi yang salah secara faktual. Untuk mengatasi tantangan ini, paradigma Retrieval-Augmented Generation (RAG) muncul bukan sebagai solusi monolitik, melainkan sebagai pendekatan arsitektural untuk menyeimbangkan dua representasi pengetahuan yang berbeda. RAG meningkatkan LLM dengan memberinya akses ke basis pengetahuan eksternal yang dapat diperbarui, memungkinkan model mengambil informasi relevan secara real-time sebelum menghasilkan respons. Pendekatan ini sangat krusial untuk aplikasi domain spesifik seperti kedokteran, di mana model serbaguna rentan terhadap "ilusi perseptual" dan kesalahan faktual—sebuah masalah yang dapat dimitigasi secara efektif oleh pengambilan informasi dari basis pengetahuan yang terkurasi, seperti yang ditunjukkan oleh GastroBot. Dengan demikian, RAG secara fundamental meningkatkan akurasi, relevansi kontekstual, dan kemampuan menyediakan sumber yang dapat diverifikasi.

Tantangan rekayasa inti dalam RAG adalah menyeimbangkan dan mengintegrasikan dua jenis memori secara efektif:

* Memori Parametrik: Ini adalah pengetahuan implisit yang tersimpan dalam parameter model sequence-to-sequence (seq2seq) yang telah dilatih sebelumnya, seperti BART. Pengetahuan ini diperoleh selama fase pra-pelatihan ekstensif pada korpus data yang masif.
* Memori Non-Parametrik: Ini adalah basis pengetahuan eksternal yang eksplisit, seperti indeks vektor dari Wikipedia. Memori ini diakses melalui komponen retriever neural, seperti Dense Passage Retriever (DPR), yang secara dinamis mengambil potongan informasi yang relevan sebagai respons terhadap kueri.

Perpaduan antara pengetahuan yang diinternalisasi (parametrik) dan informasi yang diambil secara dinamis (non-parametrik) inilah yang menjadi inti dari sistem RAG, memungkinkannya menghasilkan respons yang tidak hanya fasih tetapi juga berlandaskan fakta yang dapat diverifikasi. Bagian selanjutnya dari analisis ini akan menelusuri evolusi arsitektur yang telah membentuk kerangka kerja RAG modern, mengeksplorasi berbagai pendekatan untuk mengoptimalkan keseimbangan fundamental ini.

2.0 Fondasi Arsitektur: Dari Model Hibrida ke Dense Retrieval

Evolusi menuju RAG modern berakar pada pergeseran dari arsitektur berbasis aturan yang kaku ke kerangka kerja pengambilan informasi (retrieval) yang lebih dinamis. Pendekatan awal yang mengandalkan pencarian leksikal, seperti BM25, sering gagal ketika kueri pengguna tidak mengandung kata kunci yang sama persis dengan yang ada di dalam dokumen sumber. Masalah ini, yang dikenal sebagai lexical gap (kesenjangan kosakata), bukan sekadar ketidaknyamanan; ini merepresentasikan kegagalan fundamental dalam menangkap intensi semantik. Sistem yang bergantung pada pencocokan kata kunci tidak dapat membedakan antara kueri untuk "Apple" perusahaan dan "apple" buah tanpa pemahaman kontekstual—sebuah kesenjangan yang dirancang untuk dijembatani oleh dense retrieval dengan beroperasi dalam ruang semantik kontinu.

Sebelum kemunculan RAG yang terintegrasi penuh, model chatbot hibrida berfungsi sebagai pendahulu konseptual yang penting. Sistem-sistem ini mengintegrasikan kekuatan pendekatan berbasis aturan, berbasis pengambilan, dan generatif. Secara krusial, model-model ini memanfaatkan pengklasifikasi Multinomial Naive Bayes (MNB) untuk secara cerdas merutekan kueri ke modul chatbot yang paling sesuai. Mekanisme perutean ini merupakan prekursor konseptual langsung bagi agen perutean dan perencanaan yang ditemukan dalam kerangka kerja Agentic RAG tingkat lanjut, yang menjadikan hubungan evolusioner ini konkret, bukan hanya metaforis.

Lompatan arsitektural yang paling signifikan adalah transisi dari metode pengambilan informasi sparse ke Dense Retrieval (DR). Pergeseran ini secara fundamental mengubah cara sistem menemukan informasi yang relevan, dengan fokus pada makna semantik daripada pencocokan leksikal.

Fitur	Pengambilan Informasi Sparse (BM25)	Dense Retrieval (DPR)
Mekanisme Pencocokan	Pencocokan kata kunci diskrit (bag-of-words).	Pencocokan dalam ruang representasi kontinu (vektor).
Keterbatasan Utama	Rentan terhadap lexical gap (ketidakcocokan kosakata).	Secara fundamental mengatasi lexical gap.
Kinerja	Merupakan baseline yang kuat tetapi menjadi hambatan.	Secara signifikan mengungguli BM25 (misalnya, 65.2% vs. 42.9% dalam akurasi Top-5).

Seperti yang ditunjukkan oleh data kinerja, Dense Passage Retriever (DPR) secara drastis mengungguli BM25 dengan mencocokkan kueri dan dokumen berdasarkan makna semantik yang di-embed dalam vektor. Meskipun Dense Retrieval memecahkan masalah pencocokan semantik, kerangka kerja RAG awal memperlakukan document encoder sebagai artefak statis yang telah dihitung sebelumnya. Hal ini menciptakan hambatan baru: retriever tidak dapat beradaptasi dengan nuansa domain baru, sebuah keterbatasan yang secara langsung diatasi oleh pengenalan arsitektur yang dapat dilatih secara end-to-end.

3.0 Kerangka Kerja RAG Inti: Analisis Komparatif RAG-end2end

Arsitektur RAG fundamental yang diperkenalkan oleh Lewis et al. (2020) mengintegrasikan retriever dan generator ke dalam satu sistem, tetapi dengan batasan kunci: hanya query encoder dari retriever yang diperbarui selama pelatihan, sementara document encoder dan indeks pengetahuan tetap statis. Evolusi penting dalam arsitektur ini adalah RAG-end2end, yang memperkenalkan pelatihan bersama (joint training) dari kedua komponen retriever dan generator, memungkinkan adaptasi yang lebih dinamis dan efektif, terutama untuk domain pengetahuan baru.

Arsitektur RAG asli hadir dalam dua varian: RAG-Sequence dan RAG-Token. Keduanya memperlakukan dokumen yang diambil sebagai variabel laten dan melakukan marginalisasi atas dokumen-dokumen tersebut untuk menghasilkan respons akhir. RAG-Sequence menggunakan dokumen yang sama untuk menghasilkan seluruh urutan jawaban, sedangkan RAG-Token memiliki fleksibilitas untuk menggunakan dokumen yang berbeda untuk setiap token yang dihasilkannya. Namun, kemampuan adaptasi mereka terbatas karena indeks pengetahuan yang statis.

Kerangka kerja RAG-end2end mengatasi batasan ini dengan memungkinkan passage encoder diperbarui secara asinkron selama proses pelatihan. Penelitian menunjukkan bahwa adaptasi komponen retriever ini memainkan peran penting dalam kinerja adaptasi domain secara keseluruhan. Ketika hanya query encoder yang diperbarui, kinerja cenderung menurun. Sebaliknya, RAG-end2end menunjukkan peningkatan kinerja yang substansial di berbagai domain (misalnya, riset COVID-19, berita, dan percakapan) dengan melatih kedua encoder tersebut secara bersamaan.

Aspek	RAG (Original)	RAG-end2end
Pelatihan Retriever	Hanya query encoder yang di-fine-tune; document encoder tetap.	Query encoder dan passage encoder dilatih bersama (secara asinkron).
Kinerja Adaptasi Domain	Kinerja menurun jika hanya query encoder yang diperbarui.	Peningkatan signifikan di berbagai domain (COVID-19, News, Conversation).
Kompleksitas Implementasi	Lebih sederhana, tidak memerlukan pembaruan indeks.	Lebih kompleks, melibatkan pembaruan indeks secara asinkron.

Pembaruan indeks asinkron pada RAG-end2end secara inheren lebih kompleks karena melibatkan proses pengkodean ulang seluruh korpus dokumen secara berkala dengan passage encoder yang telah diperbarui dan membangun kembali indeks Approximate Nearest Neighbor (ANN). Ini adalah proses yang intensif secara komputasi yang berjalan secara paralel dengan loop pelatihan utama. Namun, manfaat kinerjanya sangat signifikan. Pada domain COVID-19, RAG-end2end mencapai skor Exact Match (EM) sebesar 8.32, lebih dari dua kali lipat skor RAG-original sebesar 3.66.

Kemampuan untuk memperbarui indeks pengetahuan secara dinamis di RAG-end2end merupakan langkah penting dalam pembelajaran adaptif. Namun, strategi pengambilan itu sendiri tetap tetap dan reaktif. Evolusi logis berikutnya, Agentic RAG, bergerak melampaui adaptasi data menuju adaptasi proses, dengan memperkenalkan agen otonom yang dapat merumuskan dan menjalankan strategi pengambilan yang dinamis.

4.0 Lompatan Agentic: Mengintegrasikan Agen Otonom ke dalam RAG

Agentic RAG merepresentasikan lompatan paradigma dari sistem RAG tradisional. Alih-alih mengikuti alur kerja pengambilan-dan-generasi yang linear, Agentic RAG menyematkan agen AI otonom ke dalam prosesnya. Agen-agen ini berfungsi sebagai "otak" sistem, yang secara dinamis mengelola strategi pengambilan, menyempurnakan pemahaman kontekstual, dan mengadaptasi alur kerja sesuai dengan kompleksitas kueri. Dengan memanfaatkan pola desain agentic seperti perencanaan, penggunaan alat, dan kolaborasi multi-agen, kerangka kerja ini mampu menangani tugas-tugas yang jauh lebih rumit.

Komponen inti dari agen LLM dalam konteks Agentic RAG meliputi:

* LLM (dengan Peran dan Tugas yang Didefinisikan): Bertindak sebagai mesin penalaran utama agen, menafsirkan kueri, menghasilkan respons, dan mengelola alur kerja.
* Memori (Jangka Pendek dan Jangka Panjang): Melacak status percakapan saat ini dan menyimpan pengetahuan yang terakumulasi dari interaksi sebelumnya.
* Perencanaan (Refleksi & Kritik Diri): Memandu proses penalaran berulang, memecah tugas-tugas kompleks, merutekan kueri, dan mengkritik diri sendiri untuk memastikan hasil yang efektif.
* Alat (Pencarian Vektor, Pencarian Web, API, dll.): Memperluas kemampuan agen di luar generasi teks, memungkinkan akses ke sumber daya eksternal atau komputasi khusus.

Berbagai kerangka kerja Agentic RAG telah dikembangkan, masing-masing dengan kekuatan unik:

* Multi-Agent RAG: Kerangka kerja ini mendistribusikan tanggung jawab ke beberapa agen khusus. Dalam kasus "Analisis Dampak Ekonomi," satu agen dapat mengambil data statistik, agen lain mencari makalah akademis, dan agen ketiga melakukan pencarian web untuk berita terbaru, sebelum seorang koordinator mensintesis masukan tersebut.
* Agentic Corrective RAG (CRAG): CRAG memperkenalkan mekanisme koreksi diri. Agen evaluasi menilai relevansi dokumen yang diambil. Dokumen yang berada di bawah ambang batas relevansi (relevance threshold) memicu langkah-langkah korektif, seperti penyempurnaan kueri oleh agen lain atau pencarian web eksternal untuk melengkapi informasi.
* Graph-Based Agentic RAG (Agent-G & GeAR): Kerangka kerja ini mengintegrasikan basis pengetahuan grafik (data terstruktur) dengan pengambilan dokumen tidak terstruktur.
  * Agent-G menggunakan "Modul Kritik" untuk mengevaluasi informasi yang diambil dari kedua sumber. Dalam kasus penggunaan "Diagnostik Kesehatan," Graph Retriever dapat mengekstrak hubungan penyakit-gejala dari grafik pengetahuan medis, sementara Document Retriever mengambil deskripsi kontekstual dari literatur medis.
  * GeAR berfokus pada teknik ekspansi grafik (graph expansion) untuk meningkatkan pengambilan multi-hop dengan menavigasi hubungan dalam data terstruktur untuk menemukan informasi yang relevan secara tidak langsung.

Kerangka kerja agentic ini secara signifikan meningkatkan kemampuan RAG. Namun, untuk kueri yang memerlukan penalaran multi-langkah yang sangat kompleks, kerangka kerja yang lebih terspesialisasi lagi telah muncul.

5.0 Kerangka Kerja Penalaran dan Perencanaan Tingkat Lanjut

Meskipun RAG agentic unggul dalam banyak tugas, kueri multi-langkah (multi-hop)—di mana jawaban atas satu pertanyaan bergantung pada jawaban pertanyaan lain—tetap menjadi tantangan. Untuk mengatasi hal ini, kerangka kerja canggih yang dirancang untuk dekomposisi dan perencanaan tugas telah dikembangkan, memungkinkan sistem untuk memecah masalah rumit menjadi bagian-bagian yang dapat dikelola.

Paradigma ReAct (Reason + Act) adalah salah satu kerangka kerja fundamental dalam kategori ini. ReAct mendorong LLM untuk menghasilkan jejak penalaran verbal (reason) dan tindakan yang relevan (act) secara bergantian. Proses yang saling terkait ini memungkinkan penalaran dinamis, di mana model dapat membuat, memelihara, dan menyesuaikan rencana tingkat tinggi saat berinteraksi dengan lingkungan eksternal. Pendekatan berurutan ini sangat efektif untuk tugas-tugas di mana strategi perlu disesuaikan secara real-time berdasarkan informasi baru.

Arsitektur Plan-RAG membawa pendekatan perencanaan ke tingkat yang lebih terstruktur. Alih-alih penalaran berurutan, Plan-RAG terlebih dahulu menghasilkan rencana penalaran lengkap dalam bentuk Directed Acyclic Graph (DAG). Dalam DAG, kueri asli dipecah menjadi beberapa sub-kueri, dan dependensi di antara mereka dipetakan. Keunggulan utama pendekatan ini adalah efisiensinya: sub-kueri yang tidak memiliki dependensi dapat dieksekusi secara paralel. Efisiensi ini sangat menguntungkan dalam sistem terdistribusi atau untuk kueri dengan sub-tugas berlatensi tinggi (misalnya, kueri basis data kompleks atau panggilan API), di mana paralelisasi dapat secara dramatis mengurangi total waktu respons.

Tabel berikut membandingkan kedua kerangka kerja canggih ini:

Kerangka Kerja	Mekanisme Inti	Pendekatan Penalaran	Kasus Penggunaan Ideal
ReAct	Jejak penalaran dan tindakan yang saling terkait.	Berurutan dan dinamis.	Tugas interaktif yang membutuhkan adaptasi waktu nyata.
Plan-RAG	Perencanaan berbasis Directed Acyclic Graph (DAG).	Dekomposisi terstruktur dan eksekusi paralel.	Kueri multi-langkah kompleks dengan dependensi yang jelas.

Untuk memahami kekuatan dan kelemahan dari kerangka kerja yang beragam ini secara objektif, diperlukan metodologi evaluasi yang kuat dan multi-faceted.

6.0 Evaluasi Kinerja: Metodologi dan Hasil Komparatif

Metrik generasi standar seperti ROUGE tidak cukup untuk sistem RAG, karena metrik tersebut gagal memberikan penalti pada inkonsistensi faktual atau "halusinasi" yang didasarkan pada bukti yang salah. Hal ini mendorong pengembangan kerangka kerja evaluasi multi-faceted yang menilai seluruh alur kerja, mulai dari keakuratan pengambilan hingga kesetiaan generatif. Kombinasi metrik otomatis dan penilaian manusia sangat penting untuk mendapatkan gambaran lengkap tentang efektivitas sebuah sistem.

Berbagai metrik evaluasi telah digunakan untuk mengukur aspek-aspek yang berbeda dari kinerja RAG:

* Metrik Kualitas Generasi:
  * ROUGE (ROUGE-1, ROUGE-2, ROUGE-L): Mengukur tumpang tindih n-gram (unigram, bigram, dan urutan umum terpanjang) antara teks yang dihasilkan dan jawaban referensi.
  * BERTScore: Mengukur kesamaan semantik antara teks yang dihasilkan dan referensi dengan membandingkan embedding token dari model BERT.
* Metrik Kualitas Pengambilan & Penalaran:
  * Akurasi Pengambilan Top-k: Mengukur persentase kueri di mana dokumen yang relevan ditemukan dalam k hasil teratas yang diambil (misalnya, Top-5, Top-20).
  * Exact Match (EM): Metrik ketat di mana jawaban yang dihasilkan harus sama persis dengan jawaban referensi.
  * F1 Score: Rata-rata harmonik dari presisi dan recall pada tingkat kata.
* Metrik Kualitas Spesifik RAG (RAGAS):
  * Faithfulness: Menilai sejauh mana jawaban yang dihasilkan didukung oleh konteks yang diambil, untuk mengukur halusinasi.
  * Answer Relevance: Mengukur seberapa relevan jawaban yang dihasilkan dengan pertanyaan asli.
  * Context Relevance: Mengevaluasi apakah konteks yang diambil benar-benar diperlukan untuk menjawab pertanyaan, dengan memberikan penalti pada informasi yang berlebihan.
* Evaluasi Manusia dan Kualitatif:
  * Peringkat Ahli: Spesialis domain (misalnya, dua teknolog radiologi [satu dengan keahlian dalam kedokteran nuklir] dan seorang fisikawan medis) menilai kualitas jawaban berdasarkan skala yang telah ditentukan.
  * Skor Kepuasan Pengguna: Pengguna akhir memberikan peringkat pada aspek-aspek seperti kemudahan penggunaan dan kualitas jawaban secara keseluruhan.

Hasil kinerja komparatif dari berbagai studi menyoroti kekuatan relatif dari model dan kerangka kerja yang berbeda. Tabel berikut merangkum beberapa temuan utama:

Model / Kerangka Kerja	Metrik	Hasil	Sumber
DPR vs. BM25	Akurasi Top-5 (NQ)	65.2% vs. 42.9%	Dense_Passage_Retrieval...pdf
RAG-end2end vs. RAG-original	EM (COVID-19 Domain)	8.32 vs. 3.66	Improving_the_Domain...pdf
Mistral 7B (Fine-tuned RAG)	F1 BERTScore	0.9151	QnA Chatbot with Mistral...pdf
GPT-4	F1 BERTScore	0.8364	QnA Chatbot with Mistral...pdf
GPT-4o + Hybrid Retrieval	Skor Evaluasi Manusia	84.0 / 100	Evaluation_of_a_retrieval...pdf
GastroBot (Fine-tuned Embed.)	Peningkatan Hit Rate	+20% vs. OpenAI	GastroBot_a_Chinese...pdf

Temuan-temuan ini secara kolektif menunjukkan tren yang jelas: arsitektur yang lebih canggih dan terspesialisasi secara konsisten mengungguli pendekatan yang lebih umum.

7.0 Kesimpulan: Sintesis Temuan dan Arah Masa Depan

Analisis ini melacak evolusi Retrieval-Augmented Generation (RAG) dari arsitektur pengambilan sederhana menjadi kerangka kerja agentic canggih yang mampu melakukan penalaran multi-langkah. Perjalanan ini didorong oleh kebutuhan untuk mengatasi keterbatasan inheren dari LLM dengan mengintegrasikannya dengan sumber pengetahuan eksternal yang dinamis dan dapat diverifikasi.

Temuan-temuan utama dari analisis komparatif ini adalah sebagai berikut:

* Keunggulan Dense Retrieval: Metode dense retrieval secara konsisten mengungguli pendekatan sparse dalam tugas-tugas yang menuntut pemahaman semantik, yang secara efektif mengatasi masalah lexical gap.
* Dampak Pelatihan End-to-End: Pelatihan bersama komponen retriever dan generator (seperti dalam RAG-end2end) sangat krusial untuk adaptasi domain yang optimal, sebuah area di mana RAG asli kesulitan.
* Kekuatan Agentic RAG: Untuk kueri yang kompleks dan multi-langkah, kerangka kerja agentic (misalnya, Multi-Agent, Plan-RAG) sangat penting, memungkinkan sistem untuk memecahkan masalah yang jauh di luar jangkauan RAG standar.
* Pentingnya Evaluasi Holistik: Validasi yang kuat dari sistem RAG bergantung pada kombinasi metrik otomatis dan penilaian kualitatif dari manusia untuk menangkap kinerja sistem secara menyeluruh.

Meskipun kemajuan yang telah dicapai sangat besar, penelitian di bidang RAG masih terus berkembang pesat. Arah penelitian masa depan yang menjanjikan meliputi:

* Peningkatan Keandalan Agen Validasi: Mengembangkan agen yang lebih kuat untuk memvalidasi informasi dan secara andal memblokir konten yang berbahaya, tidak akurat, atau tidak ilmiah adalah prioritas utama untuk aplikasi di domain sensitif.
* Eksplorasi Pra-Pelatihan Bersama (Joint Pre-training): Evolusi logis dari fine-tuning bersama adalah pre-training bersama. Pendekatan ini berhipotesis bahwa dengan mempelajari tugas pengambilan dan generasi dari awal pada korpus masif, sinergi yang lebih fundamental dan terintegrasi secara mendalam akan muncul antara komponen parametrik dan non-parametrik.
* Penyempurnaan Strategi Chunking dan Prompting: Ini tetap menjadi area penelitian empiris yang krusial, karena strategi chunking merepresentasikan pertukaran antara kelengkapan semantik (chunk yang lebih besar) dan presisi pengambilan (chunk yang lebih kecil). Strategi optimal kemungkinan besar bergantung pada tugas dan data, yang memerlukan penyelidikan lebih lanjut ke dalam metode chunking adaptif atau hierarkis.

Evolusi dari pengambilan statis ke perencanaan yang dinamis dan agentic menunjukkan masa depan di mana sistem RAG bertransisi dari "pengambil informasi" menjadi "pemecah masalah". Batasan berikutnya kemungkinan besar tidak hanya melibatkan pengambilan data, tetapi juga simulasi hasil secara proaktif, mengkritik bukti dari berbagai sumber yang saling bertentangan, dan menghasilkan hipotesis baru—menggerakkan RAG lebih dekat ke mesin penalaran ilmiah yang sesungguhnya.
