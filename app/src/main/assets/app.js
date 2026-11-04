// ============================================================
// POWNIN SMART BRAIN v5.4
// PART 1/8 — CORE CONFIGURATION, LANGUAGE, HISTORY & UI
// ============================================================

"use strict";

// ------------------------------------------------------------
// 1. CORE CONFIGURATION
// ------------------------------------------------------------

const POWNIN_VERSION = "5.4";

const MAX_HISTORY_MESSAGES = 10;
const MAX_COMMAND_LENGTH = 1000;
const MAX_NOTE_LENGTH = 500;

const POWNIN_HISTORY_KEY = "pownin_chat_history_v1";
const POWNIN_NOTES_KEY = "pownin_extra_notes_v1";
const POWNIN_MODE_KEY = "pownin_brain_mode_v1";
const POWNIN_LANGUAGE_KEY = "pownin_language_v1";

let currentMode = "hybrid";
let selectedLanguage = "en-IN";

let speechEnabled = true;
let isListening = false;
let isProcessing = false;

let powninCommandToken = 0;
let activePowninAbortController = null;

let lastReply = "";
let lastUserCommand = "";

let history = [];

// ------------------------------------------------------------
// 2. UI ELEMENT REFERENCES
// ------------------------------------------------------------

function getElement(id) {
    return document.getElementById(id);
}

const chat = getElement("chat");
const commandInput = getElement("command");
const sendBtn = getElement("sendBtn");
const modeSelect = getElement("mode");
const languageSelect = getElement("language");

const statusElement = getElement("status");
const statusDot = getElement("statusDot");

const micBtn = getElement("micBtn");
const speakBtn = getElement("speakBtn");
const stopSpeakBtn = getElement("stopSpeakBtn");
const clearChatBtn = getElement("clearChatBtn");
const commandForm = getElement("commandForm");

const settingsBtn = getElement("settingsBtn");
const settingsPanel = getElement("settingsPanel");
const closeSettingsBtn = getElement("closeSettingsBtn");

const endpointInput = getElement("endpoint");
const modelInput = getElement("model");
const apiKeyInput = getElement("apiKey");
const clearKeyBtn = getElement("clearKeyBtn");

const characterCount = getElement("characterCount");

const clockElement = getElement("clock");
const networkLabel = getElement("networkLabel");
const voiceLabel = getElement("voiceLabel");
const brainModeLabel = getElement("brainModeLabel");

// ------------------------------------------------------------
// 3. TEXT NORMALIZATION
// ------------------------------------------------------------

