"use client";

import { CheckCircle2, FileJson, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACADEMIC_QUESTIONS, SAMPLE_QUESTIONS_EN } from "@/lib/evaluation-questions";

interface ImportQuestionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    evaluationRunId: string;
    onImported: () => void;
}

export function ImportQuestionsDialog({ open, onOpenChange, evaluationRunId, onImported }: ImportQuestionsDialogProps) {
    const [jsonInput, setJsonInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleImport = async () => {
        setError("");
        setIsLoading(true);

        try {
            let questions: unknown;
            try {
                questions = JSON.parse(jsonInput);
            } catch (e) {
                setError("Format JSON tidak valid");
                setIsLoading(false);
                return;
            }

            if (!Array.isArray(questions)) {
                setError("Data harus berupa array dari objek pertanyaan");
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/evaluation/import-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    runId: evaluationRunId,
                    questions,
                }),
            });

            if (response.ok) {
                onImported();
                setJsonInput("");
                onOpenChange(false);
            } else {
                const data = await response.json();
                setError(data.error || "Gagal mengimpor pertanyaan");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const loadAcademicQuestions = () => {
        setJsonInput(JSON.stringify(ACADEMIC_QUESTIONS, null, 2));
    };

    const loadSampleQuestionsEN = () => {
        setJsonInput(JSON.stringify(SAMPLE_QUESTIONS_EN, null, 2));
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Impor Pertanyaan Bulk
                    </DialogTitle>
                    <DialogDescription>
                        Impor beberapa pertanyaan sekaligus dari format JSON. Ideal untuk 30+ pertanyaan.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <Button onClick={loadAcademicQuestions} size="sm" type="button" variant="outline">
                            <FileJson className="mr-2 h-4 w-4" />
                            Muat Template Indonesia ({ACADEMIC_QUESTIONS.length} pertanyaan)
                        </Button>
                        <Button onClick={loadSampleQuestionsEN} size="sm" type="button" variant="outline">
                            <FileJson className="mr-2 h-4 w-4" />
                            Load English Template ({SAMPLE_QUESTIONS_EN.length} questions)
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>Format JSON</Label>
                        <Textarea
                            className="font-mono text-sm"
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder={`[\n  {\n    "question": "Your question here",\n    "groundTruth": "Expected answer here"\n  },\n  ...\n]`}
                            rows={15}
                            value={jsonInput}
                        />
                        <p className="text-muted-foreground text-xs">
                            Format: Array of objects with "question" and "groundTruth" fields
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                            <span className="font-medium">Error:</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2 rounded-lg bg-muted p-4">
                        <h4 className="font-medium text-sm">Contoh Format:</h4>
                        <pre className="overflow-x-auto rounded border bg-background p-3 text-xs">
                            {`[
  {
    "question": "Apa itu RAG?",
    "groundTruth": "Retrieval-Augmented Generation..."
  },
  {
    "question": "Jelaskan vektor embedding",
    "groundTruth": "Vektor embedding adalah..."
  }
]`}
                        </pre>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="outline">
                        Batal
                    </Button>
                    <Button disabled={isLoading || !jsonInput.trim()} onClick={handleImport}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Mengimpor...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Impor Pertanyaan
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
