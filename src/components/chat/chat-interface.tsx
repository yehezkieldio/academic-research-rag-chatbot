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
    Languages,
    Loader2,
    RefreshCw,
    Search,
    Send,
    Shield,
    Sparkles,
    Square,
    Target,
    Trash2,
    User,
    Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionSelector } from "@/components/chat/session-manager";
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

// Metadata types from server
interface AgenticMetadata {
    type: "agentic";
    retrievedChunks: RetrievedChunk[];
    steps: AgentStep[];
    language: "en" | "id";
    latencyMs?: number;
    citations: Array<{ id: string; documentTitle: string; citationNumber: number }>;
}

interface StandardRagMetadata {
    type: "standard-rag";
    retrievedChunks: RetrievedChunk[];
    language: "en" | "id";
    latencyMs?: number;
}

interface DirectMetadata {
    type: "direct";
    language: "en" | "id";
    latencyMs?: number;
    negativeReactionDetected?: boolean;
}

type ChatMetadata = AgenticMetadata | StandardRagMetadata | DirectMetadata;

// Extend AIMessage to include metadata
interface MessageWithMetadata extends AIMessage {
    metadata?: ChatMetadata;
}

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
        <div className={cn("flex w-full gap-3", isUser ? "flex-row-reverse justify-end" : "justify-start")}>
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
                                                  <span>
                                                      Calling tool:{" "}
                                                      {"toolName" in part ? String(part.toolName) : "tool"}
                                                  </span>
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

function getLoadingText(isStreaming: boolean, useAgenticMode: boolean): string {
    if (isStreaming) {
        return "Streaming response...";
    }
    if (useAgenticMode) {
        return "Agent reasoning... / Agen sedang berpikir...";
    }
    return "Thinking...";
}

function getMessageSteps(
    message: MessageWithMetadata,
    index: number,
    messagesLength: number,
    agentSteps: AgentStep[] | undefined
): AgentStep[] | undefined {
    const metadata = message.metadata;
    const isLastAssistantMessage = index === messagesLength - 1 && message.role === "assistant";

    if (!isLastAssistantMessage) {
        return undefined;
    }

    if (metadata?.type === "agentic") {
        return (metadata as AgenticMetadata).steps || agentSteps;
    }

    return agentSteps;
}

