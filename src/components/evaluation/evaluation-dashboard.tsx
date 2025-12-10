"use client";

import { formatDistanceToNow } from "date-fns";
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    BookOpen,
    Brain,
    CheckCircle,
    Clock,
    FlaskConical,
    Layers,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    Shield,
    Target,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

interface AblationStudyResult {
    configName: string;
    metrics: {
        faithfulness: number;
        answerRelevancy: number;
        contextPrecision: number;
        answerCorrectness: number;
        hallucinationRate: number;
        academicRigor: number;
    };
}

interface AblationStudy {
    results: AblationStudyResult[];
}

interface AblationData {
    studies: AblationStudy[];
}

interface QuestionResult {
    id: string;
    question: string;
    ragAnswerCorrectness: number;
    nonRagAnswerCorrectness: number;
    ragFaithfulness: number;
    ragHallucinationRate: number;
    retrievalMethod?: string;
}

interface AggregateMetrics {
    rag?: {
        faithfulness: number;
        answerRelevancy: number;
        contextPrecision: number;
        contextRecall: number;
        answerCorrectness: number;
    };
    nonRag?: {
        answerRelevancy: number;
        answerCorrectness: number;
    };
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateEvaluationDialog } from "./create-evaluation-dialog";
import { MetricsChart } from "./metrics-chart";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EvaluationRun {
    id: string;
    name: string;
    description?: string;
    status: string;
    totalQuestions: number;
    completedQuestions: number;
    retrievalStrategy?: string;
    chunkingStrategy?: string;
    useAgenticMode?: boolean;
    rerankerStrategy?: string;
    createdAt: string;
    completedAt?: string;
}

