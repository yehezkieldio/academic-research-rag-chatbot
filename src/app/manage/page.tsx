import { Database, FileText, Upload } from "lucide-react";
import { DocumentList } from "@/components/manage/document-list";
import { DocumentUploader } from "@/components/manage/document-uploader";
import { Sidebar } from "@/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManagePage() {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="mx-auto max-w-6xl p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Database className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="font-semibold text-2xl text-foreground">Knowledge Base</h1>
                        </div>
                        <p className="text-muted-foreground">
                            Upload, manage, and organize documents for the RAG system
                        </p>
                    </div>

                    {/* Tabs */}
                    <Tabs className="space-y-4" defaultValue="upload">
                        <TabsList>
                            <TabsTrigger className="gap-2" value="upload">
                                <Upload className="h-4 w-4" />
                                Upload Documents
                            </TabsTrigger>
                            <TabsTrigger className="gap-2" value="documents">
                                <FileText className="h-4 w-4" />
                                Document Library
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload">
                            <DocumentUploader />
                        </TabsContent>

                        <TabsContent value="documents">
                            <DocumentList />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
}