function normalizePowninText(value) {
    return String(value == null ? "" : value)
        .normalize("NFKC")
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizePowninDigits(text) {
    const bengaliDigits = "০১২৩৪৫৬৭৮৯";
    const hindiDigits = "०१२३४५६७८९";

    return String(text == null ? "" : text)
        .replace(/[০-৯]/g, function (digit) {
            return String(bengaliDigits.indexOf(digit));
        })
        .replace(/[०-९]/g, function (digit) {
            return String(hindiDigits.indexOf(digit));
        });
}

// ------------------------------------------------------------
// 4. LANGUAGE NORMALIZATION
// ------------------------------------------------------------

function normalizePowninLanguage(language) {
    const value = String(language || "")
        .trim()
        .toLowerCase();

    if (value.startsWith("bn")) {
        return "bn-IN";
    }

    if (value.startsWith("hi")) {
        return "hi-IN";
    }

    return "en-IN";
}

// ------------------------------------------------------------
// 5. LANGUAGE DETECTION
// Bengali, Hindi, English and common Banglish.
// ------------------------------------------------------------

function detectPowninLanguage(text) {
    const value = String(text || "");

    if (/[\u0980-\u09FF]/.test(value)) {
        return "bn-IN";
    }

    if (/[\u0900-\u097F]/.test(value)) {
        return "hi-IN";
    }

    const normalized = normalizePowninText(value);

    const bengaliWords =
        /\b(amar|amake|ami|amra|amader|tumi|tomar|tomake|apni|apnar|naam|nam|name|kemon|acho|achho|bhalo|valo|bolo|bolun|koro|korbe|ki|kothay|keno|kokhon|bangla|banglay|shomoy|somoy|tarikh|dhonnobad|kholo|khol|kholbe|hisab|jog|biyog|gun|vag|shuno|shunbe|abar|thamo)\b/i;

    const hindiWords =
        /\b(mera|meri|mujhe|main|hum|tum|tumhara|aap|aapka|kaise|kaisa|kya|batao|samay|tarikh|dhanyavad|namaste|hindi|kholo|khol do)\b/i;

    if (bengaliWords.test(normalized)) {
        return "bn-IN";
    }

    if (hindiWords.test(normalized)) {
        return "hi-IN";
    }

    return normalizePowninLanguage(selectedLanguage);
}

function getCurrentLanguage() {
    return normalizePowninLanguage(selectedLanguage);
}

function getReplyLanguage(text) {
    return normalizePowninLanguage(
        detectPowninLanguage(text)
    );
}

// ------------------------------------------------------------
// 6. PERSISTENT CHAT HISTORY
// ------------------------------------------------------------

function loadPowninHistory() {
    try {
        const raw = localStorage.getItem(POWNIN_HISTORY_KEY);

        if (!raw) {
            history = [];
            return history;
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            history = [];
            return history;
        }

        history = parsed
            .filter(function (item) {
                return item &&
                    (item.role === "user" ||
                     item.role === "assistant") &&
                    typeof item.content === "string";
            })
            .slice(-MAX_HISTORY_MESSAGES);

        return history;

    } catch (error) {
        console.warn("Pownin history could not be loaded:", error);
        history = [];
        return history;
    }
}

function savePowninHistory() {
    try {
        localStorage.setItem(
            POWNIN_HISTORY_KEY,
            JSON.stringify(
                history.slice(-MAX_HISTORY_MESSAGES)
            )
        );

        return true;

    } catch (error) {
        console.warn("Pownin history could not be saved:", error);
        return false;
    }
}

function addHistory(role, content) {
    const message = {
        role: role === "user" ? "user" : "assistant",
        content: String(content || "").slice(0, MAX_COMMAND_LENGTH)
    };

    if (!message.content.trim()) {
        return false;
    }

    history.push(message);

    if (history.length > MAX_HISTORY_MESSAGES) {
        history = history.slice(-MAX_HISTORY_MESSAGES);
    }

    savePowninHistory();

    return true;
}

function getPowninHistory() {
    return history.map(function (item) {
        return {
            role: item.role,
            content: item.content
        };
    });
}

function clearPowninHistory() {
    history = [];
    savePowninHistory();
}

// ------------------------------------------------------------
// 7. STATUS AND MODE UI
// ------------------------------------------------------------

function setStatus(message, isError) {
    if (statusElement) {
        statusElement.textContent = String(message || "");
    }

    if (statusDot) {
        statusDot.classList.toggle("error", Boolean(isError));
        statusDot.classList.toggle("active", !isError);
    }
}

function setNetworkStatus(message) {
    if (networkLabel) {
        networkLabel.textContent = String(message || "");
    }
}

function setVoiceStatus(message) {
    if (voiceLabel) {
        voiceLabel.textContent = String(message || "");
    }
}

function updatePowninModeLabel() {
    if (brainModeLabel) {
        brainModeLabel.textContent =
            String(currentMode || "hybrid").toUpperCase() + " MODE";
    }
}

function setPowninMode(mode) {
    const allowedModes = [
        "offline",
        "online",
        "hybrid"
    ];

    const nextMode = String(mode || "").toLowerCase();

    if (!allowedModes.includes(nextMode)) {
        return false;
    }

    currentMode = nextMode;

    if (modeSelect) {
        modeSelect.value = currentMode;
    }

    updatePowninModeLabel();

    if (currentMode === "offline") {
        setNetworkStatus("OFFLINE");
    } else if (currentMode === "online") {
        setNetworkStatus("ONLINE AI");
    } else {
        setNetworkStatus("HYBRID");
    }

    return true;
}

// ------------------------------------------------------------
// 8. ERROR MESSAGE HELPER
// ------------------------------------------------------------

function getPowninErrorMessage(error) {
    if (error && typeof error.message === "string") {
        return error.message;
    }

    return "An unexpected error occurred.";
}

// ------------------------------------------------------------
// END OF PART 1/8
// ============================================================


// ============================================================
// POWNIN SMART BRAIN v5.4
// PART 2/8 — GREETINGS, IDENTITY, HELP, ANSWER STYLE & NOTES
// ============================================================

// ------------------------------------------------------------
// 1. LANGUAGE-AWARE REPLY HELPERS
// ------------------------------------------------------------

function getPowninGreetingReply(language) {
    const lang = normalizePowninLanguage(language);

    if (lang === "bn-IN") {
        return "হ্যালো! আমি Pownin। তোমাকে কীভাবে সাহায্য করতে পারি?";
    }

    if (lang === "hi-IN") {
        return "नमस्ते! मैं Pownin हूँ। मैं आपकी कैसे मदद कर सकता हूँ?";
    }

    return "Hello! I am Pownin. How can I help you?";
}

function getPowninIdentityReply(language) {
    const lang = normalizePowninLanguage(language);

    if (lang === "bn-IN") {
        return "আমি Pownin, তোমার Android AI assistant। আমি উপলব্ধ offline command, voice feature এবং অনুমোদিত device action-এ সাহায্য করতে পারি।";
    }

    if (lang === "hi-IN") {
        return "मैं Pownin हूँ, आपका Android AI assistant। मैं उपलब्ध offline commands, voice features और अनुमत device actions में मदद कर सकता हूँ।";
    }

    return "I am Pownin, your Android AI assistant. I can help with available offline commands, voice features and permitted device actions.";
}

function getPowninHelpReply(language) {
    const lang = normalizePowninLanguage(language);

    if (lang === "bn-IN") {
        return [
            "আমি এই command-গুলোতে সাহায্য করতে পারি:",
            "• Hello বা Pownin-কে পরিচয় জিজ্ঞাসা",
            "• সময় ও তারিখ",
            "• সাধারণ হিসাব",
            "• নোট save, show ও clear",
            "• সমর্থিত app খোলা",
            "• Volume control",
            "• Settings ও voice language",
            "• Hybrid mode-এ configured online AI"
        ].join("\n");
    }

    if (lang === "hi-IN") {
        return [
            "मैं इन commands में मदद कर सकता हूँ:",
            "• Greeting और पहचान",
            "• समय और तारीख",
            "• सामान्य गणना",
            "• Notes save, show और clear",
            "• समर्थित apps खोलना",
            "• Volume control",
            "• Settings और voice language",
            "• Configured online AI"
        ].join("\n");
    }

    return [
        "Here are some commands you can try:",
        "• Hello or ask who Pownin is",
        "• Time and date",
        "• Basic calculations",
        "• Save, show or clear notes",
        "• Open supported apps",
        "• Volume control",
        "• Settings and voice language",
        "• Configured online AI"
    ].join("\n");
}

function getPowninThanksReply(language) {
    const lang = normalizePowninLanguage(language);

    if (lang === "bn-IN") {
        return "তোমাকে স্বাগতম! আর কীভাবে সাহায্য করতে পারি?";
    }

    if (lang === "hi-IN") {
        return "आपका स्वागत है! मैं और किस तरह मदद कर सकता हूँ?";
    }

    return "You're welcome! What else can I help you with?";
}

// ------------------------------------------------------------
// 2. SPECIAL GREETING DETECTION
// ------------------------------------------------------------

function isPowninGreetingCommand(text) {
    const value = normalizePowninText(text);

    return /^(hi|hello|hey|good morning|good afternoon|good evening|namaste|namaskar|হ্যালো|হাই|নমস্কার|সুপ্রভাত|নমস্তে|नमस्ते|नमस्कार|सुप्रभात)[!.?,\s]*$/i.test(value);
}

function getPowninAnswerStyle(language) {
    return {
        language: normalizePowninLanguage(language),
        length: "medium",
        personality: "friendly",
        mode: currentMode
    };
}

// ------------------------------------------------------------
// 3. SAFE NOTES STORAGE
// ------------------------------------------------------------

function getPowninNotes() {
    try {
        const raw = localStorage.getItem(POWNIN_NOTES_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed.filter(function (item) {
                return typeof item === "string";
            })
            : [];
    } catch (error) {
        console.warn("Pownin notes could not be read:", error);
        return [];
    }
}

function savePowninNotes(notes) {
    try {
        if (!Array.isArray(notes)) {
            return false;
        }

        localStorage.setItem(
            POWNIN_NOTES_KEY,
            JSON.stringify(notes.slice(-100))
        );

        return true;
    } catch (error) {
        console.warn("Pownin notes could not be saved:", error);
        return false;
    }
}

function addPowninNote(note) {
    const value = String(note || "").trim();

    if (!value) {
        return {
            success: false,
            message: "Please provide a note to save."
        };
    }

    if (value.length > MAX_NOTE_LENGTH) {
        return {
            success: false,
            message: "The note is too long. Please keep it under 500 characters."
        };
    }

    const notes = getPowninNotes();
    notes.push(value);

    if (!savePowninNotes(notes)) {
        return {
            success: false,
            message: "I could not save the note on this device."
        };
    }

    return {
        success: true,
        message: "Note saved."
    };
}

function formatPowninNotes(language) {
    const lang = normalizePowninLanguage(language);
    const notes = getPowninNotes();

    if (notes.length === 0) {
        if (lang === "bn-IN") {
            return "এখনও কোনো নোট save করা নেই।";
        }

        if (lang === "hi-IN") {
            return "अभी कोई note save नहीं है।";
        }

        return "There are no saved notes yet.";
    }

    const heading =
        lang === "bn-IN" ? "তোমার নোট:" :
        lang === "hi-IN" ? "आपके notes:" :
        "Your notes:";

    return heading + "\n" + notes.map(function (note, index) {
        return (index + 1) + ". " + note;
    }).join("\n");
}

function clearPowninNotes(language) {
    const lang = normalizePowninLanguage(language);

    if (!savePowninNotes([])) {
        return "I could not clear the notes.";
    }

    if (lang === "bn-IN") {
        return "সব নোট মুছে ফেলা হয়েছে।";
    }

    if (lang === "hi-IN") {
        return "सभी notes हटा दिए गए हैं।";
    }

    return "All notes have been cleared.";
}

// ------------------------------------------------------------
// 4. LOCAL DATE AND TIME
// ------------------------------------------------------------

function getPowninLocalTime(language) {
    const lang = normalizePowninLanguage(language);

    const locale =
        lang === "bn-IN" ? "bn-IN" :
        lang === "hi-IN" ? "hi-IN" :
        "en-IN";

    return new Date().toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getPowninLocalDate(language) {
    const lang = normalizePowninLanguage(language);

    const locale =
        lang === "bn-IN" ? "bn-IN" :
        lang === "hi-IN" ? "hi-IN" :
        "en-IN";

    return new Date().toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

// END OF PART 2/8


// ============================================================
// POWNIN SMART BRAIN v5.4
// PART 3/8 — MEDIUM CALCULATOR & OFFLINE COMMAND ROUTER
// ============================================================

// ------------------------------------------------------------
// 1. NORMALIZE SPOKEN MATH EXPRESSIONS
// ------------------------------------------------------------

function normalizePowninMathExpression(text) {
    let value = normalizePowninDigits(String(text || ""));

    const replacements = [
        [/[×✕]/g, "*"],
        [/÷/g, "/"],
        [/[−–—]/g, "-"],
        [/(\d)\s*[xX]\s*(?=\d)/g, "$1 * "],

        [/\bmultiplied by\b/gi, "*"],
        [/\btimes\b/gi, "*"],
        [/\bdivided by\b/gi, "/"],
        [/\bover\b/gi, "/"],
        [/\bplus\b/gi, "+"],
        [/\bminus\b/gi, "-"],
        [/\binto\b/gi, "*"],
        [/\bmodulo\b/gi, "%"],
        [/\bmod\b/gi, "%"],

        [/\b(jog|jogfol)\b/gi, "+"],
        [/\b(biyog|biog)\b/gi, "-"],
        [/\b(gun|gunfol)\b/gi, "*"],
        [/\b(vag|vagfol)\b/gi, "/"],

        [/গুণ/gu, "*"],
        [/ভাগ/gu, "/"],
        [/যোগ/gu, "+"],
        [/বিয়োগ|বিয়োগ/gu, "-"],

        [/गुणा/gu, "*"],
        [/भाग/gu, "/"],
        [/जोड़|जोड/gu, "+"],
        [/घटाओ/gu, "-"]
    ];

    for (const pair of replacements) {
        value = value.replace(pair[0], pair[1]);
    }

    return value.trim();
}

// ------------------------------------------------------------
// 2. DETECT CALCULATION INTENT
// ------------------------------------------------------------

function isPowninMathIntent(text) {
    const value = normalizePowninMathExpression(text);

    if (/[0-9]\s*[+\-*/%]\s*[0-9]/.test(value)) {
        return true;
    }

    return /\b(calculate|calculator|calc|compute|solve|evaluate|what is|how much is)\b/i.test(value)
        || /\b(jog|biyog|gun|vag)\b/i.test(value)
        || /হিসাব কর|গণনা কর|যোগ কর|বিয়োগ কর|বিয়োগ কর|গুণ কর|ভাগ কর|কত/u.test(value)
        || /गणना करो|कितना होगा|जोड़ो|जोडो|घटाओ|गुणा करो|भाग करो/u.test(value);
}

// ------------------------------------------------------------
// 3. EXTRACT BASIC ARITHMETIC EXPRESSION
// ------------------------------------------------------------

function extractPowninMathExpression(text) {
    let value = normalizePowninMathExpression(text);

    value = value
        .replace(/^(please\s+)?(calculate|calculator|calc|compute|evaluate)\s*/i, "")
        .replace(/^what\s+is\s*/i, "")
        .replace(/^how\s+much\s+is\s*/i, "")
        .replace(/^the\s+answer\s+to\s*/i, "")
        .replace(/^(এটা|এটির|এর)\s*/u, "")
        .replace(/^(হিসাব কর|গণনা কর)\s*/u, "")
        .replace(/^(गणना करो)\s*/u, "")
        .replace(/[=?।.!]+$/g, "")
        .trim();

    value = value.replace(/^solve\s+/i, "");

    if (!value || value.length > 120) {
        return "";
    }

    if (!/^[0-9+\-*/%().\s]+$/.test(value)) {
        return "";
    }

    return value;
}

// ------------------------------------------------------------
// 4. SAFE FALLBACK CALCULATOR
// No eval() or Function().
// Supports +, -, *, /, %, parentheses and decimals.
// ------------------------------------------------------------

function calculatePowninBasicExpression(expression) {
    const source = String(expression || "").replace(/\s+/g, "");

    if (!source || source.length > 120) {
        throw new Error("INVALID");
    }

    if (!/^[0-9+\-*/%().]+$/.test(source)) {
        throw new Error("INVALID");
    }

    let index = 0;

    function parseNumber() {
        const start = index;
        let dots = 0;

        while (index < source.length) {
            const character = source[index];

            if (character === ".") {
                dots++;
                if (dots > 1) throw new Error("INVALID");
                index++;
            } else if (/[0-9]/.test(character)) {
                index++;
            } else {
                break;
            }
        }

        if (start === index || source.slice(start, index) === ".") {
            throw new Error("INVALID");
        }

        const number = Number(source.slice(start, index));

        if (!Number.isFinite(number)) {
            throw new Error("INVALID");
        }

        return number;
    }

    function parsePrimary() {
        if (source[index] === "(") {
            index++;

            const value = parseExpression();

            if (source[index] !== ")") {
                throw new Error("INVALID");
            }

            index++;
            return value;
        }

        return parseNumber();
    }

    function parseUnary() {
        if (source[index] === "+") {
            index++;
            return parseUnary();
        }

        if (source[index] === "-") {
            index++;
            return -parseUnary();
        }

        return parsePrimary();
    }

    function parseTerm() {
        let value = parseUnary();

        while (index < source.length) {
            const operator = source[index];

            if (!["*", "/", "%"].includes(operator)) {
                break;
            }

            index++;

            const right = parseUnary();

            if ((operator === "/" || operator === "%") && right === 0) {
                throw new Error("DIV_ZERO");
            }

            if (operator === "*") value *= right;
            else if (operator === "/") value /= right;
            else value %= right;
        }

        return value;
    }

    function parseExpression() {
        let value = parseTerm();

        while (index < source.length) {
            const operator = source[index];

            if (operator !== "+" && operator !== "-") {
                break;
            }

            index++;

            const right = parseTerm();

            if (operator === "+") value += right;
            else value -= right;
        }

        return value;
    }

    const result = parseExpression();

    if (index !== source.length || !Number.isFinite(result)) {
        throw new Error("INVALID");
    }

    return Number.isInteger(result)
        ? String(result)
        : String(Number(result.toPrecision(12)));
}

// ------------------------------------------------------------
// 5. USE EXISTING MATH ENGINE FIRST
// ------------------------------------------------------------

function calculatePowninMath(command) {
    const original = String(command || "").trim();

    if (!original) {
        return {
            success: false,
            message: "INVALID"
        };
    }

    try {
        if (
            window.PowninMath &&
            typeof window.PowninMath.calculate === "function"
        ) {
            const result = window.PowninMath.calculate(original);

            if (result && result.success === true) {
                const answer =
                    result.result !== undefined ? result.result :
                    result.answer !== undefined ? result.answer :
                    null;

                if (answer !== null && answer !== undefined) {
                    return {
                        success: true,
                        result: String(answer),
                        topic: result.topic || "Mathematics"
                    };
                }
            }
        }

        const expression = extractPowninMathExpression(original);

        if (!expression) {
            return {
                success: false,
                message: "INVALID"
            };
        }

        return {
            success: true,
            result: calculatePowninBasicExpression(expression),
            topic: "Mathematics"
        };
    } catch (error) {
        return {
            success: false,
            message: error.message === "DIV_ZERO"
                ? "DIV_ZERO"
                : "INVALID"
        };
    }
}

// ------------------------------------------------------------
// 6. LANGUAGE-AWARE MATH REPLY
// ------------------------------------------------------------

function getPowninMathReply(calculation, language) {
    const lang = normalizePowninLanguage(language);

    if (!calculation.success) {
        if (calculation.message === "DIV_ZERO") {
            if (lang === "bn-IN") {
                return "শূন্য দিয়ে ভাগ করা যায় না। অন্য একটি হিসাব দাও।";
            }

            if (lang === "hi-IN") {
                return "शून्य से भाग नहीं किया जा सकता। कोई दूसरा हिसाब दें।";
            }

            return "Division by zero is not allowed. Please try another calculation.";
        }

        if (lang === "bn-IN") {
            return "হিসাবটি বুঝতে পারিনি। আবার সঠিকভাবে লিখে দাও।";
        }

        if (lang === "hi-IN") {
            return "मैं यह गणना समझ नहीं पाया। कृपया सही तरीके से लिखें।";
        }

        return "I couldn't understand that calculation. Please enter it again.";
    }

    if (lang === "bn-IN") {
        return "হিসাবের ফল হলো: " + calculation.result;
    }

    if (lang === "hi-IN") {
        return "गणना का परिणाम है: " + calculation.result;
    }

    return "The answer is " + calculation.result;
}

// ------------------------------------------------------------
// 7. OFFLINE COMMAND HANDLER
// ------------------------------------------------------------

function getPowninOfflineReply(command) {
    const raw = String(command || "").trim();
    const value = normalizePowninText(raw);
    const language = getReplyLanguage(raw);

    if (!value) {
        return {
            handled: true,
            reply: "Please enter a command."
        };
    }

    if (isPowninGreetingCommand(raw)) {
        return {
            handled: true,
            reply: getPowninGreetingReply(language)
        };
    }

    if (
        /\b(who are you|your name|what are you)\b/i.test(value) ||
        /তুমি কে|তোমার নাম কী|তোমার নাম কি|আপনি কে/u.test(value) ||
        /तुम कौन हो|आप कौन हैं|तुम्हारा नाम क्या है/u.test(value)
    ) {
        return {
            handled: true,
            reply: getPowninIdentityReply(language)
        };
    }

    if (
        /^(help|commands|what can you do)\??$/i.test(value) ||
        /সাহায্য|কী কী করতে পার|কি কি করতে পার|কমান্ড দেখাও/u.test(value) ||
        /मदद|क्या कर सकते हो|कमांड बताओ/u.test(value)
    ) {
        return {
            handled: true,
            reply: getPowninHelpReply(language)
        };
    }

    if (
        /^(thanks|thank you|thank you so much)$/i.test(value) ||
        /ধন্যবাদ|অনেক ধন্যবাদ/u.test(value) ||
        /धन्यवाद|शुक्रिया/u.test(value)
    ) {
        return {
            handled: true,
            reply: getPowninThanksReply(language)
        };
    }

    if (
        /\b(time|current time|what time is it)\b/i.test(value) ||
        /সময় কত|সময় কত|এখন কয়টা|এখন কটা/u.test(value) ||
        /समय क्या है|कितने बजे हैं/u.test(value)
    ) {
        const time = getPowninLocalTime(language);

        const reply = language === "bn-IN"
            ? "এখন সময় " + time
            : language === "hi-IN"
                ? "अभी समय " + time
                : "The current time is " + time;

        return {
            handled: true,
            reply: reply
        };
    }

    if (
        /\b(date|today's date|what is the date)\b/i.test(value) ||
        /আজ কত তারিখ|আজকের তারিখ/u.test(value) ||
        /आज की तारीख|आज तारीख क्या है/u.test(value)
    ) {
        const date = getPowninLocalDate(language);

        const reply = language === "bn-IN"
            ? "আজকের তারিখ " + date
            : language === "hi-IN"
                ? "आज की तारीख " + date
                : "Today's date is " + date;

        return {
            handled: true,
            reply: reply
        };
    }

    if (isPowninMathIntent(raw)) {
        const calculation = calculatePowninMath(raw);

        return {
            handled: true,
            reply: getPowninMathReply(calculation, language)
        };
    }

    return {
        handled: false,
        reply: ""
    };
}

// END OF PART 3/8


// ============================================================
// POWNIN SMART BRAIN v5.4
// PART 4/8 — ANDROID BRIDGE & SMART APP CONTROL
// ============================================================

// 1. ANDROID BRIDGE ACCESS

function getPowninAndroidBridge() {
    try {
        if (
            window.PowninAndroid &&
            typeof window.PowninAndroid === "object"
        ) {
            return window.PowninAndroid;
        }
    } catch (error) {
        console.warn("Pownin Android Bridge unavailable:", error);
    }

    return null;
}

function getPowninBridgeMethod(methodName) {
    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge[methodName] === "function") {
        return bridge[methodName].bind(bridge);
    }

    return null;
}

// 2. SAFE ANDROID METHOD CALL

function callPowninAndroid(methodName, ...args) {
    const method = getPowninBridgeMethod(methodName);

    if (!method) {
        return {
            success: false,
            message: "Android bridge method is unavailable: " + methodName
        };
    }

    try {
        const result = method(...args);

        if (result === false || result == null) {
            return {
                success: false,
                message: "Android command was rejected."
            };
        }

        if (typeof result === "string") {
            const status = result.trim().toUpperCase();

            const failureStatuses = [
                "ERROR",
                "FAILED",
                "NOT_FOUND",
                "APP_NOT_FOUND",
                "INVALID_APP",
                "UNAVAILABLE"
            ];

            if (failureStatuses.includes(status)) {
                return {
                    success: false,
                    message: status,
                    result: result
                };
            }
        }

        return {
            success: true,
            message: "Android command accepted.",
            result: result
        };
    } catch (error) {
        return {
            success: false,
            message: getPowninErrorMessage(error)
        };
    }
}

// 3. LOCALIZED DEVICE COMMAND MESSAGES

function getPowninDeviceCommandReply(action, language, extra) {
    const lang = normalizePowninLanguage(language);
    const value = String(extra || "");

    const replies = {
        opening: {
            "bn-IN": "খোলার চেষ্টা করছি: " + value,
            "hi-IN": "खोलने की कोशिश कर रहा हूँ: " + value,
            "en-IN": "Trying to open " + value
        },
        failed: {
            "bn-IN": "অ্যাপটি খুঁজে পাইনি বা খুলতে পারিনি: " + value,
            "hi-IN": "ऐप नहीं मिला या खुल नहीं पाया: " + value,
            "en-IN": "I couldn't find or open " + value
        },
        settings: {
            "bn-IN": "ডিভাইসের Settings খোলার চেষ্টা করছি।",
            "hi-IN": "डिवाइस की Settings खोलने की कोशिश कर रहा हूँ।",
            "en-IN": "Trying to open device Settings."
        },
        volumeUp: {
            "bn-IN": "ভলিউম বাড়ানোর command পাঠানো হয়েছে।",
            "hi-IN": "वॉल्यूम बढ़ाने का command भेजा गया।",
            "en-IN": "Volume up command sent."
        },
        volumeDown: {
            "bn-IN": "ভলিউম কমানোর command পাঠানো হয়েছে।",
            "hi-IN": "वॉल्यूम कम करने का command भेजा गया।",
            "en-IN": "Volume down command sent."
        },
        mute: {
            "bn-IN": "Mute command পাঠানো হয়েছে।",
            "hi-IN": "म्यूट command भेजा गया।",
            "en-IN": "Mute command sent."
        },
        unmute: {
            "bn-IN": "Unmute command পাঠানো হয়েছে।",
            "hi-IN": "अनम्यूट command भेजा गया।",
            "en-IN": "Unmute command sent."
        },
        voice: {
            "bn-IN": "Voice style পরিবর্তনের command পাঠানো হয়েছে।",
            "hi-IN": "वॉइस स्टाइल बदलने का command भेजा गया।",
            "en-IN": "Voice style change command sent."
        },
        language: {
            "bn-IN": "Voice language পরিবর্তনের command পাঠানো হয়েছে।",
            "hi-IN": "वॉइस भाषा बदलने का command भेजा गया।",
            "en-IN": "Voice language change command sent."
        },
        unavailable: {
            "bn-IN": "এই Android সুবিধাটি এখন উপলব্ধ নেই।",
            "hi-IN": "यह Android सुविधा अभी उपलब्ध नहीं है।",
            "en-IN": "This Android feature is unavailable."
        }
    };

    const item = replies[action];

    return item && item[lang]
        ? item[lang]
        : replies.unavailable[lang];
}

// 4. SUPPORTED APP ALIASES

const POWNIN_APP_MAP = {
    whatsapp: "whatsapp",
    youtube: "youtube",
    chrome: "chrome",
    browser: "chrome",
    maps: "maps",
    "google maps": "maps",
    settings: "settings",
    setting: "settings",
    phone: "phone",
    dialer: "phone",
    camera: "camera",
    calculator: "calculator",
    calc: "calculator",
    files: "files",
    "file manager": "files",
    gallery: "gallery",
    photos: "photos",
    "google photos": "photos"
};

// 5. OPEN COMMAND DETECTION

function hasPowninOpenIntent(command) {
    const text = normalizePowninText(command);

    const openPatterns = [
        /\b(open|launch|start|run)\b/i,
        /খোলো|খুলে দাও|চালু করো|ওপেন করো/u,
        /खोलो|खोल दो|चालू करो|ओपन करो/u,
        /\b(kholo|khol do|chalu koro|open koro)\b/i
    ];

    return openPatterns.some(function (pattern) {
        return pattern.test(text);
    });
}

// 6. APP NAME DETECTION

function detectPowninAppName(command) {
    const text = normalizePowninText(command);

    if (!text) return null;

    const appPatterns = [
        {
            app: "whatsapp",
            patterns: [
                /\bwhatsapp\b|\bwhats app\b/i,
                /व्हाट्सऐप|व्हाट्सएप/u,
                /হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ/u
            ]
        },
        {
            app: "youtube",
            patterns: [/\byoutube\b/i, /यूट्यूब/u, /ইউটিউব/u]
        },
        {
            app: "chrome",
            patterns: [/\bchrome\b|\bbrowser\b/i, /क्रोम/u, /ক্রোম/u]
        },
        {
            app: "calculator",
            patterns: [/\bcalculator\b|\bcalc\b/i, /कैलकुलेटर/u, /ক্যালকুলেটর/u]
        },
        {
            app: "camera",
            patterns: [/\bcamera\b/i, /कैमरा/u, /ক্যামেরা/u]
        },
        {
            app: "settings",
            patterns: [/\bsettings?\b/i, /सेटिंग/u, /সেটিংস/u]
        },
        {
            app: "maps",
            patterns: [/\bgoogle maps\b|\bmaps\b/i, /गूगल मैप्स|मैप्स/u, /গুগল ম্যাপস|ম্যাপস/u]
        },
        {
            app: "phone",
            patterns: [/\bphone\b|\bdialer\b/i, /फोन|डायलर/u, /ফোন|ডায়ালার|ডায়ালার/u]
        },
        {
            app: "files",
            patterns: [/\bfiles\b|\bfile manager\b|\bmy files\b/i, /फाइल|फ़ाइल/u, /ফাইল|ফাইল ম্যানেজার/u]
        },
        {
            app: "gallery",
            patterns: [/\bgallery\b/i, /गैलरी/u, /গ্যালারি/u]
        },
        {
            app: "photos",
            patterns: [/\bgoogle photos\b|\bphotos\b/i, /गूगल फोटोज|फोटोज/u, /গুগল ফটোস|ফটোস/u]
        }
    ];

    for (const item of appPatterns) {
        if (item.patterns.some(function (pattern) {
            return pattern.test(text);
        })) {
            return item.app;
        }
    }

    if (!hasPowninOpenIntent(text)) {
        return null;
    }

    let appName = text;

    const cleanupPatterns = [
        /^(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?/i,
        /^(?:খোলো|খুলে দাও|চালু করো|ওপেন করো)\s*/u,
        /^(?:खोलो|खोल दो|चालू करो|ओपन करो)\s*/u,
        /\s+(?:please|app|application)$/i,
        /\s+(?:খোলো|খুলে দাও|চালু করো|ওপেন করো)$/u,
        /\s+(?:खोलो|खोल दो|चालू करो|ओपन करो)$/u,
        /\s+(?:kholo|khol do|chalu koro|open koro)$/i
    ];

    for (const pattern of cleanupPatterns) {
        appName = appName.replace(pattern, "").trim();
    }

    appName = appName.replace(/^please\s+/i, "").trim();

    if (!appName || appName.length > 60) {
        return null;
    }

    const normalizedName = appName.toLowerCase();

    return POWNIN_APP_MAP[normalizedName] || appName;
}

// 7. OPEN APP COMMAND DETECTION

function isPowninOpenAppCommand(command) {
    const text = normalizePowninText(command);

    return hasPowninOpenIntent(text) &&
        detectPowninAppName(text) !== null;
}

// 8. OPEN APP COMMAND

function processPowninOpenAppCommand(text) {
    if (!isPowninOpenAppCommand(text)) {
        return {
            handled: false,
            reply: ""
        };
    }

    const appName = detectPowninAppName(text);
    const language = getReplyLanguage(text);

    if (!appName) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("openApp", appName);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceCommandReply(
                "failed",
                language,
                appName + "."
            )
        };
    }

    return {
        handled: true,
        reply: getPowninDeviceCommandReply(
            "opening",
            language,
            appName + "."
        )
    };
}

// 9. ANDROID SETTINGS COMMANDS

function processPowninSettingsCommand(text) {
    const value = normalizePowninText(text);

    const settingsIntent =
        /\b(open|show)\s+(wifi|wi-fi|internet|bluetooth|sound|audio|volume|display|brightness|notification|accessibility|security|app)\s+settings\b/i.test(value) ||
        (
            /ওয়াই-?ফাই|ওয়াই-?ফাই|ব্লুটুথ|ডিসপ্লে|নোটিফিকেশন|অ্যাক্সেসিবিলিটি/u.test(value) &&
            hasPowninOpenIntent(value)
        ) ||
        (
            /वाई-?फाई|ब्लूटूथ|डिस्प्ले|नोटिफिकेशन|एक्सेसिबिलिटी/u.test(value) &&
            hasPowninOpenIntent(value)
        );

    if (!settingsIntent) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("openApp", "settings");
    const language = getReplyLanguage(text);

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("settings", language)
            : getPowninDeviceCommandReply("failed", language, "Settings.")
    };
}

// 10. VOLUME COMMANDS

function processPowninVolumeCommand(text) {
    const value = normalizePowninText(text);
    let direction = "";

    if (
        /\b(volume up|increase volume|raise volume|louder)\b/i.test(value) ||
        /ভলিউম বাড়াও|ভলিউম বাড়াও|শব্দ বাড়াও|শব্দ বাড়াও/u.test(value) ||
        /आवाज़ बढ़ाओ|वॉल्यूम बढ़ाओ/u.test(value)
    ) {
        direction = "up";
    } else if (
        /\b(volume down|decrease volume|lower volume|quieter)\b/i.test(value) ||
        /ভলিউম কমাও|শব্দ কমাও/u.test(value) ||
        /आवाज़ कम करो|वॉल्यूम कम करो/u.test(value)
    ) {
        direction = "down";
    } else if (
        /\b(mute|mute volume|silence volume)\b/i.test(value) ||
        /সাউন্ড বন্ধ কর|ভলিউম বন্ধ কর|মিউট কর/u.test(value) ||
        /म्यूट करो|आवाज़ बंद करो/u.test(value)
    ) {
        direction = "mute";
    } else if (
        /\b(unmute|sound on|restore volume)\b/i.test(value) ||
        /আনমিউট কর|সাউন্ড চালু কর/u.test(value) ||
        /अनम्यूट करो|आवाज़ चालू करो/u.test(value)
    ) {
        direction = "unmute";
    }

    if (!direction) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("adjustVolume", direction);
    const language = getReplyLanguage(text);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceCommandReply("unavailable", language)
        };
    }

    const replyKey = {
        up: "volumeUp",
        down: "volumeDown",
        mute: "mute",
        unmute: "unmute"
    }[direction];

    return {
        handled: true,
        reply: getPowninDeviceCommandReply(replyKey, language)
    };
}