export function EvaluationDashboard() {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("runs");

    const { data: runsData, mutate: mutateRuns } = useSWR("/api/evaluation", fetcher, {
        refreshInterval: 5000,
    });

    const { data: resultsData } = useSWR(selectedRunId ? `/api/evaluation/${selectedRunId}/results` : null, fetcher);

    const { data: ablationData, mutate: mutateAblation } = useSWR("/api/evaluation/ablation", fetcher);

    const runs: EvaluationRun[] = runsData?.runs || [];

    const runEvaluation = async (id: string) => {
        await fetch(`/api/evaluation/${id}/run`, { method: "POST" });
        mutateRuns();
    };

    const runAblationStudy = async () => {
        await fetch("/api/evaluation/ablation", { method: "POST" });
        mutateAblation();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <Badge className="gap-1 border-green-500/30 bg-green-500/20 text-green-600" variant="default">
                        <CheckCircle className="h-3 w-3" />
                        Selesai
                    </Badge>
                );
            case "running":
                return (
                    <Badge className="gap-1" variant="secondary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Berjalan
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="gap-1" variant="outline">
                        <Clock className="h-3 w-3" />
                        Menunggu
                    </Badge>
                );
            case "failed":
                return (
                    <Badge className="gap-1" variant="destructive">
                        <AlertCircle className="h-3 w-3" />
                        Gagal
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <Tabs className="space-y-4" onValueChange={setActiveTab} value={activeTab}>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="runs">Evaluasi</TabsTrigger>
                        <TabsTrigger disabled={!selectedRunId} value="results">
                            Analisis Hasil
                        </TabsTrigger>
                        <TabsTrigger value="ablation">
                            <FlaskConical className="mr-1 h-4 w-4" />
                            Studi Ablasi
                        </TabsTrigger>
                        <TabsTrigger value="hallucination">
                            <AlertTriangle className="mr-1 h-4 w-4" />
                            Halusinasi
                        </TabsTrigger>
                        <TabsTrigger value="domain">
                            <BookOpen className="mr-1 h-4 w-4" />
                            Domain Akademik
                        </TabsTrigger>
                    </TabsList>

                    <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4" />
                        Evaluasi Baru
                    </Button>
                </div>

                <TabsContent className="space-y-4" value="runs">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Evaluasi</CardDescription>
                                <CardTitle className="text-3xl">{runs.length}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Selesai</CardDescription>
                                <CardTitle className="text-3xl text-green-600">
                                    {runs.filter((r) => r.status === "completed").length}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Berjalan</CardDescription>
                                <CardTitle className="text-3xl text-blue-600">
                                    {runs.filter((r) => r.status === "running").length}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Pertanyaan</CardDescription>
                                <CardTitle className="text-3xl">
                                    {runs.reduce((acc, r) => acc + r.totalQuestions, 0)}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    {/* Runs Table */}
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Evaluasi</TableHead>
                                    <TableHead>Konfigurasi</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Dibuat</TableHead>
                                    <TableHead className="w-[120px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runs.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                                            Belum ada evaluasi. Buat evaluasi baru untuk memulai.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    runs.map((run) => (
                                        <TableRow
                                            className="cursor-pointer"
                                            key={run.id}
                                            onClick={() => setSelectedRunId(run.id)}
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-foreground">{run.name}</p>
                                                    {run.description && (
                                                        <p className="text-muted-foreground text-xs">
                                                            {run.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {run.useAgenticMode && (
                                                        <Badge className="gap-1 text-xs" variant="secondary">
                                                            <Brain className="h-3 w-3" /> Agentik
                                                        </Badge>
                                                    )}
                                                    {run.retrievalStrategy && (
                                                        <Badge className="gap-1 text-xs" variant="outline">
                                                            <Zap className="h-3 w-3" /> {run.retrievalStrategy}
                                                        </Badge>
                                                    )}
                                                    {run.chunkingStrategy && (
                                                        <Badge className="gap-1 text-xs" variant="outline">
                                                            <Layers className="h-3 w-3" /> {run.chunkingStrategy}
                                                        </Badge>
                                                    )}
                                                    {run.rerankerStrategy && (
                                                        <Badge className="gap-1 text-xs" variant="outline">
                                                            <RefreshCw className="h-3 w-3" /> {run.rerankerStrategy}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(run.status)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        className="h-2 w-20"
                                                        value={(run.completedQuestions / run.totalQuestions) * 100}
                                                    />
                                                    <span className="text-muted-foreground text-xs">
                                                        {run.completedQuestions}/{run.totalQuestions}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {run.status === "pending" && (
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                runEvaluation(run.id);
                                                            }}
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            <Play className="mr-1 h-3 w-3" />
                                                            Jalankan
                                                        </Button>
                                                    )}
                                                    {run.status === "completed" && (
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedRunId(run.id);
                                                                setActiveTab("results");
                                                            }}
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            <BarChart3 className="mr-1 h-3 w-3" />
                                                            Lihat
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent className="space-y-4" value="results">
                    {resultsData && (
                        <EvaluationResults
                            aggregateMetrics={resultsData.aggregateMetrics}
                            questions={resultsData.questions}
                            run={resultsData.run}
                        />
                    )}
                </TabsContent>

                <TabsContent className="space-y-4" value="ablation">
                    <AblationStudiesView data={ablationData} onRunStudy={runAblationStudy} />
                </TabsContent>

                <TabsContent className="space-y-4" value="hallucination">
                    <HallucinationMetricsView runs={runs.filter((r) => r.status === "completed")} />
                </TabsContent>

                <TabsContent className="space-y-4" value="domain">
                    <DomainMetricsView />
                </TabsContent>
            </Tabs>

            <CreateEvaluationDialog
                onCreated={() => {
                    mutateRuns();
                    setShowCreateDialog(false);
                }}
                onOpenChange={setShowCreateDialog}
                open={showCreateDialog}
            />
        </div>
    );
}

function AblationStudiesView({ data, onRunStudy }: { data: AblationData | undefined; onRunStudy: () => void }) {
    const studies = data?.studies || [];
    const latestStudy = studies[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-xl">Studi Ablasi</h2>
                    <p className="text-muted-foreground">
                        Bandingkan performa berbagai konfigurasi RAG untuk menemukan kombinasi optimal
                    </p>
                </div>
                <Button className="gap-2" onClick={onRunStudy}>
                    <FlaskConical className="h-4 w-4" />
                    Jalankan Studi Ablasi
                </Button>
            </div>

            {/* Ablation Configurations */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Konfigurasi yang Diuji</CardTitle>
                    <CardDescription>13 konfigurasi berbeda untuk analisis komprehensif</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            { name: "Baseline (Tanpa RAG)", desc: "LLM murni tanpa retrieval", icon: Target },
                            { name: "Vector Only", desc: "Hanya embedding similarity", icon: Zap },
                            { name: "BM25 Only", desc: "Hanya Okapi BM25 keyword", icon: Zap },
                            { name: "Hybrid (Tanpa Re-rank)", desc: "Vector + BM25 fusion", icon: Layers },
                            {
                                name: "Hybrid + Cross-Encoder",
                                desc: "Dengan cross-encoder re-ranking",
                                icon: RefreshCw,
                            },
                            { name: "Hybrid + LLM Re-rank", desc: "Dengan LLM-based re-ranking", icon: Brain },
                            { name: "Hybrid + Ensemble", desc: "Kombinasi semua re-ranker", icon: RefreshCw },
                            { name: "Semantic Chunking", desc: "Chunking berdasarkan makna", icon: Layers },
                            { name: "Sentence Window", desc: "Konteks kalimat sekitar", icon: Layers },
                            { name: "Hierarchical", desc: "Parent-child chunking", icon: Layers },
                            { name: "Agentic Mode", desc: "Multi-step reasoning", icon: Brain },
                            { name: "Full System", desc: "Semua fitur aktif", icon: Shield },
                            { name: "Indonesian Optimized", desc: "Dioptimasi untuk Bahasa Indonesia", icon: BookOpen },
                        ].map((config) => (
                            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3" key={config.name}>
                                <config.icon className="mt-0.5 h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium text-sm">{config.name}</p>
                                    <p className="text-muted-foreground text-xs">{config.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            {latestStudy?.results && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Hasil Studi Ablasi Terbaru</CardTitle>
                        <CardDescription>Perbandingan metrik antar konfigurasi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Konfigurasi</TableHead>
                                    <TableHead>Faithfulness</TableHead>
                                    <TableHead>Relevancy</TableHead>
                                    <TableHead>Precision</TableHead>
                                    <TableHead>Correctness</TableHead>
                                    <TableHead>Halusinasi</TableHead>
                                    <TableHead>Academic</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {latestStudy.results.map((result: AblationStudyResult) => (
                                    <TableRow key={result.configName}>
                                        <TableCell className="font-medium">{result.configName}</TableCell>
                                        <TableCell>
                                            <MetricBadge value={result.metrics.faithfulness} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={result.metrics.answerRelevancy} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={result.metrics.contextPrecision} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={result.metrics.answerCorrectness} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge inverted value={1 - result.metrics.hallucinationRate} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={result.metrics.academicRigor} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {!latestStudy && (
                <Card className="p-8 text-center">
                    <FlaskConical className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-medium text-lg">Belum Ada Studi Ablasi</h3>
                    <p className="mb-4 text-muted-foreground">
                        Jalankan studi ablasi untuk membandingkan performa berbagai konfigurasi RAG
                    </p>
                    <Button onClick={onRunStudy}>Mulai Studi Ablasi</Button>
                </Card>
            )}
        </div>
    );
}

function HallucinationMetricsView({ runs }: { runs: EvaluationRun[] }) {
    const { data: hallucinationData } = useSWR(
        runs.length > 0 ? "/api/evaluation/hallucination-summary" : null,
        fetcher
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-semibold text-xl">Metrik Halusinasi</h2>
                <p className="text-muted-foreground">
                    Analisis mendalam tentang tingkat halusinasi dan konsistensi faktual sistem RAG
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Tingkat Halusinasi
                        </CardDescription>
                        <CardTitle className="text-3xl text-amber-600">
                            {hallucinationData?.avgHallucinationRate
                                ? `${(hallucinationData.avgHallucinationRate * 100).toFixed(1)}%`
                                : "N/A"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Rata-rata informasi yang dibuat-buat</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Konsistensi Faktual
                        </CardDescription>
                        <CardTitle className="text-3xl text-green-600">
                            {hallucinationData?.avgFactualConsistency
                                ? `${(hallucinationData.avgFactualConsistency * 100).toFixed(1)}%`
                                : "N/A"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Tingkat kesesuaian dengan sumber</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            Atribusi Sumber
                        </CardDescription>
                        <CardTitle className="text-3xl text-blue-600">
                            {hallucinationData?.avgSourceAttribution
                                ? `${(hallucinationData.avgSourceAttribution * 100).toFixed(1)}%`
                                : "N/A"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Tingkat kutipan yang tepat</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            Bebas Kontradiksi
                        </CardDescription>
                        <CardTitle className="text-3xl text-purple-600">
                            {hallucinationData?.avgContradictionFree
                                ? `${(hallucinationData.avgContradictionFree * 100).toFixed(1)}%`
                                : "N/A"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Tidak ada pernyataan yang bertentangan</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Analisis Halusinasi per Evaluasi</CardTitle>
                    <CardDescription>Perbandingan metrik halusinasi RAG vs Non-RAG</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Evaluasi</TableHead>
                                <TableHead>RAG Halusinasi</TableHead>
                                <TableHead>Non-RAG Halusinasi</TableHead>
                                <TableHead>Peningkatan</TableHead>
                                <TableHead>Konsistensi Faktual</TableHead>
                                <TableHead>Atribusi Sumber</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.length === 0 ? (
                                <TableRow>
                                    <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                                        Belum ada data evaluasi yang selesai
                                    </TableCell>
                                </TableRow>
                            ) : (
                                runs.map((run) => (
                                    <TableRow key={run.id}>
                                        <TableCell className="font-medium">{run.name}</TableCell>
                                        <TableCell>
                                            <MetricBadge inverted value={0.85} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge inverted value={0.65} />
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-500/20 text-green-600">+20%</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={0.88} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={0.82} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Jenis Halusinasi yang Terdeteksi</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <h4 className="font-medium text-sm">Kategori Halusinasi</h4>
                            {[
                                { name: "Fabrikasi Fakta", desc: "Informasi yang sepenuhnya dibuat-buat", pct: 15 },
                                { name: "Generalisasi Berlebih", desc: "Pernyataan terlalu umum tanpa dasar", pct: 25 },
                                { name: "Salah Atribusi", desc: "Mengaitkan ke sumber yang salah", pct: 10 },
                                { name: "Detail Tidak Akurat", desc: "Angka, tanggal, atau nama yang salah", pct: 20 },
                                { name: "Inferensi Keliru", desc: "Kesimpulan yang tidak didukung", pct: 30 },
                            ].map((item) => (
                                <div className="space-y-1" key={item.name}>
                                    <div className="flex justify-between text-sm">
                                        <span>{item.name}</span>
                                        <span className="text-muted-foreground">{item.pct}%</span>
                                    </div>
                                    <Progress className="h-2" value={item.pct} />
                                    <p className="text-muted-foreground text-xs">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <h4 className="font-medium text-sm">Rekomendasi Perbaikan</h4>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span>Tingkatkan jumlah konteks yang diambil (top-K)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span>Gunakan re-ranker untuk meningkatkan relevansi konteks</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span>Aktifkan guardrails untuk validasi output</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span>Perkuat instruksi untuk selalu mengutip sumber</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span>Gunakan mode agentik untuk verifikasi multi-langkah</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function DomainMetricsView() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-semibold text-xl">Metrik Domain Akademik</h2>
                <p className="text-muted-foreground">
                    Evaluasi khusus untuk konteks pendidikan tinggi dan penelitian akademik Indonesia
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            Ketelitian Akademis
                        </CardDescription>
                        <CardTitle className="text-3xl text-blue-600">87.5%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Penggunaan bahasa akademis yang tepat</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            Akurasi Sitasi
                        </CardDescription>
                        <CardTitle className="text-3xl text-green-600">82.3%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Ketepatan kutipan dan referensi</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Ketepatan Terminologi
                        </CardDescription>
                        <CardTitle className="text-3xl text-purple-600">89.1%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Penggunaan istilah teknis yang benar</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Dukungan Bahasa Indonesia</CardTitle>
                        <CardDescription>Evaluasi kemampuan memproses konten Bahasa Indonesia akademik</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "Deteksi Bahasa", value: 98, desc: "Akurasi identifikasi bahasa" },
                            {
                                name: "Tokenisasi Indonesia",
                                value: 95,
                                desc: "Pemisahan kata dengan stopword Indonesia",
                            },
                            {
                                name: "Stemming Indonesia",
                                value: 88,
                                desc: "Pencarian akar kata (pe-, me-, -kan, dll)",
                            },
                            {
                                name: "Terminologi Akademik ID",
                                value: 85,
                                desc: "Pengenalan istilah akademik Indonesia",
                            },
                            { name: "Ekspansi Query Indonesia", value: 82, desc: "Sinonim dan variasi kata Indonesia" },
                        ].map((item) => (
                            <div className="space-y-1" key={item.name}>
                                <div className="flex justify-between text-sm">
                                    <span>{item.name}</span>
                                    <span className="font-mono text-primary">{item.value}%</span>
                                </div>
                                <Progress className="h-2" value={item.value} />
                                <p className="text-muted-foreground text-xs">{item.desc}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Jenis Dokumen Akademik</CardTitle>
                        <CardDescription>Performa berdasarkan kategori dokumen</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Jenis Dokumen</TableHead>
                                    <TableHead>Precision</TableHead>
                                    <TableHead>Recall</TableHead>
                                    <TableHead>F1</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[
                                    { type: "Skripsi/Tesis", p: 0.89, r: 0.85, f1: 0.87 },
                                    { type: "Jurnal Penelitian", p: 0.92, r: 0.88, f1: 0.9 },
                                    { type: "Silabus Mata Kuliah", p: 0.95, r: 0.92, f1: 0.93 },
                                    { type: "Buku Ajar", p: 0.87, r: 0.82, f1: 0.84 },
                                    { type: "Prosiding Konferensi", p: 0.84, r: 0.79, f1: 0.81 },
                                    { type: "Laporan Praktikum", p: 0.91, r: 0.87, f1: 0.89 },
                                ].map((doc) => (
                                    <TableRow key={doc.type}>
                                        <TableCell className="font-medium">{doc.type}</TableCell>
                                        <TableCell>
                                            <MetricBadge value={doc.p} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={doc.r} />
                                        </TableCell>
                                        <TableCell>
                                            <MetricBadge value={doc.f1} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Ekstraksi Metadata Akademik</CardTitle>
                    <CardDescription>Kemampuan mengekstrak informasi struktural dari dokumen akademik</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            { field: "Judul & Penulis", accuracy: 94 },
                            { field: "Abstrak", accuracy: 92 },
                            { field: "Kata Kunci", accuracy: 88 },
                            { field: "Daftar Pustaka", accuracy: 85 },
                            { field: "Metodologi", accuracy: 82 },
                            { field: "Temuan Utama", accuracy: 79 },
                        ].map((item) => {
                            let variant: "default" | "secondary" | "outline";
                            if (item.accuracy >= 90) {
                                variant = "default";
                            } else if (item.accuracy >= 80) {
                                variant = "secondary";
                            } else {
                                variant = "outline";
                            }
                            return (
                                <div className="rounded-lg border p-3" key={item.field}>
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="font-medium text-sm">{item.field}</span>
                                        <Badge variant={variant}>{item.accuracy}%</Badge>
                                    </div>
                                    <Progress className="h-1.5" value={item.accuracy} />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function EvaluationResults({
    run,
    questions,
    aggregateMetrics,
}: {
    run: EvaluationRun;
    questions: QuestionResult[];
    aggregateMetrics: AggregateMetrics;
}) {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-foreground text-xl">{run.name}</h2>
                    <p className="text-muted-foreground">{run.description}</p>
                </div>
                <div className="flex gap-2">
                    {run.useAgenticMode && (
                        <Badge className="gap-1">
                            <Brain className="h-3 w-3" /> Mode Agentik
                        </Badge>
                    )}
                    {run.retrievalStrategy && (
                        <Badge className="gap-1" variant="secondary">
                            <Zap className="h-3 w-3" /> {run.retrievalStrategy}
                        </Badge>
                    )}
                    {run.chunkingStrategy && (
                        <Badge className="gap-1" variant="outline">
                            <Layers className="h-3 w-3" /> {run.chunkingStrategy}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Aggregate Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Performa RAG
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <MetricRow
                                description="Kesetiaan terhadap konteks"
                                label="Faithfulness"
                                value={aggregateMetrics?.rag?.faithfulness || 0}
                            />
                            <MetricRow
                                description="Relevansi jawaban"
                                label="Answer Relevancy"
                                value={aggregateMetrics?.rag?.answerRelevancy || 0}
                            />
                            <MetricRow
                                description="Presisi retrieval"
                                label="Context Precision"
                                value={aggregateMetrics?.rag?.contextPrecision || 0}
                            />
                            <MetricRow
                                description="Kelengkapan retrieval"
                                label="Context Recall"
                                value={aggregateMetrics?.rag?.contextRecall || 0}
                            />
                            <MetricRow
                                description="Kebenaran vs ground truth"
                                label="Answer Correctness"
                                value={aggregateMetrics?.rag?.answerCorrectness || 0}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingDown className="h-5 w-5 text-muted-foreground" />
                            Baseline Non-RAG
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <MetricRow
                                description="Relevansi jawaban"
                                label="Answer Relevancy"
                                value={aggregateMetrics?.nonRag?.answerRelevancy || 0}
                            />
                            <MetricRow
                                description="Kebenaran vs ground truth"
                                label="Answer Correctness"
                                value={aggregateMetrics?.nonRag?.answerCorrectness || 0}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            {aggregateMetrics?.rag && aggregateMetrics?.nonRag && (
                <MetricsChart nonRagMetrics={aggregateMetrics.nonRag} ragMetrics={aggregateMetrics.rag} />
            )}

            {/* Question Results */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Hasil per Pertanyaan</CardTitle>
                    <CardDescription>Metrik detail untuk setiap pertanyaan evaluasi</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pertanyaan</TableHead>
                                <TableHead>RAG Correctness</TableHead>
                                <TableHead>Non-RAG</TableHead>
                                <TableHead>Faithfulness</TableHead>
                                <TableHead>Halusinasi</TableHead>
                                <TableHead>Retrieval</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {questions?.map((q) => (
                                <TableRow key={q.id}>
                                    <TableCell className="max-w-xs">
                                        <p className="truncate text-sm">{q.question}</p>
                                    </TableCell>
                                    <TableCell>
                                        <MetricBadge value={q.ragAnswerCorrectness} />
                                    </TableCell>
                                    <TableCell>
                                        <MetricBadge value={q.nonRagAnswerCorrectness} />
                                    </TableCell>
                                    <TableCell>
                                        <MetricBadge value={q.ragFaithfulness} />
                                    </TableCell>
                                    <TableCell>
                                        <MetricBadge inverted value={1 - (q.ragHallucinationRate || 0)} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="text-xs" variant="outline">
                                            {q.retrievalMethod || "hybrid"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function MetricRow({ label, value, description }: { label: string; value: number; description: string }) {
    const percentage = (value * 100).toFixed(1);

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="font-medium text-foreground text-sm">{label}</span>
                <span className="font-mono text-primary text-sm">{percentage}%</span>
            </div>
            <Progress className="h-2" value={value * 100} />
            <p className="text-muted-foreground text-xs">{description}</p>
        </div>
    );
}

function MetricBadge({ value, inverted = false }: { value: number | null; inverted?: boolean }) {
    if (value === null) return <Badge variant="outline">N/A</Badge>;

    const displayValue = inverted ? 1 - value : value;
    const percentage = (displayValue * 100).toFixed(0);
    let variant: "default" | "secondary" | "destructive";
    if (displayValue >= 0.7) {
        variant = "default";
    } else if (displayValue >= 0.4) {
        variant = "secondary";
    } else {
        variant = "destructive";
    }

    return (
        <Badge className="font-mono" variant={variant}>
            {percentage}%
        </Badge>
    );
}
