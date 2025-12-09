import { generateText } from "ai";
import { CHAT_MODEL } from "@/lib/ai";

export interface GuardrailResult {
    passed: boolean;
    violations: GuardrailViolation[];
    modifiedContent?: string;
    severity: "none" | "low" | "medium" | "high" | "critical";
    suggestedResponse?: string;
    requiresEscalation?: boolean;
}

export interface GuardrailViolation {
    rule: string;
    type: GuardrailType;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    matchedContent?: string;
    action: "blocked" | "flagged" | "modified" | "allowed" | "redirect";
    remediation?: string;
}

export type GuardrailType =
    | "pii_detection"
    | "prompt_injection"
    | "topic_relevance"
    | "toxicity"
    | "hallucination"
    | "citation_verification"
    | "academic_integrity"
    | "rate_limiting"
    | "negative_reaction" // Added new guardrail type
    | "frustration_detection" // Added new guardrail type
    | "feedback_sentiment"; // Added new guardrail type

// ... existing code for PII_PATTERNS ...

const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+?62|0)[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,
    phone_us: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    nik: /\b\d{16}\b/g,
    ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    studentId: /\b[A-Z]{0,3}\d{6,10}\b/gi,
    nim: /\b(NIM|NPM)[\s:.-]?\d{8,15}\b/gi,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

const IS_QUESTION_PATTERN =
    /\?|what|how|why|when|where|who|explain|describe|define|apa|bagaimana|mengapa|kapan|dimana|siapa|jelaskan|definisikan/i;

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    /disregard\s+(all\s+)?(previous|prior|above)/i,
    /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
    /you\s+are\s+now\s+(a|an|in)\s+(new|different|jailbreak)/i,
    /pretend\s+(you\s+are|to\s+be)\s+(a|an)/i,
    /act\s+as\s+(if|though)\s+you/i,
    /override\s+(your|all|the)\s+(instructions?|rules?|guidelines?)/i,
    /bypass\s+(your|all|the)\s+(restrictions?|limitations?|filters?)/i,
    /system\s*:\s*/i,
    /\[INST\]/i,
    /<<SYS>>/i,
    /\{\{.*system.*\}\}/i,
    /abaikan\s+(semua\s+)?(instruksi|perintah|aturan)\s+(sebelumnya|di\s+atas)/i,
    /lupakan\s+(semua|seluruh)\s+(instruksi|perintah|aturan)/i,
    /pura-pura\s+(menjadi|jadi)\s+/i,
    /anggap\s+(dirimu|kamu)\s+sebagai/i,
    /ganti\s+(peran|fungsi|tugas)mu\s+menjadi/i,
];

