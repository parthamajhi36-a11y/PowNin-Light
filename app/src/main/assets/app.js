// ============================================================
// POWNIN SMART BRAIN v5.3 — MERGED APP
// PART 1/8 — CORE CONFIGURATION, LANGUAGE, HISTORY & UI
// ============================================================

"use strict";

// ------------------------------------------------------------
// 1. CORE CONFIGURATION
// ------------------------------------------------------------

const POWNIN_VERSION = "5.3";
const MAX_HISTORY_MESSAGES = 10;
const MAX_COMMAND_LENGTH = 1000;
const MAX_NOTE_LENGTH = 500;

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

// Notes use Android WebView DOM storage.
const POWNIN_NOTES_KEY = "pownin_extra_notes_v1";

// ------------------------------------------------------------
// 2. UI ELEMENT REFERENCES
// Match these names to index.html.
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
// 4. LANGUAGE DETECTION
// Bengali, Hindi, English and Banglish support.
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
        /\b(amar|amake|ami|amra|amader|tumi|tomar|tomake|apni|apnar|naam|nam|name|kemon|acho|achho|bhalo|valo|bolo|bolun|koro|korbe|ki|kothay|kothay|keno|kokhon|bangla|banglay|shomoy|somoy|tarikh|dhonnobad|pownin|kholo|khol|kholbe|help koro|ki koro|ke tumi)\b/i;

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

// ------------------------------------------------------------
// 5. CHAT HISTORY
// ------------------------------------------------------------

function addHistory(role, content) {
    const message = {
        role: role === "user" ? "user" : "assistant",
        content: String(content || "").slice(0, MAX_COMMAND_LENGTH)
    };

    history.push(message);

    if (history.length > MAX_HISTORY_MESSAGES) {
        history = history.slice(-MAX_HISTORY_MESSAGES);
    }
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
}

// ------------------------------------------------------------
// 6. STATUS AND MODE UI
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
    const allowedModes = ["offline", "online", "hybrid"];
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
// 7. ERROR MESSAGE HELPER
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
// POWNIN SMART BRAIN v5.3
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
// POWNIN ANSWER STYLE
// Language-aware AI response settings.
// ------------------------------------------------------------

function getPowninAnswerStyle(language) {
    const lang = normalizePowninLanguage(language);

    let languageName;
    let replyInstruction;

    if (lang === "bn-IN") {
        languageName = "Bengali";

        replyInstruction =
            "Always reply in natural Bengali using Bengali script. " +
            "If the user writes in Banglish or Romanized Bangla, " +
            "understand it as Bengali and reply in Bengali script.";
    } else if (lang === "hi-IN") {
        languageName = "Hindi";

        replyInstruction =
            "Always reply in natural Hindi using Devanagari script.";
    } else {
        languageName = "English";

        replyInstruction =
            "Always reply in clear, natural English.";
    }

    return {
        language: lang,
        languageName: languageName,
        replyInstruction: replyInstruction,
        length: "medium",
        personality: "friendly",
        mode: currentMode
    };
}

// ------------------------------------------------------------
// 3. SAFE NOTES STORAGE
// Replaces the notes helper from pownin_extra_commands.js.
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
// Uses the Android device's current local date and time.
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

// ------------------------------------------------------------
// END OF PART 2/8
// Continue with PART 3/8 in the same app.js file.
// ============================================================


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
        || /হিসাব কর|গণনা কর|যোগ কর|বিয়োগ কর|বিয়োগ কর|গুণ কর|ভাগ কর|কত/u.test(value)
        || /गणना करो|कितना होगा|जोड़ो|जोडो|घटाओ|गुणा करो|भाग करो/u.test(value);
}

// ------------------------------------------------------------
// 3. EXTRACT A BASIC ARITHMETIC EXPRESSION
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

    // Remove a leading "solve" only when followed by an expression.
    value = value.replace(/^solve\s+/i, "");

    // This medium calculator accepts arithmetic and parentheses only.
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
// Does not use eval() or Function().
// Supports +, -, *, /, %, parentheses and decimals.
// ------------------------------------------------------------

