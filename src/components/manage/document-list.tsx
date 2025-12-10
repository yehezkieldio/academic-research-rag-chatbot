"use client";

import { formatDistanceToNow } from "date-fns";
import {
    AlertCircle,
    BookOpen,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    GraduationCap,
    Layers,
    Loader2,
    MoreHorizontal,
    RefreshCw,
    Search,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Document {
    id: string;
    title: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    processingStatus: string;
    processingError?: string;
    chunkingStrategy?: string;
    metadata?: {
        category?: string;
        tags?: string[];
        wordCount?: number;
        documentType?: string;
        courseCode?: string;
        department?: string;
        keywords?: string[];
        chunksCount?: number;
        pages?: number;
    };
    createdAt: string;
}

export function DocumentList() {
    const { data, error, isLoading, mutate } = useSWR("/api/documents", fetcher, {
        refreshInterval: 5000,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

    const documents: Document[] = data?.documents || [];

    const filteredDocs = documents.filter(
        (doc) =>
            doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.metadata?.courseCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.metadata?.keywords?.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
        mutate();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <Badge className="gap-1 border-green-500/30 bg-green-500/20 text-green-600" variant="default">
                        <CheckCircle className="h-3 w-3" />
                        Indexed
                    </Badge>
                );
            case "processing":
                return (
                    <Badge className="gap-1" variant="secondary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="gap-1" variant="outline">
                        <Clock className="h-3 w-3" />
                        Pending
                    </Badge>
                );
            case "failed":
                return (
                    <Badge className="gap-1" variant="destructive">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getDocTypeIcon = (docType?: string) => {
        switch (docType) {
            case "syllabus":
            case "lecture_notes":
                return <GraduationCap className="h-4 w-4" />;
            case "research_paper":
            case "thesis":
                return <BookOpen className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search and Actions */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative max-w-sm flex-1">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents, courses, keywords..."
                        value={searchQuery}
                    />
                </div>
                <Button onClick={() => mutate()} size="icon" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Documents Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Chunking</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="w-[50px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDocs.length === 0 ? (
                            <TableRow>
                                <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                                    {searchQuery ? "No documents match your search" : "No documents uploaded yet"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredDocs.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-muted p-2">
                                                {getDocTypeIcon(doc.metadata?.documentType)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{doc.title}</p>
                                                <p className="text-muted-foreground text-xs">{doc.fileName}</p>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {doc.metadata?.courseCode && (
                                                        <Badge className="bg-primary/5 py-0 text-xs" variant="outline">
                                                            {doc.metadata.courseCode}
                                                        </Badge>
                                                    )}
                                                    {doc.metadata?.documentType &&
                                                        doc.metadata.documentType !== "other" && (
                                                            <Badge className="py-0 text-xs" variant="secondary">
                                                                {doc.metadata.documentType.replace("_", " ")}
                                                            </Badge>
                                                        )}
                                                    {doc.metadata?.tags?.slice(0, 2).map((tag) => (
                                                        <Badge className="py-0 text-xs" key={tag} variant="outline">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="text-xs uppercase" variant="outline">
                                            {doc.fileType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="gap-1 text-xs" variant="secondary">
                                            <Layers className="h-3 w-3" />
                                            {doc.chunkingStrategy || "recursive"}
                                        </Badge>
                                        {doc.metadata?.chunksCount && (
                                            <p className="mt-1 text-muted-foreground text-xs">
                                                {doc.metadata.chunksCount} chunks
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(doc.processingStatus)}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button className="h-8 w-8" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="gap-2" onClick={() => setSelectedDoc(doc)}>
                                                    <Eye className="h-4 w-4" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="gap-2 text-destructive"
                                                    onClick={() => handleDelete(doc.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Stats */}
            {documents.length > 0 && (
                <div className="flex gap-4 text-muted-foreground text-sm">
                    <span>{documents.length} documents</span>
                    <span>{documents.filter((d) => d.processingStatus === "completed").length} indexed</span>
                    <span>{documents.filter((d) => d.processingStatus === "processing").length} processing</span>
                </div>
            )}

            <Dialog onOpenChange={() => setSelectedDoc(null)} open={!!selectedDoc}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDoc?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedDoc && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">File Name</p>
                                    <p className="font-medium">{selectedDoc.fileName}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">File Size</p>
                                    <p className="font-medium">{(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Document Type</p>
                                    <p className="font-medium capitalize">
                                        {selectedDoc.metadata?.documentType?.replace("_", " ") || "Unknown"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Chunking Strategy</p>
                                    <p className="font-medium capitalize">
                                        {selectedDoc.chunkingStrategy || "Recursive"}
                                    </p>
                                </div>
                                {selectedDoc.metadata?.courseCode && (
                                    <div>
                                        <p className="text-muted-foreground">Course Code</p>
                                        <p className="font-medium">{selectedDoc.metadata.courseCode}</p>
                                    </div>
                                )}
                                {selectedDoc.metadata?.department && (
                                    <div>
                                        <p className="text-muted-foreground">Department</p>
                                        <p className="font-medium">{selectedDoc.metadata.department}</p>
                                    </div>
                                )}
                                {selectedDoc.metadata?.pages && (
                                    <div>
                                        <p className="text-muted-foreground">Pages</p>
                                        <p className="font-medium">{selectedDoc.metadata.pages}</p>
                                    </div>
                                )}
                                {selectedDoc.metadata?.wordCount && (
                                    <div>
                                        <p className="text-muted-foreground">Word Count</p>
                                        <p className="font-medium">{selectedDoc.metadata.wordCount.toLocaleString()}</p>
                                    </div>
                                )}
                                {selectedDoc.metadata?.chunksCount && (
                                    <div>
                                        <p className="text-muted-foreground">Total Chunks</p>
                                        <p className="font-medium">{selectedDoc.metadata.chunksCount}</p>
                                    </div>
                                )}
                            </div>
                            {selectedDoc.metadata?.keywords && selectedDoc.metadata.keywords.length > 0 && (
                                <div>
                                    <p className="mb-2 text-muted-foreground text-sm">Extracted Keywords</p>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedDoc.metadata.keywords.map((keyword) => (
                                            <Badge key={keyword} variant="outline">
                                                {keyword}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