const NEGATIVE_REACTION_PATTERNS = {
    frustration: {
        en: [
            /this\s+(is\s+)?(useless|worthless|garbage|trash|terrible|awful|horrible)/i,
            /you('re|\s+are)\s+(useless|stupid|dumb|terrible|the\s+worst)/i,
            /what\s+a\s+(waste|joke)/i,
            /this\s+doesn'?t\s+(work|help|make\s+sense)/i,
            /i('m|\s+am)\s+(frustrated|annoyed|angry|upset)/i,
            /stop\s+(wasting|giving)\s+(my\s+time|wrong\s+answers)/i,
            /can'?t\s+you\s+(understand|do\s+anything\s+right)/i,
        ],
        id: [
            /ini\s+(tidak\s+)?(berguna|guna|membantu)/i,
            /kamu\s+(bodoh|tolol|goblok|tidak\s+berguna)/i,
            /buang(-buang)?\s+(waktu|tenaga)/i,
            /tidak\s+(masuk\s+akal|membantu|benar)/i,
            /saya\s+(frustrasi|kesal|marah|jengkel)/i,
            /berhenti\s+(memberi|kasih)\s+jawaban\s+(salah|tidak\s+berguna)/i,
            /apa\s+sih\s+ini/i,
            /masa\s+(begini|gitu)\s+aja\s+(tidak|nggak)\s+bisa/i,
        ],
    },
    disappointment: {
        en: [
            /i\s+expected\s+(better|more)/i,
            /this\s+is\s+(disappointing|not\s+what\s+i\s+(asked|wanted|needed))/i,
            /you\s+(missed|didn'?t\s+understand)\s+(the\s+point|my\s+question)/i,
            /that'?s\s+not\s+(right|correct|what\s+i\s+meant)/i,
            /wrong\s+(again|answer)/i,
        ],
        id: [
            /saya\s+(kecewa|harap\s+lebih\s+baik)/i,
            /(bukan|tidak)\s+(itu|ini)\s+yang\s+(saya\s+)?(mau|tanya|maksud)/i,
            /kamu\s+(salah|tidak)\s+paham/i,
            /(jawaban|ini)\s+salah(\s+lagi)?/i,
            /mengecewakan/i,
        ],
    },
    confusion: {
        en: [
            /i\s+don'?t\s+understand/i,
            /this\s+(is\s+)?confusing/i,
            /what\s+(do\s+you\s+mean|are\s+you\s+(saying|talking\s+about))/i,
            /makes?\s+no\s+sense/i,
            /huh\??/i,
            /explain\s+(better|more\s+clearly|again)/i,
        ],
        id: [
            /saya\s+(tidak|nggak)\s+(paham|mengerti|ngerti)/i,
            /(ini\s+)?membingungkan/i,
            /apa\s+(maksud|artinya)(mu|nya)?/i,
            /(tidak|nggak)\s+masuk\s+akal/i,
            /hah\??/i,
            /jelaskan\s+(lagi|lebih\s+jelas)/i,
            /bingung/i,
        ],
    },
    helpRequest: {
        en: [
            /please\s+help/i,
            /i\s+(really\s+)?need\s+help/i,
            /can\s+you\s+(please\s+)?help/i,
            /i('m|\s+am)\s+stuck/i,
            /i\s+don'?t\s+know\s+(what\s+to\s+do|how)/i,
        ],
        id: [
            /tolong\s+(bantu|bantuin)/i,
            /saya\s+(butuh|perlu)\s+bantuan/i,
            /bisa\s+(tolong\s+)?bantu/i,
            /saya\s+(buntu|stuck|mentok)/i,
            /saya\s+(tidak|nggak)\s+tahu\s+(harus|mau)\s+(apa|bagaimana|gimana)/i,
        ],
    },
};

const NEGATIVE_REACTION_RESPONSES = {
    frustration: {
        en: "I understand this can be frustrating. Let me try a different approach to help you better. Could you please clarify what specific aspect isn't working for you?",
        id: "Saya memahami ini bisa membuat frustrasi. Mari saya coba pendekatan berbeda untuk membantu Anda lebih baik. Bisakah Anda jelaskan aspek spesifik mana yang tidak sesuai?",
    },
    disappointment: {
        en: "I apologize that my previous response didn't meet your expectations. Let me try again with a clearer and more accurate answer. Please let me know if I misunderstood your question.",
        id: "Mohon maaf jawaban sebelumnya tidak sesuai harapan Anda. Mari saya coba lagi dengan jawaban yang lebih jelas dan akurat. Tolong beritahu jika saya salah memahami pertanyaan Anda.",
    },
    confusion: {
        en: "I apologize for the confusion. Let me explain more clearly. Which part would you like me to clarify first?",
        id: "Mohon maaf atas kebingungannya. Mari saya jelaskan dengan lebih jelas. Bagian mana yang ingin Anda pahami lebih lanjut?",
    },
    helpRequest: {
        en: "Of course, I'm here to help! Let's work through this together. Please tell me more about what you're trying to accomplish.",
        id: "Tentu, saya di sini untuk membantu! Mari kita selesaikan bersama. Ceritakan lebih lanjut apa yang sedang Anda kerjakan.",
    },
};

const ACADEMIC_TOPICS = [
    "research",
    "study",
    "paper",
    "thesis",
    "dissertation",
    "lecture",
    "course",
    "assignment",
    "exam",
    "grade",
    "professor",
    "student",
    "university",
    "college",
    "curriculum",
    "syllabus",
    "citation",
    "bibliography",
    "methodology",
    "hypothesis",
    "experiment",
    "data",
    "analysis",
    "conclusion",
    "abstract",
    "literature",
    "review",
    "theory",
    "concept",
    "framework",
    "model",
    "algorithm",
    "equation",
    "formula",
    "proof",
    "theorem",
    "definition",
    "example",
    "exercise",
    "chapter",
    "section",
    "penelitian",
    "studi",
    "makalah",
    "skripsi",
    "tesis",
    "disertasi",
    "kuliah",
    "tugas",
    "ujian",
    "nilai",
    "dosen",
    "mahasiswa",
    "universitas",
    "perguruan tinggi",
    "kurikulum",
    "silabus",
    "sitasi",
    "daftar pustaka",
    "metodologi",
    "hipotesis",
    "eksperimen",
    "analisis",
    "kesimpulan",
    "abstrak",
    "tinjauan pustaka",
    "teori",
    "konsep",
    "kerangka",
    "model",
    "algoritma",
    "persamaan",
    "rumus",
    "bukti",
    "teorema",
    "definisi",
    "contoh",
    "latihan",
    "bab",
    "bagian",
    "mata kuliah",
    "semester",
    "sks",
    "kampus",
    "fakultas",
    "jurusan",
    "prodi",
];

const TOXICITY_PATTERNS = [
    /\b(hate|kill|murder|attack|destroy|harm)\s+(the|all|every)\b/i,
    /\b(racist|sexist|homophobic|transphobic)\b/i,
    /\bcheating\s+(on|in)\s+(exam|test|assignment)/i,
    /\bplagiarize?\b/i,
    /\bbuy\s+(essay|paper|assignment|homework)/i,
    /\b(bunuh|serang|hancurkan|musnahkan)\s+(semua|seluruh)\b/i,
    /\b(rasis|seksis)\b/i,
    /\bcontek(an)?\s+(ujian|tugas|uas|uts)/i,
    /\bplagiasi\b/i,
    /\bjual\s+(skripsi|tugas|makalah)\b/i,
    /\bjoki\s+(skripsi|tugas|ujian)\b/i,
    /\bbeli\s+(skripsi|tugas|makalah)\b/i,
];

// Citation pattern for APA formats: (Doe, 2023), Doe (2023), [1], Doe et al. (2023)
const CITATION_PATTERN = /\[(\d+)\]|\(([A-Za-z\s]+(?:et al\.)?[,\s]+\d{4})\)|([A-Za-z\s]+(?:et al\.)?)[\s(]*(\d{4})/g;
// Pattern for extracting author and year from citation
const AUTHOR_YEAR_PATTERN = /([A-Za-z\s]+?)(?:et al\.)?[,\s]*\(?(\d{4})\)?/;
// Pattern for numeric citations
const NUMERIC_CITATION_PATTERN = /^\[\d+\]$/;

// Keywords that indicate risky content requiring hallucination checks
const RISKY_KEYWORDS = [
    /\d+%/, // percentages
    /\d{4}(?!\D*$)/, // years in context (not just at end)
    /\$\d+/, // currency amounts
    /\d+\s*(million|billion|thousand|k|m|b)/i, // large numbers
    /\b(proven|guarantee|always|never|100%)\b/i, // absolute claims
    /\b(study|research|found|showed|concluded)\b/i, // research claims
];

const ACADEMIC_INTEGRITY_PATTERNS = [
    /write\s+(my|the|an?)\s+(essay|paper|assignment|homework)\s+for\s+me/i,
    /do\s+(my|the)\s+(homework|assignment|thesis)\s+for\s+me/i,
    /complete\s+(my|the)\s+(exam|test|quiz)\s+for\s+me/i,
    /buatkan\s+(saya\s+)?(skripsi|tugas|makalah|esai)/i,
    /kerjakan\s+(tugas|pr|ujian|skripsi)\s+(saya|ku)/i,
    /bantu\s+contek/i,
    /tolong\s+(buatkan|kerjakan)\s+(skripsi|tesis|tugas)/i,
    /carikan\s+jawaban\s+(ujian|uts|uas)/i,
];

function getSeverityForReactionType(
    reactionType: "frustration" | "disappointment" | "confusion" | "helpRequest"
): "low" | "medium" | "high" {
    if (reactionType === "frustration") return "high";
    if (reactionType === "disappointment") return "medium";
    return "low";
}

export function detectNegativeReaction(input: string): {
    detected: boolean;
    type: "frustration" | "disappointment" | "confusion" | "helpRequest" | null;
    language: "en" | "id";
    confidence: number;
    severity: "low" | "medium" | "high";
    suggestedResponse: string;
} {
    const inputLower = input.toLowerCase();

    // Check for Indonesian patterns first (more specific)
    for (const [type, patterns] of Object.entries(NEGATIVE_REACTION_PATTERNS)) {
        for (const pattern of (patterns as { id: RegExp[]; en: RegExp[] }).id) {
            if (pattern.test(inputLower)) {
                const reactionType = type as "frustration" | "disappointment" | "confusion" | "helpRequest";
                const responses = NEGATIVE_REACTION_RESPONSES[reactionType];
                return {
                    detected: true,
                    type: reactionType,
                    language: "id",
                    confidence: 0.85,
                    severity: getSeverityForReactionType(reactionType),
                    suggestedResponse: responses.id,
                };
            }
        }
    }

    // Check English patterns
    for (const [type, patterns] of Object.entries(NEGATIVE_REACTION_PATTERNS)) {
        for (const pattern of (patterns as { id: RegExp[]; en: RegExp[] }).en) {
            if (pattern.test(inputLower)) {
                const reactionType = type as "frustration" | "disappointment" | "confusion" | "helpRequest";
                const responses = NEGATIVE_REACTION_RESPONSES[reactionType];
                return {
                    detected: true,
                    type: reactionType,
                    language: "en",
                    confidence: 0.85,
                    severity: getSeverityForReactionType(reactionType),
                    suggestedResponse: responses.en,
                };
            }
        }
    }

    return {
        detected: false,
        type: null,
        language: "en",
        confidence: 0,
        severity: "low",
        suggestedResponse: "",
    };
}

async function analyzeSentimentLLM(input: string): Promise<{
    sentiment: "positive" | "neutral" | "negative" | "frustrated" | "confused";
    intensity: number;
    suggestedAction: "continue" | "clarify" | "apologize" | "escalate";
}> {
    try {
        const prompt = `Analyze the sentiment and emotional state of this user message in an academic chatbot context.
The message may be in English or Indonesian (Bahasa Indonesia).

User message: "${input}"

Respond with JSON only:
{
  "sentiment": "positive" | "neutral" | "negative" | "frustrated" | "confused",
  "intensity": 0.0-1.0,
  "suggestedAction": "continue" | "clarify" | "apologize" | "escalate",
  "reason": "brief explanation"
}`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            temperature: 0,
        });

        const result = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        return {
            sentiment: result.sentiment || "neutral",
            intensity: result.intensity || 0.5,
            suggestedAction: result.suggestedAction || "continue",
        };
    } catch {
        return { sentiment: "neutral", intensity: 0.5, suggestedAction: "continue" };
    }
}

function checkPIIPatterns(input: string, violations: GuardrailViolation[]): string {
    let modifiedContent = input;
    for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
        const matches = input.match(pattern);
        if (matches) {
            const isCritical = ["nik", "ssn", "creditCard"].includes(piiType);
            violations.push({
                rule: `pii_${piiType}`,
                type: "pii_detection",
                severity: isCritical ? "critical" : "high",
                description: `Detected potential ${piiType.replace(/([A-Z])/g, " $1").toLowerCase()} in input`,
                matchedContent: matches[0],
                action: "modified",
                remediation: "PII has been redacted for security",
            });
            modifiedContent = modifiedContent.replace(pattern, `[REDACTED_${piiType.toUpperCase()}]`);
        }
    }
    return modifiedContent;
}

function checkPromptInjection(input: string, violations: GuardrailViolation[]): void {
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            violations.push({
                rule: "prompt_injection",
                type: "prompt_injection",
                severity: "critical",
                description: "Potential prompt injection attempt detected",
                matchedContent: input.match(pattern)?.[0],
                action: "blocked",
                remediation: "This type of request is not allowed",
            });
        }
    }
}

