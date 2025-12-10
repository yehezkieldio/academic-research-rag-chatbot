import { ChatInterface } from "@/components/chat/chat-interface";
import { Sidebar } from "@/components/layout/sidebar";

export default function ChatPage() {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden">
                <ChatInterface />
            </main>
        </div>
    );
}