function calculatePowninBasicExpression(expression) {
    const source = String(expression || "").replace(/\s+/g, "");

    if (!source || source.length > 120) {
        throw new Error("Please enter a valid calculation.");
    }

    if (!/^[0-9+\-*/%().]+$/.test(source)) {
        throw new Error("Please enter a valid arithmetic expression.");
    }

    let index = 0;

    function parseNumber() {
        const start = index;
        let dots = 0;

        while (index < source.length) {
            const character = source[index];

            if (character === ".") {
                dots++;

                if (dots > 1) {
                    throw new Error("Invalid number.");
                }

                index++;
            } else if (/[0-9]/.test(character)) {
                index++;
            } else {
                break;
            }
        }

        if (start === index || source.slice(start, index) === ".") {
            throw new Error("Invalid number.");
        }

        const number = Number(source.slice(start, index));

        if (!Number.isFinite(number)) {
            throw new Error("Invalid number.");
        }

        return number;
    }

    function parsePrimary() {
        if (source[index] === "(") {
            index++;

            const value = parseExpression();

            if (source[index] !== ")") {
                throw new Error("Missing closing parenthesis.");
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

            if (operator !== "*" && operator !== "/" && operator !== "%") {
                break;
            }

            index++;

            const right = parseUnary();

            if ((operator === "/" || operator === "%") && right === 0) {
                throw new Error("Division by zero is not allowed.");
            }

            if (operator === "*") {
                value *= right;
            } else if (operator === "/") {
                value /= right;
            } else {
                value %= right;
            }
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

            if (operator === "+") {
                value += right;
            } else {
                value -= right;
            }
        }

        return value;
    }

    const result = parseExpression();

    if (index !== source.length || !Number.isFinite(result)) {
        throw new Error("Please enter a valid calculation.");
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
            message: "Please enter a calculation."
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
                message: "Please enter a valid calculation."
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
            message: error.message || "Please enter a valid calculation."
        };
    }
}