// 11. VOICE STYLE COMMANDS

function processPowninVoiceStyleCommand(text) {
    const value = normalizePowninText(text);
    let style = "";

    if (
        /\b(gaming voice|game voice|pubg voice|gaming mode|gaming style)\b/i.test(value) ||
        /গেমিং ভয়েস|গেমিং ভয়েস|পাবজি ভয়েস|পাবজি ভয়েস/u.test(value) ||
        /गेमिंग वॉइस/u.test(value)
    ) {
        style = "gaming";
    } else if (
        /\b(normal voice|normal mode|normal style)\b/i.test(value) ||
        /স্বাভাবিক ভয়েস|স্বাভাবিক ভয়েস|নরমাল ভয়েস/u.test(value) ||
        /नॉर्मल वॉइस/u.test(value)
    ) {
        style = "normal";
    } else if (
        /\b(deep voice|deeper voice|deep style)\b/i.test(value) ||
        /গভীর ভয়েস|গভীর ভয়েস|ডিপ ভয়েস/u.test(value) ||
        /डीप वॉइस/u.test(value)
    ) {
        style = "deep";
    }

    if (!style) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("setVoiceStyle", style);
    const language = getReplyLanguage(text);

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("voice", language)
            : getPowninDeviceCommandReply("unavailable", language)
    };
}

