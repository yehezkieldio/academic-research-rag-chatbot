"use client";

import {
    AlertCircle,
    CheckCircle,
    Eye,
    FileText,
    GitBranch,
    GraduationCap,
    Languages,
    Layers,
    Loader2,
    Type,
    Upload,
    X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ChunkingStrategy = "recursive" | "semantic" | "sentence_window" | "hierarchical";
type LanguageHint = "auto" | "en" | "id";

interface UploadFile {
    id: string;
    file: File;
    progress: number;
    status: "pending" | "uploading" | "processing" | "completed" | "error";
    error?: string;
    documentId?: string;
}

interface DocumentUploaderProps {
    onUploadComplete?: () => void;
}

export function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [useMistralOcr, setUseMistralOcr] = useState(false);
    const [chunkingStrategy, setChunkingStrategy] = useState<ChunkingStrategy>("recursive");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState("");
    const [documentType, setDocumentType] = useState<string>("auto");
    const [languageHint, setLanguageHint] = useState<LanguageHint>("auto");

    const generateFileId = useCallback(
        (file: File) =>
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? (crypto as { randomUUID: () => string }).randomUUID()
                : `${file.name.replace(/\s+/g, "-")}-${file.size}-${file.lastModified}-${Math.random()
                      .toString(36)
                      .slice(2, 9)}`,
        []
    );

    const languageLabelMap: Record<LanguageHint, string> = {
        auto: "Auto",
        en: "EN",
        id: "ID",
    };

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
                id: generateFileId(file),
                file,
                progress: 0,
                status: "pending",
            }));
            setFiles((prev) => [...prev, ...newFiles]);
        },
        [generateFileId]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "text/plain": [".txt"],
            "text/markdown": [".md"],
        },
        maxSize: 50 * 1024 * 1024,
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const uploadFile = async (fileItem: UploadFile, index: number) => {
        setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 10 } : f)));

        try {
            const formData = new FormData();
            formData.append("file", fileItem.file);
            formData.append("useMistralOcr", String(useMistralOcr));
            formData.append("chunkingStrategy", chunkingStrategy);
            formData.append("documentType", documentType);
            formData.append("languageHint", languageHint);
            if (category) formData.append("category", category);
            if (tags) formData.append("tags", tags);

            setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, progress: 30 } : f)));

            const response = await fetch("/api/documents/upload", {
                method: "POST",
                body: formData,
            });

            setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, progress: 60 } : f)));

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Upload failed");
            }

            const result = await response.json();

            setFiles((prev) =>
                prev.map((f, i) =>
                    i === index
                        ? {
                              ...f,
                              status: "processing",
                              progress: 80,
                              documentId: result.document.id,
                          }
                        : f
                )
            );

            setTimeout(() => {
                setFiles((prev) =>
                    prev.map((f, i) => (i === index ? { ...f, status: "completed", progress: 100 } : f))
                );
                onUploadComplete?.();
            }, 2000);
        } catch (error) {
            setFiles((prev) =>
                prev.map((f, i) =>
                    i === index
                        ? {
                              ...f,
                              status: "error",
                              error: error instanceof Error ? error.message : "Upload failed",
                          }
                        : f
                )
            );
        }
    };

    const uploadAll = async () => {
        for (let i = 0; i < files.length; i++) {
            if (files[i].status === "pending") {
                await uploadFile(files[i], i);
            }
        }
    };

    const pendingCount = files.filter((f) => f.status === "pending").length;

    const chunkingDescriptions: Record<ChunkingStrategy, string> = {
        recursive: "Split by structure (paragraphs, sentences) with overlap",
        semantic: "Split by topic/meaning changes using embeddings",
        sentence_window: "Individual sentences with surrounding context",
        hierarchical: "Parent-child chunk relationships for multi-level retrieval",
    };

    return (
        <div className="space-y-6">
            {/* Upload Zone */}
            <div
                {...getRootProps()}
                className={cn(
                    "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-4">
                        <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            {isDragActive ? "Lepaskan file di sini" : "Seret & lepaskan file di sini"}
                        </p>
                        <p className="mt-1 text-muted-foreground text-sm">
                            atau klik untuk memilih. Mendukung file PDF, TXT, MD hingga 50MB
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">Mendukung dokumen Bahasa Indonesia</p>
                    </div>
                </div>
            </div>

            {/* Options */}
            <Card className="p-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center gap-3">
                        <Switch checked={useMistralOcr} id="mistral-ocr" onCheckedChange={setUseMistralOcr} />
                        <Label className="cursor-pointer" htmlFor="mistral-ocr">
                            <span className="flex items-center gap-1.5">
                                <Eye className="h-4 w-4" />
                                Use Mistral OCR
                            </span>
                            <span className="block text-muted-foreground text-xs">For scanned PDFs and images</span>
                        </Label>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                            <Layers className="h-4 w-4" />
                            Chunking Strategy
                        </Label>
                        <Select
                            onValueChange={(v: ChunkingStrategy) => setChunkingStrategy(v)}
                            value={chunkingStrategy}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recursive">
                                    <span className="flex items-center gap-2">
                                        <GitBranch className="h-3 w-3" /> Recursive
                                    </span>
                                </SelectItem>
                                <SelectItem value="semantic">
                                    <span className="flex items-center gap-2">
                                        <Type className="h-3 w-3" /> Semantic
                                    </span>
                                </SelectItem>
                                <SelectItem value="sentence_window">
                                    <span className="flex items-center gap-2">
                                        <Layers className="h-3 w-3" /> Sentence Window
                                    </span>
                                </SelectItem>
                                <SelectItem value="hierarchical">
                                    <span className="flex items-center gap-2">
                                        <GitBranch className="h-3 w-3" /> Hierarchical
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">{chunkingDescriptions[chunkingStrategy]}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                            <Languages className="h-4 w-4" />
                            Bahasa Dokumen
                        </Label>
                        <Select onValueChange={(v: LanguageHint) => setLanguageHint(v)} value={languageHint}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">Mempengaruhi tokenisasi & stopwords</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4" />
                            Document Type
                        </Label>
                        <Select onValueChange={setDocumentType} value={documentType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-80">
                                <SelectItem value="auto">🔍 Auto-detect</SelectItem>

                                {/* Traditional Academic */}
                                <SelectItem value="syllabus">📋 Syllabus / RPS</SelectItem>
                                <SelectItem value="lecture_notes">📝 Lecture Notes / Catatan Kuliah</SelectItem>
                                <SelectItem value="research_paper">📄 Research Paper / Makalah</SelectItem>
                                <SelectItem value="textbook">📚 Textbook / Buku Teks</SelectItem>
                                <SelectItem value="assignment">✏️ Assignment / Tugas</SelectItem>
                                <SelectItem value="exam">📝 Exam / Ujian</SelectItem>
                                <SelectItem value="skripsi">🎓 Skripsi (S1)</SelectItem>
                                <SelectItem value="tesis">🎓 Tesis (S2)</SelectItem>
                                <SelectItem value="disertasi">🎓 Disertasi (S3)</SelectItem>
                                <SelectItem value="lab_report">🔬 Lab Report / Laporan Praktikum</SelectItem>
                                <SelectItem value="modul_kuliah">📖 Modul Perkuliahan</SelectItem>

                                {/* Informasi Akademik */}
                                <SelectItem value="profil_prodi">🏫 Profil Program Studi</SelectItem>
                                <SelectItem value="cpl">🎯 Capaian Pembelajaran (CPL)</SelectItem>
                                <SelectItem value="kurikulum">📑 Struktur Kurikulum</SelectItem>
                                <SelectItem value="daftar_matkul">📋 Daftar Mata Kuliah</SelectItem>
                                <SelectItem value="kalender_akademik">📅 Kalender Akademik</SelectItem>
                                <SelectItem value="ketentuan_krs">📝 Ketentuan KRS/KHS</SelectItem>
                                <SelectItem value="ketentuan_ip">📊 Ketentuan IP/IPK</SelectItem>
                                <SelectItem value="syarat_kelulusan">✅ Syarat Kelulusan</SelectItem>
                                <SelectItem value="aturan_ta">📜 Aturan Skripsi/TA</SelectItem>
                                <SelectItem value="aturan_yudisium">🎓 Aturan Yudisium/Wisuda</SelectItem>

                                {/* Dokumen Regulasi */}
                                <SelectItem value="buku_pedoman_akademik">📕 Buku Pedoman Akademik</SelectItem>
                                <SelectItem value="buku_pedoman_kemahasiswaan">
                                    📗 Buku Pedoman Kemahasiswaan
                                </SelectItem>
                                <SelectItem value="peraturan_rektor">⚖️ Peraturan Rektor</SelectItem>
                                <SelectItem value="sk_akademik">📜 SK Akademik</SelectItem>
                                <SelectItem value="sop">📋 SOP Akademik/Administrasi</SelectItem>
                                <SelectItem value="tata_tertib">📖 Tata Tertib Mahasiswa</SelectItem>
                                <SelectItem value="panduan_etika">⚖️ Panduan Etika Akademik</SelectItem>
                                <SelectItem value="panduan_plagiarisme">🚫 Panduan Plagiarisme</SelectItem>

                                {/* Administrasi */}
                                <SelectItem value="prosedur_ukt">💳 Prosedur Pembayaran UKT</SelectItem>
                                <SelectItem value="prosedur_cuti">🏖️ Prosedur Cuti Akademik</SelectItem>
                                <SelectItem value="prosedur_surat_aktif">📄 Prosedur Surat Aktif</SelectItem>
                                <SelectItem value="prosedur_legalisir">✅ Prosedur Legalisir</SelectItem>
                                <SelectItem value="prosedur_pindah_prodi">🔄 Prosedur Pindah Prodi</SelectItem>
                                <SelectItem value="prosedur_magang">💼 Prosedur Magang/PKL</SelectItem>
                                <SelectItem value="jam_layanan">🕐 Jam Layanan</SelectItem>
                                <SelectItem value="formulir_administrasi">📝 Formulir Administrasi</SelectItem>
                                <SelectItem value="faq_layanan">❓ FAQ Layanan Akademik</SelectItem>

                                {/* Dosen */}
                                <SelectItem value="daftar_dosen">👨‍🏫 Daftar Dosen</SelectItem>
                                <SelectItem value="profil_dosen">👤 Profil Dosen</SelectItem>
                                <SelectItem value="jadwal_mengajar">📅 Jadwal Mengajar</SelectItem>
                                <SelectItem value="publikasi_dosen">📚 Publikasi Dosen</SelectItem>

                                {/* Penelitian */}
                                <SelectItem value="daftar_penelitian">🔬 Daftar Penelitian</SelectItem>
                                <SelectItem value="roadmap_penelitian">🗺️ Roadmap Penelitian</SelectItem>
                                <SelectItem value="hibah_penelitian">💰 Hibah Penelitian</SelectItem>
                                <SelectItem value="pengabdian">🤝 Pengabdian Masyarakat</SelectItem>
                                <SelectItem value="jurnal_kampus">📰 Jurnal Kampus</SelectItem>
                                <SelectItem value="prosiding">📑 Prosiding</SelectItem>
                                <SelectItem value="call_for_papers">📢 Call for Papers</SelectItem>

                                {/* Kemahasiswaan */}
                                <SelectItem value="pengumuman_mahasiswa">📢 Pengumuman Mahasiswa</SelectItem>
                                <SelectItem value="beasiswa">🎓 Informasi Beasiswa</SelectItem>
                                <SelectItem value="lomba_kompetisi">🏆 Lomba/Kompetisi</SelectItem>
                                <SelectItem value="ukm_organisasi">👥 UKM/Organisasi</SelectItem>
                                <SelectItem value="agenda_kampus">📅 Agenda Kampus</SelectItem>
                                <SelectItem value="prestasi_mahasiswa">🏅 Prestasi Mahasiswa</SelectItem>
                                <SelectItem value="kerjasama_industri">🏢 Kerjasama Industri</SelectItem>
                                <SelectItem value="layanan_konseling">💬 Layanan Konseling</SelectItem>

                                {/* Fasilitas */}
                                <SelectItem value="fasilitas_kampus">🏛️ Fasilitas Kampus</SelectItem>
                                <SelectItem value="fasilitas_lab">🔬 Fasilitas Laboratorium</SelectItem>
                                <SelectItem value="jadwal_lab">📅 Jadwal Lab</SelectItem>
                                <SelectItem value="peraturan_lab">📋 Peraturan Lab</SelectItem>
                                <SelectItem value="perpustakaan">📚 Perpustakaan</SelectItem>
                                <SelectItem value="denah_kampus">🗺️ Denah Kampus</SelectItem>
                                <SelectItem value="layanan_it">💻 Layanan IT</SelectItem>

                                {/* PMB */}
                                <SelectItem value="jalur_penerimaan">🚪 Jalur Penerimaan</SelectItem>
                                <SelectItem value="syarat_pendaftaran">📋 Syarat Pendaftaran</SelectItem>
                                <SelectItem value="biaya_kuliah">💰 Biaya Kuliah</SelectItem>
                                <SelectItem value="kuota_prodi">📊 Kuota Prodi</SelectItem>
                                <SelectItem value="panduan_pendaftaran">📖 Panduan Pendaftaran</SelectItem>
                                <SelectItem value="faq_pmb">❓ FAQ PMB</SelectItem>
                                <SelectItem value="jadwal_seleksi">📅 Jadwal Seleksi</SelectItem>
                                <SelectItem value="prosedur_registrasi">✅ Prosedur Registrasi</SelectItem>

                                {/* Keuangan */}
                                <SelectItem value="rincian_biaya">💵 Rincian Biaya</SelectItem>
                                <SelectItem value="alur_pembayaran">💳 Alur Pembayaran</SelectItem>
                                <SelectItem value="rekening_kampus">🏦 Rekening Kampus</SelectItem>
                                <SelectItem value="prosedur_refund">↩️ Prosedur Refund</SelectItem>
                                <SelectItem value="keterlambatan_bayar">⏰ Keterlambatan Bayar</SelectItem>
                                <SelectItem value="bantuan_biaya">🤝 Bantuan Biaya</SelectItem>

                                {/* Alumni */}
                                <SelectItem value="tracer_study">📊 Tracer Study</SelectItem>
                                <SelectItem value="statistik_lulusan">📈 Statistik Lulusan</SelectItem>
                                <SelectItem value="lowongan_alumni">💼 Lowongan Alumni</SelectItem>
                                <SelectItem value="ikatan_alumni">🤝 Ikatan Alumni</SelectItem>

                                {/* Humas */}
                                <SelectItem value="berita_kampus">📰 Berita Kampus</SelectItem>
                                <SelectItem value="rilis_pers">📢 Rilis Pers</SelectItem>
                                <SelectItem value="artikel_publik">📝 Artikel Publik</SelectItem>
                                <SelectItem value="dokumentasi_kegiatan">📸 Dokumentasi Kegiatan</SelectItem>
                                <SelectItem value="pengumuman_resmi">📋 Pengumuman Resmi</SelectItem>

                                <SelectItem value="other">📄 Other / Lainnya</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="category">Category / Kategori</Label>
                        <Input
                            id="category"
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="e.g., Computer Science / Ilmu Komputer"
                            value={category}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g., machine-learning, nlp, penelitian"
                            value={tags}
                        />
                    </div>
                </div>
            </Card>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">Files ({files.length})</h3>
                        {pendingCount > 0 && (
                            <Button onClick={uploadAll} size="sm">
                                Upload All ({pendingCount})
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {files.map((fileItem, index) => (
                            <Card className="p-3" key={fileItem.id}>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-muted p-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate font-medium text-foreground text-sm">
                                                {fileItem.file.name}
                                            </p>
                                            <Badge className="text-xs" variant="outline">
                                                {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                                            </Badge>
                                            <Badge className="text-xs" variant="secondary">
                                                {chunkingStrategy}
                                            </Badge>
                                            <Badge className="text-xs" variant="outline">
                                                {languageLabelMap[languageHint]}
                                            </Badge>
                                        </div>

                                        {fileItem.status !== "pending" && fileItem.status !== "completed" && (
                                            <Progress className="mt-2 h-1" value={fileItem.progress} />
                                        )}

                                        {fileItem.error && (
                                            <p className="mt-1 text-destructive text-xs">{fileItem.error}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {fileItem.status === "pending" && (
                                            <Button
                                                onClick={() => uploadFile(fileItem, index)}
                                                size="sm"
                                                variant="outline"
                                            >
                                                Upload
                                            </Button>
                                        )}

                                        {fileItem.status === "uploading" && (
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        )}

                                        {fileItem.status === "processing" && (
                                            <Badge className="gap-1" variant="secondary">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Processing
                                            </Badge>
                                        )}

                                        {fileItem.status === "completed" && (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        )}

                                        {fileItem.status === "error" && (
                                            <AlertCircle className="h-5 w-5 text-destructive" />
                                        )}

                                        {(fileItem.status === "pending" || fileItem.status === "error") && (
                                            <Button
                                                className="h-8 w-8"
                                                onClick={() => removeFile(index)}
                                                size="icon"
                                                variant="ghost"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
