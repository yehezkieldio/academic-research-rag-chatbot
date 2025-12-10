import { createAzure } from "@ai-sdk/azure";
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

export const telemetryConfig = {
    isEnabled: env.NODE_ENV === "production",
    functionId: "muliachat-academic-research-rag",
    metadata: {
        application: "muliachat",
        version: "1.0.0",
    },
};