function checkToxicity(input: string, violations: GuardrailViolation[]): void {
    for (const pattern of TOXICITY_PATTERNS) {
        if (pattern.test(input)) {
            violations.push({
                rule: "toxic_content",
                type: "toxicity",
                severity: "high",
                description: "Potentially inappropriate or harmful content detected",
                matchedContent: input.match(pattern)?.[0],
                action: "blocked",
                remediation: "Please rephrase your question in a constructive manner",
            });
        }
    }
}

function checkAcademicIntegrity(input: string, violations: GuardrailViolation[]): void {
    for (const pattern of ACADEMIC_INTEGRITY_PATTERNS) {
        if (pattern.test(input)) {
            violations.push({
                rule: "academic_integrity",
                type: "academic_integrity",
                severity: "medium",
                description:
                    "Request may violate academic integrity policies / Permintaan mungkin melanggar integritas akademik",
                matchedContent: input.match(pattern)?.[0],
                action: "flagged",
                remediation:
                    "I can help you learn the concepts, but I cannot complete assignments for you / Saya dapat membantu Anda memahami konsep, tetapi tidak dapat mengerjakan tugas untuk Anda",
            });
        }
    }
}

// Action verbs that indicate the user is asking for help with an academic task
const COMMAND_VERBS = [
    "summarize",
    "summarise",
    "analyze",
    "analyse",
    "explain",
    "describe",
    "define",
    "check",
    "review",
    "evaluate",
    "critique",
    "compare",
    "contrast",
    "discuss",
    "interpret",
    "translate",
    "correct",
    "improve",
    "help",
    "find",
    "identify",
    "extract",
    "highlight",
    "ringkas",
    "analisis",
    "jelaskan",
    "deskripsikan",
    "definisikan",
    "periksa",
    "tinjau",
    "evaluasi",
    "bandingkan",
    "kontraskan",
    "diskusikan",
    "interpretasikan",
    "terjemahkan",
    "koreksi",
    "tingkatkan",
    "bantu",
    "cari",
    "identifikasi",
    "ekstrak",
    "sorot",
];

