- [ ] Upload 20-50 relevant documents to knowledge base
- [ ] Create 30-50 evaluation questions with ground truth
- [ ] Run evaluation (wait for completion)
- [ ] Run ablation study (test all configurations)
- [ ] Export data as Python/R script
- [ ] Run statistical analysis
- [ ] Review generated figures and tables
- [ ] Copy statistical results to paper (Methods & Results sections)
- [ ] Include ablation study table
- [ ] Add latency comparison chart
- [ ] Report effect sizes and confidence intervals
- [ ] Discuss trade-offs (accuracy vs latency)

## �� How to Run Evaluations for Your Paper

### **Step 1: Prepare Your Test Dataset**

Create evaluation questions with ground truth answers:

\`\`\`typescript
// In your evaluation UI or via API
const testQuestions = [
  {
    question: "Apa itu pembelajaran mesin?",
    groundTruth: "Pembelajaran mesin adalah cabang dari kecerdasan buatan yang memungkinkan sistem komputer untuk belajar dari data dan meningkatkan kinerjanya tanpa diprogram secara eksplisit."
  },
  {
    question: "What is the difference between supervised and unsupervised learning?",
    groundTruth: "Supervised learning uses labeled training data where the correct outputs are known, while unsupervised learning works with unlabeled data to find patterns and structure."
  },
  // Add 30-50 questions for statistical significance
];
\`\`\`

### **Step 2: Run Evaluation (via UI)**

1. Navigate to `/evaluation` page
2. Click "Create New Evaluation"
3. Add your test questions (paste JSON or enter manually)
4. Click "Run Evaluation"
5. Wait for completion (shows progress)
6. View results in tabs:
   - **Metrics**: RAGAS scores, hallucination rates, latency
   - **Ablation**: Comparison across 13 configurations
   - **Hallucination Analysis**: Detailed hallucination patterns
   - **Domain Metrics**: Academic-specific performance

## 📊 Statistical Analysis Output

### **What You Get**

The exported Python/R scripts automatically calculate:

1. **Descriptive Statistics**
   - Mean, median, SD for all metrics
   - By condition (RAG vs Non-RAG)
   - By configuration (baseline, vector, hybrid, etc.)

2. **Inferential Statistics**
   - **Paired t-test**: RAG vs Non-RAG comparison
   - **Independent t-test**: Between different configurations
   - **One-way ANOVA**: Overall comparison across all configs
   - **Tukey HSD**: Post-hoc pairwise comparisons

3. **Effect Sizes**
   - **Cohen's d**: Magnitude of differences
   - **η² (eta squared)**: ANOVA effect size
   - Interpretation labels (small, medium, large)

4. **Confidence Intervals**
   - 95% CI for all mean differences
   - Bootstrap CI (2000 iterations) for robust estimation

5. **Visualizations** (Python/R only)
   - Box plots comparing RAG vs Non-RAG
   - Bar charts with error bars
   - Heatmap of metric correlations
   - Latency comparison charts