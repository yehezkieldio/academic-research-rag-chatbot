import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        DATABASE_URL: z.url(),
        AZURE_OPENAI_API_KEY: z.string().min(1),
        AZURE_OPENAI_RESOURCE_NAME: z.string().min(1),
        AZURE_OPENAI_CHAT_DEPLOYMENT: z.string().min(1),
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: z.string().min(1),
        AZURE_OPENAI_BASE_URL: z.string().min(1),
    },
    client: {},
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_RESOURCE_NAME: process.env.AZURE_OPENAI_RESOURCE_NAME,
        AZURE_OPENAI_CHAT_DEPLOYMENT: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        AZURE_OPENAI_BASE_URL: process.env.AZURE_OPENAI_BASE_URL,
    },
});