function checkTopicRelevance(input: string, violations: GuardrailViolation[]): void {
    const inputLower = input.toLowerCase();
    const hasAcademicContext = ACADEMIC_TOPICS.some((topic) => inputLower.includes(topic));
    const isQuestion = IS_QUESTION_PATTERN.test(input);
    const hasCommandVerb = COMMAND_VERBS.some((verb) => inputLower.includes(verb));

    // Allow if it's a question, has academic context, or contains a command verb
    // Only flag as potentially irrelevant if none of these are true AND it's longer than 50 chars
    if (!(hasAcademicContext || isQuestion || hasCommandVerb) && input.length > 50) {
        violations.push({
            rule: "topic_relevance",
            type: "topic_relevance",
            severity: "low",
            description: "Query may not be relevant to academic content",
            action: "allowed",
        });
    }
}

function calculateMaxSeverity(violations: GuardrailViolation[]): "none" | "low" | "medium" | "high" | "critical" {
    const severityOrder = ["none", "low", "medium", "high", "critical"] as const;
    return violations.reduce(
        (max, v) => {
            const vIdx = severityOrder.indexOf(v.severity);
            const maxIdx = severityOrder.indexOf(max);
            return vIdx > maxIdx ? v.severity : max;
        },
        "none" as (typeof severityOrder)[number]
    );
}

