"use client";

import {
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileCode,
    FileJson,
    FileSpreadsheet,
    FileText,
    Loader2,
} from "lucide-react";

// Regex pattern at module level
const FILENAME_PATTERN = /filename="(.+)"/;

import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DataExportPanelProps {
    evaluationRunId?: string;
    ablationStudyId?: string;
    runName?: string;
}

type ExportFormat = "csv" | "json" | "spss" | "python" | "r";

const FORMAT_INFO: Record<
    ExportFormat,
    {
        label: string;
        description: string;
        icon: React.ElementType;
        extension: string;
        useCase: string;
    }
> = {
    csv: {
        label: "CSV",
        description: "Comma-separated values",
        icon: FileSpreadsheet,
        extension: ".csv",
        useCase: "Excel, Google Sheets, SPSS Import",
    },
    json: {
        label: "JSON",
        description: "JavaScript Object Notation",
        icon: FileJson,
        extension: ".json",
        useCase: "Python pandas, JavaScript, APIs",
    },
    spss: {
        label: "SPSS Syntax",
        description: "SPSS import syntax file",
        icon: FileText,
        extension: ".sps",
        useCase: "IBM SPSS Statistics",
    },
    python: {
        label: "Python Script",
        description: "Complete analysis script",
        icon: FileCode,
        extension: ".py",
        useCase: "Jupyter, Google Colab, VSCode",
    },
    r: {
        label: "R Script",
        description: "Complete analysis script",
        icon: FileCode,
        extension: ".R",
        useCase: "RStudio, R Markdown",
    },
};