// ------------------------------------------------------------
// 6. OFFLINE COMMAND HANDLER
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

    if (/\b(who are you|your name|what are you)\b/i.test(value)
        || /তুমি কে|তোমার নাম কী|তোমার নাম কি|আপনি কে/u.test(value)
        || /तुम कौन हो|आप कौन हैं|तुम्हारा नाम क्या है/u.test(value)) {
        return {
            handled: true,
            reply: getPowninIdentityReply(language)
        };
    }

    if (/^(help|commands|what can you do)\??$/i.test(value)
        || /সাহায্য|কী কী করতে পার|কি কি করতে পার|কমান্ড দেখাও/u.test(value)
        || /मदद|क्या कर सकते हो|कमांड बताओ/u.test(value)) {
        return {
            handled: true,
            reply: getPowninHelpReply(language)
        };
    }

    if (/^(thanks|thank you|thank you so much)$/i.test(value)
        || /ধন্যবাদ|অনেক ধন্যবাদ/u.test(value)
        || /धन्यवाद|शुक्रिया/u.test(value)) {
        return {
            handled: true,
            reply: getPowninThanksReply(language)
        };
    }

    if (/\b(time|current time|what time is it)\b/i.test(value)
        || /সময় কত|সময় কত|এখন কয়টা|এখন কটা/u.test(value)
        || /समय क्या है|कितने बजे हैं/u.test(value)) {
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

    if (/\b(date|today's date|what is the date)\b/i.test(value)
        || /আজ কত তারিখ|আজকের তারিখ/u.test(value)
        || /आज की तारीख|आज तारीख क्या है/u.test(value)) {
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

        let reply;

        if (calculation.success) {
            reply = language === "bn-IN"
                ? "উত্তর হলো " + calculation.result
                : language === "hi-IN"
                    ? "उत्तर है " + calculation.result
                    : "The answer is " + calculation.result;
        } else {
            reply = calculation.message;
        }

        return {
            handled: true,
            reply: reply
        };
    }

    return {
        handled: false,
        reply: ""
    };
}

// ------------------------------------------------------------
// END OF PART 3/8


// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 4/8 — SMART APP CONTROL & NOTES COMMANDS
// ============================================================

// ------------------------------------------------------------
// 1. SUPPORTED APP NAMES AND ALIASES
// ------------------------------------------------------------

const POWNIN_APP_MAP = {
    whatsapp: [
        "whatsapp", "whats app", "হোয়াটসঅ্যাপ", "व्हाट्सएप"
    ],
    youtube: [
        "youtube", "you tube", "ইউটিউব", "यूट्यूब"
    ],
    chrome: [
        "chrome", "google chrome", "ক্রোম", "क्रोम"
    ],
    calculator: [
        "calculator", "calc", "ক্যালকুলেটর", "कैलकुलेटर"
    ],
    camera: [
        "camera", "ক্যামেরা", "कैमरा"
    ],
    settings: [
        "settings", "setting", "সেটিংস", "सेटिंग्स"
    ],
    maps: [
        "maps", "google maps", "গুগল ম্যাপ", "मैप्स"
    ],
    gallery: [
        "gallery", "ফটো গ্যালারি", "गैलरी"
    ],
    photos: [
        "photos", "google photos", "গুগল ফটোস", "गूगल फोटोज"
    ],
    phone: [
        "phone", "dialer", "ফোন", "फोन"
    ],
    messages: [
        "messages", "messaging", "মেসেজ", "मैसेज"
    ],
    contacts: [
        "contacts", "contact", "কন্টাক্ট", "कॉन्टैक्ट"
    ]
};

// ------------------------------------------------------------
// 2. DETECT APP NAME FROM USER COMMAND
// ------------------------------------------------------------

function detectPowninAppName(command) {
    const text = normalizePowninText(command);

    for (const appName of Object.keys(POWNIN_APP_MAP)) {
        const aliases = POWNIN_APP_MAP[appName];

        for (const alias of aliases) {
            const escaped = alias.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            const pattern = new RegExp(
                "(^|\\s)" + escaped + "($|\\s|[.!?,])",
                "i"
            );

            if (pattern.test(text)) {
                return appName;
            }
        }
    }

    return null;
}

// ------------------------------------------------------------
// 3. DETECT OPEN-APP COMMAND
// ------------------------------------------------------------

function isPowninOpenAppCommand(command) {
    const text = normalizePowninText(command);

    const hasOpenIntent =
        /\b(open|launch|start|run)\b/i.test(text) ||
        /খোলো|খুলে দাও|চালু করো|চালাও/u.test(text) ||
        /खोलो|खोल दो|चालू करो/u.test(text);

    return hasOpenIntent && Boolean(detectPowninAppName(text));
}

// ------------------------------------------------------------
// 4. ANDROID BRIDGE ACCESS
// ------------------------------------------------------------

function getPowninAndroidBridge() {
    try {
        if (
            typeof window !== "undefined" &&
            window.PowninAndroid &&
            typeof window.PowninAndroid === "object"
        ) {
            return window.PowninAndroid;
        }
    } catch (error) {
        console.warn("Pownin Android bridge unavailable:", error);
    }

    return null;
}

// ------------------------------------------------------------
// 5. SAFE ANDROID BRIDGE CALL
// ------------------------------------------------------------

function callPowninAndroid(methodName, args) {
    const bridge = getPowninAndroidBridge();

    if (!bridge) {
        return {
            success: false,
            status: "UNAVAILABLE"
        };
    }

    if (typeof bridge[methodName] !== "function") {
        return {
            success: false,
            status: "METHOD_NOT_FOUND"
        };
    }

    try {
        const result = bridge[methodName].apply(
            bridge,
            Array.isArray(args) ? args : []
        );

        if (result === false || result === null) {
            return {
                success: false,
                status: "FAILED"
            };
        }

        if (typeof result === "string") {
            const status = result.trim().toUpperCase();

            if (
                status === "ERROR" ||
                status === "FAILED" ||
                status === "NOT_FOUND" ||
                status === "APP_NOT_FOUND" ||
                status === "INVALID_APP" ||
                status === "UNAVAILABLE"
            ) {
                return {
                    success: false,
                    status: status
                };
            }
        }

        return {
            success: true,
            status: result === undefined
                ? "REQUEST_SENT"
                : String(result)
        };
    } catch (error) {
        console.error("Pownin bridge call failed:", error);

        return {
            success: false,
            status: "ERROR"
        };
    }
}

// ------------------------------------------------------------
// 6. LANGUAGE-AWARE APP STATUS MESSAGE
// ------------------------------------------------------------

function getPowninDeviceMessage(status, language, appName) {
    const lang = normalizePowninLanguage(language);
    const app = String(appName || "App");

    if (status === "opened") {
        if (lang === "bn-IN") {
            return app + " খোলার command পাঠানো হয়েছে।";
        }

        if (lang === "hi-IN") {
            return app + " खोलने का command भेज दिया गया है।";
        }

        return "Opening command sent for " + app + ".";
    }

    if (lang === "bn-IN") {
        return app + " খোলা যায়নি। Appটি install করা আছে কি না পরীক্ষা করো।";
    }

    if (lang === "hi-IN") {
        return app + " नहीं खुला। जाँचें कि App install है या नहीं।";
    }

    return "I couldn't open " + app + ". Please check whether it is installed.";
}

// ------------------------------------------------------------
// 7. PROCESS APP-OPEN COMMAND
// ------------------------------------------------------------

function processPowninOpenAppCommand(command, language) {
    const appName = detectPowninAppName(command);
    const lang = normalizePowninLanguage(language);

    if (!appName || !isPowninOpenAppCommand(command)) {
        return null;
    }

    const result = callPowninAndroid(
        "openApp",
        [appName]
    );

    if (!result.success) {
        return getPowninDeviceMessage(
            "failed",
            lang,
            appName
        );
    }

    return getPowninDeviceMessage(
        "opened",
        lang,
        appName
    );
}

// ------------------------------------------------------------
// 8. NOTES COMMAND DETECTION
// ------------------------------------------------------------

function detectPowninNoteAction(command) {
    const text = normalizePowninText(command);

    if (
        /\b(show|read|list|view)\s+(my\s+)?notes?\b/i.test(text) ||
        /নোট দেখাও|নোট পড়ে শোনাও|নোট পড়ো/u.test(text) ||
        /नोट दिखाओ|मेरे नोट पढ़ो/u.test(text)
    ) {
        return "show";
    }

    if (
        /\b(clear|delete|remove)\s+(all\s+)?(my\s+)?notes?\b/i.test(text) ||
        /সব নোট মুছে দাও|নোট মুছে দাও/u.test(text) ||
        /सभी नोट मिटाओ|नोट हटाओ/u.test(text)
    ) {
        return "clear";
    }

    if (
        /\b(save|remember|add)\s+(a\s+)?note\b/i.test(text) ||
        /নোট সেভ করো|নোট লিখে রাখো|মনে রেখো/u.test(text) ||
        /नोट सेव करो|याद रखो/u.test(text)
    ) {
        return "save";
    }

    return null;
}

// ------------------------------------------------------------
// 9. EXTRACT NOTE TEXT
// ------------------------------------------------------------

function extractPowninNoteText(command) {
    let text = String(command || "").trim();

    text = text
        .replace(/^(please\s+)?(save|remember|add)\s+(a\s+)?note\s*/i, "")
        .replace(/^(নোট সেভ করো|নোট লিখে রাখো|মনে রেখো)\s*/u, "")
        .replace(/^(नोट सेव करो|याद रखो)\s*/u, "")
        .replace(/[.!?।]+$/g, "")
        .trim();

    return text.slice(0, MAX_NOTE_LENGTH);
}

// ------------------------------------------------------------
// 10. PROCESS NOTES COMMAND
// ------------------------------------------------------------

function processPowninNoteCommand(command, language) {
    const action = detectPowninNoteAction(command);
    const lang = normalizePowninLanguage(language);

    if (!action) {
        return null;
    }

    if (action === "show") {
        return formatPowninNotes(lang);
    }

    if (action === "clear") {
        return clearPowninNotes(lang);
    }

    const note = extractPowninNoteText(command);

    if (!note) {
        if (lang === "bn-IN") {
            return "কোন নোটটি save করতে হবে, সেটি বলো।";
        }

        if (lang === "hi-IN") {
            return "कौन सा note save करना है, बताइए।";
        }

        return "Please tell me what note to save.";
    }

    const result = addPowninNote(note);

    if (!result.success) {
        return result.message;
    }

    if (lang === "bn-IN") {
        return "নোটটি এই ডিভাইসে save করা হয়েছে।";
    }

    if (lang === "hi-IN") {
        return "Note इस device में save कर लिया गया है।";
    }

    return "The note has been saved on this device.";
}

// ------------------------------------------------------------
// END OF PART 4/8
// ============================================================


// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 5/8 — SMART COMMAND ROUTER
// ============================================================

// ------------------------------------------------------------
// 1. MAIN LOCAL COMMAND ROUTER
// ------------------------------------------------------------

function routePowninLocalCommand(rawCommand) {
    const command = String(rawCommand || "").trim();

    if (!command) {
        return {
            handled: true,
            route: "empty",
            reply: "Please enter a command."
        };
    }

    if (command.length > MAX_COMMAND_LENGTH) {
        return {
            handled: true,
            route: "limit",
            reply: "Your command is too long. Please use a shorter command."
        };
    }

    const language = getReplyLanguage(command);

    // --------------------------------------------------------
    // 2. NOTES COMMANDS
    // --------------------------------------------------------

    const noteAction = detectPowninNoteAction(command);

    if (noteAction) {
        return {
            handled: true,
            route: "notes",
            reply: processPowninNoteCommand(command, language)
        };
    }

    // --------------------------------------------------------
    // 3. APP OPEN COMMANDS
    // --------------------------------------------------------

    if (isPowninOpenAppCommand(command)) {
        return {
            handled: true,
            route: "app",
            reply: processPowninOpenAppCommand(command, language)
        };
    }

    // --------------------------------------------------------
    // 4. EXISTING OFFLINE COMMANDS
    // Greeting, identity, help, time, date and calculator.
    // --------------------------------------------------------

    const offlineResult = getPowninOfflineReply(command);

    if (offlineResult && offlineResult.handled) {
        return {
            handled: true,
            route: "offline",
            reply: offlineResult.reply
        };
    }

    // --------------------------------------------------------
    // 5. NOT HANDLED LOCALLY
    // Part 6 will connect this route to the Online AI handler.
    // --------------------------------------------------------

    return {
        handled: false,
        route: "online",
        reply: "",
        command: command,
        language: language
    };
}

// ------------------------------------------------------------
// 6. SAFE ROUTER WRAPPER
// ------------------------------------------------------------

function runPowninLocalCommand(rawCommand) {
    try {
        return routePowninLocalCommand(rawCommand);
    } catch (error) {
        console.error("Pownin local command error:", error);

        return {
            handled: true,
            route: "error",
            reply: getPowninErrorMessage(error)
        };
    }
}

// ------------------------------------------------------------
// END OF PART 5/8
// ============================================================


// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 6/8 — ONLINE AI REQUEST HANDLER
// ============================================================

// ------------------------------------------------------------
// 1. READ ONLINE AI CONFIGURATION
// Uses the existing settings fields in index.html.
// ------------------------------------------------------------

function getPowninOnlineConfig() {
    const endpoint = endpointInput
        ? String(endpointInput.value || "").trim()
        : "";

    const model = modelInput
        ? String(modelInput.value || "").trim()
        : "";

    const apiKey = apiKeyInput
        ? String(apiKeyInput.value || "").trim()
        : "";

    return {
        endpoint: endpoint,
        model: model,
        apiKey: apiKey
    };
}

// ------------------------------------------------------------
// 2. LANGUAGE-AWARE ONLINE ERROR MESSAGES
// ------------------------------------------------------------

function getPowninOnlineMessage(type, language) {
    const lang = normalizePowninLanguage(language);

    if (type === "not_configured") {
        if (lang === "bn-IN") {
            return "Online AI এখনো configure করা হয়নি। Settings-এ endpoint এবং model সেট করো।";
        }

        if (lang === "hi-IN") {
            return "Online AI अभी configure नहीं है। Settings में endpoint और model सेट करें।";
        }

        return "Online AI is not configured yet. Set the endpoint and model in Settings.";
    }

    if (type === "network") {
        if (lang === "bn-IN") {
            return "Online AI-এর সঙ্গে connection করা যায়নি। Internet connection পরীক্ষা করো।";
        }

        if (lang === "hi-IN") {
            return "Online AI से connection नहीं हो पाया। Internet connection जाँचें।";
        }

        return "I couldn't connect to Online AI. Please check your internet connection.";
    }

    if (type === "busy") {
        if (lang === "bn-IN") {
            return "আগের request এখনো চলছে। একটু অপেক্ষা করো।";
        }

        if (lang === "hi-IN") {
            return "पिछली request अभी चल रही है। कृपया प्रतीक्षा करें।";
        }

        return "The previous request is still running. Please wait.";
    }

    if (lang === "bn-IN") {
        return "Online AI থেকে উত্তর পাওয়া যায়নি। পরে আবার চেষ্টা করো।";
    }

    if (lang === "hi-IN") {
        return "Online AI से उत्तर नहीं मिला। बाद में फिर कोशिश करें।";
    }

    return "I couldn't get a response from Online AI. Please try again.";
}

// ------------------------------------------------------------
// 3. EXTRACT TEXT FROM AI RESPONSE
// ------------------------------------------------------------

function extractPowninAIResponse(data) {
    if (!data || typeof data !== "object") {
        return "";
    }

    const content =
        data.choices &&
        data.choices[0] &&
        data.choices[0].message
            ? data.choices[0].message.content
            : "";

    if (typeof content === "string") {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content.map(function (item) {
            return item && typeof item.text === "string"
                ? item.text
                : "";
        }).join("").trim();
    }

    return "";
}

// ------------------------------------------------------------
// 4. SEND REQUEST TO OPENAI-COMPATIBLE CHAT API
// The endpoint must be a complete chat-completions URL.
// Example format: https://example.com/v1/chat/completions
// ------------------------------------------------------------

async function requestPowninOnlineAI(command, language) {
    const userCommand = String(command || "").trim();
    const lang = normalizePowninLanguage(language);

    if (!userCommand) {
        return {
            success: false,
            message: "Please enter a command."
        };
    }

    if (activePowninAbortController) {
        return {
            success: false,
            message: getPowninOnlineMessage("busy", lang)
        };
    }

    const config = getPowninOnlineConfig();

    if (!config.endpoint || !config.model) {
        return {
            success: false,
            message: getPowninOnlineMessage("not_configured", lang)
        };
    }

    if (!/^https?:\/\/\S+$/i.test(config.endpoint)) {
        return {
            success: false,
            message: "Please enter a valid HTTP or HTTPS API endpoint."
        };
    }

    const controller = new AbortController();
    activePowninAbortController = controller;

    try {
        setNetworkStatus("CONNECTING");

        const answerStyle = getPowninAnswerStyle(lang);

        const systemPrompt = [
            "You are Pownin, an Android AI voice assistant.",
            "Reply in the user's language.",
            "Supported languages: Bengali, Hindi, English and Banglish.",
            "Use a friendly, clear and medium-length answer.",
            "Do not claim to have performed a device action unless the app confirms it.",
            "Do not claim access to device files, calls, messages or apps unless a tool confirms it.",
            "Keep answers suitable for a general audience.",
            "Reply language: " + answerStyle.language,
            "Answer length: " + answerStyle.length
        ].join(" ");

        const messages = [
            {
                role: "system",
                content: systemPrompt
            }
        ];

        const previousHistory = getPowninHistory();

        previousHistory.forEach(function (item) {
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
        });

        const headers = {
            "Content-Type": "application/json"
        };

        if (config.apiKey) {
            headers.Authorization = "Bearer " + config.apiKey;
        }

        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: config.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error("API_HTTP_" + response.status);
        }

        const data = await response.json();
        const answer = extractPowninAIResponse(data);

        if (!answer) {
            throw new Error("EMPTY_AI_RESPONSE");
        }

        setNetworkStatus("ONLINE");

        return {
            success: true,
            message: answer
        };

    } catch (error) {
        console.error("Pownin Online AI error:", error);

        if (error && error.name === "AbortError") {
            return {
                success: false,
                cancelled: true,
                message: "Request cancelled."
            };
        }

        const isNetworkError =
            error instanceof TypeError ||
            (error && error.message === "Failed to fetch");

        setNetworkStatus("OFFLINE");

        return {
            success: false,
            message: isNetworkError
                ? getPowninOnlineMessage("network", lang)
                : getPowninOnlineMessage("failed", lang)
        };

    } finally {
        if (activePowninAbortController === controller) {
            activePowninAbortController = null;
        }
    }
}

