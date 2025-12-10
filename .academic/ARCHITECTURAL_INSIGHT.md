
## 4. Key Architectural Insights (WHY This System Exists)

### Research Hypothesis
**Problem**: Traditional chatbots hallucinate and miss specific terminology
**Solution**: Agentic RAG with hybrid search (BM25 for keywords + embeddings for semantics)
**Validation**: Ablation studies + statistical significance testing

### Design Decisions

#### WHY Hybrid Search (Not Just Vector)?
- Vector-only misses exact course codes ("TI-101"), acronyms ("RPS"), names
- BM25-only fails on semantic queries ("What is the methodology?" vs "What are the methods?")
- Fusion (Reciprocal Rank Fusion) combines strengths of both
- **Evidence**: ablationStudies table tracks vector-only vs hybrid-only vs fusion performance

#### WHY Agentic Mode (Not Just RAG)?
- Complex academic queries need decomposition ("Compare X and Y" → search X, search Y, synthesize)
- Single retrieval-generation pass insufficient for multi-hop reasoning
- Agent tools (expand_query, decompose_query, verify_claim) enable stepwise reasoning
- **Evidence**: agentSteps table logs tool usage patterns and multi-step traces

#### WHY Multiple Reranking Strategies?
- Cross-encoder (TinyBERT): Fast (~100ms) but lower quality
- LLM (GPT-4): High quality but slow (~3-5s per query)
- Ensemble: Best quality but computationally expensive
- Trade-off: latency vs quality depends on use case (interactive chat vs batch evaluation)
- **Evidence**: rerankerStrategy field in evaluations tracks which performs best

#### WHY Comprehensive Guardrails?
- **PII Detection**: University context - students might share NIK, student IDs (privacy law compliance)
- **Academic Integrity**: Prevent "do my homework" abuse (institutional policy)
- **Negative Reaction Detection**: Identify user frustration for UX improvement
- **Hallucination Prevention**: Academic credibility requires factual accuracy
- **Evidence**: guardrailLogs table enables audit trail and policy violation analysis

#### WHY Statistical Significance Testing?
- Academic publication requires p-values, effect sizes, confidence intervals
- Can't claim "System A better than System B" without statistical evidence
- Paired t-tests: Compare same questions across configurations
- ANOVA: Compare 3+ configurations (e.g., chunking strategies)
- **Evidence**: statisticalAnalyses table stores test results for paper methodology section

### Indonesian-Specific Adaptations

#### WHY Indonesian Language Focus?
- Research context: Universitas Mulia (Indonesian university)
- Academic documents primarily in Indonesian (skripsi, tesis, RPS)
- Terminology: "metodologi" ≠ "metode" but both valid academic terms
- **Implementation**: Indonesian stemming, stopwords, synonym expansion in `university-domain.ts`

#### WHY Indonesian Document Type Detection?
- "Skripsi" (S1 thesis), "Tesis" (S2 thesis), "Disertasi" (S3 dissertation) have different structures
- "RPS" (Rencana Pembelajaran Semester) = syllabus equivalent, specific format
- Document type affects retrieval (e.g., thesis has methodology section, syllabus doesn't)
- **Implementation**: Pattern matching + LLM classification in `detectDocumentType()`