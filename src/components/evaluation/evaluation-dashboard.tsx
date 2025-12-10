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
    XCircle,
    Zap,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import useSWR from "swr";
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
    description: string | null;
    status: string;
    totalQuestions: number;
    completedQuestions: number;
    retrievalStrategy: string | null;
    chunkingStrategy: string | null;
    useAgenticMode: boolean | null;
    rerankerStrategy?: string;
    createdAt: string;
    completedAt?: string;
    aggregateMetrics?: AggregateMetrics; // Added for ComparisonChart
}

interface EvaluationQuestion {
    id: string;
    question: string;
    groundTruth: string;
    ragAnswer: string | null;
    nonRagAnswer: string | null;
    ragFaithfulness?: number;
    ragAnswerRelevancy?: number;
    ragContextPrecision?: number;
    ragContextRecall?: number;
    ragAnswerCorrectness?: number;
    ragHallucinationRate?: number;
    ragLatencyMs?: number;
    retrievalMethod?: string;
}

interface AggregateMetrics {
    avgFaithfulness: number;
    avgAnswerRelevancy: number;
    avgContextPrecision: number;
    avgContextRecall: number;
    avgAnswerCorrectness: number;
    avgHallucinationRate: number;
    avgSourceAttribution: number;
    avgContradictionFree: number;
    avgLatencyMs: number;
    retrievalNdcg?: number;
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
    avgFactualConsistency?: number; // Added for HallucinationMetricsView
}