// ------------------------------------------------------------
// 5. CANCEL ACTIVE ONLINE REQUEST
// ------------------------------------------------------------

function cancelPowninOnlineRequest() {
    if (!activePowninAbortController) {
        return false;
    }

    try {
        activePowninAbortController.abort();
        activePowninAbortController = null;
        setNetworkStatus("READY");
        return true;
    } catch (error) {
        console.warn("Could not cancel Pownin request:", error);
        return false;
    }
}

// ------------------------------------------------------------
// END OF PART 6/8
// ============================================================


// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 7/8 — SMART COMMAND PROCESSING
// ============================================================

// ------------------------------------------------------------
// 1. DISPLAY A CHAT MESSAGE SAFELY
// ------------------------------------------------------------

function displayPowninMessage(role, message) {
    if (!chat) {
        console.warn("Pownin chat element was not found.");
        return;
    }

    const item = document.createElement("div");
    item.className = role === "user"
        ? "message user-message"
        : "message assistant-message";

    item.textContent = String(message || "");
    item.setAttribute("role", "article");

    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
}

/* =========================================================
   POWNIN SMART BRAIN v5.3
   PART 7/8 — COMMAND PROCESSING
   ========================================================= */

// ------------------------------------------------------------
// 3. SHOW AND SPEAK THE FINAL REPLY
// ------------------------------------------------------------

