"use client";

import { BookOpen, ChevronLeft, ChevronRight, Database, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
    {
        title: "Chat",
        href: "/",
        icon: MessageSquare,
        description: "Conversational interface",
    },
    {
        title: "Knowledge Base",
        href: "/manage",
        icon: Database,
        description: "Document management",
    },
    // {
    //     title: "Evaluation",
    //     href: "/evaluation",
    //     icon: BarChart3,
    //     description: "RAGAS metrics",
    // },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "flex h-screen flex-col border-sidebar-border border-r bg-sidebar transition-all duration-300",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-sidebar-border border-b p-4">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-sidebar-primary" />
                        <span className="font-semibold text-sidebar-foreground">MuliaChat</span>
                    </div>
                )}
                <button
                    className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
                    onClick={() => setCollapsed(!collapsed)}
                    type="button"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                            href={item.href}
                            key={item.href}
                        >
                            <item.icon className="flex h-5 w-5 shrink-0" />
                            {!collapsed && (
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{item.title}</span>
                                    <span
                                        className={cn(
                                            "text-xs",
                                            isActive
                                                ? "text-sidebar-primary-foreground/70"
                                                : "text-sidebar-foreground/60"
                                        )}
                                    >
                                        {item.description}
                                    </span>
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
