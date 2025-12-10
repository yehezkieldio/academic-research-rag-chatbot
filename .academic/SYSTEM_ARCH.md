### **1. Architectural Overview**

The system implements a **multi-stage, agentic Retrieval-Augmented Generation (RAG)** pipeline designed for bilingual (Indonesian/English) academic domains. Unlike traditional architectures that rely on database-native full-text search engines (e.g., Postgres `tsvector`), this system decouples keyword scoring from the storage layer. It utilizes a **"Vector-First Candidate Generation"** strategy, where high-recall semantic search retrieves a candidate pool, followed by an in-memory, application-side implementation of the Okapi BM25 algorithm for high-precision reranking.

The architecture consists of four distinct processing layers:
1.  **Ingestion & Structural Chunking**
2.  **Hybrid Retrieval (The "Vector-First" Core)**
3.  **Semantic Reranking**
4.  **Agentic Orchestration & Guardrails**

---

### **2. Layer-by-Layer Technical Description**

#### **Layer 1: Domain-Aware Ingestion**

To handle the structural complexity of academic texts (theses, journals), the system employs a **Hierarchical & Semantic Chunking Strategy**:

* **Structure Detection:** The system utilizes regex-based pattern matching to identify academic sections (e.g., "Abstract", "Metodologi", "Daftar Pustaka") and separates content by logical boundaries rather than arbitrary character counts.
* **Semantic Segmentation:** Instead of fixed-window splitting, the system calculates cosine similarity between consecutive sentences. A "break" is introduced only when the semantic similarity drops below a threshold (`semanticThreshold: 0.5`), ensuring chunks represent coherent topics.
* **Language Detection:** A lightweight classifier detects the language (ID/EN) at the chunk level to apply appropriate stop-word filters and stemming rules (using a custom Indonesian stemmer for prefixes like `meng-`, `ber-`, `di-`).

#### **Layer 2: Client-Side Hybrid Retrieval (Core Contribution)**

This layer addresses the limitation of database vendor lock-in by moving the ranking logic to the application layer.

1.  **Vector Candidate Generation (Recall):**
    * The system first queries `pgvector` using the `<=>` (Cosine Distance) operator.
    * It retrieves an **oversampled candidate pool** of size $3 \times K$ (where $K$ is the final desired count). This oversampling provides the necessary statistical corpus for the local BM25 calculation.
2.  **Stateless BM25 Scoring (Precision):**
    * An in-memory implementation of **Okapi BM25** is applied to the retrieved candidate pool.
    * *Mathematical Note:* Unlike standard BM25 which calculates Inverse Document Frequency (IDF) over the entire database, this system calculates **Local IDF** over the retrieved vectors. This acts as a "contextual differentiator," penalizing terms that are ubiquitous within the specific semantic cluster while boosting exact keyword matches.
3.  **Reciprocal Rank Fusion (RRF):**
    * The Vector scores and BM25 scores are fused using the formula:
        $$Score(d) = \sum_{rank \in R} \frac{1}{k + rank(d)}$$
    * The constant $k$ is set to **60**, balancing the influence of high-ranking items from both retrieval methods.

#### **Layer 3: Neural Reranking**

To filter out semantic "drift" (documents that share keywords but different meanings), the fused results undergo a final pass:

* **Cross-Encoder Strategy:** For latency-sensitive queries, a distilled BERT model (`ms-marco-TinyBERT-L-2-v2`) scores query-passage pairs.
* **LLM Listwise Reranking:** For complex agentic queries, the system employs a "Listwise" approach where the LLM (Large Language Model) receives the top 10 documents and outputs a JSON-structured ranking based on reasoning (e.g., "Document A is more relevant because it addresses the methodology directly").

#### **Layer 4: Agentic Orchestration & Governance**

The system does not simply feed retrieved chunks to the LLM. It uses an **Agentic Workflow**:

* **Query Decomposition:** Complex academic questions (e.g., "Compare the methodology of Paper A and Paper B") are decomposed into sub-questions.
* **Parallel Execution:** The agent triggers multiple `search_documents` tool calls in parallel to gather evidence for all sub-questions simultaneously.
* **Safety Guardrails:**
    * **Input/Output Validation:** Detects PII (e.g., Student IDs, NIK) and Toxic content.
    * **Hallucination Check:** A "Self-Correction" loop verifies if the generated answer contains statistical claims or citations not present in the source chunks.
    * **Sentiment analysis:** Detects user frustration to escalate or change tone.

---

### **3. Implementation Diagram Description**

1.  **User Input** $\rightarrow$ **Guardrails** (PII/Toxicity Check).
2.  **Query Processor** $\rightarrow$ Decomposes Query (if Agentic) OR Expands Synonyms (En/Id).
3.  **Retrieval Engine**:
    * *Path A:* **Postgres (pgvector)** $\rightarrow$ Returns Top-30 Chunks via Cosine Similarity.
    * *Path B:* **In-Memory Engine** $\rightarrow$ Tokenizes Candidates $\rightarrow$ Calculates Local BM25.
4.  **Fusion Layer**: RRF Algorithm merges Vector Rank + BM25 Rank.
5.  **Reranker**: Cross-Encoder filters Top-30 down to Top-5.
6.  **Synthesis**: LLM generates answer with `[Citation]` tags based on Top-5 chunks.
7.  **Output Guardrail**: Verifies Citations & Hallucinations $\rightarrow$ **Final Response**.

---

### **4. Key Research Defenses (The "Why")**

* **Why not Postgres FTS?**
    * *Defense:* "By implementing BM25 in the application layer, the system achieves **database agility**. The vector store can be swapped (e.g., from Postgres to Qdrant or Milvus) without losing the keyword-search capability, as the keyword logic is part of the application code, not the database engine."
* **Why Local IDF (BM25 on Candidates)?**
    * *Defense:* "Global IDF requires maintaining an inverted index of the entire corpus, which is computationally expensive to update. Our **Local IDF** approach leverages the vector engine to define a 'semantic neighborhood,' then uses BM25 to discriminate specificity within that neighborhood. This approximates global search behavior with significantly lower overhead."
* **Why Agentic RAG?**
    * *Defense:* "Academic queries are often multi-faceted. Standard RAG fails on 'Compare and Contrast' queries. Our agentic decomposition allows the system to retrieve disparate information (e.g., 'Methodology of X' and 'Methodology of Y') in parallel, synthesizing a coherent answer that a single-step retrieval could not achieve."