function getMessageChunks(
    message: MessageWithMetadata,
    index: number,
    messagesLength: number,
    retrievedChunks: RetrievedChunk[] | undefined
): RetrievedChunk[] | undefined {
    const metadata = message.metadata;
    const isLastAssistantMessage = index === messagesLength - 1 && message.role === "assistant";

    if (!isLastAssistantMessage) {
        return undefined;
    }

    if (metadata?.type === "agentic" || metadata?.type === "standard-rag") {
        return (metadata as AgenticMetadata | StandardRagMetadata).retrievedChunks || retrievedChunks;
    }

    return retrievedChunks;
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
    detectedLanguage,
    latencyMs,
    onSessionChange,
}: {
    settings: { useAgenticMode: boolean; useRag: boolean };
    detectedLanguage: "en" | "id" | null;
    latencyMs: number | null;
    onSessionChange?: (sessionId: string) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <SessionSelector onSessionChange={onSessionChange} />
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
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4 pt-0">
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

const ChatInput = memo(function ChatInputComponent({
    input,
    isLoading,
    isStreaming,
    messagesExist,
    onInputChange,
    onSubmit,
    onReload,
    onClear,
    onStop,
}: {
    input: string;
    isLoading: boolean;
    isStreaming: boolean;
    messagesExist: boolean;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    onReload: () => void;
    onClear: () => void;
    onStop: () => void;
}) {
    return (
        <div className="border-border border-t bg-card p-4">
            <form className="mx-auto max-w-4xl" onSubmit={onSubmit}>
                <div className="relative">
                    <Textarea
                        className="min-h-[60px] resize-none bg-background pr-24"
                        disabled={isLoading || isStreaming}
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
                        {isStreaming && (
                            <Button
                                onClick={onStop}
                                size="icon"
                                title="Stop generation"
                                type="button"
                                variant="destructive"
                            >
                                <Square className="h-4 w-4" />
                            </Button>
                        )}
                        {messagesExist && !isStreaming && (
                            <>
                                <Button
                                    disabled={isLoading}
                                    onClick={onClear}
                                    size="icon"
                                    title="Delete chat session"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    disabled={isLoading}
                                    onClick={onReload}
                                    size="icon"
                                    title="Reload last message"
                                    type="button"
                                    variant="ghost"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        {!isStreaming && (
                            <Button disabled={isLoading || !input.trim()} size="icon" type="submit">
                                <Send className="h-4 w-4" />
                            </Button>
                        )}
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
    isStreaming,
    settings,
    scrollRef,
}: {
    messages: MessageWithMetadata[];
    agentSteps: AgentStep[];
    retrievedChunks: RetrievedChunk[];
    isLoading: boolean;
    isStreaming: boolean;
    settings: { useAgenticMode: boolean };
    scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div className="mx-auto max-w-4xl space-y-4 pb-4">
            {messages.length === 0 && <EmptyState />}

            {messages.map((message: MessageWithMetadata, index: number) => (
                <MessageBubble
                    agentSteps={getMessageSteps(message, index, messages.length, agentSteps)}
                    key={message.id}
                    message={message}
                    retrievedChunks={getMessageChunks(message, index, messages.length, retrievedChunks)}
                />
            ))}

            {(isLoading || isStreaming) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{getLoadingText(isStreaming, settings.useAgenticMode)}</span>
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
    const {
        settings,
        setSettings,
        isLoading: storeLoading,
        setLoading,
        error,
        setError,
        activeSession,
        createSession,
        deleteSession,
        sessions,
        activeSessionId,
    } = useChatStore();

    const scrollRef = useRef<HTMLDivElement>(null);
    const session = activeSession();

    const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
    const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([]);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [detectedLanguage, setDetectedLanguage] = useState<"en" | "id" | null>(null);
    const [input, setInput] = useState("");
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Memoize the transport to prevent recreation on every render
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: () => ({
                    sessionId: session?.id,
                    useRag: settings.useRag,
                    useAgenticMode: settings.useAgenticMode,
                    retrievalStrategy: settings.retrievalStrategy,
                    enableGuardrails: settings.enableGuardrails,
                }),
            }),
        [session?.id, settings.useRag, settings.useAgenticMode, settings.retrievalStrategy, settings.enableGuardrails]
    );

    const {
        messages,
        sendMessage,
        status,
        setMessages,
        error: chatError,
        stop,
    } = useChat<MessageWithMetadata>({
        transport,
        experimental_throttle: 50, // Throttle UI updates for better performance
        onFinish: ({ message }) => {
            // Extract metadata from the finished message
            const metadata = message.metadata as ChatMetadata | undefined;

            if (metadata) {
                if (metadata.latencyMs) {
                    setLatencyMs(metadata.latencyMs);
                }
                if (metadata.language) {
                    setDetectedLanguage(metadata.language);
                }

                // Handle agentic metadata
                if (metadata.type === "agentic") {
                    const agenticMeta = metadata as AgenticMetadata;
                    if (agenticMeta.steps) {
                        setAgentSteps(agenticMeta.steps);
                    }
                    if (agenticMeta.retrievedChunks) {
                        setRetrievedChunks(agenticMeta.retrievedChunks);
                    }
                }

                // Handle standard RAG metadata
                if (metadata.type === "standard-rag") {
                    const ragMeta = metadata as StandardRagMetadata;
                    if (ragMeta.retrievedChunks) {
                        setRetrievedChunks(ragMeta.retrievedChunks);
                    }
                }
            }

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

    // Load messages from database when session changes
    const loadMessagesFromDb = useCallback(
        async (sessionId: string) => {
            setIsLoadingMessages(true);
            try {
                const response = await fetch(`/api/sessions/${sessionId}/messages`);
                const { messages: dbMessages } = await response.json();

                if (dbMessages && dbMessages.length > 0) {
                    // Convert DB messages to UIMessage format
                    const uiMessages: MessageWithMetadata[] = dbMessages.map(
                        (msg: { id: string; role: string; content: string; createdAt: string }) => ({
                            id: msg.id,
                            role: msg.role as "user" | "assistant",
                            parts: [{ type: "text" as const, text: msg.content }],
                        })
                    );
                    setMessages(uiMessages);
                } else {
                    setMessages([]);
                }
            } catch (err) {
                console.error("Failed to load messages:", err);
                setMessages([]);
            } finally {
                setIsLoadingMessages(false);
            }
        },
        [setMessages]
    );

    // Handle session change from SessionSelector
    const handleSessionChange = useCallback(
        (sessionId: string) => {
            // Reset state for new session
            setAgentSteps([]);
            setRetrievedChunks([]);
            setLatencyMs(null);
            setDetectedLanguage(null);
            setError(null);
            setInput("");

            // Load messages from database
            loadMessagesFromDb(sessionId);
        },
        [loadMessagesFromDb, setError]
    );

    // Initialize: wait for sessions to load, then set active session or create new one
    useEffect(() => {
        const { isLoadingSessions } = useChatStore.getState();

        // Don't do anything while sessions are still loading from DB
        if (isLoadingSessions) {
            return;
        }

        // If no active session but we have sessions, set the most recent one as active
        if (!session && sessions.length > 0) {
            const mostRecent = sessions[0]; // sessions are sorted by updatedAt descending
            useChatStore.setState({ activeSessionId: mostRecent.id });
            return;
        }

        // Only create a new session if we have no sessions at all
        if (!session && sessions.length === 0 && !isLoadingSessions) {
            (async () => {
                try {
                    const response = await fetch("/api/sessions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            useRag: settings.useRag,
                            useAgenticMode: settings.useAgenticMode,
                            retrievalStrategy: settings.retrievalStrategy,
                        }),
                    });
                    const { session: dbSession } = await response.json();

                    if (dbSession?.id) {
                        useChatStore.setState((state) => ({
                            sessions: [
                                ...state.sessions,
                                {
                                    id: dbSession.id,
                                    title: dbSession.title || "New Chat",
                                    messages: [],
                                    createdAt: Date.now(),
                                    updatedAt: Date.now(),
                                    settings: { ...settings },
                                },
                            ],
                            activeSessionId: dbSession.id,
                        }));
                    }
                } catch (err) {
                    console.error("Failed to create session:", err);
                    createSession("New Chat");
                }
            })();
        }
    }, [session, sessions, createSession, settings]);

    // Load messages when active session changes
    useEffect(() => {
        if (activeSessionId && messages.length === 0) {
            loadMessagesFromDb(activeSessionId);
        }
    }, [activeSessionId, loadMessagesFromDb, messages.length]);

    const onSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!input.trim()) return;

            // Reset metadata for new message
            setAgentSteps([]);
            setRetrievedChunks([]);
            setDetectedLanguage(null);
            setLatencyMs(null);
            setError(null);

            const userMessage = input;
            setInput("");

            // Send message - useChat handles streaming automatically for all modes
            sendMessage({ text: userMessage });
        },
        [input, sendMessage, setError]
    );

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const isLoading = storeLoading || isSubmitted || isLoadingMessages;

    const handleStop = useCallback(() => {
        stop();
    }, [stop]);

    const handleReload = useCallback(() => {
        const lastUserMsg = messages.filter((m) => m.role === "user").pop();
        const text = lastUserMsg?.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
        if (text) setInput(text);
    }, [messages]);

    const handleClear = useCallback(() => {
        if (!session?.id) {
            return;
        }

        if (!window.confirm("Delete this chat session? This cannot be undone.")) {
            return;
        }

        void (async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
                if (!response.ok) {
                    const errorText = await response.text().catch(() => "Failed to delete session");
                    throw new Error(errorText || "Failed to delete session");
                }

                deleteSession(session.id);
                setMessages([]);
                setAgentSteps([]);
                setRetrievedChunks([]);
                setLatencyMs(null);
                setDetectedLanguage(null);
                setInput("");
                setError(null);

                const nextActiveSessionId = useChatStore.getState().activeSessionId;
                if (nextActiveSessionId) {
                    await loadMessagesFromDb(nextActiveSessionId);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to delete session";
                setError(message);
            } finally {
                setLoading(false);
            }
        })();
    }, [deleteSession, loadMessagesFromDb, session?.id, setError, setLoading, setMessages]);

    return {
        settings,
        setSettings,
        error,
        chatError,
        messages: messages as MessageWithMetadata[],
        agentSteps,
        retrievedChunks,
        latencyMs,
        detectedLanguage,
        isLoading,
        isStreaming,
        input,
        scrollRef,
        handleInputChange,
        onSubmit,
        handleReload,
        handleClear,
        handleSessionChange,
        handleStop,
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
        isStreaming,
        input,
        scrollRef,
        handleInputChange,
        onSubmit,
        handleReload,
        handleClear,
        handleSessionChange,
        handleStop,
    } = useChatLogic();

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex shrink-0 flex-col gap-3 border-border border-b bg-card p-4">
                <ChatHeader
                    detectedLanguage={detectedLanguage}
                    latencyMs={latencyMs}
                    onSessionChange={handleSessionChange}
                    settings={settings}
                />
                <SettingsPanel setSettings={setSettings} settings={settings} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {(error || chatError) && (
                    <div className="mx-4 mt-4 flex shrink-0 items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive text-sm">{error || chatError?.message}</span>
                    </div>
                )}

                <ScrollArea className="min-h-0 flex-1">
                    <div className="flex p-4">
                        <MessageList
                            agentSteps={agentSteps}
                            isLoading={isLoading}
                            isStreaming={isStreaming}
                            messages={messages}
                            retrievedChunks={retrievedChunks}
                            scrollRef={scrollRef}
                            settings={settings}
                        />
                    </div>
                </ScrollArea>
            </div>

            <div className="shrink-0">
                <ChatInput
                    input={input}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    messagesExist={messages.length > 0}
                    onClear={handleClear}
                    onInputChange={handleInputChange}
                    onReload={handleReload}
                    onStop={handleStop}
                    onSubmit={onSubmit}
                />
            </div>
        </div>
    );
}