// 12. VOICE LANGUAGE COMMANDS

function processPowninVoiceLanguageCommand(text) {
    const value = normalizePowninText(text);
    let language = "";

    if (
        /\b(bengali voice|bangla voice|speak bengali|speak bangla)\b/i.test(value) ||
        /বাংলায় কথা বল|বাংলায় কথা বল|বাংলা ভয়েস|বাংলা ভয়েস/u.test(value) ||
        /बंगाली वॉइस|बांग्ला में बोलो/u.test(value)
    ) {
        language = "bn-IN";
    } else if (
        /\b(hindi voice|speak hindi)\b/i.test(value) ||
        /হিন্দি ভয়েস|হিন্দি ভয়েস/u.test(value) ||
        /हिंदी में बोलो|हिंदी वॉइस/u.test(value)
    ) {
        language = "hi-IN";
    } else if (
        /\b(english voice|speak english)\b/i.test(value) ||
        /ইংরেজিতে কথা বল|ইংরেজি ভয়েস|ইংরেজি ভয়েস/u.test(value) ||
        /अंग्रेज़ी में बोलो|अंग्रेजी वॉइस/u.test(value)
    ) {
        language = "en-IN";
    }

    if (!language) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("setTtsLanguage", language);

    if (result.success) {
        selectedLanguage = language;

        if (languageSelect) {
            languageSelect.value = language;
        }
    }

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("language", language)
            : getPowninDeviceCommandReply("unavailable", language)
    };
}

// END OF PART 4/8


/* =========================================================
   POWNIN SMART BRAIN v5.4
   PART 4/8 — ANDROID BRIDGE & SMART APP CONTROL
   ========================================================= */

// ---------------------------------------------------------
// 1. ANDROID BRIDGE ACCESS
// ---------------------------------------------------------

function getPowninAndroidBridge() {
    try {
        if (
            window.PowninAndroid &&
            typeof window.PowninAndroid === "object"
        ) {
            return window.PowninAndroid;
        }
    } catch (error) {
        console.warn("Pownin Android Bridge unavailable:", error);
    }

    return null;
}

function getPowninBridgeMethod(methodName) {
    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge[methodName] === "function") {
        return bridge[methodName].bind(bridge);
    }

    return null;
}

// ---------------------------------------------------------
// 2. SAFE ANDROID METHOD CALL
// ---------------------------------------------------------

function callPowninAndroid(methodName, ...args) {
    const method = getPowninBridgeMethod(methodName);

    if (!method) {
        return {
            success: false,
            message: "Android bridge method is unavailable: " + methodName
        };
    }

    try {
        const result = method(...args);

        if (result === false || result == null) {
            return {
                success: false,
                message: "Android command was rejected."
            };
        }

        if (typeof result === "string") {
            const status = result.trim().toUpperCase();

            const failureStatuses = [
                "ERROR",
                "FAILED",
                "NOT_FOUND",
                "APP_NOT_FOUND",
                "INVALID_APP",
                "UNAVAILABLE"
            ];

            if (failureStatuses.includes(status)) {
                return {
                    success: false,
                    message: status,
                    result: result
                };
            }
        }

        return {
            success: true,
            message: "Android command accepted.",
            result: result
        };
    } catch (error) {
        return {
            success: false,
            message: getPowninErrorMessage(error)
        };
    }
}

