/**
 * Database Connection Configuration
 *
 * WHY these specific settings:
 * - **Connection Pooling (globalForDb)**: Prevents connection exhaustion in serverless Next.js
 *   - Serverless functions create new module instances on cold starts
 *   - Without global caching, each request creates new connection \u2192 pool exhaustion
 *   - Global stores single connection across hot starts \u2192 better performance
 *
 * - **prepare: false**: Disables prepared statements for PostgreSQL
 *   - Required for serverless deployments (Vercel, AWS Lambda) where connection state not preserved
 *   - Prepared statements cache query plans - doesn't work with transient connections
 *   - Small performance cost but necessary for deployment architecture
 *
 * - **snake_case casing**: Maps TypeScript camelCase to database snake_case automatically
 *   - TypeScript: `documentChunks` \u2192 SQL: `document_chunks`
 *   - Avoids manual mapping, reduces errors
 *   - Follows PostgreSQL naming conventions
 *
 * - **logger: false**: Disables Drizzle ORM query logging in production
 *   - Development: Enable for debugging (change to `true`)
 *   - Production: Disable to reduce log noise and potential data leakage
 *
 * WHY Drizzle ORM over Prisma:
 * - Type-safe SQL queries without code generation step
 * - Better raw SQL escape hatch for complex queries (e.g., pgvector similarity search)
 * - Smaller bundle size for serverless deployments
 *
 * @module db
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== "production") {
    globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema, casing: "snake_case", logger: false });
