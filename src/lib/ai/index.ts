import { createAzure } from "@ai-sdk/azure";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { env } from "@/lib/env";

export const azure = createAzure({
    resourceName: env.AZURE_OPENAI_RESOURCE_NAME,
    apiKey: env.AZURE_OPENAI_API_KEY,
    baseURL: env.AZURE_OPENAI_BASE_URL,
});

export const AZURE_CHAT_MODEL = azure(env.AZURE_OPENAI_CHAT_DEPLOYMENT);
export const AZURE_EMBEDDING_MODEL = azure.textEmbedding(env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT);

export const CHAT_MODEL = AZURE_CHAT_MODEL;
export const EMBEDDING_MODEL = AZURE_EMBEDDING_MODEL;

export function createModel() {
    return wrapLanguageModel({
        model: CHAT_MODEL,
        middleware: [extractReasoningMiddleware({ tagName: "think" })],
    });
}

export const telemetryConfig = {
    isEnabled: env.NODE_ENV === "production",
    functionId: "muliachat-academic-research-rag",
    metadata: {
        application: "muliachat",
        version: "1.0.0",
    },
};

export function getModelForTask(task: "chat" | "embedding" | "evaluation" | "rerank") {
    switch (task) {
        case "chat":
            return AZURE_CHAT_MODEL;
        case "embedding":
            return AZURE_EMBEDDING_MODEL;
        case "evaluation":
            return AZURE_CHAT_MODEL;
        case "rerank":
            return AZURE_CHAT_MODEL;
        default:
            return AZURE_CHAT_MODEL;
    }
}