// ---------------------------------------------------------
// 3. LOCALIZED DEVICE COMMAND MESSAGES
// ---------------------------------------------------------

function getPowninDeviceCommandReply(action, language, extra) {
    const lang = normalizePowninLanguage(language);
    const value = String(extra || "");

    const replies = {
        opening: {
            "bn-IN": "খোলার চেষ্টা করছি: " + value,
            "hi-IN": "खोलने की कोशिश कर रहा हूँ: " + value,
            "en-IN": "Trying to open " + value
        },
        failed: {
            "bn-IN": "অ্যাপটি খুঁজে পাইনি বা খুলতে পারিনি: " + value,
            "hi-IN": "ऐप नहीं मिला या खुल नहीं पाया: " + value,
            "en-IN": "I couldn't find or open " + value
        },
        settings: {
            "bn-IN": "ডিভাইসের Settings খোলার চেষ্টা করছি।",
            "hi-IN": "डिवाइस की Settings खोलने की कोशिश कर रहा हूँ।",
            "en-IN": "Trying to open device Settings."
        },
        volumeUp: {
            "bn-IN": "ভলিউম বাড়ানোর কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "वॉल्यूम बढ़ाने का कमांड भेज दिया गया है।",
            "en-IN": "Volume increase command sent."
        },
        volumeDown: {
            "bn-IN": "ভলিউম কমানোর কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "वॉल्यूम कम करने का कमांड भेज दिया गया है।",
            "en-IN": "Volume decrease command sent."
        },
        mute: {
            "bn-IN": "Mute কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "म्यूट कमांड भेजा गया।",
            "en-IN": "Mute command sent."
        },
        unmute: {
            "bn-IN": "Unmute কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "अनम्यूट कमांड भेजा गया।",
            "en-IN": "Unmute command sent."
        },
        voice: {
            "bn-IN": "Voice style পরিবর্তনের কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "वॉइस स्टाइल बदलने का कमांड भेजा गया।",
            "en-IN": "Voice style command sent."
        },
        language: {
            "bn-IN": "Voice language পরিবর্তনের কমান্ড পাঠানো হয়েছে।",
            "hi-IN": "वॉइस भाषा बदलने का कमांड भेजा गया।",
            "en-IN": "Voice language command sent."
        },
        unavailable: {
            "bn-IN": "এই Android সুবিধাটি এখন উপলব্ধ নেই।",
            "hi-IN": "यह Android सुविधा अभी उपलब्ध नहीं है।",
            "en-IN": "This Android feature is unavailable."
        }
    };

    const item = replies[action];

    return item && item[lang]
        ? item[lang]
        : replies.unavailable[lang];
}

// ---------------------------------------------------------
// 4. SUPPORTED APP ALIASES
// ---------------------------------------------------------

const POWNIN_APP_MAP = {
    whatsapp: "whatsapp",
    youtube: "youtube",
    chrome: "chrome",
    browser: "chrome",
    maps: "maps",
    "google maps": "maps",
    settings: "settings",
    setting: "settings",
    phone: "phone",
    dialer: "phone",
    camera: "camera",
    calculator: "calculator",
    calc: "calculator",
    files: "files",
    "file manager": "files",
    gallery: "gallery",
    photos: "photos",
    "google photos": "photos"
};

// ---------------------------------------------------------
// 5. OPEN COMMAND DETECTION
// ---------------------------------------------------------

function hasPowninOpenIntent(command) {
    const text = normalizePowninText(command);

    const openPatterns = [
        /\b(open|launch|start|run)\b/i,
        /খোলো|খুলে দাও|চালু করো|ওপেন করো/u,
        /खोलो|खोल दो|चालू करो|ओपन करो/u,
        /\b(kholo|khol do|chalu koro|open koro)\b/i
    ];

    return openPatterns.some(function (pattern) {
        return pattern.test(text);
    });
}

// ---------------------------------------------------------
// 6. APP NAME DETECTION
// ---------------------------------------------------------

function detectPowninAppName(command) {
    const text = normalizePowninText(command);

    if (!text) return null;

    const appPatterns = [
        {
            app: "whatsapp",
            patterns: [
                /\bwhatsapp\b|\bwhats app\b/i,
                /व्हाट्सऐप|व्हाट्सएप/u,
                /হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ/u
            ]
        },
        {
            app: "youtube",
            patterns: [
                /\byoutube\b/i,
                /यूट्यूब/u,
                /ইউটিউব/u
            ]
        },
        {
            app: "chrome",
            patterns: [
                /\bchrome\b|\bbrowser\b/i,
                /क्रोम/u,
                /ক্রোম/u
            ]
        },
        {
            app: "calculator",
            patterns: [
                /\bcalculator\b|\bcalc\b/i,
                /कैलकुलेटर/u,
                /ক্যালকুলেটর/u
            ]
        },
        {
            app: "camera",
            patterns: [
                /\bcamera\b/i,
                /कैमरा/u,
                /ক্যামেরা/u
            ]
        },
        {
            app: "settings",
            patterns: [
                /\bsettings?\b/i,
                /सेटिंग/u,
                /সেটিংস/u
            ]
        },
        {
            app: "maps",
            patterns: [
                /\bgoogle maps\b|\bmaps\b/i,
                /गूगल मैप्स|मैप्स/u,
                /গুগল ম্যাপস|ম্যাপস/u
            ]
        },
        {
            app: "phone",
            patterns: [
                /\bphone\b|\bdialer\b/i,
                /फोन|डायलर/u,
                /ফোন|ডায়ালার|ডায়ালার/u
            ]
        },
        {
            app: "files",
            patterns: [
                /\bfiles\b|\bfile manager\b|\bmy files\b/i,
                /फाइल|फ़ाइल/u,
                /ফাইল|ফাইল ম্যানেজার/u
            ]
        },
        {
            app: "gallery",
            patterns: [
                /\bgallery\b/i,
                /गैलरी/u,
                /গ্যালারি/u
            ]
        },
        {
            app: "photos",
            patterns: [
                /\bgoogle photos\b|\bphotos\b/i,
                /गूगल फोटोज|फोटोज/u,
                /গুগল ফটোস|ফটোস/u
            ]
        }
    ];

    for (const item of appPatterns) {
        if (item.patterns.some(function (pattern) {
            return pattern.test(text);
        })) {
            return item.app;
        }
    }

    if (!hasPowninOpenIntent(text)) {
        return null;
    }

    let appName = text;

    const cleanupPatterns = [
        /^(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?/i,
        /^(?:খোলো|খুলে দাও|চালু করো|ওপেন করো)\s*/u,
        /^(?:खोलो|खोल दो|चालू करो|ओपन करो)\s*/u,
        /\s+(?:please|app|application)$/i,
        /\s+(?:খোলো|খুলে দাও|চালু করো|ওপেন করো)$/u,
        /\s+(?:खोलो|खोल दो|चालू करो|ओपन करो)$/u,
        /\s+(?:kholo|khol do|chalu koro|open koro)$/i
    ];

    for (const pattern of cleanupPatterns) {
        appName = appName.replace(pattern, "").trim();
    }

    appName = appName.replace(/^please\s+/i, "").trim();

    if (!appName || appName.length > 60) {
        return null;
    }

    const normalizedName = appName.toLowerCase();

    return POWNIN_APP_MAP[normalizedName] || appName;
}

// ---------------------------------------------------------
// 7. OPEN APP COMMAND DETECTION
// ---------------------------------------------------------

function isPowninOpenAppCommand(command) {
    const text = normalizePowninText(command);

    return hasPowninOpenIntent(text) &&
        detectPowninAppName(text) !== null;
}

// ---------------------------------------------------------
// 8. OPEN APP COMMAND
// ---------------------------------------------------------

function processPowninOpenAppCommand(text) {
    if (!isPowninOpenAppCommand(text)) {
        return {
            handled: false,
            reply: ""
        };
    }

    const appName = detectPowninAppName(text);
    const language = getReplyLanguage(text);

    if (!appName) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("openApp", appName);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceCommandReply(
                "failed",
                language,
                appName + "."
            )
        };
    }

    return {
        handled: true,
        reply: getPowninDeviceCommandReply(
            "opening",
            language,
            appName + "."
        )
    };
}

// ---------------------------------------------------------
// 9. ANDROID SETTINGS COMMANDS
// ---------------------------------------------------------

function processPowninSettingsCommand(text) {
    const value = normalizePowninText(text);

    const settingsIntent =
        /\b(open|show)\s+(wifi|wi-fi|internet|bluetooth|sound|audio|volume|display|brightness|notification|accessibility|security|app)\s+settings\b/i.test(value) ||
        (/ওয়াই-?ফাই|ওয়াই-?ফাই|ব্লুটুথ|ডিসপ্লে|নোটিফিকেশন|অ্যাক্সেসিবিলিটি/u.test(value) && hasPowninOpenIntent(value)) ||
        (/वाई-?फाई|ब्लूटूथ|डिस्प्ले|नोटिफिकेशन|एक्सेसिबिलिटी/u.test(value) && hasPowninOpenIntent(value));

    if (!settingsIntent) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("openApp", "settings");
    const language = getReplyLanguage(text);

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("settings", language)
            : getPowninDeviceCommandReply("failed", language, "Settings.")
    };
}

// ---------------------------------------------------------
// 10. VOLUME COMMANDS
// ---------------------------------------------------------

function processPowninVolumeCommand(text) {
    const value = normalizePowninText(text);
    let direction = "";

    if (
        /\b(volume up|increase volume|raise volume|louder)\b/i.test(value) ||
        /ভলিউম বাড়াও|ভলিউম বাড়াও|শব্দ বাড়াও|শব্দ বাড়াও/u.test(value) ||
        /आवाज़ बढ़ाओ|वॉल्यूम बढ़ाओ/u.test(value)
    ) {
        direction = "up";
    } else if (
        /\b(volume down|decrease volume|lower volume|quieter)\b/i.test(value) ||
        /ভলিউম কমাও|শব্দ কমাও/u.test(value) ||
        /आवाज़ कम करो|वॉल्यूम कम करो/u.test(value)
    ) {
        direction = "down";
    } else if (
        /\b(mute|mute volume|silence volume)\b/i.test(value) ||
        /সাউন্ড বন্ধ কর|ভলিউম বন্ধ কর|মিউট কর/u.test(value) ||
        /म्यूट करो|आवाज़ बंद करो/u.test(value)
    ) {
        direction = "mute";
    } else if (
        /\b(unmute|sound on|restore volume)\b/i.test(value) ||
        /আনমিউট কর|সাউন্ড চালু কর/u.test(value) ||
        /अनम्यूट करो|आवाज़ चालू करो/u.test(value)
    ) {
        direction = "unmute";
    }

    if (!direction) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("adjustVolume", direction);
    const language = getReplyLanguage(text);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceCommandReply("unavailable", language)
        };
    }

    const replyKey = {
        up: "volumeUp",
        down: "volumeDown",
        mute: "mute",
        unmute: "unmute"
    }[direction];

    return {
        handled: true,
        reply: getPowninDeviceCommandReply(replyKey, language)
    };
}