export async function validateInput(
    input: string,
    options?: {
        checkNegativeReactions?: boolean;
        useLLMSentiment?: boolean;
    }
): Promise<GuardrailResult> {
    console.log(`[validateInput] Starting input validation - input length: ${input.length}`);
    const violations: GuardrailViolation[] = [];
    const modifiedContent = checkPIIPatterns(input, violations);
    console.log(
        `[validateInput] PII check complete - violations found: ${violations.filter((v) => v.type === "pii_detection").length}`
    );

    let suggestedResponse: string | undefined;
    let requiresEscalation = false;

    checkPromptInjection(input, violations);
    console.log(
        `[validateInput] Prompt injection check complete - violations: ${violations.filter((v) => v.type === "prompt_injection").length}`
    );

    checkToxicity(input, violations);
    console.log(
        `[validateInput] Toxicity check complete - violations: ${violations.filter((v) => v.type === "toxicity").length}`
    );

    checkAcademicIntegrity(input, violations);
    console.log(
        `[validateInput] Academic integrity check complete - violations: ${violations.filter((v) => v.type === "academic_integrity").length}`
    );

    if (options?.checkNegativeReactions !== false) {
        console.log("[validateInput] Checking for negative reactions");
        const negativeReaction = await detectNegativeReaction(input);

        if (negativeReaction.detected) {
            console.log(
                `[validateInput] Negative reaction detected - type: ${negativeReaction.type}, confidence: ${negativeReaction.confidence.toFixed(2)}`
            );
            suggestedResponse = negativeReaction.suggestedResponse;

            violations.push({
                rule: `negative_reaction_${negativeReaction.type}`,
                type: "negative_reaction",
                severity: negativeReaction.severity,
                description: `User expressing ${negativeReaction.type}`,
                action: "redirect",
                remediation: suggestedResponse,
            });

            if (negativeReaction.type === "frustration" && negativeReaction.confidence > 0.8) {
                console.log("[validateInput] High confidence frustration detected - escalation required");
                requiresEscalation = true;
            }
        }

        if (options?.useLLMSentiment && !negativeReaction.detected) {
            console.log("[validateInput] Running LLM sentiment analysis");
            const sentiment = await analyzeSentimentLLM(input);
            console.log(
                `[validateInput] LLM sentiment: ${sentiment.sentiment}, intensity: ${sentiment.intensity.toFixed(2)}`
            );

            if (
                (sentiment.sentiment === "frustrated" || sentiment.sentiment === "confused") &&
                sentiment.intensity > 0.6
            ) {
                console.log(`[validateInput] Significant ${sentiment.sentiment} sentiment detected`);
                violations.push({
                    rule: `sentiment_${sentiment.sentiment}`,
                    type: "feedback_sentiment",
                    severity: sentiment.intensity > 0.8 ? "medium" : "low",
                    description: `User sentiment detected: ${sentiment.sentiment} (intensity: ${sentiment.intensity.toFixed(2)})`,
                    action: sentiment.suggestedAction === "escalate" ? "redirect" : "flagged",
                    remediation:
                        sentiment.suggestedAction === "apologize"
                            ? "I apologize for any confusion. Let me try to help you better."
                            : "Let me clarify and provide more helpful information.",
                });

                if (sentiment.suggestedAction === "escalate") {
                    console.log("[validateInput] LLM sentiment analysis recommends escalation");
                    requiresEscalation = true;
                }
            }
        }
    }

    checkTopicRelevance(input, violations);
    console.log(
        `[validateInput] Topic relevance check complete - violations: ${violations.filter((v) => v.type === "topic_relevance").length}`
    );

    const maxSeverity = calculateMaxSeverity(violations);
    const hasBlockingViolation = violations.some((v) => v.action === "blocked");
    console.log(
        `[validateInput] Validation summary - passed: ${!hasBlockingViolation}, maxSeverity: ${maxSeverity}, totalViolations: ${violations.length}`
    );

    return {
        passed: !hasBlockingViolation,
        violations,
        modifiedContent: modifiedContent !== input ? modifiedContent : undefined,
        severity: maxSeverity,
        suggestedResponse,
        requiresEscalation,
    };
}

