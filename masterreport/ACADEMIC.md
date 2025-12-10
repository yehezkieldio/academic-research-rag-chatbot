# 🎓 Konteks Akademik - Academic RAG Chatbot

> Domain akademik, konteks universitas, dan penerapan sistem untuk layanan mahasiswa.

---

## 1. Latar Belakang Institusi

**Institusi:** Universitas Mulia
**Domain:** Layanan Akademik dan Administrasi Mahasiswa

### Permasalahan Layanan Tradisional
- Ketergantungan pada staf administrasi
- Inefisiensi komunikasi dan keterlambatan respons
- Skalabilitas terbatas dengan pertumbuhan populasi mahasiswa

### Kebutuhan Domain Spesifik
- Pertanyaan mengenai **KRS** (Kartu Rencana Studi)
- Prosedur **Cuti Akademik**
- Syarat dan ketentuan **Beasiswa**
- Panduan **Tugas Akhir/Skripsi**
- Aturan dan regulasi akademik

---

## 2. Tantangan Domain Akademik

### 2.1 Karakteristik Query Akademik
| Tipe Query | Contoh | Tantangan |
|------------|--------|-----------|
| Faktual | "Kapan batas akhir KRS?" | Butuh informasi terkini |
| Prosedural | "Bagaimana cara mengajukan cuti?" | Multi-langkah |
| Komparatif | "Bandingkan syarat beasiswa A dan B" | Multi-dokumen |
| Interpretif | "Apa yang dimaksud dengan IPK minimum?" | Konteks lokal |

### 2.2 Terminologi Spesifik

| Istilah Indonesia | Deskripsi |
|-------------------|-----------|
| KRS | Kartu Rencana Studi |
| KHS | Kartu Hasil Studi |
| IPK | Indeks Prestasi Kumulatif |
| SKS | Satuan Kredit Semester |
| Cuti Akademik | Academic Leave |
| DO | Drop Out |
| SP | Surat Peringatan |
| UTS/UAS | Ujian Tengah/Akhir Semester |
| TA | Tugas Akhir |
| SK Rektor | Surat Keputusan Rektor |

### 2.3 Isu Utama LLM pada Domain Akademik

1. **Halusinasi**: LLM menghasilkan informasi yang tidak sesuai aturan institusi
2. **Outdated Knowledge**: Model terlatih pada data historis, tidak mengetahui aturan terbaru
3. **Context Mismatch**: Aturan nasional vs aturan institusi lokal

---

## 3. Dokumen Sumber

### Jenis Dokumen dalam Knowledge Base
| Kategori | Contoh | Format |
|----------|--------|--------|
| Regulasi | SK Rektor, Peraturan Akademik | PDF |
| Panduan | Buku Panduan Akademik | PDF/DOC |
| Prosedur | SOP Layanan Akademik | PDF |
| Kurikulum | Silabus, Rencana Pembelajaran | PDF |
| Referensi | Jurnal, Paper | PDF |

### Karakteristik Dokumen Akademik
- **Struktur hierarkis**: Bab, Bagian, Pasal, Ayat
- **Referensi silang**: Mengacu dokumen lain
- **Pembaruan berkala**: Setiap semester/tahun akademik
- **Bahasa formal**: Terminologi legal dan akademik

---

## 4. Pengguna Target

### 4.1 Mahasiswa
- Pertanyaan administratif (KRS, cuti, beasiswa)
- Pertanyaan akademik (kurikulum, nilai, wisuda)
- Dukungan penelitian (panduan TA/skripsi)

### 4.2 Staf Akademik
- Verifikasi prosedur
- Referensi cepat regulasi
- Konsistensi informasi

### 4.3 Peneliti/Evaluator
- Pengujian sistem RAG
- Analisis kualitas jawaban
- Benchmarking performa

---

## 5. Metrik Kualitas Domain-Spesifik

| Metrik | Deskripsi | Target |
|--------|-----------|--------|
| `academicRigor` | Ketepatan terminologi akademik | > 0.8 |
| `citationAccuracy` | Akurasi referensi ke dokumen sumber | > 0.9 |
| `terminologyCorrectness` | Penggunaan istilah yang benar | > 0.85 |
| `answerCompleteness` | Kelengkapan jawaban prosedural | > 0.8 |

---

## 6. Dukungan Bilingual

### Bahasa Indonesia
- Stemming khusus prefiks: `ber-`, `meng-`, `di-`, `ter-`
- Stopwords Indonesia
- Ekspansi sinonim akademik

### English
- Terminologi internasional
- Academic English conventions
- Cross-lingual query support

---

*Konteks akademik sistem Academic RAG Chatbot untuk Universitas Mulia.*