// ---------------------------------------------------------
// 11. VOICE STYLE COMMANDS
// ---------------------------------------------------------

function processPowninVoiceStyleCommand(text) {
    const value = normalizePowninText(text);
    let style = "";

    if (
        /\b(gaming voice|game voice|pubg voice|gaming mode|gaming style)\b/i.test(value) ||
        /গেমিং ভয়েস|গেমিং ভয়েস|পাবজি ভয়েস|পাবজি ভয়েস/u.test(value) ||
        /गेमिंग वॉइस/u.test(value)
    ) {
        style = "gaming";
    } else if (
        /\b(normal voice|normal mode|normal style)\b/i.test(value) ||
        /স্বাভাবিক ভয়েস|স্বাভাবিক ভয়েস|নরমাল ভয়েস/u.test(value) ||
        /नॉर्मल वॉइस/u.test(value)
    ) {
        style = "normal";
    } else if (
        /\b(deep voice|deeper voice|deep style)\b/i.test(value) ||
        /গভীর ভয়েস|গভীর ভয়েস|ডিপ ভয়েস/u.test(value) ||
        /डीप वॉइस/u.test(value)
    ) {
        style = "deep";
    }

    if (!style) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("setVoiceStyle", style);
    const language = getReplyLanguage(text);

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("voice", language)
            : getPowninDeviceCommandReply("unavailable", language)
    };
}

// ---------------------------------------------------------
// 12. VOICE LANGUAGE COMMANDS
// ---------------------------------------------------------

function processPowninVoiceLanguageCommand(text) {
    const value = normalizePowninText(text);
    let language = "";

    if (
        /\b(bengali voice|bangla voice|speak bengali|speak bangla)\b/i.test(value) ||
        /বাংলায় কথা বল|বাংলায় কথা বল|বাংলা ভয়েস|বাংলা ভয়েস/u.test(value) ||
        /बंगाली वॉइस|बांग्ला में बोलो/u.test(value)
    ) {
        language = "bn-IN";
    } else if (
        /\b(hindi voice|speak hindi)\b/i.test(value) ||
        /হিন্দি ভয়েস|হিন্দি ভয়েস/u.test(value) ||
        /हिंदी में बोलो|हिंदी वॉइस/u.test(value)
    ) {
        language = "hi-IN";
    } else if (
        /\b(english voice|speak english)\b/i.test(value) ||
        /ইংরেজিতে কথা বল|ইংরেজি ভয়েস|ইংরেজি ভয়েস/u.test(value) ||
        /अंग्रेज़ी में बोलो|अंग्रेजी वॉइस/u.test(value)
    ) {
        language = "en-IN";
    }

    if (!language) {
        return {
            handled: false,
            reply: ""
        };
    }

    const result = callPowninAndroid("setTtsLanguage", language);

    if (result.success) {
        selectedLanguage = language;
    }

    return {
        handled: true,
        reply: result.success
            ? getPowninDeviceCommandReply("language", language)
            : getPowninDeviceCommandReply("unavailable", language)
    };
}

// ---------------------------------------------------------
// END OF PART 4/8
// Continue with PART 5/8 in the same app.js file.
// =========================================================


/* =========================================================
   POWNIN SMART BRAIN v5.4
   PART 5/8 — NOTES, EXTRA COMMANDS & ONLINE AI
   ========================================================= */

// ---------------------------------------------------------
// 1. SAVE AND MANAGE NOTES
// ---------------------------------------------------------

function processPowninNoteCommand(text) {
    const raw = String(text || "").trim();
    const value = normalizePowninText(raw);
    const language = getReplyLanguage(raw);

    const saveMatch = raw.match(
        /^(?:save note|remember note|remember this|note)\s*[:,-]?\s*(.+)$/i
    );

    const bengaliSaveMatch = raw.match(
        /^(?:নোট লেখো|নোট সেভ করো|মনে রেখো|এটা মনে রাখো)\s*[:,-]?\s*(.+)$/u
    );

    const hindiSaveMatch = raw.match(
        /^(?:नोट लिखो|नोट सेव करो|याद रखो)\s*[:,-]?\s*(.+)$/u
    );

    const noteText =
        (saveMatch && saveMatch[1]) ||
        (bengaliSaveMatch && bengaliSaveMatch[1]) ||
        (hindiSaveMatch && hindiSaveMatch[1]);

    if (noteText) {
        const result = addPowninNote(noteText);

        if (result.success) {
            return {
                handled: true,
                reply: language === "bn-IN"
                    ? "নোট সেভ করা হয়েছে।"
                    : language === "hi-IN"
                        ? "नोट सेव कर दिया गया है।"
                        : "Note saved."
            };
        }

        return {
            handled: true,
            reply: result.message
        };
    }

    if (
        /\b(show|read|list)\s+(my\s+)?notes\b/i.test(value) ||
        /নোট দেখাও|আমার নোট দেখাও/u.test(value) ||
        /मेरे नोट दिखाओ|नोट दिखाओ/u.test(value)
    ) {
        return {
            handled: true,
            reply: formatPowninNotes(language)
        };
    }

    if (
        /\b(clear|delete|erase)\s+(all\s+)?notes\b/i.test(value) ||
        /সব নোট মুছে দাও|নোট মুছে দাও/u.test(value) ||
        /सभी नोट मिटाओ|नोट मिटाओ/u.test(value)
    ) {
        return {
            handled: true,
            reply: clearPowninNotes(language)
        };
    }

    return {
        handled: false,
        reply: ""
    };
}

// ---------------------------------------------------------
// 2. EXTRA COMMAND ROUTER
// ---------------------------------------------------------

function processPowninExtraCommand(text) {
    const command = String(text || "").trim();

    const handlers = [
        processPowninNoteCommand,
        processPowninSettingsCommand,
        processPowninOpenAppCommand,
        processPowninVolumeCommand,
        processPowninVoiceStyleCommand,
        processPowninVoiceLanguageCommand
    ];

    for (const handler of handlers) {
        try {
            const result = handler(command);

            if (result && result.handled) {
                return result;
            }
        } catch (error) {
            console.error("Pownin command handler error:", error);

            return {
                handled: true,
                reply: getPowninErrorMessage(error)
            };
        }
    }

    return {
        handled: false,
        reply: ""
    };
}

// ---------------------------------------------------------
// 3. ONLINE AI SETTINGS
// ---------------------------------------------------------

function getPowninOnlineSettings() {
    return {
        endpoint: endpointInput
            ? endpointInput.value.trim()
            : "",
        model: modelInput
            ? modelInput.value.trim()
            : "",
        apiKey: apiKeyInput
            ? apiKeyInput.value.trim()
            : ""
    };
}

function validatePowninOnlineSettings(settings) {
    if (!settings.endpoint || !settings.model || !settings.apiKey) {
        return {
            valid: false,
            message: "Online AI ব্যবহার করতে Endpoint, Model এবং API Key পূরণ করো।"
        };
    }

    let endpointURL;

    try {
        endpointURL = new URL(settings.endpoint);
    } catch (error) {
        return {
            valid: false,
            message: "Online AI Endpoint-এর URL সঠিক নয়।"
        };
    }

    if (endpointURL.protocol !== "https:") {
        return {
            valid: false,
            message: "নিরাপত্তার জন্য Online AI Endpoint অবশ্যই HTTPS হতে হবে।"
        };
    }

    if (endpointURL.username || endpointURL.password) {
        return {
            valid: false,
            message: "Endpoint URL-এর মধ্যে username বা password দিও না।"
        };
    }

    return {
        valid: true,
        message: ""
    };
}

// ---------------------------------------------------------
// 4. ASK ONLINE AI
// ---------------------------------------------------------

async function askPowninOnlineAI(command, signal) {
    const settings = getPowninOnlineSettings();
    const validation = validatePowninOnlineSettings(settings);

    if (!validation.valid) {
        return {
            success: false,
            message: validation.message
        };
    }

    const language = getReplyLanguage(command);

    const languageInstruction =
        language === "bn-IN"
            ? "Reply in natural Bengali unless the user requests another language."
            : language === "hi-IN"
                ? "Reply in natural Hindi unless the user requests another language."
                : "Reply in clear English unless the user requests another language.";

    const messages = [
        {
            role: "system",
            content:
                "You are Pownin, a helpful Android voice assistant. " +
                languageInstruction +
                " Keep answers useful and reasonably concise. " +
                "Never claim to have performed a device action unless its result is confirmed."
        }
    ];

    for (const item of getPowninHistory()) {
        if (
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string"
        ) {
            messages.push({
                role: item.role,
                content: item.content
            });
        }
    }

    messages.push({
        role: "user",
        content: String(command).slice(0, MAX_COMMAND_LENGTH)
    });

    setNetworkStatus("CONNECTING");

    try {
        const response = await fetch(settings.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + settings.apiKey
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.7
            }),
            signal: signal
        });

        if (!response.ok) {
            throw new Error(
                "Online AI request failed (HTTP " +
                response.status +
                "). Check the endpoint, model and API key."
            );
        }

        const data = await response.json();

        const answer =
            data &&
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content;

        if (typeof answer !== "string" || !answer.trim()) {
            throw new Error("Online AI returned an empty response.");
        }

        setNetworkStatus("ONLINE");

        return {
            success: true,
            reply: answer.trim()
        };
    } catch (error) {
        if (error && error.name === "AbortError") {
            return {
                success: false,
                aborted: true,
                message: "Request stopped."
            };
        }

        setNetworkStatus("OFFLINE");

        return {
            success: false,
            message: getPowninErrorMessage(error)
        };
    }
}

// ---------------------------------------------------------
// 5. BRAIN MODE COMMANDS
// ---------------------------------------------------------