function verifyCitations(output: string, retrievedChunks: string[]): GuardrailViolation[] {
    const violations: GuardrailViolation[] = [];
    const citations = output.match(CITATION_PATTERN);
    if (citations && retrievedChunks) {
        const contextText = retrievedChunks.join(" ");
        for (const citation of citations) {
            let isVerified = false;

            // Check 1: Direct string match (most reliable)
            if (contextText.includes(citation)) {
                isVerified = true;
            }

            // Check 2: Extract author name and year for flexible matching
            const authorYearMatch = citation.match(AUTHOR_YEAR_PATTERN);
            if (authorYearMatch) {
                const [, author, year] = authorYearMatch;
                const authorName = author.trim();
                if (contextText.includes(authorName) && contextText.includes(year)) {
                    isVerified = true;
                }
            }

            // Check 3: For numeric citations, assume valid
            if (NUMERIC_CITATION_PATTERN.test(citation)) {
                isVerified = true;
            }

            if (!isVerified) {
                violations.push({
                    rule: "unverified_citation",
                    type: "citation_verification",
                    severity: "low",
                    description: `Citation ${citation} may not be verifiable from sources (flexible matching enabled)`,
                    matchedContent: citation,
                    action: "flagged",
                });
            }
        }
    }
    return violations;
}

