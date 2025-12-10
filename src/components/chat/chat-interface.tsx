"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage as AIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import {
    AlertTriangle,
    BookOpen,
    Bot,
    Brain,
    ChevronDown,
    Clock,
    Database,
    FileText,
    GraduationCap,
    Languages,
    Loader2,
    RefreshCw,
    Search,
    Send,
    Shield,
    Sparkles,
    Target,
    User,
    Zap,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type AgentStep, type RetrievedChunk, useChatStore } from "@/lib/stores/chat-stores";
import { cn } from "@/lib/utils";

// Type definitions
type Message = AIMessage;
type MessagePart = Message["parts"][number];

const MessageBubble = memo(function MessageBubbleComponent({
    message,
    agentSteps,
    retrievedChunks,
}: {
    message: Message;
    agentSteps?: AgentStep[];
    retrievedChunks?: RetrievedChunk[];
}) {
    const isUser = message.role === "user";

    return (
        <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
            <div
                className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
            >
                {isUser ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
            </div>

            <div className={cn("max-w-[85%] space-y-2", isUser && "items-end")}>
                <Card className={cn("p-4", isUser ? "bg-primary text-primary-foreground" : "bg-card")}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.parts && message.parts.length > 0
                            ? message.parts.map((part: MessagePart, index: number) => {
                                  switch (part.type) {
                                      case "text":
                                          return (
                                              <div key={`${message.id}-text-${index}`}>
                                                  {part.text.split("\n").map((paragraph: string, i: number) => (
                                                      <p
                                                          className={cn(
                                                              "mb-2 last:mb-0",
                                                              isUser && "text-primary-foreground"
                                                          )}
                                                          key={`${message.id}-para-${index}-${i}`}
                                                      >
                                                          {paragraph}
                                                      </p>
                                                  ))}
                                              </div>
                                          );
                                      case "tool-call":
                                          return (
                                              <div
                                                  className="flex items-center gap-2 text-muted-foreground text-xs"
                                                  key={`${message.id}-tool-${index}`}
                                              >
                                                  <Zap className="h-3 w-3" />
                                                  <span>Calling tool: {part.type}</span>
                                              </div>
                                          );
                                      default:
                                          return null;
                                  }
                              })
                            : null}
                    </div>
                </Card>

                {!isUser && agentSteps && agentSteps.length > 0 && <AgentStepsCollapsible steps={agentSteps} />}
                {!isUser && retrievedChunks && retrievedChunks.length > 0 && (
                    <SourcesCollapsible chunks={retrievedChunks} />
                )}
            </div>
        </div>
    );
});

function getStepColor(stepType: AgentStep["stepType"]): string {
    switch (stepType) {
        case "tool_call":
            return "bg-blue-500/20 text-blue-600";
        case "retrieval":
            return "bg-green-500/20 text-green-600";
        case "synthesis":
            return "bg-purple-500/20 text-purple-600";
        default:
            return "bg-orange-500/20 text-orange-600";
    }
}

function getStepIcon(stepType: AgentStep["stepType"]): React.ReactNode {
    switch (stepType) {
        case "tool_call":
            return <Zap className="h-3 w-3" />;
        case "retrieval":
            return <Search className="h-3 w-3" />;
        case "synthesis":
            return <FileText className="h-3 w-3" />;
        default:
            return <Brain className="h-3 w-3" />;
    }
}

