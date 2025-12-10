# Chat Flow and Implementation Report

This document explains how the chat flow works in this repository, from the frontend user input to the backend processing, including both standard RAG mode and Agentic RAG mode, guardrails behavior, tools, telemetry, database usage, and streaming.

Sources referenced:
- [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx) — Frontend UI and hooks
- [src/app/api/chat/route.ts](src/app/api/chat/route.ts) — Main backend route for chat
- [src/lib/rag/agentic-rag.ts](src/lib/rag/agentic-rag.ts) — Agentic RAG implementation
- Other lib utilities: guardrails, hybrid retrieval, context builder, and db schema in `src/lib/*`

---

## 1. High-level Flow

1. User enters a message in the UI chat input and submits.
2. The client sends a POST request to `/api/chat` with a payload containing:
   - `messages`: the conversation (UIMessage array)
   - `sessionId`: optional (used for DB and session state)
   - Settings: `useRag`, `useAgenticMode`, `retrievalStrategy`, `enableGuardrails`
3. The backend `POST` handler in `route.ts` parses the input, detects language, and optionally performs guardrail checks.
4. If `useAgenticMode && useRag` it runs the Agentic RAG pipeline (`runAgenticRag`).
   - Agentic RAG executes a tool-driven workflow, may parallelize searches, decomposes complex queries, and synthesizes a final answer.
5. Otherwise, standard RAG is used: a retrieval call (`retrieveContext`) fetches chunks which are used to build a `system` prompt and the model is asked to generate a response.
6. The model's response is streamed back to the client, saved to DB, and optionally validated by guardrails (output validation).
7. The client receives the chat response and optional metadata (`steps`, `retrievedChunks`, `latencyMs`, `language`, `guardrails`).

This flow supports streaming responses and tool-based reasoning in Agentic RAG mode.

---

## 2. Frontend (UI) Behavior

Files: [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx)

- Chat UI structure:
  - `ChatInterface` contains header, settings, message list, input.
  - `MessageList` renders messages; `MessageBubble` shows content.
  - `AgentStepsCollapsible` and `SourcesCollapsible` render agent steps and retrieved chunks for the assistant message.

- Message model and session handling
  - Messages are `UIMessage` objects with `role` (user/assistant) and `parts`: array of parts (text or tool-call). The client can show both text and tool-call parts.
  - Sessions are loaded from `/api/sessions` and session messages are loaded from `/api/sessions/:id/messages`.
  - `useAgenticChat` is a custom helper to send a POST to `/api/chat` and handle the response for Agentic RAG submission. If agentic mode is disabled, the default `useChat` transport is used for streaming.

- Submitting a message
  - User types in `Textarea` in ChatInput and submits.
  - `useAgenticChat` builds `apiMessages` listing previous messages and the new user message.
  - POST request includes settings: `useRag`, `useAgenticMode`, `retrievalStrategy`, `enableGuardrails`, and `sessionId`.

- Handling responses
  - For Agentic mode the frontend expects a final JSON response (not streaming) containing `content`, `steps`, `retrievedChunks`, `latencyMs`, and `language`.
  - The UI adds an assistant message to the messages list, updates `agentSteps`, `retrievedChunks`, and metadata shown in the header.
  - The message list shows agent reasoning steps and sources if present.

---

## 3. Server Route: API Chat POST Handler

File: [src/app/api/chat/route.ts](src/app/api/chat/route.ts)

Entry: `export async function POST(request: Request)`

Core responsibilities:
- Parse the incoming JSON with messages and settings.
- Extract the user message from the last `UIMessage` part.
- Detect message language using `detectQueryLanguage()`.
- If `enableGuardrails` is true:
  - `validateInput(userMessage)` validates content policy.
  - `detectNegativeReaction(userMessage)` looks for signs of emotional reactions.
  - Log any guardrail checks to DB (`guardrailLogs`) when `sessionId` is present.
  - If negative reaction `severity` is `high`, return an empathetic response (blocked but helpful).
  - If validation fails, return a 400 response.

Decision branching:
- If `useRag && useAgenticMode` → Agentic RAG path (call `runAgenticRag(userMessage, options)`).
  - Save user message and assistant message into `chatMessages` with `agenticMode` flag.
  - Update `chatSessions` updatedAt value.
  - Return JSON with `content`, `steps`, `retrievedChunks`, `latencyMs`, `language`, `reasoning`, and `guardrails`.
- Else → Standard RAG path:
  - If `useRag`, call `retrieveContext(userMessage, options)` to fetch relevant chunks.
  - If `context` is present, build a RAG system prompt (`buildRagPrompt`) combining the retrieved context and system prompts.
  - Call `streamText` with `system` and `messages` converted via `convertToModelMessages`. This uses `experimental_telemetry` including `functionId`, metadata.
  - `onFinish` callback: validate output via `validateOutput` (with guardrails), save both user and assistant messages into `chatMessages` and update session.
  - Return the streaming response (`result.toUIMessageStreamResponse()`), with headers containing retrieved chunks data and language/strategy.

