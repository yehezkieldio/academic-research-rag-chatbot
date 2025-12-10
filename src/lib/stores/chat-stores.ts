/**
 * @fileoverview Chat State Management - Zustand Store
 *
 * WHY Zustand:
 * - Simpler API than Redux with less boilerplate
 * - Better TypeScript support out of the box
 * - Built-in persistence with localStorage
 * - Immer integration for immutable updates
 * - No Provider wrapper needed (vs Context API)
 * - Better performance than Context for frequent updates
 *
 * State Structure:
 * - sessions: Array of chat sessions with messages and settings
 * - activeSessionId: Currently selected session
 * - isLoading: Request in progress indicator
 * - streamingContent: Accumulator for streaming responses
 * - settings: Global chat configuration
 *
 * WHY This Architecture:
 * - Supports multiple concurrent conversations
 * - Persists last 10 sessions to localStorage
 * - Enables offline access to recent conversations
 * - Syncs with database on app load
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Agent step metadata for agentic RAG responses
 *
 * @property stepIndex - Sequential step number
 * @property stepType - Type of operation performed
 * @property toolName - Name of tool called (if applicable)
 * @property toolInput - Input parameters to tool
 * @property toolOutput - Tool execution result
 * @property reasoning - Agent's reasoning for this step
 * @property durationMs - Step execution time
 * @property timestamp - Step completion timestamp
 */
export interface AgentStep {
    stepIndex: number;
    stepType: "reasoning" | "tool_call" | "retrieval" | "synthesis";
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    reasoning?: string;
    durationMs: number;
    timestamp: number;
}

/**
 * Retrieved document chunk metadata
 *
 * @property chunkId - Unique chunk identifier
 * @property documentTitle - Source document name
 * @property content - Chunk text content
 * @property similarity - Relevance score (0-1, higher is better)
 * @property retrievalMethod - How chunk was retrieved
 * @property vectorScore - Semantic similarity score (if vector retrieval used)
 * @property bm25Score - Keyword matching score (if BM25 used)
 */
export interface RetrievedChunk {
    chunkId: string;
    documentTitle: string;
    content: string;
    similarity: number;
    retrievalMethod?: "vector" | "keyword" | "hybrid";
    vectorScore?: number;
    bm25Score?: number;
}

/**
 * Chat message with RAG metadata
 *
 * @property id - Unique message identifier
 * @property role - Message sender role
 * @property content - Message text
 * @property createdAt - Unix timestamp
 * @property agentSteps - Agentic reasoning steps (if agentic mode)
 * @property retrievedChunks - RAG context chunks (if RAG enabled)
 * @property latencyMs - Response generation time
 * @property tokenCount - Token count for cost tracking
 * @property language - Detected message language
 */
export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
    agentSteps?: AgentStep[];
    retrievedChunks?: RetrievedChunk[];
    latencyMs?: number;
    tokenCount?: number;
    language?: "en" | "id";
}

/**
 * Chat session container
 *
 * @property id - Unique session identifier
 * @property title - User-facing session name
 * @property messages - Conversation history
 * @property createdAt - Session creation timestamp
 * @property updatedAt - Last message timestamp
 * @property settings - Session-specific configuration
 */
export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    settings: ChatSettings;
}

/**
 * Chat configuration settings
 *
 * @property useRag - Enable RAG mode
 * @property useAgenticMode - Enable multi-step reasoning
 * @property retrievalStrategy - Document retrieval method
 * @property enableGuardrails - Enable content safety checks
 * @property language - Language preference (auto-detect or fixed)
 * @property maxSteps - Maximum agent reasoning steps
 * @property temperature - LLM temperature (0-1, lower is more deterministic)
 */
export interface ChatSettings {
    useRag: boolean;
    useAgenticMode: boolean;
    retrievalStrategy: "vector" | "keyword" | "hybrid";
    enableGuardrails: boolean;
    language: "auto" | "en" | "id";
    maxSteps: number;
    temperature: number;
}

/**
 * Chat store interface with state and actions
 *
 * WHY This Design:
 * - Separates state from actions for clarity
 * - Computed values (activeSession) derived from state
 * - Actions are synchronous - API calls happen in components
 * - Streaming content separated from message history for performance
 */
interface ChatStore {
    // State
    sessions: ChatSession[];
    activeSessionId: string | null;
    isLoading: boolean;
    error: string | null;
    streamingContent: string;
    isLoadingSessions: boolean;

    // Settings
    settings: ChatSettings;

    // Computed
    activeSession: () => ChatSession | undefined;

    // Actions
    createSession: (title?: string) => string;
    deleteSession: (sessionId: string) => void;
    deleteAllSessions: () => void;
    setActiveSession: (sessionId: string) => void;
    renameSession: (sessionId: string, title: string) => void;
    syncSessionsFromDb: (
        dbSessions: Array<{ id: string; title: string | null; createdAt: Date; updatedAt: Date }>
    ) => void;
    setIsLoadingSessions: (loading: boolean) => void;

    addMessage: (message: Omit<ChatMessage, "id" | "createdAt">) => void;
    updateLastMessage: (updates: Partial<ChatMessage>) => void;
    clearMessages: () => void;

    setSettings: (settings: Partial<ChatSettings>) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStreamingContent: (content: string) => void;
    appendStreamingContent: (content: string) => void;
}

