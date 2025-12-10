"use client";

import { Check, ChevronDown, Edit2, Loader2, MessageSquare, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ChatSession, useChatStore } from "@/lib/stores/chat-stores";
import { cn } from "@/lib/utils";

interface SessionManagerProps {
    onSessionChange?: (sessionId: string) => void;
    onNewSession?: (sessionId: string) => void;
}

export const SessionManager = memo(function SessionManagerComponent({
    onSessionChange,
    onNewSession,
}: SessionManagerProps) {
    const {
        sessions,
        activeSessionId,
        setActiveSession,
        deleteSession,
        deleteAllSessions,
        renameSession,
        syncSessionsFromDb,
        settings,
        isLoadingSessions,
        setIsLoadingSessions,
    } = useChatStore();

    const [isCreating, setIsCreating] = useState(false);
    const [newSessionTitle, setNewSessionTitle] = useState("");
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");

    // Fetch sessions from database on mount
    useEffect(() => {
        const fetchSessions = async () => {
            setIsLoadingSessions(true);
            try {
                const response = await fetch("/api/sessions");
                const { sessions: dbSessions } = await response.json();
                if (dbSessions) {
                    syncSessionsFromDb(dbSessions);
                }
            } catch (error) {
                console.error("Failed to fetch sessions:", error);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        fetchSessions();
    }, [syncSessionsFromDb, setIsLoadingSessions]);

    const handleCreateSession = useCallback(async () => {
        setIsCreating(true);
        try {
            const response = await fetch("/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newSessionTitle.trim() || undefined,
                    useRag: settings.useRag,
                    useAgenticMode: settings.useAgenticMode,
                    retrievalStrategy: settings.retrievalStrategy,
                }),
            });
            const { session: dbSession } = await response.json();

            if (dbSession?.id) {
                useChatStore.setState((state) => ({
                    sessions: [
                        {
                            id: dbSession.id,
                            title: dbSession.title || "New Chat",
                            messages: [],
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            settings: { ...settings },
                        },
                        ...state.sessions,
                    ],
                    activeSessionId: dbSession.id,
                }));
                onNewSession?.(dbSession.id);
            }
        } catch (error) {
            console.error("Failed to create session:", error);
        } finally {
            setIsCreating(false);
            setNewSessionTitle("");
        }
    }, [newSessionTitle, settings, onNewSession]);

    const handleSwitchSession = useCallback(
        (sessionId: string) => {
            setActiveSession(sessionId);
            onSessionChange?.(sessionId);
        },
        [setActiveSession, onSessionChange]
    );

    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            if (!window.confirm("Delete this chat session? This cannot be undone.")) {
                return;
            }

            try {
                await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
                deleteSession(sessionId);
            } catch (error) {
                console.error("Failed to delete session:", error);
            }
        },
        [deleteSession]
    );

    const handleDeleteAllSessions = useCallback(async () => {
        if (!window.confirm("Delete ALL chat sessions? This cannot be undone.")) {
            return;
        }

        try {
            await fetch("/api/sessions", { method: "DELETE" });
            deleteAllSessions();
        } catch (error) {
            console.error("Failed to delete all sessions:", error);
        }
    }, [deleteAllSessions]);

    const handleStartRename = useCallback((session: ChatSession) => {
        setEditingSessionId(session.id);
        setEditingTitle(session.title);
    }, []);

    const handleSaveRename = useCallback(
        async (sessionId: string) => {
            const newTitle = editingTitle.trim();
            if (!newTitle) {
                setEditingSessionId(null);
                return;
            }

            try {
                await fetch(`/api/sessions/${sessionId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: newTitle }),
                });
                renameSession(sessionId, newTitle);
            } catch (error) {
                console.error("Failed to rename session:", error);
            } finally {
                setEditingSessionId(null);
            }
        },
        [editingTitle, renameSession]
    );

    const handleCancelRename = useCallback(() => {
        setEditingSessionId(null);
        setEditingTitle("");
    }, []);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        }
        if (diffDays === 1) {
            return "Yesterday";
        }
        if (diffDays < 7) {
            return date.toLocaleDateString("en-US", { weekday: "short" });
        }
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    return (
        <div className="flex h-full flex-col">
            {/* Header with New Chat */}
            <div className="border-border border-b p-3">
                <div className="flex items-center gap-2">
                    <Input
                        className="h-8 flex-1 text-sm"
                        disabled={isCreating}
                        onChange={(e) => setNewSessionTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleCreateSession();
                            }
                        }}
                        placeholder="New chat title (optional)"
                        value={newSessionTitle}
                    />
                    <Button className="h-8 shrink-0" disabled={isCreating} onClick={handleCreateSession} size="sm">
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Session List */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {isLoadingSessions && (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading sessions...</span>
                        </div>
                    )}
                    {!isLoadingSessions && sessions.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            No chat sessions yet.
                            <br />
                            Create one to get started!
                        </div>
                    )}
                    {!isLoadingSessions && sessions.length > 0 && (
                        <div className="space-y-1">
                            {sessions.map((session) => (
                                <SessionItem
                                    editingTitle={editingTitle}
                                    formatDate={formatDate}
                                    isActive={session.id === activeSessionId}
                                    isEditing={editingSessionId === session.id}
                                    key={session.id}
                                    onCancelRename={handleCancelRename}
                                    onDelete={() => handleDeleteSession(session.id)}
                                    onSaveRename={() => handleSaveRename(session.id)}
                                    onSelect={() => handleSwitchSession(session.id)}
                                    onSetEditingTitle={setEditingTitle}
                                    onStartRename={() => handleStartRename(session)}
                                    session={session}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer with Delete All */}
            {sessions.length > 0 && (
                <div className="border-border border-t p-2">
                    <Button
                        className="w-full text-destructive hover:text-destructive"
                        onClick={handleDeleteAllSessions}
                        size="sm"
                        variant="ghost"
                    >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete All Sessions
                    </Button>
                </div>
            )}
        </div>
    );
});

interface SessionItemProps {
    session: ChatSession;
    isActive: boolean;
    isEditing: boolean;
    editingTitle: string;
    formatDate: (timestamp: number) => string;
    onSelect: () => void;
    onDelete: () => void;
    onStartRename: () => void;
    onSaveRename: () => void;
    onCancelRename: () => void;
    onSetEditingTitle: (title: string) => void;
}

const SessionItem = memo(function SessionItemComponent({
    session,
    isActive,
    isEditing,
    editingTitle,
    formatDate,
    onSelect,
    onDelete,
    onStartRename,
    onSaveRename,
    onCancelRename,
    onSetEditingTitle,
}: SessionItemProps) {
    if (isEditing) {
        return (
            <div className="flex items-center gap-1 rounded-md bg-muted p-2">
                <Input
                    autoFocus
                    className="h-7 flex-1 text-sm"
                    onChange={(e) => onSetEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            onSaveRename();
                        } else if (e.key === "Escape") {
                            onCancelRename();
                        }
                    }}
                    value={editingTitle}
                />
                <Button className="h-7 w-7" onClick={onSaveRename} size="icon" variant="ghost">
                    <Check className="h-3 w-3" />
                </Button>
                <Button className="h-7 w-7" onClick={onCancelRename} size="icon" variant="ghost">
                    <X className="h-3 w-3" />
                </Button>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-muted/50",
                isActive && "bg-muted"
            )}
        >
            <button className="flex flex-1 items-center gap-2 text-left" onClick={onSelect} type="button">
                <MessageSquare
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                />
                <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", isActive ? "font-medium" : "text-foreground")}>
                        {session.title}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                        {formatDate(session.updatedAt)}
                        {session.messages.length > 0 && ` • ${session.messages.length} messages`}
                    </p>
                </div>
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        size="icon"
                        variant="ghost"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onStartRename}>
                        <Edit2 className="mr-2 h-3 w-3" />
                        Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
});

// Compact dropdown version for header
interface SessionSelectorProps {
    onSessionChange?: (sessionId: string) => void;
    onNewSession?: (sessionId: string) => void;
}

export const SessionSelector = memo(function SessionSelectorComponent({
    onSessionChange,
    onNewSession,
}: SessionSelectorProps) {
    const {
        sessions,
        activeSessionId,
        setActiveSession,
        syncSessionsFromDb,
        settings,
        isLoadingSessions,
        setIsLoadingSessions,
    } = useChatStore();

    const [isCreating, setIsCreating] = useState(false);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    // Fetch sessions from database on mount
    useEffect(() => {
        const fetchSessions = async () => {
            setIsLoadingSessions(true);
            try {
                const response = await fetch("/api/sessions");
                const { sessions: dbSessions } = await response.json();
                if (dbSessions) {
                    syncSessionsFromDb(dbSessions);
                }
            } catch (error) {
                console.error("Failed to fetch sessions:", error);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        fetchSessions();
    }, [syncSessionsFromDb, setIsLoadingSessions]);

    const handleCreateSession = useCallback(async () => {
        setIsCreating(true);
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
                        {
                            id: dbSession.id,
                            title: dbSession.title || "New Chat",
                            messages: [],
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            settings: { ...settings },
                        },
                        ...state.sessions,
                    ],
                    activeSessionId: dbSession.id,
                }));
                onNewSession?.(dbSession.id);
            }
        } catch (error) {
            console.error("Failed to create session:", error);
        } finally {
            setIsCreating(false);
        }
    }, [settings, onNewSession]);

    const handleSwitchSession = useCallback(
        (sessionId: string) => {
            setActiveSession(sessionId);
            onSessionChange?.(sessionId);
        },
        [setActiveSession, onSessionChange]
    );

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="gap-2" size="sm" variant="outline">
                        <MessageSquare className="h-4 w-4" />
                        <span className="max-w-[150px] truncate">
                            {isLoadingSessions ? "Loading..." : activeSession?.title || "Select Chat"}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    {sessions.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground text-sm">No sessions yet</div>
                    ) : (
                        <ScrollArea className="max-h-64">
                            {sessions.map((session) => (
                                <DropdownMenuItem
                                    className={cn(
                                        "flex cursor-pointer flex-col items-start gap-0.5",
                                        session.id === activeSessionId && "bg-muted"
                                    )}
                                    key={session.id}
                                    onClick={() => handleSwitchSession(session.id)}
                                >
                                    <span className="truncate font-medium">{session.title}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {new Date(session.updatedAt).toLocaleDateString()}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </ScrollArea>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer" disabled={isCreating} onClick={handleCreateSession}>
                        {isCreating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        New Chat
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
});