Error handling: top-level `catch` logs the error and returns a 500 with `error` message.

---

## 4. Agentic RAG

File: [src/lib/rag/agentic-rag.ts](src/lib/rag/agentic-rag.ts)

Purpose: A tool-backed agentic retrieval-augmented generation pipeline with parallel tool execution, decomposition, verification, and step tracking.

Main functions and data:
- `runAgenticRag(query, options)` - orchestrates agentic flow, returns `AgenticRagResult` containing:
  - `answer`: synthesized response string
  - `steps`: array of `AgentStep` objects describing tool calls and synthesis steps
  - `retrievedChunks`: array of retrieved documents
  - `citations`: array of citations assigned to retrieved docs
  - `guardrailResults`: results of input/output validations and negative reaction detection
  - `language`: language of the query/response (`en` | `id`)
  - `totalLatencyMs` and optional `reasoning`

- `streamAgenticRag(query, options)` - streaming variant that returns a streaming response and state for client use.

Important components:
- `StreamingState`
  - Holds `retrievedChunks` and `citationManager` for a session.
  - `sessionStates` is a Map<sessionId, StreamingState> for persisting across a session.
  - `getOrCreateStreamingState` manages creating and fetching session state.

- `CitationManager`
  - Assigns incremental numeric citations to chunk IDs and provides a list of citations.

- Tools created with `createAgentTools(language, streamingState)`:
  - `search_documents` — uses `hybridRetrieve(query, options)` to run Okapi BM25 + vector similarity (hybrid). Adds unique chunks to streaming state and assigns citations using the `citationManager`.
  - `expand_query` — expands a query using domain-specific synonyms.
  - `decompose_query` — decomposes complex question into sub-questions. The system prompt instructs the agent to call `search_documents` for all sub-questions in the same turn (parallel execution).
  - `verify_claim` — uses the language model to verify claims against context.
  - `synthesize_answer` — synthesizes the final answer from multiple sources and returns a text.

Tool behavior:
- Tools follow `ai.tool` pattern with `inputSchema` (zod) and a defined `execute` function.
- The `search_documents` tool merges results into `streamingState.retrievedChunks` while avoiding duplicates and assigns citation numbers.
- `decompose_query` returns JSON array of subQuestions and instructs the agent to call `search_documents` for each subquestion in parallel.

Execution:
- `runAgenticRag` creates tools and builds `systemWithLanguage` (forces language). It validates input (guardrails). Then it calls `executeAgentWorkflow` which runs a `generateText` call with tools and `stopWhen` controlled by step count.
- `onStepFinish` (or `processStepFinish`) records tool calls and synthesis steps into `steps`, captures `toolResults` and `toolCalls`, and extracts any `search_documents` results to add to `streamingState`.
- After the agent completes (or stops), Agentic RAG validates output (if enabled) and returns the final assembled result and metadata.

Error handling:
- `NoSuchToolError` is handled and returns a user-facing message about an unavailable tool.
- Other errors bubble up and are re-thrown for top-level catch in `runAgenticRag`.

Notes about parallelization:
- The `AGENTIC_SYSTEM_PROMPT` emphasizes parallel search_documents calls after decompose. Implementation relies on the model producing multiple tool calls in the same step.

---

## 5. Guardrails (Input and Output Validation)

- `validateInput(userMessage)` - checks user input against configured rules and returns `passed` flag and violations.
- `detectNegativeReaction` - detects if user text indicates negative emotions and returns detection and severity.
- `validateOutput(text, { retrievedChunks, query })` - post-response validation that checks whether answer violates policies or is hallucinated/unverified.

Guardrail usage:
- For input: If validation fails, backend returns a 400 or policy text; `negativeReaction.severity === 'high'` results in an empathetic message returned to the user instead of executing the agent.
- For output: Logged in `guardrailLogs` table and stored in `guardrailResults` inside agentic results.
- Both input/output validations are logged in DB: `guardrailLogs` with `sessionId`, `guardrailType`, `triggered`, `severity`, and `details`.

---

## 6. Retrieval / Hybrid Retrieval

- Standard RAG path uses `retrieveContext(userMessage, {topK, minSimilarity, maxTokens, strategy})` from `context-builder`.
- Agentic RAG uses `hybridRetrieve` directly in its `search_documents` tool.
- `hybridRetrieve` returns `RetrievalResult` items:
  - `chunkId`, `documentId`, `documentTitle`, `content`, scores (fusedScore, vectorScore, bm25Score), and `retrievalMethod`.
- Retrieved chunks are used to build system prompts, are saved with the assistant message into DB, and may be exposed to the UI via headers or returned payloads.

---

## 7. Database Interactions

DB interactions use `db` (drizzle-orm) and schema across `lib/db`:
- `chatMessages` — inserted for both user and assistant messages. Saved fields include `role`, `content`, `ragEnabled`, `agenticMode`, `retrievedChunks` (if any), `agentStepsCount`, `latencyMs`, `tokenCount`.
- `chatSessions` — `updatedAt` is set to now whenever a message is saved.
- `guardrailLogs` — store guardrail checks and whether they were triggered.