function processPowninModeCommand(text) {
    const value = normalizePowninText(text);

    let requestedMode = "";

    if (
        /\b(offline mode|switch to offline|use offline mode)\b/i.test(value) ||
        /অফলাইন মোড চালু কর|অফলাইন মোডে যাও/u.test(value) ||
        /ऑफलाइन मोड चालू करो/u.test(value)
    ) {
        requestedMode = "offline";
    } else if (
        /\b(online mode|switch to online|use online mode)\b/i.test(value) ||
        /অনলাইন মোড চালু কর|অনলাইন মোডে যাও/u.test(value) ||
        /ऑनलाइन मोड चालू करो/u.test(value)
    ) {
        requestedMode = "online";
    } else if (
        /\b(hybrid mode|switch to hybrid|use hybrid mode)\b/i.test(value) ||
        /হাইব্রিড মোড চালু কর|হাইব্রিড মোডে যাও/u.test(value) ||
        /हाइब्रिड मोड चालू करो/u.test(value)
    ) {
        requestedMode = "hybrid";
    }

    if (!requestedMode) {
        return {
            handled: false,
            reply: ""
        };
    }

    setPowninMode(requestedMode);

    const language = getReplyLanguage(text);

    const replies = {
        offline: {
            "bn-IN": "Offline Mode চালু হয়েছে।",
            "hi-IN": "ऑफलाइन मोड चालू हो गया है।",
            "en-IN": "Offline Mode is now selected."
        },
        online: {
            "bn-IN": "Online Mode নির্বাচন করা হয়েছে।",
            "hi-IN": "ऑनलाइन मोड चुना गया है।",
            "en-IN": "Online Mode is now selected."
        },
        hybrid: {
            "bn-IN": "Hybrid Mode চালু হয়েছে।",
            "hi-IN": "हाइब्रिड मोड चालू हो गया है।",
            "en-IN": "Hybrid Mode is now selected."
        }
    };

    return {
        handled: true,
        reply: replies[requestedMode][language]
    };
}

// ---------------------------------------------------------
// END OF PART 5/8
// Continue with PART 6/8 in the same app.js file.
// =========================================================


/* =========================================================
   POWNIN SMART BRAIN v5.4
   PART 6/8 — CHAT UI, NATIVE VOICE & SPEECH CALLBACKS
   ========================================================= */

// ---------------------------------------------------------
// 1. ADD CHAT MESSAGE
// ---------------------------------------------------------

function addPowninChatMessage(role, text) {
    if (!chat) {
        console.warn("Pownin chat element not found.");
        return null;
    }

    const message = document.createElement("div");

    message.className =
        role === "user"
            ? "message user-message"
            : "message assistant-message";

    const label = document.createElement("strong");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "Pownin";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = String(text || "");

    message.appendChild(label);
    message.appendChild(content);
    chat.appendChild(message);

    chat.scrollTop = chat.scrollHeight;

    return message;
}

// ---------------------------------------------------------
// 2. SHOW REPLY AND STORE CONVERSATION HISTORY
// ---------------------------------------------------------

function showReply(text, options) {
    const reply = String(text || "").trim();

    if (!reply) return;

    lastReply = reply;
    addHistory("assistant", reply);
    addPowninChatMessage("assistant", reply);

    if (!options || options.speak !== false) {
        speak(reply);
    }
}

function showUserMessage(text) {
    const message = String(text || "").trim();

    if (!message) return;

    lastUserCommand = message;
    addHistory("user", message);
    addPowninChatMessage("user", message);
}

// ---------------------------------------------------------
// 3. SPEAK THROUGH NATIVE ANDROID TTS
// ---------------------------------------------------------

function speak(text) {
    if (!speechEnabled) return;

    const message = String(text || "").trim();
    if (!message) return;

    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.speak === "function") {
        try {
            bridge.speak(message);
            setVoiceStatus("READY");
            return;
        } catch (error) {
            console.error("Native speech failed:", error);
        }
    }

    // Browser fallback, if supported by the WebView.
    if (
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    ) {
        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = getCurrentLanguage();

            utterance.onstart = function () {
                setVoiceStatus("SPEAKING");
            };

            utterance.onend = function () {
                setVoiceStatus("READY");
            };

            utterance.onerror = function () {
                setVoiceStatus("VOICE ERROR");
            };

            window.speechSynthesis.speak(utterance);
            return;
        } catch (error) {
            console.error("Browser speech failed:", error);
        }
    }

    setVoiceStatus("VOICE UNAVAILABLE");
}

// ---------------------------------------------------------
// 4. STOP VOICE OUTPUT
// ---------------------------------------------------------

function stopPowninVoice() {
    let nativeStopped = false;

    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.stopSpeaking === "function") {
        try {
            bridge.stopSpeaking();
            nativeStopped = true;
        } catch (error) {
            console.error("Could not stop native speech:", error);
        }
    }

    if ("speechSynthesis" in window) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.error("Could not stop browser speech:", error);
        }
    }

    setVoiceStatus("READY");

    return nativeStopped;
}

// ---------------------------------------------------------
// 5. STOP NATIVE SPEECH RECOGNITION
// ---------------------------------------------------------

function stopPowninListening() {
    isListening = false;

    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.stopListening === "function") {
        try {
            bridge.stopListening();
        } catch (error) {
            console.warn("Could not stop native listening:", error);
        }
    }

    setVoiceStatus("READY");
}

// ---------------------------------------------------------
// 6. CANCEL CURRENT COMMAND AND ONLINE REQUEST
// ---------------------------------------------------------

function cancelPowninProcessing() {
    // Invalidate the old async command before aborting it.
    powninCommandToken++;

    if (activePowninAbortController) {
        try {
            activePowninAbortController.abort();
        } catch (error) {
            console.warn("Could not abort the online request:", error);
        }

        activePowninAbortController = null;
    }

    isProcessing = false;

    stopPowninVoice();
    stopPowninListening();
}

// ---------------------------------------------------------
// 7. STOP COMMAND DETECTION
// Only stop and exit are used as English stop words.
// ---------------------------------------------------------

function isPowninStopCommand(command) {
    const value = normalizePowninText(command);

    return /^(stop|exit)$/i.test(value)
        || /^(থামো|থাম|বন্ধ করো|আওয়াজ বন্ধ করো|আওয়াজ বন্ধ করো)$/u.test(value)
        || /^(रुको|आवाज़ बंद करो|आवाज बंद करो)$/u.test(value);
}

function handlePowninStopCommand(command) {
    cancelPowninProcessing();

    const language = getReplyLanguage(command);

    const reply = language === "bn-IN"
        ? "ঠিক আছে, থামানো হয়েছে।"
        : language === "hi-IN"
            ? "ठीक है, रोक दिया गया है।"
            : "Stopped.";

    showUserMessage(command);
    showReply(reply, { speak: false });

    setStatus("Stopped.");
}

// ---------------------------------------------------------
// 8. START NATIVE SPEECH RECOGNITION
// ---------------------------------------------------------

function startPowninListening() {
    if (isListening) {
        setStatus("Already listening.");
        return;
    }

    const bridge = getPowninAndroidBridge();

    if (!bridge || typeof bridge.startListening !== "function") {
        setStatus("Android microphone bridge is unavailable.", true);
        setVoiceStatus("MIC UNAVAILABLE");
        return;
    }

    const language = getCurrentLanguage();

    try {
        isListening = true;

        setStatus("Listening...");
        setVoiceStatus("LISTENING");

        bridge.startListening(language);
    } catch (error) {
        isListening = false;

        setStatus(getPowninErrorMessage(error), true);
        setVoiceStatus("MIC ERROR");
    }
}

// ---------------------------------------------------------
// 9. CALLBACK: SPEECH RECOGNITION RESULT
// MainActivity.kt calls this after recognizing speech.
// ---------------------------------------------------------

window.onNativeSpeechResult = function (recognizedText) {
    isListening = false;

    const text = String(recognizedText || "").trim();

    setVoiceStatus("READY");

    if (!text) {
        setStatus("No speech was recognized.", true);
        return;
    }

    if (commandInput) {
        commandInput.value = text;
    }

    updatePowninCharacterCount();

    setStatus("Speech recognized.");

    processCommand(text);
};

// ---------------------------------------------------------
// 10. CALLBACK: SPEECH RECOGNITION ERROR
// ---------------------------------------------------------

window.onNativeSpeechError = function (errorMessage) {
    isListening = false;

    const message = String(
        errorMessage || "Speech recognition failed."
    );

    setStatus(message, true);
    setVoiceStatus("MIC ERROR");
};

// ---------------------------------------------------------
// 11. CLEAR CHAT
// ---------------------------------------------------------

function clearPowninChat() {
    if (chat) {
        chat.replaceChildren();
    }

    clearPowninHistory();

    lastReply = "";
    lastUserCommand = "";

    setStatus("Chat cleared.");

    const language = getCurrentLanguage();
    const greeting = getPowninGreetingReply(language);

    addPowninChatMessage("assistant", greeting);
    addHistory("assistant", greeting);
}

// ---------------------------------------------------------
// 12. UPDATE CHARACTER COUNT
// ---------------------------------------------------------

function updatePowninCharacterCount() {
    if (!commandInput || !characterCount) return;

    const count = commandInput.value.length;

    characterCount.textContent =
        count + "/" + MAX_COMMAND_LENGTH;

    if (count > MAX_COMMAND_LENGTH) {
        characterCount.classList.add("limit-exceeded");
    } else {
        characterCount.classList.remove("limit-exceeded");
    }
}

// ---------------------------------------------------------
// 13. UPDATE MODE FROM UI
// ---------------------------------------------------------

function handlePowninModeChange() {
    if (!modeSelect) return;

    const requestedMode = String(
        modeSelect.value || ""
    ).toLowerCase();

    if (!setPowninMode(requestedMode)) {
        setPowninMode("hybrid");
    }

    setStatus("Mode: " + currentMode.toUpperCase());
}

// ---------------------------------------------------------
// END OF PART 6/8
// Continue with PART 7/8 in the same app.js file.
// =========================================================


/* =========================================================
   POWNIN SMART BRAIN v5.4
   PART 7/8 — MAIN COMMAND ROUTER & MODE HANDLING
   ========================================================= */

// ---------------------------------------------------------
// 1. OFFLINE COMMAND HANDLER
// ---------------------------------------------------------

async function runPowninOfflineCommand(command) {
    // Brain mode commands work in every mode.
    const modeResult = processPowninModeCommand(command);

    if (modeResult.handled) {
        return modeResult;
    }

    // Device and extra commands.
    const deviceResult = processPowninExtraCommand(command);

    if (deviceResult.handled) {
        return deviceResult;
    }

    // Local replies, time/date and medium calculator.
    const offlineResult = getPowninOfflineReply(command);

    if (offlineResult.handled) {
        return offlineResult;
    }

    return {
        handled: false,
        reply: ""
    };
}

// ---------------------------------------------------------
// 2. MAIN COMMAND ROUTER
// ---------------------------------------------------------