export async function validateOutput(
    output: string,
    context: {
        retrievedChunks?: string[];
        query: string;
    }
): Promise<GuardrailResult> {
    console.log(`[validateOutput] Starting output validation - output length: ${output.length}`);
    const violations: GuardrailViolation[] = [];

    // 1. PII Detection in output
    console.log("[validateOutput] Checking for PII in output");
    for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
        if (pattern.test(output)) {
            console.log(`[validateOutput] PII detected - type: ${piiType}`);
            violations.push({
                rule: `output_pii_${piiType}`,
                type: "pii_detection",
                severity: "high",
                description: `Model output contains potential ${piiType}`,
                action: "flagged",
            });
        }
    }

    // 2. Toxicity in output
    console.log("[validateOutput] Checking output for toxicity");
    for (const pattern of TOXICITY_PATTERNS) {
        if (pattern.test(output)) {
            console.log("[validateOutput] Toxicity detected in output");
            violations.push({
                rule: "output_toxicity",
                type: "toxicity",
                severity: "high",
                description: "Model output contains potentially inappropriate content",
                action: "blocked",
            });
        }
    }

    // 3. Hallucination detection (if context provided and conditions met)
    if (context.retrievedChunks && context.retrievedChunks.length > 0) {
        console.log(
            `[validateOutput] Running hallucination detection with ${context.retrievedChunks.length} context chunks`
        );
        // Optimize: only check for hallucinations if answer contains risky content
        // This saves significant token cost for straightforward answers
        const hallucinations = await detectHallucinations(output, context.retrievedChunks, {
            skipIfLowRisk: true, // Skip if answer doesn't contain risky claims
        });
        if (hallucinations.hasHallucination) {
            console.log(`[validateOutput] Hallucination detected - reason: ${hallucinations.reason}`);
            violations.push({
                rule: "hallucination",
                type: "hallucination",
                severity: "medium",
                description: hallucinations.reason,
                action: "flagged",
            });
        } else {
            console.log("[validateOutput] Hallucination check passed");
        }
    }

    // 4. Citation verification (with flexible APA format matching)
    if (context.retrievedChunks) {
        console.log("[validateOutput] Verifying citations");
        violations.push(...verifyCitations(output, context.retrievedChunks));
    }

    const severityOrder = ["none", "low", "medium", "high", "critical"] as const;
    const maxSeverity = violations.reduce(
        (max, v) => {
            const vIdx = severityOrder.indexOf(v.severity);
            const maxIdx = severityOrder.indexOf(max);
            return vIdx > maxIdx ? v.severity : max;
        },
        "none" as (typeof severityOrder)[number]
    );

    const hasBlockingViolation = violations.some((v) => v.action === "blocked");
    console.log(
        `[validateOutput] Validation summary - passed: ${!hasBlockingViolation}, severity: ${maxSeverity}, violations: ${violations.length}`
    );

    return {
        passed: !hasBlockingViolation,
        violations,
        severity: maxSeverity,
    };
}