function deliverPowninReply(message, options) {
    const text = String(message || "").trim();

    if (!text) {
        return;
    }

    const settings = options || {};

    lastReply = text;

    displayPowninMessage("assistant", text);

    if (settings.saveHistory !== false) {
        addHistory("assistant", text);
    }

    if (settings.speak !== false) {
        speakPowninReply(text);
    }

    setStatus("Ready", false);
}

// ------------------------------------------------------------
// 4. PROCESS ONE USER COMMAND
// ------------------------------------------------------------

async function processPowninCommand(rawCommand) {
    const command = String(rawCommand || "").trim();

    if (!command) {
        setStatus("Please enter a command.", true);
        return;
    }

    if (command.length > MAX_COMMAND_LENGTH) {
        deliverPowninReply(
            "Your command is too long. Please use a shorter command.",
            { speak: false }
        );
        return;
    }

    if (isProcessing) {
        setStatus("Please wait. Pownin is processing the previous command.", true);
        return;
    }

    isProcessing = true;

    const commandToken = ++powninCommandToken;
    const language = getReplyLanguage(command);

    lastUserCommand = command;

    displayPowninMessage("user", command);
    addHistory("user", command);

    setStatus("Thinking...", false);

    try {
        // Local commands are checked first in every mode.
        const localResult = runPowninLocalCommand(command);

        if (localResult && localResult.handled) {
            deliverPowninReply(localResult.reply);
            return;
        }

        // Offline mode never sends unknown commands to the internet.
        if (currentMode === "offline") {
            const offlineMessage =
                language === "bn-IN"
                    ? "এই command-টি এখনো আমার Offline command list-এ নেই।"
                    : language === "hi-IN"
                        ? "यह command अभी मेरी Offline command list में उपलब्ध नहीं है।"
                        : "I don't have an offline command for that yet.";

            deliverPowninReply(offlineMessage);
            return;
        }

        // Online and Hybrid modes use the configured AI endpoint.
        const onlineResult = await requestPowninOnlineAI(
            command,
            language
        );

        // Ignore an outdated result if another command has replaced it.
        if (commandToken !== powninCommandToken) {
            return;
        }

        if (onlineResult && onlineResult.cancelled) {
            setStatus("Request cancelled.", false);
            return;
        }

        if (onlineResult && onlineResult.success) {
            deliverPowninReply(onlineResult.message);
            return;
        }

        deliverPowninReply(
            onlineResult && onlineResult.message
                ? onlineResult.message
                : getPowninOnlineMessage("failed", language)
        );

    } catch (error) {
        console.error("Pownin command processing error:", error);

        if (commandToken === powninCommandToken) {
            deliverPowninReply(getPowninErrorMessage(error));
        }

    } finally {
        if (commandToken === powninCommandToken) {
            isProcessing = false;
        }
    }
}