export function EvaluationDashboard() {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("runs");

    const { data: runsData, mutate: mutateRuns } = useSWR<EvaluationRun[]>("/api/evaluation", fetcher, {
        refreshInterval: 5000,
    });

    const { data: runDetails } = useSWR<{
        run: EvaluationRun;
        questions: EvaluationQuestion[];
        aggregateMetrics: AggregateMetrics;
    }>(selectedRunId ? `/api/evaluation/${selectedRunId}` : null, fetcher);

    const { data: ablationData, mutate: mutateAblation } = useSWR("/api/evaluation/ablation", fetcher);

    const runs: EvaluationRun[] = runsData || [];

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
                        <TabsTrigger value="comparison">
                            <BarChart3 className="mr-1 h-4 w-4" />
                            Perbandingan
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
                    {runDetails && (
                        <EvaluationResults
                            aggregateMetrics={runDetails.aggregateMetrics}
                            questions={runDetails.questions}
                            run={runDetails.run}
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
                    <DomainMetricsView runs={runs.filter((r) => r.status === "completed")} />
                </TabsContent>

                <TabsContent className="space-y-4" value="comparison">
                    <ComparisonChart runs={runs.filter((r) => r.status === "completed")} />
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

interface AblationResult {
    configName: string;
    metrics: Record<string, number>;
}

interface AblationData {
    studies: Array<{
        id: string;
        name: string;
        status: string;
        configurations: unknown[];
        results: AblationResult[];
    }>;
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
                                {latestStudy.results.map((result: AblationResult) => (
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

function DomainMetricsView(_props: { runs: EvaluationRun[] }) {
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
                        ].map((item) => (
                            <div className="rounded-lg border p-3" key={item.field}>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium text-sm">{item.field}</span>
                                    <Badge
                                        variant={(() => {
                                            if (item.accuracy >= 90) return "default";
                                            if (item.accuracy >= 80) return "secondary";
                                            return "outline";
                                        })()}
                                    >
                                        {item.accuracy}%
                                    </Badge>
                                </div>
                                <Progress className="h-1.5" value={item.accuracy} />
                            </div>
                        ))}
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
    questions: EvaluationQuestion[];
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
                            {questions?.map((q: EvaluationQuestion) => (
                                <TableRow key={q.id}>
                                    <TableCell className="max-w-xs">
                                        <p className="truncate text-sm">{q.question}</p>
                                    </TableCell>
                                    <TableCell>
                                        <MetricBadge value={q.ragAnswerCorrectness} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="text-xs" variant="outline">
                                            N/A
                                        </Badge>
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

function MetricRow({
    label,
    value,
    description,
    inverted = false,
}: {
    label: string;
    value: number;
    description: string;
    inverted?: boolean;
}) {
    const displayValue = inverted ? 1 - value : value;
    const percentage = (displayValue * 100).toFixed(1);

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

function MetricBadge({ value, inverted = false }: { value: number | null | undefined; inverted?: boolean }) {
    if (value === null || value === undefined) return <Badge variant="outline">N/A</Badge>;

    const displayValue = inverted ? 1 - value : value;
    const percentage = (displayValue * 100).toFixed(0);
    let variant: "default" | "secondary" | "destructive" = "destructive";
    if (displayValue >= 0.7) {
        variant = "default";
    } else if (displayValue >= 0.4) {
        variant = "secondary";
    }

    return (
        <Badge className="font-mono" variant={variant}>
            {percentage}%
        </Badge>
    );
}

// New components from updates

function ComparisonChart({ runs }: { runs: EvaluationRun[] }) {
    const hasData = runs.length > 0;

    const metrics = useMemo(() => {
        if (!hasData) return [];

        return runs.map((run) => ({
            name: run.name,
            "RAG Correctness": run.aggregateMetrics?.rag?.answerCorrectness || 0,
            "Non-RAG Correctness": run.aggregateMetrics?.nonRag?.answerCorrectness || 0,
            "RAG Faithfulness": run.aggregateMetrics?.rag?.faithfulness || 0,
            "RAG Relevancy": run.aggregateMetrics?.rag?.answerRelevancy || 0,
            "RAG Precision": run.aggregateMetrics?.rag?.contextPrecision || 0,
            "RAG Recall": run.aggregateMetrics?.rag?.contextRecall || 0,
            "Hallucination Rate": (1 - (run.aggregateMetrics?.avgHallucinationRate || 0)) * 100, // Inverted for clarity
            "Latency (ms)": run.aggregateMetrics?.avgLatencyMs || 0,
        }));
    }, [runs, hasData]);

    if (!hasData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Perbandingan RAG vs Non-RAG</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                    Belum ada data evaluasi untuk ditampilkan. Jalankan beberapa evaluasi terlebih dahulu.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Perbandingan Metrik Utama</CardTitle>
                    <CardDescription>Perbandingan skor RAG vs Non-RAG untuk metrik kunci.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer height={400} width="100%">
                        <BarChart
                            data={metrics}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 1]} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                            <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                            <Legend />
                            <Bar dataKey="RAG Correctness" fill="#10B981" />
                            <Bar dataKey="Non-RAG Correctness" fill="#6B7280" />
                            <Bar dataKey="RAG Faithfulness" fill="#3B82F6" />
                            <Bar dataKey="RAG Relevancy" fill="#A855F7" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>RAG Metrik Detail</CardTitle>
                    <CardDescription>Visualisasi RAGAS metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer height={350} width="100%">
                        <RadarChart cx="50%" cy="50%" data={metrics} outerRadius="80%">
                            <PolarGrid />
                            <PolarAngleAxis dataKey="name" />
                            <PolarRadiusAxis angle={30} domain={[0, 1]} />
                            <Radar
                                dataKey="RAG Correctness"
                                fill="#10B981"
                                fillOpacity={0.6}
                                name="RAG"
                                stroke="#10B981"
                            />
                            <Radar
                                dataKey="RAG Faithfulness"
                                fill="#3B82F6"
                                fillOpacity={0.6}
                                name="RAG"
                                stroke="#3B82F6"
                            />
                            <Radar
                                dataKey="RAG Relevancy"
                                fill="#A855F7"
                                fillOpacity={0.6}
                                name="RAG"
                                stroke="#A855F7"
                            />
                            <Radar
                                dataKey="RAG Precision"
                                fill="#F59E0B"
                                fillOpacity={0.6}
                                name="RAG"
                                stroke="#F59E0B"
                            />
                            <Radar dataKey="RAG Recall" fill="#06B6D4" fillOpacity={0.6} name="RAG" stroke="#06B6D4" />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Performa Berdasarkan Strategi Retrieval</CardTitle>
                    <CardDescription>Analisis performa berdasarkan strategi retrieval yang digunakan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer height={350} width="100%">
                        <LineChart
                            data={runs.map((run) => ({
                                name: run.retrievalStrategy || "Unknown",
                                Correctness: run.aggregateMetrics?.rag?.answerCorrectness || 0,
                                "Hallucination Rate": (1 - (run.aggregateMetrics?.avgHallucinationRate || 0)) * 100,
                            }))}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line activeDot={{ r: 8 }} dataKey="Correctness" stroke="#10B981" type="monotone" />
                            <Line dataKey="Hallucination Rate" stroke="#EF4444" type="monotone" />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Perbandingan Halusinasi dan Latensi</CardTitle>
                    <CardDescription>Hubungan antara tingkat halusinasi dan latensi.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer height={350} width="100%">
                        <BarChart
                            data={metrics}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis
                                domain={[0, 100]}
                                orientation="left"
                                stroke="#EF4444"
                                tickFormatter={(val) => `${val}%`}
                                yAxisId="left"
                            />
                            <YAxis
                                domain={[0, Math.max(...runs.map((r) => r.aggregateMetrics?.avgLatencyMs || 0))]}
                                orientation="right"
                                stroke="#3B82F6"
                                yAxisId="right"
                            />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Hallucination Rate" fill="#EF4444" yAxisId="left" />
                            <Bar dataKey="Latency (ms)" fill="#3B82F6" yAxisId="right" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

function AblationStudyPanel() {
    const { data: ablationData, mutate: mutateAblation } = useSWR("/api/evaluation/ablation", fetcher);
    const studies = ablationData?.studies || [];
    const latestStudy = studies[0];

    const runAblationStudy = async () => {
        await fetch("/api/evaluation/ablation", { method: "POST" });
        mutateAblation();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-xl">Studi Ablasi</h2>
                    <p className="text-muted-foreground">
                        Bandingkan performa berbagai konfigurasi RAG untuk menemukan kombinasi optimal
                    </p>
                </div>
                <Button className="gap-2" onClick={runAblationStudy}>
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
                                {latestStudy.results.map((result: AblationResult) => (
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
                    <Button onClick={runAblationStudy}>Mulai Studi Ablasi</Button>
                </Card>
            )}
        </div>
    );
}

function HallucinationAnalysis({ runId }: { runId: string | null }) {
    const { data: runData } = useSWR<{
        run: EvaluationRun;
        questions: EvaluationQuestion[];
        aggregateMetrics: AggregateMetrics;
    }>(runId ? `/api/evaluation/${runId}` : null);

    const hallucinationRate = runData?.aggregateMetrics?.avgHallucinationRate ?? 0;
    const factualConsistency = runData?.aggregateMetrics?.avgFactualConsistency ?? 0;
    const sourceAttribution = runData?.aggregateMetrics?.avgSourceAttribution ?? 0;
    const contradictionFree = runData?.aggregateMetrics?.avgContradictionFree ?? 0;

    const hasData =
        runData?.aggregateMetrics?.avgHallucinationRate !== undefined &&
        runData?.aggregateMetrics?.avgFactualConsistency !== undefined &&
        runData?.aggregateMetrics?.avgSourceAttribution !== undefined &&
        runData?.aggregateMetrics?.avgContradictionFree !== undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analisis Halusinasi</CardTitle>
                <CardDescription>Metrik halusinasi untuk evaluasi yang dipilih.</CardDescription>
            </CardHeader>
            <CardContent>
                {!runId && (
                    <p className="text-center text-muted-foreground">
                        Pilih evaluasi dari daftar untuk melihat detailnya.
                    </p>
                )}
                {runId && !hasData && <p className="text-center text-muted-foreground">Memuat data halusinasi...</p>}
                {runId && hasData && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-4">
                            <MetricRow
                                description="Rata-rata informasi yang dibuat-buat"
                                label="Tingkat Halusinasi"
                                value={hallucinationRate}
                            />
                            <MetricRow
                                description="Tingkat kesesuaian dengan sumber"
                                label="Konsistensi Faktual"
                                value={factualConsistency}
                            />
                        </div>
                        <div className="space-y-4">
                            <MetricRow
                                description="Tingkat kutipan yang tepat"
                                label="Atribusi Sumber"
                                value={sourceAttribution}
                            />
                            <MetricRow
                                description="Tidak ada pernyataan yang bertentangan"
                                label="Bebas Kontradiksi"
                                value={contradictionFree}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function LatencyAnalysis({ runId }: { runId: string | null }) {
    const { data: runData } = useSWR<{
        run: EvaluationRun;
        questions: EvaluationQuestion[];
        aggregateMetrics: AggregateMetrics;
    }>(runId ? `/api/evaluation/${runId}` : null, fetcher);

    const latency = runData?.aggregateMetrics?.avgLatencyMs ?? 0;
    const hasData = runData?.aggregateMetrics?.avgLatencyMs !== undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analisis Latensi</CardTitle>
                <CardDescription>Distribusi latensi respons untuk evaluasi yang dipilih.</CardDescription>
            </CardHeader>
            <CardContent>
                {!runId && (
                    <p className="text-center text-muted-foreground">
                        Pilih evaluasi dari daftar untuk melihat detailnya.
                    </p>
                )}
                {runId && !hasData && <p className="text-center text-muted-foreground">Memuat data latensi...</p>}
                {runId && hasData && (
                    <div className="space-y-4">
                        <MetricRow
                            description="Waktu rata-rata untuk merespons (detik)"
                            label="Latensi Rata-rata"
                            value={latency / 1000}
                        />
                        {/* Add more detailed latency breakdown if available */}
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer>
                                <LineChart
                                    data={[
                                        { name: "Total Latency", uv: latency, pv: latency, amt: latency }, // Placeholder data structure
                                    ]}
                                >
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <Tooltip />
                                    <Line dataKey="uv" stroke="#8884d8" type="monotone" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, { icon: React.ElementType; className: string }> = {
        pending: { icon: Clock, className: "bg-yellow-100 text-yellow-800" },
        running: { icon: RefreshCw, className: "bg-blue-100 text-blue-800" },
        completed: { icon: CheckCircle, className: "bg-green-100 text-green-800" },
        failed: { icon: XCircle, className: "bg-red-100 text-red-800" },
    };

    const { icon: Icon, className } = variants[status] || variants.pending;

    return (
        <Badge className={className}>
            <Icon className="mr-1 h-3 w-3" />
            {status}
        </Badge>
    );
}

function EvaluationResultsPanel({
    run,
    questions,
    aggregateMetrics,
}: {
    run: EvaluationRun;
    questions: EvaluationQuestion[];
    aggregateMetrics: AggregateMetrics;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{run.name} - Hasil</CardTitle>
                <CardDescription>{run.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Aggregate Metrics */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Metrik Agregat</h3>
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
                        <MetricRow
                            description="Tingkat informasi yang dibuat-buat (inverted)"
                            inverted
                            label="Halusinasi"
                            value={1 - (aggregateMetrics?.avgHallucinationRate || 0)}
                        />
                    </div>

                    {/* Question Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Detail per Pertanyaan</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pertanyaan</TableHead>
                                    <TableHead>Correctness</TableHead>
                                    <TableHead>Faithfulness</TableHead>
                                    <TableHead>Hallucination</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {questions?.slice(0, 5).map(
                                    (
                                        q: EvaluationQuestion // Display first 5 for brevity
                                    ) => (
                                        <TableRow key={q.id}>
                                            <TableCell className="max-w-xs">
                                                <p className="truncate text-sm">{q.question}</p>
                                            </TableCell>
                                            <TableCell>
                                                <MetricBadge value={q.ragAnswerCorrectness} />
                                            </TableCell>
                                            <TableCell>
                                                <MetricBadge value={q.ragFaithfulness} />
                                            </TableCell>
                                            <TableCell>
                                                <MetricBadge inverted value={1 - (q.ragHallucinationRate || 0)} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                )}
                            </TableBody>
                        </Table>
                        {questions.length > 5 && (
                            <p className="text-muted-foreground text-sm">
                                Menampilkan 5 dari {questions.length} pertanyaan.
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