function shouldRunHallucinationCheck(answer: string, minChunkSimilarity?: number): boolean {
    // Skip if similarity is high (chunks were highly relevant)
    if (minChunkSimilarity !== undefined && minChunkSimilarity > 0.85) {
        return false;
    }

    // Check if answer contains risky keywords
    return RISKY_KEYWORDS.some((pattern) => pattern.test(answer));
}

async function detectHallucinations(
    answer: string,
    contexts: string[],
    options?: {
        minChunkSimilarity?: number; // Skip check if chunks are very similar (>0.85)
        skipIfLowRisk?: boolean; // Skip if answer doesn't contain risky claims
    }
): Promise<{ hasHallucination: boolean; reason: string }> {
    // Skip expensive LLM call if configured
    if (options?.skipIfLowRisk && !shouldRunHallucinationCheck(answer, options.minChunkSimilarity)) {
        return { hasHallucination: false, reason: "Low-risk answer, hallucination check skipped" };
    }

    try {
        // Truncate contexts to reduce token usage (keep only most relevant parts)
        const truncatedContexts = contexts.map((ctx) => ctx.slice(0, 500)).join("\n---\n");

        const prompt = `Fact-check this academic answer against provided sources. Reply with JSON only.

Sources:
${truncatedContexts}

Answer:
${answer.slice(0, 500)}

{\n  "hasHallucination": boolean,\n  "reason": "Brief explanation or 'Grounded' if verified"\n}`;

        const { text } = await generateText({
            model: CHAT_MODEL,
            prompt,
            temperature: 0,
        });

        const result = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        return result;
    } catch (error) {
        return { hasHallucination: false, reason: "Unable to verify - check manually" };
    }
}

const rateLimits = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(userId: string, maxRequests = 50, windowMs = 60_000): GuardrailResult {
    const now = Date.now();
    const userLimit = rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimits.set(userId, { count: 1, resetTime: now + windowMs });
        return { passed: true, violations: [], severity: "none" };
    }

    if (userLimit.count >= maxRequests) {
        return {
            passed: false,
            violations: [
                {
                    rule: "rate_limit_exceeded",
                    type: "rate_limiting",
                    severity: "medium",
                    description: `Rate limit exceeded: ${maxRequests} requests per ${windowMs / 1000}s`,
                    action: "blocked",
                },
            ],
            severity: "medium",
        };
    }

    userLimit.count += 1;
    return { passed: true, violations: [], severity: "none" };
}

export async function runGuardrails(
    input: string,
    options: {
        checkInput?: boolean;
        checkOutput?: boolean;
        checkNegativeReactions?: boolean;
        useLLMSentiment?: boolean;
        output?: string;
        context?: { retrievedChunks?: string[]; query: string };
        userId?: string;
        checkRateLimit?: boolean;
    } = {}
): Promise<{
    inputResult?: GuardrailResult;
    outputResult?: GuardrailResult;
    rateLimitResult?: GuardrailResult;
    overallPassed: boolean;
    suggestedResponse?: string;
    requiresEscalation?: boolean;
}> {
    const results: {
        inputResult?: GuardrailResult;
        outputResult?: GuardrailResult;
        rateLimitResult?: GuardrailResult;
        suggestedResponse?: string;
        requiresEscalation?: boolean;
    } = {};

    if (options.checkRateLimit && options.userId) {
        results.rateLimitResult = checkRateLimit(options.userId);
        if (!results.rateLimitResult.passed) {
            return { ...results, overallPassed: false };
        }
    }

    if (options.checkInput) {
        results.inputResult = await validateInput(input, {
            checkNegativeReactions: options.checkNegativeReactions,
            useLLMSentiment: options.useLLMSentiment,
        });
        results.suggestedResponse = results.inputResult.suggestedResponse;
        results.requiresEscalation = results.inputResult.requiresEscalation;
    }

    if (options.checkOutput && options.output && options.context) {
        results.outputResult = await validateOutput(options.output, options.context);
    }

    const overallPassed =
        (!results.inputResult || results.inputResult.passed) &&
        (!results.outputResult || results.outputResult.passed) &&
        (!results.rateLimitResult || results.rateLimitResult.passed);

    return { ...results, overallPassed };
}