/**
 * Default chat settings
 *
 * WHY These Defaults:
 * - useRag: true - RAG provides better accuracy for academic queries
 * - useAgenticMode: true - Multi-step reasoning improves complex query handling
 * - retrievalStrategy: \"hybrid\" - Combines semantic + keyword for best recall
 * - enableGuardrails: true - Safety-first for production use
 * - language: \"auto\" - Detect Indonesian vs English automatically
 * - maxSteps: 5 - Balance between thoroughness and latency
 * - temperature: 0.4 - Lower for factual accuracy (academic context)
 */
const defaultSettings: ChatSettings = {
    useRag: true,
    useAgenticMode: true,
    retrievalStrategy: "hybrid",
    enableGuardrails: true,
    language: "auto",
    maxSteps: 5,
    temperature: 0.4,
};

export const useChatStore = create<ChatStore>()(
    persist(
        immer((set, get) => ({
            // Initial state
            sessions: [],
            activeSessionId: null,
            isLoading: false,
            error: null,
            streamingContent: "",
            settings: defaultSettings,
            isLoadingSessions: false,

            // Computed
            activeSession: () => {
                const state = get();
                return state.sessions.find((s) => s.id === state.activeSessionId);
            },

            // Actions
            createSession: (title = "New Chat") => {
                const sessionId = crypto.randomUUID();
                set((state) => {
                    state.sessions.push({
                        id: sessionId,
                        title,
                        messages: [],
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        settings: { ...state.settings },
                    });
                    state.activeSessionId = sessionId;
                });
                return sessionId;
            },

            deleteSession: (sessionId) => {
                set((state) => {
                    state.sessions = state.sessions.filter((s: ChatSession) => s.id !== sessionId);
                    if (state.activeSessionId === sessionId) {
                        state.activeSessionId = state.sessions[0]?.id || null;
                    }
                });
            },

            deleteAllSessions: () => {
                set((state) => {
                    state.sessions = [];
                    state.activeSessionId = null;
                });
            },

            setActiveSession: (sessionId) => {
                set((state) => {
                    state.activeSessionId = sessionId;
                });
            },

            renameSession: (sessionId, title) => {
                set((state) => {
                    const session = state.sessions.find((s: ChatSession) => s.id === sessionId);
                    if (session) {
                        session.title = title;
                        session.updatedAt = Date.now();
                    }
                });
            },

            syncSessionsFromDb: (dbSessions) => {
                set((state) => {
                    // Merge DB sessions with existing local sessions
                    const existingIds = new Set(state.sessions.map((s: ChatSession) => s.id));
                    const newSessions = dbSessions
                        .filter((dbSession) => !existingIds.has(dbSession.id))
                        .map((dbSession) => ({
                            id: dbSession.id,
                            title: dbSession.title || "Untitled Chat",
                            messages: [],
                            createdAt: new Date(dbSession.createdAt).getTime(),
                            updatedAt: new Date(dbSession.updatedAt).getTime(),
                            settings: { ...defaultSettings },
                        }));

                    // Update existing sessions with DB data (title changes)
                    for (const dbSession of dbSessions) {
                        const existing = state.sessions.find((s: ChatSession) => s.id === dbSession.id);
                        if (existing) {
                            existing.title = dbSession.title || existing.title;
                            existing.updatedAt = new Date(dbSession.updatedAt).getTime();
                        }
                    }

                    // Add new sessions
                    state.sessions.push(...newSessions);

                    // Sort by updatedAt descending
                    state.sessions.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);
                });
            },

            setIsLoadingSessions: (loading) => {
                set((state) => {
                    state.isLoadingSessions = loading;
                });
            },

            addMessage: (message) => {
                set((state) => {
                    const session = state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
                    if (session) {
                        session.messages.push({
                            ...message,
                            id: crypto.randomUUID(),
                            createdAt: Date.now(),
                        });
                        session.updatedAt = Date.now();
                    }
                });
            },

            updateLastMessage: (updates) => {
                set((state) => {
                    const session = state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
                    if (session && session.messages.length > 0) {
                        const lastMessage = session.messages.at(-1);
                        if (lastMessage) {
                            Object.assign(lastMessage, updates);
                            session.updatedAt = Date.now();
                        }
                    }
                });
            },

            clearMessages: () => {
                set((state) => {
                    const session = state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
                    if (session) {
                        session.messages = [];
                        session.updatedAt = Date.now();
                    }
                });
            },

            setSettings: (newSettings) => {
                set((state) => {
                    Object.assign(state.settings, newSettings);
                    const session = state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
                    if (session) {
                        Object.assign(session.settings, newSettings);
                    }
                });
            },

            setLoading: (loading) => {
                set((state) => {
                    state.isLoading = loading;
                });
            },

            setError: (error) => {
                set((state) => {
                    state.error = error;
                });
            },

            setStreamingContent: (content) => {
                set((state) => {
                    state.streamingContent = content;
                });
            },

            appendStreamingContent: (content) => {
                set((state) => {
                    state.streamingContent += content;
                });
            },
        })),
        {
            name: "academic-rag-chat",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                sessions: state.sessions.slice(-10), // Keep last 10 sessions
                settings: state.settings,
            }),
        }
    )
);