When a sessionId exists the backend writes entries accordingly. For Agentic RAG, it writes both user and assistant messages once the agent completes.

---

## 8. Telemetry & Headers

- All model calls include `experimental_telemetry` metadata using `telemetryConfig` from `lib/ai` and `functionId` for routing or analytics.
  - `functionId` varies by path: "rag-chat", "direct-chat", "agentic-rag".
  - Additional metadata includes language, retrievalStrategy, sessionId.
- Standard RAG streaming responds with HTTP headers via `result.toUIMessageStreamResponse({ headers })` containing:
  - `X-Retrieved-Chunks`: JSON string of retrieved chunk titles and similarity
  - `X-Retrieval-Strategy` and `X-Language` to inform the client

---

## 9. Streaming and Message Lifecycle

- Standard RAG uses `streamText` which returns a `toUIMessageStreamResponse()` that streams the assistant text back to the client.
  - `onFinish` is used to finalize DB saves and run output guardrails.
- Agentic RAG supports streaming via `streamAgenticRag` which returns streaming object `stream` and `steps`, `retrievedChunks`, `citations` for the client.
- Client-side for non-agentic streaming uses the SDK `useChat` and `DefaultChatTransport` to stream messages and call `onFinish`/`onError` callbacks.

---

## 10. Tool-Specific Notes and UX Details

- `decompose_query` expects the model to return a JSON array of sub-questions. The instruction is explicit: after decomposing, call `search_documents` for *all* sub-questions in the same turn.
- `verify_claim` encourages a JSON response format { supported, confidence, evidence } which the agent can use to reduce hallucinations.
- `synthesize_answer` returns final synthesized text and a source count.
- `search_documents` returns shortened content previews and fused `score` for display.

Client-side UX:
- Agent steps are shown in a collapsible with icons showing step type.
- Sources are shown with similarity and score bars.
- The ChatHeader includes language detection and latency.
- Settings panel toggles RAG and Agentic mode, guardrails, and retrieval strategy.

---

## 11. Error handling and special cases

- Top-level errors inside `route.ts` return a 500 with `error` and message details.
- Agentic RAG returns a policy-friendly message when input fails guardrails.
- If the model uses a wrong language, `executeAgentWorkflow` tries a forced re-synthesis using collected sources and re-generating text in the expected language.
- The agent avoids adding duplicate retrieved chunks to `streamingState`.

---

## 12. Security & Policy Considerations

- Guardrails check the user input and output for policy violations and negative reactions. These checks result in internal logging and may block or modify responses.
- DB writes are limited to session-based logs and message content. Guardrail logs include details but are not published to the client (client gets high-level flags).

---

## 13. Developer Notes & Follow-ups

- Tools rely on `hybridRetrieve` and other domain-specific utilities in `src/lib/rag/*` — if you customize the retrieval strategy, update `createSearchTool` accordingly.
- `AGENTIC_SYSTEM_PROMPT` enforces behavior constraints — if you need to change how parallel tool calls work, update this prompt and validate with new model runs.
- `sessionStates` Map is in-memory; for long-lived production sessions or horizontally scaled servers you may need to persist streaming state in an external store (Redis).
- Telemetry config and function ids are used for metrics. If you integrate with telemetry backend, ensure this metadata is passed and stored.

---

## 14. Quick Sequence Example (Simple Question)

User: "Summarize key findings from document X."

Sequence:
1. Client sends POST to `/api/chat` with message and sessionId.
2. Server `POST` extracts user message and language; guardrails run.
3. Options: (a) Agentic RAG: `runAgenticRag` runs tools: decompose (optional), search_documents (parallel), verify claims, synthesize; returns final JSON with `content`, `steps`. (b) Standard RAG: `retrieveContext` fetches chunks, `buildRagPrompt` builds system prompt, and `streamText` streams back answer while writing to DB on finish.
4. DB entries created for user and assistant messages; `guardrailLogs` are updated.
5. Client updates UI with text, steps, sources, latency and language.

---

## Related Files and Quick Links
- [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx) (frontend UI and logic)
- [src/app/api/chat/route.ts](src/app/api/chat/route.ts) (server POST handler)
- [src/lib/rag/agentic-rag.ts](src/lib/rag/agentic-rag.ts) (Agentic RAG core)
- [src/lib/rag/hybrid-retrieval.ts](src/lib/rag/hybrid-retrieval.ts) (retrieval implementation)
- [src/lib/rag/context-builder.ts](src/lib/rag/context-builder.ts) (prompt building & context)
- [src/lib/rag/guardrails.ts](src/lib/rag/guardrails.ts) (input/output validation)
- [src/lib/db](src/lib/db) (database schema and indexing)

---

If you want, I can also add a diagram (sequence diagram) or a short README section with simple developer steps to run and test the agentic vs standard flows.
