"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricsChartProps {
    ragMetrics: {
        faithfulness: number;
        answerRelevancy: number;
        contextPrecision: number;
        contextRecall: number;
        answerCorrectness: number;
    };
    nonRagMetrics: {
        answerRelevancy: number;
        answerCorrectness: number;
    };
}

export function MetricsChart({ ragMetrics, nonRagMetrics }: MetricsChartProps) {
    // Data for bar chart comparison
    const barData = [
        {
            name: "Answer Relevancy",
            RAG: ragMetrics.answerRelevancy * 100,
            "Non-RAG": nonRagMetrics.answerRelevancy * 100,
        },
        {
            name: "Answer Correctness",
            RAG: ragMetrics.answerCorrectness * 100,
            "Non-RAG": nonRagMetrics.answerCorrectness * 100,
        },
    ];

    // Data for radar chart (RAG-specific metrics)
    const radarData = [
        { metric: "Faithfulness", value: ragMetrics.faithfulness * 100 },
        { metric: "Relevancy", value: ragMetrics.answerRelevancy * 100 },
        { metric: "Precision", value: ragMetrics.contextPrecision * 100 },
        { metric: "Recall", value: ragMetrics.contextRecall * 100 },
        { metric: "Correctness", value: ragMetrics.answerCorrectness * 100 },
    ];

    // Colors matching the theme
    const ragColor = "oklch(0.65 0.18 160)";
    const nonRagColor = "oklch(0.65 0.18 250)";

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Bar Chart Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">RAG vs Non-RAG Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer height="100%" width="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid stroke="oklch(0.28 0.01 260)" strokeDasharray="3 3" />
                                <XAxis
                                    axisLine={{ stroke: "oklch(0.28 0.01 260)" }}
                                    dataKey="name"
                                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={{ stroke: "oklch(0.28 0.01 260)" }}
                                    domain={[0, 100]}
                                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "oklch(0.16 0.01 260)",
                                        border: "1px solid oklch(0.28 0.01 260)",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                                />
                                <Legend />
                                <Bar dataKey="RAG" fill={ragColor} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Non-RAG" fill={nonRagColor} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Radar Chart for RAGAS Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">RAGAS Metrics Profile</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer height="100%" width="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="oklch(0.28 0.01 260)" />
                                <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }} />
                                <PolarRadiusAxis
                                    axisLine={{ stroke: "oklch(0.28 0.01 260)" }}
                                    domain={[0, 100]}
                                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
                                />
                                <Radar dataKey="value" fill={ragColor} fillOpacity={0.3} name="RAG" stroke={ragColor} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "oklch(0.16 0.01 260)",
                                        border: "1px solid oklch(0.28 0.01 260)",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