// ------------------------------------------------------------
// 5. CANCEL CURRENT COMMAND
// ------------------------------------------------------------

function stopPowninProcessing() {
    powninCommandToken++;

    cancelPowninOnlineRequest();

    isProcessing = false;

    setStatus("Ready", false);
}

// ------------------------------------------------------------
// END OF PART 7/8
// ============================================================


// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 8/8 — FINAL UI INTEGRATION & EVENT HANDLERS
// ============================================================

// ------------------------------------------------------------
// 1. UI HELPERS
// ------------------------------------------------------------

function updatePowninCharacterCount() {
    if (!commandInput || !characterCount) return;

    characterCount.textContent = String(
        commandInput.value.length
    );
}

function updatePowninModeButtons() {
    const buttons = [
        getElement("offlineModeBtn"),
        getElement("onlineModeBtn"),
        getElement("hybridModeBtn")
    ];

    buttons.forEach(function (button) {
        if (!button) return;

        const active =
            button.getAttribute("data-mode") === currentMode;

        button.classList.toggle("active", active);
        button.setAttribute(
            "aria-pressed",
            active ? "true" : "false"
        );
    });

    updatePowninModeLabel();
}

function updatePowninClock() {
    if (!clockElement) return;

    clockElement.textContent =
        new Date().toLocaleTimeString(
            getCurrentLanguage(),
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}


// ------------------------------------------------------------
// 2. ANDROID BRIDGE HELPERS
// ------------------------------------------------------------

function stopPowninNativeVoice() {
    callPowninAndroid("stopSpeaking", []);
    callPowninAndroid("stopListening", []);

    isListening = false;

    setVoiceStatus("READY");
}

function startPowninNativeListening() {
    const language = getCurrentLanguage();

    const result = callPowninAndroid(
        "startListening",
        [language]
    );

    if (!result || !result.success) {
        setStatus(
            "Could not start voice recognition.",
            true
        );

        setVoiceStatus("UNAVAILABLE");
        return false;
    }

    isListening = true;

    setVoiceStatus("LISTENING");
    setStatus("Listening...");

    return true;
}


// ------------------------------------------------------------
// 3. NATIVE ANDROID SPEECH CALLBACKS
// MainActivity can call these JavaScript functions.
// ------------------------------------------------------------

window.onNativeSpeechResult = function (recognizedText) {
    const text = String(recognizedText || "").trim();

    isListening = false;
    setVoiceStatus("READY");

    if (!text) {
        setStatus("No speech detected.", true);
        return;
    }

    if (commandInput) {
        commandInput.value = text;
        updatePowninCharacterCount();
    }

    processPowninCommand(text);
};

window.onNativeSpeechError = function (errorMessage) {
    isListening = false;

    setVoiceStatus("READY");

    setStatus(
        String(errorMessage || "Speech recognition error."),
        true
    );
};


// ------------------------------------------------------------
// 4. FIX REPLY SPEAKING
// Android speak() requires text AND language.
// ------------------------------------------------------------

function speakPowninReply(message) {
    const text = String(message || "").trim();

    if (!speechEnabled || !text) return;

    const language = getReplyLanguage(text);

    const result = callPowninAndroid(
        "speak",
        [text, language]
    );

    if (!result || !result.success) {
        setVoiceStatus("VOICE UNAVAILABLE");
        return;
    }

    setVoiceStatus("SPEAKING");
}

// ------------------------------------------------------------
// 5. SEND COMMAND FORM
// ------------------------------------------------------------

if (commandForm) {
    commandForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!commandInput) return;

        const command = commandInput.value.trim();

        if (!command) {
            setStatus("Please enter a command.");
            return;
        }

        commandInput.value = "";
        updatePowninCharacterCount();

        processPowninCommand(command);
    });
}