export function DataExportPanel({ evaluationRunId, ablationStudyId, runName = "evaluation" }: DataExportPanelProps) {
    const [format, setFormat] = useState<ExportFormat>("csv");
    const [language, setLanguage] = useState<"en" | "id">("id");
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [lastExported, setLastExported] = useState<string | null>(null);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams({
                format,
                language,
                includeMetadata: String(includeMetadata),
            });

            if (evaluationRunId) {
                params.set("runId", evaluationRunId);
            } else if (ablationStudyId) {
                params.set("ablationId", ablationStudyId);
            }

            const response = await fetch(`/api/export?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Export failed");
            }

            // Get filename from Content-Disposition header or generate one
            const contentDisposition = response.headers.get("Content-Disposition");
            let filename = `${runName}_export${FORMAT_INFO[format].extension}`;
            if (contentDisposition) {
                const match = contentDisposition.match(FILENAME_PATTERN);
                if (match) {
                    filename = match[1];
                }
            }

            // Download the file
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setLastExported(format);
            toast.success(
                language === "id"
                    ? `Data berhasil diekspor ke ${FORMAT_INFO[format].label}`
                    : `Data exported successfully to ${FORMAT_INFO[format].label}`
            );
        } catch (error) {
            console.error("Export error:", error);
            toast.error(language === "id" ? "Gagal mengekspor data" : "Failed to export data");
        } finally {
            setIsExporting(false);
        }
    };

    const copyPythonImportCode = () => {
        const code = `import pandas as pd

# Load exported CSV data
df = pd.read_csv("${runName}_export.csv")

# Quick analysis
print(df.describe())
print(df.info())`;

        navigator.clipboard.writeText(code);
        toast.success(language === "id" ? "Kode disalin!" : "Code copied!");
    };

    const copyRImportCode = () => {
        const code = `library(tidyverse)

# Load exported CSV data
df <- read_csv("${runName}_export.csv")

# Quick analysis
summary(df)
glimpse(df)`;

        navigator.clipboard.writeText(code);
        toast.success(language === "id" ? "Kode disalin!" : "Code copied!");
    };

    const copySPSSImportCode = () => {
        const code = `* Run this syntax after importing CSV in SPSS.
* Or use File > Open > Syntax and run the .sps file.

GET DATA /TYPE=TXT
  /FILE="evaluation_export.csv"
  /DELIMITERS=","
  /FIRSTCASE=2.
EXECUTE.`;

        navigator.clipboard.writeText(code);
        toast.success(language === "id" ? "Kode disalin!" : "Code copied!");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    {language === "id" ? "Ekspor Data Mentah" : "Export Raw Data"}
                </CardTitle>
                <CardDescription>
                    {language === "id"
                        ? "Ekspor data evaluasi untuk analisis statistik di SPSS, Python, atau R"
                        : "Export evaluation data for statistical analysis in SPSS, Python, or R"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Format Selection */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{language === "id" ? "Format Ekspor" : "Export Format"}</Label>
                        <Select onValueChange={(v) => setFormat(v as ExportFormat)} value={format}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(FORMAT_INFO).map(([key, info]) => (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                            <info.icon className="h-4 w-4" />
                                            <span>{info.label}</span>
                                            <span className="text-muted-foreground text-xs">({info.extension})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">{FORMAT_INFO[format].useCase}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>{language === "id" ? "Bahasa" : "Language"}</Label>
                        <Select onValueChange={(v) => setLanguage(v as "en" | "id")} value={language}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">
                            {language === "id"
                                ? "Label variabel dan komentar dalam Bahasa Indonesia"
                                : "Variable labels and comments in English"}
                        </p>
                    </div>
                </div>

                {/* Options */}
                <div className="flex items-center space-x-2">
                    <Switch checked={includeMetadata} id="includeMetadata" onCheckedChange={setIncludeMetadata} />
                    <Label htmlFor="includeMetadata">
                        {language === "id"
                            ? "Sertakan metadata (label variabel, deskripsi)"
                            : "Include metadata (variable labels, descriptions)"}
                    </Label>
                </div>

                {/* Export Button */}
                <Button
                    className="w-full"
                    disabled={isExporting || !(evaluationRunId || ablationStudyId)}
                    onClick={handleExport}
                >
                    {isExporting && (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {language === "id" ? "Mengekspor..." : "Exporting..."}
                        </>
                    )}
                    {!isExporting && lastExported === format && (
                        <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {language === "id" ? "Ekspor Lagi" : "Export Again"}
                        </>
                    )}
                    {!isExporting && lastExported !== format && (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            {language === "id"
                                ? `Ekspor sebagai ${FORMAT_INFO[format].label}`
                                : `Export as ${FORMAT_INFO[format].label}`}
                        </>
                    )}
                </Button>

                {/* Quick Import Snippets */}
                <div className="space-y-4">
                    <Label className="font-medium text-sm">
                        {language === "id" ? "Kode Import Cepat" : "Quick Import Code"}
                    </Label>

                    <Tabs className="w-full" defaultValue="python">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="python">Python</TabsTrigger>
                            <TabsTrigger value="r">R</TabsTrigger>
                            <TabsTrigger value="spss">SPSS</TabsTrigger>
                        </TabsList>

                        <TabsContent className="space-y-2" value="python">
                            <div className="relative rounded-md bg-muted p-3 font-mono text-xs">
                                <pre className="overflow-x-auto">
                                    {`import pandas as pd
df = pd.read_csv("${runName}_export.csv")
print(df.describe())`}
                                </pre>
                                <Button
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={copyPythonImportCode}
                                    size="icon"
                                    variant="ghost"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Badge className="text-xs" variant="outline">
                                    pandas
                                </Badge>
                                <Badge className="text-xs" variant="outline">
                                    scipy
                                </Badge>
                                <Badge className="text-xs" variant="outline">
                                    matplotlib
                                </Badge>
                            </div>
                        </TabsContent>

                        <TabsContent className="space-y-2" value="r">
                            <div className="relative rounded-md bg-muted p-3 font-mono text-xs">
                                <pre className="overflow-x-auto">
                                    {`library(tidyverse)
df <- read_csv("${runName}_export.csv")
summary(df)`}
                                </pre>
                                <Button
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={copyRImportCode}
                                    size="icon"
                                    variant="ghost"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Badge className="text-xs" variant="outline">
                                    tidyverse
                                </Badge>
                                <Badge className="text-xs" variant="outline">
                                    psych
                                </Badge>
                                <Badge className="text-xs" variant="outline">
                                    effsize
                                </Badge>
                            </div>
                        </TabsContent>

                        <TabsContent className="space-y-2" value="spss">
                            <div className="relative rounded-md bg-muted p-3 font-mono text-xs">
                                <pre className="overflow-x-auto">
                                    {`* Import CSV then run .sps syntax
GET DATA /TYPE=TXT
  /FILE="export.csv"
  /DELIMITERS=",".`}
                                </pre>
                                <Button
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={copySPSSImportCode}
                                    size="icon"
                                    variant="ghost"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {language === "id"
                                    ? "Unduh juga file .sps untuk label variabel otomatis"
                                    : "Also download .sps file for automatic variable labels"}
                            </p>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Analysis Workflow */}
                <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="mb-2 font-medium text-sm">
                        {language === "id" ? "Alur Analisis yang Disarankan" : "Recommended Analysis Workflow"}
                    </h4>
                    <ol className="space-y-1 text-muted-foreground text-xs">
                        <li>1. {language === "id" ? "Ekspor data sebagai CSV" : "Export data as CSV"}</li>
                        <li>
                            2.{" "}
                            {language === "id"
                                ? "Unduh script Python/R untuk analisis lengkap"
                                : "Download Python/R script for complete analysis"}
                        </li>
                        <li>
                            3.{" "}
                            {language === "id"
                                ? "Jalankan paired t-test untuk RAG vs Non-RAG"
                                : "Run paired t-test for RAG vs Non-RAG"}
                        </li>
                        <li>
                            4.{" "}
                            {language === "id"
                                ? "Lakukan ANOVA untuk perbandingan strategi"
                                : "Perform ANOVA for strategy comparison"}
                        </li>
                        <li>
                            5.{" "}
                            {language === "id"
                                ? "Hitung effect size (Cohen's d, η²)"
                                : "Calculate effect sizes (Cohen's d, η²)"}
                        </li>
                        <li>
                            6.{" "}
                            {language === "id"
                                ? "Ekspor tabel hasil ke LaTeX untuk paper"
                                : "Export result tables to LaTeX for paper"}
                        </li>
                    </ol>
                </div>

                {/* External Resources */}
                <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                        <a href="https://colab.research.google.com/" rel="noopener noreferrer" target="_blank">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Google Colab
                        </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <a href="https://posit.cloud/" rel="noopener noreferrer" target="_blank">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Posit Cloud (R)
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
