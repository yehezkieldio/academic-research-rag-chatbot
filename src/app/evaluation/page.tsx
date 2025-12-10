import { BarChart3 } from "lucide-react";
import { EvaluationDashboard } from "@/components/evaluation/evaluation-dashboard";
import { Sidebar } from "@/components/layout/sidebar";

export default function EvaluationPage() {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="mx-auto max-w-7xl p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <BarChart3 className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="font-semibold text-2xl text-foreground">RAG Evaluation</h1>
                        </div>
                        <p className="text-muted-foreground">
                            Quantitative analysis using RAGAS metrics: Compare RAG vs Non-RAG performance
                        </p>
                    </div>

                    <EvaluationDashboard />
                </div>
            </main>
        </div>
    );
}