// ------------------------------------------------------------
// 6. SEND BUTTON
// ------------------------------------------------------------

if (sendBtn && !commandForm) {
    sendBtn.addEventListener("click", function () {
        if (!commandInput) return;

        const command = commandInput.value.trim();

        if (!command) return;

        commandInput.value = "";
        updatePowninCharacterCount();

        processPowninCommand(command);
    });
}


// ------------------------------------------------------------
// 7. CHARACTER COUNTER
// ------------------------------------------------------------

if (commandInput) {
    commandInput.addEventListener(
        "input",
        updatePowninCharacterCount
    );

    updatePowninCharacterCount();
}


// ------------------------------------------------------------
// 8. MICROPHONE BUTTON
// ------------------------------------------------------------

if (micBtn) {
    micBtn.addEventListener("click", function () {
        if (isListening) {
            callPowninAndroid("stopListening", []);

            isListening = false;

            setVoiceStatus("READY");
            setStatus("Listening stopped.");

            return;
        }

        startPowninNativeListening();
    });
}


// ------------------------------------------------------------
// 9. STOP VOICE BUTTON
// ------------------------------------------------------------

if (stopSpeakBtn) {
    stopSpeakBtn.addEventListener("click", function () {
        stopPowninProcessing();
        stopPowninNativeVoice();

        setStatus("Voice and processing stopped.");
    });
}