const AgentStepsCollapsible = memo(function AgentStepsCollapsibleComponent({ steps }: { steps: AgentStep[] }) {
    return (
        <Collapsible>
            <CollapsibleTrigger asChild>
                <Button className="gap-2 text-xs" size="sm" variant="ghost">
                    <Brain className="h-3 w-3" />
                    {steps.length} reasoning steps
                    <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <Card className="mt-2 bg-muted/50 p-3">
                    <div className="space-y-2">
                        {steps.map((step) => {
                            const outputText = step.toolOutput
                                ? `${(typeof step.toolOutput === "object" ? JSON.stringify(step.toolOutput) : String(step.toolOutput)).substring(0, 100)}...`
                                : null;

                            return (
                                <div
                                    className="flex items-start gap-2 text-xs"
                                    key={`${step.stepIndex}-${step.timestamp}`}
                                >
                                    <div
                                        className={cn(
                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                            getStepColor(step.stepType)
                                        )}
                                    >
                                        {getStepIcon(step.stepType)}
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-medium">{step.toolName || step.stepType}</span>
                                        {step.reasoning && (
                                            <p className="mt-0.5 text-muted-foreground">{step.reasoning}</p>
                                        )}
                                        {outputText && (
                                            <p className="mt-0.5 max-w-md truncate text-muted-foreground">
                                                Result: {outputText}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge className="text-[10px]" variant="outline">
                                            {step.durationMs}ms
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </CollapsibleContent>
        </Collapsible>
    );
});

const SourcesCollapsible = memo(function SourcesCollapsibleComponent({ chunks }: { chunks: RetrievedChunk[] }) {
    return (
        <Collapsible>
            <CollapsibleTrigger asChild>
                <Button className="gap-2 text-xs" size="sm" variant="ghost">
                    <FileText className="h-3 w-3" />
                    {chunks.length} sources
                    <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <Card className="mt-2 bg-muted/50 p-3">
                    <div className="space-y-2">
                        {chunks.map((chunk, idx) => (
                            <div
                                className="border-border border-b pb-2 text-xs last:border-0 last:pb-0"
                                key={`chunk-${chunk.documentTitle}-${idx}`}
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="font-medium">
                                        [{idx + 1}] {chunk.documentTitle}
                                    </span>
                                    <div className="flex gap-1">
                                        <Badge className="text-[10px]" variant="outline">
                                            {(chunk.similarity * 100).toFixed(0)}% fused
                                        </Badge>
                                        {chunk.retrievalMethod && (
                                            <Badge className="text-[10px]" variant="secondary">
                                                {chunk.retrievalMethod}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {(chunk.vectorScore !== undefined || chunk.bm25Score !== undefined) && (
                                    <div className="mb-1 flex gap-2">
                                        {chunk.vectorScore !== undefined && (
                                            <span className="text-[10px] text-muted-foreground">
                                                Vec: {(chunk.vectorScore * 100).toFixed(0)}%
                                            </span>
                                        )}
                                        {chunk.bm25Score !== undefined && (
                                            <span className="text-[10px] text-muted-foreground">
                                                BM25: {chunk.bm25Score.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <p className="line-clamp-2 text-muted-foreground">
                                    {chunk.content.substring(0, 150)}...
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>
            </CollapsibleContent>
        </Collapsible>
    );
});

const ChatHeader = memo(function ChatHeaderComponent({
    settings,
    detectedLanguage,
    latencyMs,
}: {
    settings: { useAgenticMode: boolean; useRag: boolean };
    detectedLanguage: "en" | "id" | null;
    latencyMs: number | null;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h2 className="font-semibold text-foreground">MuliaChat</h2>
                    <p className="text-muted-foreground text-sm">
                        {(() => {
                            if (settings.useAgenticMode) return "Agentic RAG + Okapi BM25";
                            if (settings.useRag) return "Standard RAG";
                            return "Direct LLM";
                        })()} • EN/ID
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {detectedLanguage && (
                    <Badge className="gap-1" variant="outline">
                        <Languages className="h-3 w-3" />
                        {detectedLanguage === "id" ? "Bahasa Indonesia" : "English"}
                    </Badge>
                )}
                {latencyMs && (
                    <Badge className="gap-1" variant="outline">
                        <Clock className="h-3 w-3" />
                        {latencyMs}ms
                    </Badge>
                )}
            </div>
        </div>
    );
});

const EmptyState = memo(function EmptyStateComponent() {
    return (
        <div className="py-12 text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4">
                <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 font-medium text-foreground text-lg">Welcome to MuliaChat</h3>
            <p className="mb-1 text-muted-foreground text-sm">Selamat datang di MuliaChat</p>
            <p className="mx-auto mb-4 max-w-md text-muted-foreground text-sm">
                Ask questions in English or Bahasa Indonesia about your uploaded documents.
            </p>
        </div>
    );
});

function useAgenticChat(
    messages: Message[],
    updateMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void,
    sessionId: string | undefined,
    settings: {
        useRag: boolean;
        retrievalStrategy: "vector" | "keyword" | "hybrid";
        enableGuardrails: boolean;
    },
    setAgentSteps: (steps: AgentStep[]) => void,
    setRetrievedChunks: (chunks: RetrievedChunk[]) => void,
    setLatencyMs: (ms: number) => void,
    setDetectedLanguage: (lang: "en" | "id" | null) => void,
    setError: (err: string | null) => void,
    setLoading: (loading: boolean) => void
) {
    return useCallback(
        async (userMessage: string) => {
            setLoading(true);
            setAgentSteps([]);
            setRetrievedChunks([]);
            setDetectedLanguage(null);
            setError(null);

            updateMessages((prev: Message[]) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "user",
                    content: userMessage,
                    parts: [{ type: "text", text: userMessage }],
                },
            ]);

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [...messages, { role: "user", content: userMessage }],
                        sessionId,
                        useRag: settings.useRag,
                        useAgenticMode: true,
                        retrievalStrategy: settings.retrievalStrategy,
                        enableGuardrails: settings.enableGuardrails,
                    }),
                });

                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                    updateMessages((prev: Message[]) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "assistant",
                            content: `Error: ${data.error}`,
                            parts: [{ type: "text", text: `Error: ${data.error}` }],
                        },
                    ]);
                } else {
                    updateMessages((prev: Message[]) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "assistant",
                            content: data.content,
                            parts: [{ type: "text", text: data.content }],
                        },
                    ]);
                    setAgentSteps(data.steps || []);
                    setRetrievedChunks(data.retrievedChunks || []);
                    setLatencyMs(data.latencyMs);
                    if (data.language) {
                        setDetectedLanguage(data.language);
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        },
        [
            messages,
            sessionId,
            settings,
            updateMessages,
            setLoading,
            setError,
            setAgentSteps,
            setRetrievedChunks,
            setLatencyMs,
            setDetectedLanguage,
        ]
    );
}

const ChatInput = memo(function ChatInputComponent({
    input,
    isLoading,
    messagesExist,
    onInputChange,
    onSubmit,
    onReload,
}: {
    input: string;
    isLoading: boolean;
    messagesExist: boolean;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    onReload: () => void;
}) {
    return (
        <div className="border-border border-t bg-card p-4">
            <form className="mx-auto max-w-4xl" onSubmit={onSubmit}>
                <div className="relative">
                    <Textarea
                        className="min-h-[60px] resize-none bg-background pr-24"
                        onChange={onInputChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                onSubmit(e);
                            }
                        }}
                        placeholder="Ask a question (English/Indonesian)... / Ajukan pertanyaan..."
                        value={input}
                    />
                    <div className="absolute right-2 bottom-2 flex gap-2">
                        {messagesExist && (
                            <Button disabled={isLoading} onClick={onReload} size="icon" type="button" variant="ghost">
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        )}
                        <Button disabled={isLoading || !input.trim()} size="icon" type="submit">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <p className="mt-2 text-center text-muted-foreground text-xs">
                    Press Enter to send • Shift+Enter for new line • Supports English & Bahasa Indonesia
                </p>
            </form>
        </div>
    );
});

const MessageList = memo(function MessageListComponent({
    messages,
    agentSteps,
    retrievedChunks,
    isLoading,
    settings,
    scrollRef,
}: {
    messages: Message[];
    agentSteps: AgentStep[];
    retrievedChunks: RetrievedChunk[];
    isLoading: boolean;
    settings: { useAgenticMode: boolean };
    scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div className="mx-auto max-w-4xl space-y-4">
            {messages.length === 0 && <EmptyState />}

            {messages.map((message: Message, index: number) => (
                <MessageBubble
                    agentSteps={index === messages.length - 1 && message.role === "assistant" ? agentSteps : undefined}
                    key={message.id}
                    message={message}
                    retrievedChunks={
                        index === messages.length - 1 && message.role === "assistant" ? retrievedChunks : undefined
                    }
                />
            ))}

            {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                        {settings.useAgenticMode ? "Agent reasoning... / Agen sedang berpikir..." : "Thinking..."}
                    </span>
                </div>
            )}

            <div ref={scrollRef} />
        </div>
    );
});

const SettingsPanel = memo(function SettingsPanelComponent({
    settings,
    setSettings,
}: {
    settings: {
        useRag: boolean;
        useAgenticMode: boolean;
        enableGuardrails: boolean;
        retrievalStrategy: "vector" | "keyword" | "hybrid";
    };
    setSettings: (s: Partial<typeof settings>) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <Switch checked={settings.useRag} id="rag-mode" onCheckedChange={(v) => setSettings({ useRag: v })} />
                <Label className="flex cursor-pointer items-center gap-1.5 text-sm" htmlFor="rag-mode">
                    <Database className="h-4 w-4" />
                    RAG
                </Label>
            </div>

            <div className="flex items-center gap-2">
                <Switch
                    checked={settings.useAgenticMode}
                    disabled={!settings.useRag}
                    id="agentic-mode"
                    onCheckedChange={(v) => setSettings({ useAgenticMode: v })}
                />
                <Label className="flex cursor-pointer items-center gap-1.5 text-sm" htmlFor="agentic-mode">
                    <Brain className="h-4 w-4" />
                    Agentic
                </Label>
            </div>

            <div className="flex items-center gap-2">
                <Switch
                    checked={settings.enableGuardrails}
                    id="guardrails"
                    onCheckedChange={(v) => setSettings({ enableGuardrails: v })}
                />
                <Label className="flex cursor-pointer items-center gap-1.5 text-sm" htmlFor="guardrails">
                    <Shield className="h-4 w-4" />
                    Guardrails
                </Label>
            </div>

            {settings.useRag && (
                <Select
                    onValueChange={(v: "vector" | "keyword" | "hybrid") => setSettings({ retrievalStrategy: v })}
                    value={settings.retrievalStrategy}
                >
                    <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="hybrid">
                            <span className="flex items-center gap-1.5">
                                <Zap className="h-3 w-3" /> Hybrid (RRF)
                            </span>
                        </SelectItem>
                        <SelectItem value="vector">
                            <span className="flex items-center gap-1.5">
                                <Target className="h-3 w-3" /> Vector Only
                            </span>
                        </SelectItem>
                        <SelectItem value="keyword">
                            <span className="flex items-center gap-1.5">
                                <Search className="h-3 w-3" /> Okapi BM25
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            )}

            <Badge
                className="ml-auto gap-1"
                variant={settings.useAgenticMode && settings.useRag ? "default" : "secondary"}
            >
                {(() => {
                    if (settings.useAgenticMode && settings.useRag) {
                        return (
                            <>
                                <Brain className="h-3 w-3" />
                                Agentic RAG
                            </>
                        );
                    }
                    if (settings.useRag) {
                        return (
                            <>
                                <Sparkles className="h-3 w-3" />
                                Standard RAG
                            </>
                        );
                    }
                    return (
                        <>
                            <Bot className="h-3 w-3" />
                            Direct
                        </>
                    );
                })()}
            </Badge>
        </div>
    );
});

function useChatLogic() {
    const store = useChatStore();
    const { settings, setSettings, isLoading: storeLoading, setLoading, error, setError } = store;
    const { activeSession, createSession } = store;

    const scrollRef = useRef<HTMLDivElement>(null);
    const session = activeSession();

    const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
    const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([]);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [detectedLanguage, setDetectedLanguage] = useState<"en" | "id" | null>(null);
    const [input, setInput] = useState("");

    const {
        messages,
        sendMessage,
        status,
        setMessages,
        error: chatError,
    } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: () => ({
                sessionId: session?.id,
                useRag: settings.useRag,
                useAgenticMode: settings.useAgenticMode,
                retrievalStrategy: settings.retrievalStrategy,
                enableGuardrails: settings.enableGuardrails,
            }),
        }),
        onFinish: () => {
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            setLoading(false);
        },
        onError: (err: Error) => {
            setError(err.message);
            setLoading(false);
        },
    });

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    }, []);

    useEffect(() => {
        if (!session) createSession("New Chat");
    }, [session, createSession]);

    const handleAgenticSubmit = useAgenticChat(
        messages,
        setMessages,
        session?.id,
        settings,
        setAgentSteps,
        setRetrievedChunks,
        setLatencyMs,
        setDetectedLanguage,
        setError,
        setLoading
    );

    const onSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!input.trim()) return;
            const userMessage = input;
            setInput("");
            if (settings.useAgenticMode && settings.useRag) {
                await handleAgenticSubmit(userMessage);
            } else {
                sendMessage({ text: userMessage });
            }
        },
        [input, settings.useAgenticMode, settings.useRag, handleAgenticSubmit, sendMessage]
    );

    const isLoading = storeLoading || status === "submitted" || status === "streaming";

    const handleReload = useCallback(() => {
        const lastUserMsg = messages.filter((m) => m.role === "user").pop();
        const text = lastUserMsg?.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
        if (text) setInput(text);
    }, [messages]);

    return {
        settings,
        setSettings,
        error,
        chatError,
        messages,
        agentSteps,
        retrievedChunks,
        latencyMs,
        detectedLanguage,
        isLoading,
        input,
        scrollRef,
        handleInputChange,
        onSubmit,
        handleReload,
    };
}

export function ChatInterface() {
    const {
        settings,
        setSettings,
        error,
        chatError,
        messages,
        agentSteps,
        retrievedChunks,
        latencyMs,
        detectedLanguage,
        isLoading,
        input,
        scrollRef,
        handleInputChange,
        onSubmit,
        handleReload,
    } = useChatLogic();

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-col gap-3 border-border border-b bg-card p-4">
                <ChatHeader detectedLanguage={detectedLanguage} latencyMs={latencyMs} settings={settings} />
                <SettingsPanel setSettings={setSettings} settings={settings} />
            </div>

            {(error || chatError) && (
                <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive text-sm">{error || chatError?.message}</span>
                </div>
            )}

            <ScrollArea className="flex-1 p-4">
                <MessageList
                    agentSteps={agentSteps}
                    isLoading={isLoading}
                    messages={messages}
                    retrievedChunks={retrievedChunks}
                    scrollRef={scrollRef}
                    settings={settings}
                />
            </ScrollArea>

            <ChatInput
                input={input}
                isLoading={isLoading}
                messagesExist={messages.length > 0}
                onInputChange={handleInputChange}
                onReload={handleReload}
                onSubmit={onSubmit}
            />
        </div>
    );
}