async function processCommand(rawCommand) {
    const command = String(rawCommand || "").trim();

    if (!command) {
        setStatus("Please enter a command.");
        return;
    }

    // Stop must work even while an online request is running.
    if (isPowninStopCommand(command)) {
        handlePowninStopCommand(command);
        return;
    }

    if (command.length > MAX_COMMAND_LENGTH) {
        showReply(
            "Your command is too long. Please use fewer than 1000 characters."
        );
        setStatus("Command too long.", true);
        return;
    }

    if (isProcessing) {
        setStatus("Pownin is still processing the previous command.");
        return;
    }

    const commandToken = ++powninCommandToken;

    isProcessing = true;
    lastUserCommand = command;

    if (commandInput) {
        commandInput.value = "";
        updatePowninCharacterCount();
    }

    showUserMessage(command);
    setStatus("Thinking...");

    try {
        // 1. Mode switching.
        const modeResult = processPowninModeCommand(command);

        if (modeResult.handled) {
            if (commandToken !== powninCommandToken) return;

            showReply(modeResult.reply);
            setStatus("Ready.");
            return;
        }

        // 2. App, settings, volume, notes and voice commands.
        const extraResult = processPowninExtraCommand(command);

        if (commandToken !== powninCommandToken) return;

        if (extraResult.handled) {
            showReply(extraResult.reply);
            setStatus("Command handled.");
            return;
        }

        // 3. Local calculator.
        if (isPowninMathIntent(command)) {
            const calculation = calculatePowninMath(command);

            if (commandToken !== powninCommandToken) return;

            if (calculation.success) {
                const language = getReplyLanguage(command);

                const answer = language === "bn-IN"
                    ? "উত্তর হলো " + calculation.result
                    : language === "hi-IN"
                        ? "उत्तर है " + calculation.result
                        : "The answer is " + calculation.result;

                showReply(answer);
                setStatus("Calculation complete.");
                return;
            }

            showReply(
                calculation.message ||
                "Please enter a valid calculation."
            );

            setStatus("Calculation could not be completed.", true);
            return;
        }

        // 4. Offline mode never makes a network request.
        if (currentMode === "offline") {
            const offlineResult = getPowninOfflineReply(command);

            if (commandToken !== powninCommandToken) return;

            if (offlineResult.handled) {
                showReply(offlineResult.reply);
            } else {
                const language = getReplyLanguage(command);

                const message = language === "bn-IN"
                    ? "এই কমান্ডটি Offline Mode-এ এখনও সমর্থিত নয়। Help লিখে উপলব্ধ কমান্ড দেখো।"
                    : language === "hi-IN"
                        ? "यह कमांड अभी Offline Mode में उपलब्ध नहीं है। Help लिखकर उपलब्ध कमांड देखें।"
                        : "This command is not supported offline yet. Type help to see available commands.";

                showReply(message);
            }

            setStatus("Offline Mode ready.");
            return;
        }

        // 5. Online and Hybrid modes use an abortable request.
        if (typeof AbortController !== "undefined") {
            activePowninAbortController = new AbortController();
        } else {
            activePowninAbortController = null;
        }

        const requestController = activePowninAbortController;

        const onlineResult = await askPowninOnlineAI(
            command,
            requestController
                ? requestController.signal
                : undefined
        );

        // Ignore late responses after Stop.
        if (
            commandToken !== powninCommandToken ||
            onlineResult.aborted
        ) {
            return;
        }

        if (onlineResult.success) {
            showReply(onlineResult.reply);
            setStatus("Online AI ready.");
            return;
        }

        // 6. Hybrid mode falls back to offline replies.
        if (currentMode === "hybrid") {
            const fallback = getPowninOfflineReply(command);

            if (commandToken !== powninCommandToken) return;

            if (fallback.handled) {
                showReply(fallback.reply);
                setStatus("Answered using offline brain.");
                return;
            }
        }

        showReply(
            onlineResult.message ||
            "Online AI is not configured."
        );

        setStatus("Online AI unavailable.", true);

    } catch (error) {
        if (commandToken !== powninCommandToken) return;

        console.error("Pownin command error:", error);

        showReply(
            "Sorry, an error occurred: " +
            getPowninErrorMessage(error)
        );

        setStatus("Command failed.", true);

    } finally {
        if (commandToken === powninCommandToken) {
            isProcessing = false;
            activePowninAbortController = null;
        }
    }
}

// ---------------------------------------------------------
// 3. FORM SUBMISSION
// ---------------------------------------------------------

function handlePowninFormSubmit(event) {
    if (
        event &&
        typeof event.preventDefault === "function"
    ) {
        event.preventDefault();
    }

    if (!commandInput) return;

    const command = commandInput.value.trim();

    if (command) {
        processCommand(command);
    }
}

// ---------------------------------------------------------
// 4. SETTINGS PANEL
// ---------------------------------------------------------

function togglePowninSettings(show) {
    if (!settingsPanel) return;

    const shouldShow = typeof show === "boolean"
        ? show
        : settingsPanel.hidden;

    settingsPanel.hidden = !shouldShow;

    settingsPanel.setAttribute(
        "aria-hidden",
        String(!shouldShow)
    );

    if (settingsBtn) {
        settingsBtn.setAttribute(
            "aria-expanded",
            String(shouldShow)
        );
    }
}

// ---------------------------------------------------------
// 5. INITIALIZE UI EVENTS
// ---------------------------------------------------------

function initializePowninApp() {
    if (commandForm) {
        commandForm.addEventListener(
            "submit",
            handlePowninFormSubmit
        );
    }

    if (sendBtn && !commandForm) {
        sendBtn.addEventListener("click", function () {
            handlePowninFormSubmit();
        });
    }

    if (micBtn) {
        micBtn.addEventListener(
            "click",
            startPowninListening
        );
    }

    if (speakBtn) {
        speakBtn.addEventListener("click", function () {
            if (lastReply) {
                speak(lastReply);
            } else {
                speak(
                    getPowninGreetingReply(getCurrentLanguage())
                );
            }
        });
    }

    if (stopSpeakBtn) {
        stopSpeakBtn.addEventListener("click", function () {
            cancelPowninProcessing();
            setStatus("Stopped.");
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener(
            "click",
            clearPowninChat
        );
    }

    if (commandInput) {
        commandInput.addEventListener(
            "input",
            updatePowninCharacterCount
        );
    }

    if (modeSelect) {
        modeSelect.value = currentMode;

        modeSelect.addEventListener(
            "change",
            handlePowninModeChange
        );
    }

    if (languageSelect) {
        languageSelect.value = selectedLanguage;

        languageSelect.addEventListener("change", function () {
            selectedLanguage = normalizePowninLanguage(
                languageSelect.value
            );

            callPowninAndroid(
                "setTtsLanguage",
                selectedLanguage
            );

            setVoiceStatus(
                "LANGUAGE: " + selectedLanguage
            );
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener("click", function () {
            togglePowninSettings();
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener("click", function () {
            togglePowninSettings(false);
        });
    }

    if (clearKeyBtn && apiKeyInput) {
        clearKeyBtn.addEventListener("click", function () {
            apiKeyInput.value = "";
            setStatus("API key field cleared.");
        });
    }

    if (endpointInput) {
        endpointInput.addEventListener("change", function () {
            setNetworkStatus("SETTINGS UPDATED");
        });
    }

    if (modelInput) {
        modelInput.addEventListener("change", function () {
            setNetworkStatus("SETTINGS UPDATED");
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener("change", function () {
            setNetworkStatus("SETTINGS UPDATED");
        });
    }

    updatePowninCharacterCount();
    updatePowninModeLabel();

    if (clockElement) {
        clockElement.textContent =
            new Date().toLocaleTimeString();
    }

    setNetworkStatus(
        currentMode === "offline"
            ? "OFFLINE"
            : currentMode === "online"
                ? "ONLINE AI"
                : "HYBRID"
    );

    setVoiceStatus("READY");
    setStatus("Pownin is ready.");

    console.log(
        "Pownin Smart Brain " +
        POWNIN_VERSION +
        " initialized."
    );
}

// ---------------------------------------------------------
// END OF PART 7/8
// Continue with PART 8/8 in the same app.js file.
// =========================================================


/* =========================================================
   POWNIN SMART BRAIN v5.4
   PART 8/8 — FINAL INITIALIZATION & ERROR HANDLING
   ========================================================= */

// ---------------------------------------------------------
// 1. QUICK COMMAND BUTTONS
// ---------------------------------------------------------

function initializePowninQuickCommands() {
    const buttons = document.querySelectorAll("[data-command]");

    buttons.forEach(function (button) {
        if (button.dataset.powninBound === "true") {
            return;
        }

        button.dataset.powninBound = "true";

        button.addEventListener("click", function () {
            const command = button.getAttribute("data-command");

            if (command) {
                processCommand(command);
            }
        });
    });
}

// ---------------------------------------------------------
// 2. RESTORE SAVED BRAIN MODE
// ---------------------------------------------------------

function restorePowninPreferences() {
    try {
        const savedMode = localStorage.getItem(
            "pownin_brain_mode_v1"
        );

        if (savedMode) {
            setPowninMode(savedMode);
        }
    } catch (error) {
        console.warn("Could not restore Pownin preferences.");
    }
}

// ---------------------------------------------------------
// 3. SAVE BRAIN MODE CHANGES
// ---------------------------------------------------------

function persistPowninMode(mode) {
    try {
        localStorage.setItem(
            "pownin_brain_mode_v1",
            mode
        );
    } catch (error) {
        console.warn("Could not save Pownin mode.");
    }
}

// ---------------------------------------------------------
// 4. REPORT JAVASCRIPT ERRORS
// ---------------------------------------------------------

window.addEventListener("error", function (event) {
    console.error(
        "Pownin JavaScript error:",
        event.message || "Unknown error",
        event.filename || "",
        event.lineno || 0
    );
});

window.addEventListener("unhandledrejection", function (event) {
    console.error(
        "Pownin async error:",
        event.reason
    );
});

// ---------------------------------------------------------
// 5. FINAL INITIALIZATION
// ---------------------------------------------------------

function initializePowninAppFinal() {
    restorePowninPreferences();

    initializePowninApp();
    initializePowninQuickCommands();

    // Update the clock once per minute.
    function updateClock() {
        if (clockElement) {
            clockElement.textContent =
                new Date().toLocaleTimeString(
                    getCurrentLanguage()
                );
        }
    }

    updateClock();
    window.setInterval(updateClock, 60000);

    console.log(
        "Pownin Smart Brain " +
        POWNIN_VERSION +
        " ready. Math engine:",
        Boolean(window.PowninMath)
    );
}

// ---------------------------------------------------------
// 6. PERSIST MODE WHENEVER IT CHANGES
// ---------------------------------------------------------

const originalSetPowninMode = setPowninMode;

setPowninMode = function (mode) {
    const changed = originalSetPowninMode(mode);

    if (changed) {
        persistPowninMode(currentMode);
    }

    return changed;
};

// ---------------------------------------------------------
// 7. START AFTER HTML ELEMENTS ARE AVAILABLE
// ---------------------------------------------------------

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializePowninAppFinal,
        { once: true }
    );
} else {
    initializePowninAppFinal();
}

// ---------------------------------------------------------
// END OF POWNIN SMART BRAIN v5.4 — PART 8/8
// =========================================================