// ------------------------------------------------------------
// 10. REPEAT LAST REPLY
// ------------------------------------------------------------

if (speakBtn) {
    speakBtn.addEventListener("click", function () {
        if (!lastReply) {
            setStatus("There is no reply to repeat.");
            return;
        }

        speakPowninReply(lastReply);
    });
}


// ------------------------------------------------------------
// 11. CLEAR CHAT
// ------------------------------------------------------------

if (clearChatBtn) {
    clearChatBtn.addEventListener("click", function () {
        if (chat) {
            chat.textContent = "";
        }

        clearPowninHistory();

        lastReply = "";
        lastUserCommand = "";

        setStatus("Chat cleared.");
    });
}


// ------------------------------------------------------------
// 12. MODE SELECTOR
// ------------------------------------------------------------

[
    "offlineModeBtn",
    "onlineModeBtn",
    "hybridModeBtn"
].forEach(function (id) {
    const button = getElement(id);

    if (!button) return;

    button.addEventListener("click", function () {
        const mode = button.getAttribute("data-mode");

        if (!setPowninMode(mode)) {
            setStatus("Invalid AI mode.", true);
            return;
        }

        updatePowninModeButtons();

        setStatus(
            String(mode).toUpperCase() + " mode selected."
        );
    });
});

if (modeSelect) {
    modeSelect.addEventListener("change", function () {
        setPowninMode(modeSelect.value);
        updatePowninModeButtons();
    });
}

updatePowninModeButtons();


// ------------------------------------------------------------
// 13. LANGUAGE SELECTOR
// ------------------------------------------------------------

if (languageSelect) {
    languageSelect.value = selectedLanguage;

    languageSelect.addEventListener("change", function () {
        selectedLanguage = normalizePowninLanguage(
            languageSelect.value
        );

        callPowninAndroid(
            "setTtsLanguage",
            [selectedLanguage]
        );

        setStatus("Voice language updated.");

        updatePowninClock();
    });
}


// ------------------------------------------------------------
// 14. SETTINGS PANEL
// ------------------------------------------------------------

if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener("click", function () {
        settingsPanel.hidden = !settingsPanel.hidden;
    });
}

if (closeSettingsBtn && settingsPanel) {
    closeSettingsBtn.addEventListener("click", function () {
        settingsPanel.hidden = true;
    });
}


// ------------------------------------------------------------
// 15. CLEAR API KEY
// ------------------------------------------------------------

if (clearKeyBtn && apiKeyInput) {
    clearKeyBtn.addEventListener("click", function () {
        apiKeyInput.value = "";

        setStatus("API key field cleared.");
    });
}


// ------------------------------------------------------------
// 16. DEVICE CLOCK
// ------------------------------------------------------------

updatePowninClock();

setInterval(function () {
    updatePowninClock();
}, 1000);


// ------------------------------------------------------------
// 17. INITIAL SYSTEM STATUS
// ------------------------------------------------------------

setNetworkStatus(
    currentMode === "offline" ? "OFFLINE" :
    currentMode === "online" ? "ONLINE AI" :
    "HYBRID"
);

setVoiceStatus("READY");
setStatus("POWNIN READY");

console.log(
    "POWNIN SMART BRAIN v" +
    POWNIN_VERSION +
    " — ALL 8 PARTS LOADED"
);

// ============================================================
// END OF PART 8/8
// ============================================================
