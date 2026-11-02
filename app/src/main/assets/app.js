// ============================================================
// POWNIN SMART BRAIN v5.3
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

const POWNIN_NOTES_KEY = "pownin_extra_notes_v1";

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
// 4. LANGUAGE DETECTION
// Supports Bengali, Hindi, English and common Banglish.
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

    // Identity questions written in Banglish.
    const bengaliIdentity =
        /\b(tomar|tomar nam|tomar naam|tomar name|amar nam|amar naam|amar name|tumi ke|tumi ki)\b/;

    if (bengaliIdentity.test(normalized)) {
        return "bn-IN";
    }

    const bengaliWords =
        /\b(amar|amake|amar naam|amar nam|tomar|tomake|tomar naam|tomar nam|name|nam|naam|tumi|tumi ki|kemon|bhalo|bolo|bolun|koro|korbe|ki|kothay|bangla|banglish|shomoy|somoy|tarikh|dhonnobad|pownin)\b/;

    const hindiWords =
        /\b(mera|mujhe|tum|aap|kaise|kya|batao|bolo|samay|tarikh|dhanyavad|namaste|hindi)\b/;

    if (bengaliWords.test(normalized)) {
        return "bn-IN";
    }

    if (hindiWords.test(normalized)) {
        return "hi-IN";
    }

    return normalizePowninLanguage(selectedLanguage);
}

function normalizePowninLanguage(language) {
    const value = String(language || "").toLowerCase();

    if (value.startsWith("bn")) {
        return "bn-IN";
    }

    if (value.startsWith("hi")) {
        return "hi-IN";
    }

    return "en-IN";
}

function getCurrentLanguage() {
    return normalizePowninLanguage(selectedLanguage);
}

function getReplyLanguage(text) {
    return normalizePowninLanguage(detectPowninLanguage(text));
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

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 2/8 — CHAT UI, CLOCK, LOCALIZED REPLIES & NOTES
// ============================================================

// ------------------------------------------------------------
// 1. SAFE CHAT MESSAGE DISPLAY
// ------------------------------------------------------------

function addChatMessage(role, message) {
    if (!chat) {
        console.warn("Pownin: Chat element not found.");
        return null;
    }

    const content = String(message == null ? "" : message).trim();

    if (!content) {
        return null;
    }

    const messageElement = document.createElement("div");

    messageElement.className =
        role === "user" ? "user-message" : "assistant-message";

    const textElement = document.createElement("div");
    textElement.className = "message-text";

    // textContent prevents HTML/script injection.
    textElement.textContent = content;

    messageElement.appendChild(textElement);
    chat.appendChild(messageElement);

    chat.scrollTop = chat.scrollHeight;

    return messageElement;
}

function showUserMessage(message) {
    const content = String(message || "").trim();

    if (!content) {
        return;
    }

    addChatMessage("user", content);
    addHistory("user", content);
}

function showReply(message, options) {
    const content = String(message == null ? "" : message).trim();

    if (!content) {
        return;
    }

    addChatMessage("assistant", content);
    addHistory("assistant", content);

    lastReply = content;

    const settings = options || {};

    if (settings.speak === true) {
        speak(content);
    }
}

// ------------------------------------------------------------
// 2. CLEAR CHAT
// ------------------------------------------------------------

function clearChat() {
    if (chat) {
        chat.replaceChildren();
    }

    clearPowninHistory();

    lastReply = "";
    lastUserCommand = "";

    setStatus("Chat cleared.");

    if (commandInput) {
        commandInput.value = "";
    }

    if (characterCount) {
        characterCount.textContent = "0";
    }
}

// ------------------------------------------------------------
// 3. DEVICE DATE AND TIME
// ------------------------------------------------------------

function getPowninTime() {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }).format(new Date());
    } catch (error) {
        return new Date().toLocaleTimeString();
    }
}

function getPowninDate() {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(new Date());
    } catch (error) {
        return new Date().toLocaleDateString();
    }
}

function updatePowninClock() {
    if (!clockElement) {
        return;
    }

    const now = new Date();

    clockElement.textContent = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

// ------------------------------------------------------------
// 4. LOCALIZED RESPONSE TEXT
// ------------------------------------------------------------

const POWNIN_TEXT = {
    "en-IN": {
        greeting: "Hello! I am Pownin. How can I help you?",
        identity: "I am Pownin, your smart voice assistant.",
        help: "I can help with calculations, time, date, notes, supported apps and general questions.",
        thanks: "You're welcome!",
        time: "The current device time is ",
        date: "Today's date is ",
        unknown: "I am not sure how to handle that command yet.",
        empty: "Please enter a command.",
        tooLong: "Your command is too long.",
        saved: "Your note has been saved.",
        noNotes: "You don't have any saved notes.",
        notesCleared: "All saved notes have been cleared.",
        cancelled: "Command cancelled."
    },

    "bn-IN": {
        greeting: "হ্যালো! আমি Pownin। কীভাবে সাহায্য করতে পারি?",
        identity: "আমি Pownin, তোমার স্মার্ট ভয়েস অ্যাসিস্ট্যান্ট।",
        help: "আমি হিসাব, সময়, তারিখ, নোট, সমর্থিত অ্যাপ এবং সাধারণ প্রশ্নে সাহায্য করতে পারি।",
        thanks: "তোমাকে স্বাগতম!",
        time: "এখন তোমার ডিভাইসের সময় ",
        date: "আজকের তারিখ ",
        unknown: "এই কমান্ডটি কীভাবে পরিচালনা করতে হবে, তা এখনও বুঝতে পারিনি।",
        empty: "অনুগ্রহ করে একটি কমান্ড লেখো।",
        tooLong: "তোমার কমান্ডটি অনেক বড়।",
        saved: "তোমার নোট সংরক্ষণ করা হয়েছে।",
        noNotes: "তোমার কোনো সংরক্ষিত নোট নেই।",
        notesCleared: "সব সংরক্ষিত নোট মুছে ফেলা হয়েছে।",
        cancelled: "কমান্ড বাতিল করা হয়েছে।"
    },

    "hi-IN": {
        greeting: "नमस्ते! मैं Pownin हूँ। मैं आपकी कैसे मदद कर सकता हूँ?",
        identity: "मैं Pownin हूँ, आपका स्मार्ट वॉइस असिस्टेंट।",
        help: "मैं गणना, समय, तारीख, नोट्स, समर्थित ऐप्स और सामान्य सवालों में मदद कर सकता हूँ।",
        thanks: "आपका स्वागत है!",
        time: "आपके डिवाइस में अभी समय है ",
        date: "आज की तारीख है ",
        unknown: "मैं अभी इस कमांड को समझ नहीं पाया।",
        empty: "कृपया कोई कमांड लिखें।",
        tooLong: "आपकी कमांड बहुत लंबी है।",
        saved: "आपका नोट सेव हो गया है।",
        noNotes: "आपके पास कोई सेव किया हुआ नोट नहीं है।",
        notesCleared: "सभी सेव किए गए नोट हटा दिए गए हैं।",
        cancelled: "कमांड रद्द कर दिया गया है।"
    }
};

function getPowninText(key, language) {
    const lang = normalizePowninLanguage(
        language || getCurrentLanguage()
    );

    const dictionary = POWNIN_TEXT[lang] || POWNIN_TEXT["en-IN"];

    return dictionary[key] || POWNIN_TEXT["en-IN"][key] || "";
}

// ------------------------------------------------------------
// 5. LOCALIZED GREETING AND IDENTITY
// ------------------------------------------------------------

function getPowninGreeting(language) {
    return getPowninText("greeting", language);
}

function getPowninIdentity(language) {
    return getPowninText("identity", language);
}

function getPowninHelp(language) {
    return getPowninText("help", language);
}

function getPowninThanks(language) {
    return getPowninText("thanks", language);
}

// ------------------------------------------------------------
// 6. LOCAL NOTES STORAGE
// ------------------------------------------------------------

function readPowninNotes() {
    try {
        const raw = localStorage.getItem(POWNIN_NOTES_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(function (note) {
                return note &&
                    typeof note.text === "string" &&
                    note.text.trim().length > 0;
            })
            .slice(-100);
    } catch (error) {
        console.warn("Pownin notes could not be read:", error);
        return [];
    }
}

function writePowninNotes(notes) {
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

function savePowninNote(text) {
    const content = String(text || "").trim();

    if (!content) {
        return false;
    }

    if (content.length > MAX_NOTE_LENGTH) {
        return false;
    }

    const notes = readPowninNotes();

    notes.push({
        text: content,
        createdAt: new Date().toISOString()
    });

    return writePowninNotes(notes);
}

function getPowninNotes() {
    return readPowninNotes();
}

function clearPowninNotes() {
    try {
        localStorage.removeItem(POWNIN_NOTES_KEY);
        return true;
    } catch (error) {
        console.warn("Pownin notes could not be cleared:", error);
        return false;
    }
}

function formatPowninNotes(language) {
    const notes = getPowninNotes();

    if (notes.length === 0) {
        return getPowninText("noNotes", language);
    }

    const heading = language === "bn-IN"
        ? "তোমার সংরক্ষিত নোট:"
        : language === "hi-IN"
            ? "आपके सेव किए गए नोट्स:"
            : "Your saved notes:";

    return heading + "\n" + notes.map(function (note, index) {
        return (index + 1) + ". " + note.text;
    }).join("\n");
}

// ------------------------------------------------------------
// 7. CHARACTER COUNTER
// ------------------------------------------------------------

function updatePowninCharacterCount() {
    if (!commandInput || !characterCount) {
        return;
    }

    characterCount.textContent = String(
        commandInput.value.length
    );
}

// ------------------------------------------------------------
// END OF PART 2/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 3/8 — OFFLINE BRAIN, COMMANDS & MEDIUM CALCULATOR
// ============================================================

// ------------------------------------------------------------
// 1. COMMAND MATCHING HELPERS
// ------------------------------------------------------------

function matchesPowninCommand(text, patterns) {
    const value = normalizePowninText(text);

    return patterns.some(function (pattern) {
        return pattern.test(value);
    });
}

// ------------------------------------------------------------
// 2. GREETING DETECTION
// ------------------------------------------------------------

function isPowninGreetingCommand(text) {
    return matchesPowninCommand(text, [
        /^(hi|hello|hey|hii+|helo+|good morning|good afternoon|good evening)$/,
        /^(হ্যালো|হাই|নমস্কার|সুপ্রভাত|শুভ সকাল|শুভ সন্ধ্যা)$/,
        /^(नमस्ते|नमस्कार|हेलो|हाय|सुप्रभात)$/
    ]);
}

// ------------------------------------------------------------
// 3. IDENTITY DETECTION
// ------------------------------------------------------------

function isPowninIdentityCommand(text) {
    const value = normalizePowninText(text);

    const patterns = [
        /^(who are you|what are you|what is your name|your name|tell me your name)$/,
        /^(তুমি কে|তোমার নাম কি|তোমার নাম কী|তোমার পরিচয় কি)$/,
        /^(आप कौन हो|तुम कौन हो|तुम्हारा नाम क्या है|आपका नाम क्या है)$/
    ];

    if (patterns.some(function (pattern) {
        return pattern.test(value);
    })) {
        return true;
    }

    // Banglish identity questions.
    return /^(tumi ke|tumi ke go|tomar nam ki|tomar naam ki|tomar name ki|tomar nam ki bolo|tomar naam ki bolo|tomar name ki bolo|who are tumi)$/.test(value);
}

// ------------------------------------------------------------
// 4. HELP DETECTION
// ------------------------------------------------------------

function isPowninHelpCommand(text) {
    return matchesPowninCommand(text, [
        /^(help|what can you do|your features|commands)$/,
        /^(সাহায্য করো|তুমি কি করতে পারো|তোমার কাজ কি)$/,
        /^(मदद करो|तुम क्या कर सकते हो|आप क्या कर सकते हैं)$/
    ]);
}

// ------------------------------------------------------------
// 5. THANKS DETECTION
// ------------------------------------------------------------

function isPowninThanksCommand(text) {
    return matchesPowninCommand(text, [
        /^(thanks|thank you|thank u|thx)$/,
        /^(ধন্যবাদ|অনেক ধন্যবাদ)$/,
        /^(धन्यवाद|शुक्रिया|बहुत धन्यवाद)$/
    ]);
}

// ------------------------------------------------------------
// 6. TIME AND DATE DETECTION
// ------------------------------------------------------------

function isPowninTimeCommand(text) {
    return matchesPowninCommand(text, [
        /\b(what time is it|current time|tell me the time|time now)\b/,
        /(এখন কয়টা বাজে|এখন সময় কত|সময় বলো)/,
        /(अभी कितना बजा है|अभी समय क्या है|समय बताओ)/,
        /\b(ekhon koyta baje|ekhon somoy koto|somoy bolo)\b/
    ]);
}

function isPowninDateCommand(text) {
    return matchesPowninCommand(text, [
        /\b(what is the date|today's date|today date|what day is it)\b/,
        /(আজ কত তারিখ|আজকের তারিখ|আজ কি বার)/,
        /(आज की तारीख|आज कौन सा दिन है)/,
        /\b(aj koto tarikh|ajker tarikh|aj ki bar)\b/
    ]);
}

// ------------------------------------------------------------
// 7. LOCALIZED TIME AND DATE REPLIES
// ------------------------------------------------------------

function getLocalizedTimeReply(language) {
    return getPowninText("time", language) + getPowninTime();
}

function getLocalizedDateReply(language) {
    return getPowninText("date", language) + getPowninDate();
}

// ------------------------------------------------------------
// 8. MEDIUM BASIC CALCULATOR
// Supports + - * / % and parentheses.
// No eval() or Function().
// ------------------------------------------------------------

function tokenizePowninMath(expression) {
    const input = normalizePowninDigits(expression)
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/,/g, "");

    const tokens = [];
    let position = 0;

    while (position < input.length) {
        const remaining = input.slice(position);

        const whitespace = remaining.match(/^\s+/);

        if (whitespace) {
            position += whitespace[0].length;
            continue;
        }

        const number = remaining.match(
            /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i
        );

        if (number) {
            tokens.push({
                type: "number",
                value: Number(number[0])
            });

            position += number[0].length;
            continue;
        }

        const operator = remaining.match(/^[+\-*/%()]/);

        if (operator) {
            tokens.push({
                type: "operator",
                value: operator[0]
            });

            position += 1;
            continue;
        }

        throw new Error("Invalid mathematical expression.");
    }

    return tokens;
}

function calculatePowninBasic(expression) {
    const tokens = tokenizePowninMath(expression);
    let position = 0;

    function peek() {
        return tokens[position] || null;
    }

    function consume(value) {
        const token = peek();

        if (!token || token.value !== value) {
            throw new Error("Invalid expression.");
        }

        position++;
        return token;
    }

    function parsePrimary() {
        const token = peek();

        if (!token) {
            throw new Error("Incomplete expression.");
        }

        if (token.value === "+") {
            position++;
            return parsePrimary();
        }

        if (token.value === "-") {
            position++;
            return -parsePrimary();
        }

        if (token.value === "(") {
            position++;

            const value = parseExpression();

            consume(")");

            return value;
        }

        if (token.type === "number") {
            position++;
            return token.value;
        }

        throw new Error("Invalid number.");
    }

    function parseTerm() {
        let value = parsePrimary();

        while (true) {
            const token = peek();

            if (!token || !["*", "/", "%"].includes(token.value)) {
                break;
            }

            position++;

            const right = parsePrimary();

            if (token.value === "*") {
                value *= right;
            } else if (token.value === "/") {
                if (right === 0) {
                    throw new Error("Cannot divide by zero.");
                }

                value /= right;
            } else {
                if (right === 0) {
                    throw new Error("Cannot divide by zero.");
                }

                value %= right;
            }
        }

        return value;
    }

    function parseExpression() {
        let value = parseTerm();

        while (true) {
            const token = peek();

            if (!token || !["+", "-"].includes(token.value)) {
                break;
            }

            position++;

            const right = parseTerm();

            if (token.value === "+") {
                value += right;
            } else {
                value -= right;
            }
        }

        return value;
    }

    if (tokens.length === 0) {
        throw new Error("Empty expression.");
    }

    const result = parseExpression();

    if (position !== tokens.length) {
        throw new Error("Unexpected mathematical input.");
    }

    if (!Number.isFinite(result)) {
        throw new Error("The result is not a finite number.");
    }

    return Number(result.toPrecision(12));
}

// ------------------------------------------------------------
// 9. MATH ENGINE INTEGRATION
// ------------------------------------------------------------

function calculatePowninMath(expression) {
    const engine = window.PowninMath;

    if (engine && typeof engine.calculate === "function") {
        try {
            const result = engine.calculate(expression);

            // Accept common result formats.
            if (typeof result === "number" && Number.isFinite(result)) {
                return {
                    success: true,
                    result: result
                };
            }

            if (result && typeof result === "object") {
                if (result.success === true) {
                    const value =
                        result.result !== undefined
                            ? result.result
                            : result.answer;

                    if (value !== undefined && value !== null) {
                        return {
                            success: true,
                            result: value
                        };
                    }
                }

                if (result.error) {
                    return {
                        success: false,
                        error: String(result.error)
                    };
                }
            }
        } catch (error) {
            console.warn("Pownin Math Engine error:", error);
        }
    }

    try {
        return {
            success: true,
            result: calculatePowninBasic(expression)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || "Unable to calculate."
        };
    }
}

// ------------------------------------------------------------
// 10. CALCULATION COMMAND DETECTION
// ------------------------------------------------------------

function extractPowninMathExpression(text) {
    let value = normalizePowninDigits(String(text || "").trim());

    value = value
        .replace(/^(calculate|calc|compute|solve)\s+/i, "")
        .replace(/^(হিসাব করো|গণনা করো|যোগ করো)\s*/, "")
        .replace(/^(गणना करो|हल करो)\s*/, "")
        .replace(/[?=]+$/g, "")
        .trim();

    if (!value) {
        return null;
    }

    if (!/[0-9]/.test(value)) {
        return null;
    }

    if (!/^[0-9+\-*/%().×÷−,\s]+$/.test(value)) {
        return null;
    }

    return value;
}

function isPowninCalculationCommand(text) {
    return extractPowninMathExpression(text) !== null;
}

function getPowninCalculationReply(expression, language) {
    const result = calculatePowninMath(expression);

    if (!result.success) {
        if (language === "bn-IN") {
            return "হিসাবটি করতে সমস্যা হয়েছে: " + result.error;
        }

        if (language === "hi-IN") {
            return "गणना में समस्या हुई: " + result.error;
        }

        return "Calculation error: " + result.error;
    }

    if (language === "bn-IN") {
        return "হিসাবের ফল হলো: " + result.result;
    }

    if (language === "hi-IN") {
        return "गणना का परिणाम है: " + result.result;
    }

    return "The answer is " + result.result;
}

// ------------------------------------------------------------
// 11. BASIC OFFLINE BRAIN
// ------------------------------------------------------------

function getPowninOfflineReply(command, language) {
    const text = String(command || "").trim();
    const lang = normalizePowninLanguage(language || detectPowninLanguage(text));

    if (!text) {
        return getPowninText("empty", lang);
    }

    if (isPowninGreetingCommand(text)) {
        return getPowninGreeting(lang);
    }

    if (isPowninIdentityCommand(text)) {
        return getPowninIdentity(lang);
    }

    if (isPowninHelpCommand(text)) {
        return getPowninHelp(lang);
    }

    if (isPowninThanksCommand(text)) {
        return getPowninThanks(lang);
    }

    if (isPowninTimeCommand(text)) {
        return getLocalizedTimeReply(lang);
    }

    if (isPowninDateCommand(text)) {
        return getLocalizedDateReply(lang);
    }

    if (isPowninCalculationCommand(text)) {
        const expression = extractPowninMathExpression(text);

        return getPowninCalculationReply(expression, lang);
    }

    return getPowninText("unknown", lang);
}

// ------------------------------------------------------------
// END OF PART 3/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 4/8 — ANDROID BRIDGE, APP CONTROL & DEVICE COMMANDS
// ============================================================

// ------------------------------------------------------------
// 1. ANDROID BRIDGE ACCESS
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// 2. SAFE ANDROID METHOD CALL
// ------------------------------------------------------------

function callPowninAndroid(methodName, args) {
    const bridge = getPowninAndroidBridge();

    if (!bridge) {
        return {
            success: false,
            error: "Android bridge is unavailable."
        };
    }

    if (typeof bridge[methodName] !== "function") {
        return {
            success: false,
            error: "Android method is not available: " + methodName
        };
    }

    try {
        const result = bridge[methodName].apply(
            bridge,
            Array.isArray(args) ? args : []
        );

        // Android bridge methods may return a status string.
        if (
            typeof result === "string" &&
            /^(error|failed|not_found|app_not_found|unavailable)/i.test(result)
        ) {
            return {
                success: false,
                error: result
            };
        }

        if (result === false) {
            return {
                success: false,
                error: "Android command was rejected."
            };
        }

        return {
            success: true,
            result: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || "Android command failed."
        };
    }
}

// ------------------------------------------------------------
// 3. LOCALIZED DEVICE COMMAND MESSAGES
// ------------------------------------------------------------

function getPowninDeviceMessage(key, language, extra) {
    const lang = normalizePowninLanguage(language);
    const value = String(extra || "");

    const messages = {
        "en-IN": {
            opening: "Opening ",
            opened: "The command to open ",
            failed: "I couldn't open ",
            unavailable: "This device feature is not available.",
            volumeUp: "Volume increased.",
            volumeDown: "Volume decreased.",
            muted: "Mute command sent.",
            unmuted: "Unmute command sent.",
            settings: "Opening device settings.",
            settingsFailed: "I couldn't open device settings.",
            voiceGaming: "Gaming voice style selected.",
            voiceNormal: "Normal voice style selected.",
            voiceDeep: "Deep voice style selected.",
            languageSet: "Voice language changed."
        },

        "bn-IN": {
            opening: "খুলছি ",
            opened: "খোলার কমান্ড পাঠানো হয়েছে: ",
            failed: "খুলতে পারিনি: ",
            unavailable: "এই ডিভাইসের সুবিধাটি উপলব্ধ নেই।",
            volumeUp: "ভলিউম বাড়ানোর কমান্ড পাঠানো হয়েছে।",
            volumeDown: "ভলিউম কমানোর কমান্ড পাঠানো হয়েছে।",
            muted: "Mute কমান্ড পাঠানো হয়েছে।",
            unmuted: "Unmute কমান্ড পাঠানো হয়েছে।",
            settings: "ডিভাইসের Settings খোলার কমান্ড পাঠানো হয়েছে।",
            settingsFailed: "ডিভাইসের Settings খুলতে পারিনি।",
            voiceGaming: "Gaming voice style নির্বাচন করা হয়েছে।",
            voiceNormal: "Normal voice style নির্বাচন করা হয়েছে।",
            voiceDeep: "Deep voice style নির্বাচন করা হয়েছে।",
            languageSet: "Voice language পরিবর্তন করা হয়েছে।"
        },

        "hi-IN": {
            opening: "खोल रहा हूँ ",
            opened: "ऐप खोलने का कमांड भेजा गया: ",
            failed: "मैं इसे खोल नहीं पाया: ",
            unavailable: "यह सुविधा इस डिवाइस पर उपलब्ध नहीं है।",
            volumeUp: "वॉल्यूम बढ़ाने का कमांड भेजा गया।",
            volumeDown: "वॉल्यूम कम करने का कमांड भेजा गया।",
            muted: "म्यूट कमांड भेजा गया।",
            unmuted: "अनम्यूट कमांड भेजा गया।",
            settings: "डिवाइस सेटिंग्स खोलने का कमांड भेजा गया।",
            settingsFailed: "मैं डिवाइस सेटिंग्स नहीं खोल पाया।",
            voiceGaming: "गेमिंग वॉइस स्टाइल चुना गया।",
            voiceNormal: "नॉर्मल वॉइस स्टाइल चुना गया।",
            voiceDeep: "डीप वॉइस स्टाइल चुना गया।",
            languageSet: "वॉइस भाषा बदल दी गई।"
        }
    };

    const dictionary = messages[lang] || messages["en-IN"];

    return (dictionary[key] || dictionary.unavailable) + value;
}

// ------------------------------------------------------------
// 4. SUPPORTED APP MAP
// ------------------------------------------------------------

const POWNIN_APP_MAP = {
    whatsapp: "whatsapp",
    youtube: "youtube",
    chrome: "chrome",
    browser: "chrome",
    calculator: "calculator",
    camera: "camera",
    settings: "settings",
    maps: "maps",
    gallery: "gallery",
    photos: "photos"
};

// ------------------------------------------------------------
// 5. APP NAME DETECTION
// ------------------------------------------------------------

function detectPowninAppName(command) {
    const text = normalizePowninText(command);

    const appPatterns = [
        {
            app: "whatsapp",
            patterns: [
                /\bwhatsapp\b/,
                /व्हाट्सऐप|व्हाट्सएप/,
                /হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ/,
                /\b(whatsapp|whats app)\b/
            ]
        },
        {
            app: "youtube",
            patterns: [
                /\byoutube\b/,
                /यूट्यूब/,
                /ইউটিউব/
            ]
        },
        {
            app: "chrome",
            patterns: [
                /\bchrome\b/,
                /\bbrowser\b/,
                /क्रोम/,
                /ক্রোম/
            ]
        },
        {
            app: "calculator",
            patterns: [
                /\bcalculator\b/,
                /\bcalc\b/,
                /कैलकुलेटर/,
                /ক্যালকুলেটর/
            ]
        },
        {
            app: "camera",
            patterns: [
                /\bcamera\b/,
                /कैमरा/,
                /ক্যামেরা/
            ]
        },
        {
            app: "settings",
            patterns: [
                /\bsettings\b/,
                /\bsetting\b/,
                /सेटिंग/,
                /সেটিংস/
            ]
        },
        {
            app: "maps",
            patterns: [
                /\bgoogle maps\b/,
                /\bmaps\b/,
                /गूगल मैप्स/,
                /গুগল ম্যাপস/
            ]
        },
        {
            app: "gallery",
            patterns: [
                /\bgallery\b/,
                /गैलरी/,
                /গ্যালারি/
            ]
        },
        {
            app: "photos",
            patterns: [
                /\bgoogle photos\b/,
                /\bphotos\b/,
                /गूगल फोटोज/,
                /গুগল ফটোস/
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

    return null;
}

// ------------------------------------------------------------
// 6. OPEN APP COMMAND DETECTION
// ------------------------------------------------------------

function isPowninOpenAppCommand(command) {
    const text = normalizePowninText(command);

    const openPatterns = [
        /\b(open|launch|start|run)\b/,
        /খোলো|চালু করো|ওপেন করো/,
        /खोलो|चालू करो|ओपन करो/,
        /\b(kholo|chalu koro|open koro)\b/
    ];

    return openPatterns.some(function (pattern) {
        return pattern.test(text);
    }) && detectPowninAppName(text) !== null;
}

// ------------------------------------------------------------
// 7. OPEN APP
// ------------------------------------------------------------

function processPowninOpenAppCommand(command, language) {
    const lang = normalizePowninLanguage(language);
    const app = detectPowninAppName(command);

    if (!app) {
        return {
            handled: false
        };
    }

    const result = callPowninAndroid("openApp", [app]);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceMessage("failed", lang, app + ".")
        };
    }

    return {
        handled: true,
        reply: getPowninDeviceMessage("opened", lang, app + ".")
    };
}

// ------------------------------------------------------------
// 8. SETTINGS COMMAND
// ------------------------------------------------------------

function isPowninSettingsCommand(command) {
    const text = normalizePowninText(command);

    return /\b(open|go to|show)\b.*\b(settings|setting)\b/.test(text) ||
        /সেটিংস খোলো|সেটিংস খুলে দাও/.test(text) ||
        /सेटिंग खोलो|सेटिंग्स खोलो/.test(text) ||
        /\b(settings kholo|setting kholo)\b/.test(text);
}

function processPowninSettingsCommand(language) {
    const lang = normalizePowninLanguage(language);

    const result = callPowninAndroid("openSettingsPage", []);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceMessage("settingsFailed", lang)
        };
    }

    return {
        handled: true,
        reply: getPowninDeviceMessage("settings", lang)
    };
}

// ------------------------------------------------------------
// 9. VOLUME COMMAND DETECTION
// ------------------------------------------------------------

function detectPowninVolumeAction(command) {
    const text = normalizePowninText(command);

    if (
        /\b(volume up|increase volume|raise volume)\b/.test(text) ||
        /ভলিউম বাড়াও|শব্দ বাড়াও/.test(text) ||
        /आवाज़ बढ़ाओ|वॉल्यूम बढ़ाओ/.test(text)
    ) {
        return "up";
    }

    if (
        /\b(volume down|decrease volume|lower volume)\b/.test(text) ||
        /ভলিউম কমাও|শব্দ কমাও/.test(text) ||
        /आवाज़ कम करो|वॉल्यूम कम करो/.test(text)
    ) {
        return "down";
    }

    if (
        /\b(mute|mute volume)\b/.test(text) ||
        /মিউট করো|শব্দ বন্ধ করো/.test(text) ||
        /म्यूट करो|आवाज़ बंद करो/.test(text)
    ) {
        return "mute";
    }

    if (
        /\b(unmute|restore volume)\b/.test(text) ||
        /আনমিউট করো|শব্দ চালু করো/.test(text) ||
        /अनम्यूट करो|आवाज़ चालू करो/.test(text)
    ) {
        return "unmute";
    }

    return null;
}

// ------------------------------------------------------------
// 10. PROCESS VOLUME COMMAND
// ------------------------------------------------------------

function processPowninVolumeCommand(action, language) {
    const lang = normalizePowninLanguage(language);

    const result = callPowninAndroid("adjustVolume", [action]);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceMessage("unavailable", lang)
        };
    }

    const messageKey = {
        up: "volumeUp",
        down: "volumeDown",
        mute: "muted",
        unmute: "unmuted"
    }[action];

    return {
        handled: true,
        reply: getPowninDeviceMessage(messageKey, lang)
    };
}

// ------------------------------------------------------------
// 11. VOICE STYLE COMMAND DETECTION
// ------------------------------------------------------------

function detectPowninVoiceStyle(command) {
    const text = normalizePowninText(command);

    if (
        /\b(gaming voice|game voice|gaming style)\b/.test(text) ||
        /গেমিং ভয়েস|গেমিং ভয়েস/.test(text) ||
        /गेमिंग वॉइस/.test(text)
    ) {
        return "gaming";
    }

    if (
        /\b(normal voice|normal style)\b/.test(text) ||
        /স্বাভাবিক ভয়েস|নরমাল ভয়েস/.test(text) ||
        /नॉर्मल वॉइस/.test(text)
    ) {
        return "normal";
    }

    if (
        /\b(deep voice|deep style)\b/.test(text) ||
        /গভীর ভয়েস|ডিপ ভয়েস/.test(text) ||
        /डीप वॉइस/.test(text)
    ) {
        return "deep";
    }

    return null;
}

// ------------------------------------------------------------
// 12. PROCESS VOICE STYLE COMMAND
// ------------------------------------------------------------

function processPowninVoiceStyleCommand(style, language) {
    const lang = normalizePowninLanguage(language);

    const result = callPowninAndroid("setVoiceStyle", [style]);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceMessage("unavailable", lang)
        };
    }

    const messageKey = {
        gaming: "voiceGaming",
        normal: "voiceNormal",
        deep: "voiceDeep"
    }[style];

    return {
        handled: true,
        reply: getPowninDeviceMessage(messageKey, lang)
    };
}

// ------------------------------------------------------------
// 13. VOICE LANGUAGE COMMAND DETECTION
// ------------------------------------------------------------

function detectPowninVoiceLanguage(command) {
    const text = normalizePowninText(command);

    if (
        /\b(bengali voice|bangla voice|speak bengali)\b/.test(text) ||
        /বাংলা ভয়েস|বাংলায় কথা বলো/.test(text) ||
        /बंगाली वॉइस|बांग्ला में बोलो/.test(text)
    ) {
        return "bn-IN";
    }

    if (
        /\b(hindi voice|speak hindi)\b/.test(text) ||
        /হিন্দি ভয়েস/.test(text) ||
        /हिंदी वॉइस|हिंदी में बोलो/.test(text)
    ) {
        return "hi-IN";
    }

    if (
        /\b(english voice|speak english)\b/.test(text) ||
        /ইংরেজি ভয়েস/.test(text) ||
        /अंग्रेज़ी वॉइस/.test(text)
    ) {
        return "en-IN";
    }

    return null;
}

// ------------------------------------------------------------
// 14. PROCESS VOICE LANGUAGE COMMAND
// ------------------------------------------------------------

function processPowninVoiceLanguageCommand(language) {
    const lang = normalizePowninLanguage(language);

    selectedLanguage = lang;

    if (languageSelect) {
        languageSelect.value = lang;
    }

    const result = callPowninAndroid("setTtsLanguage", [lang]);

    if (!result.success) {
        return {
            handled: true,
            reply: getPowninDeviceMessage("unavailable", lang)
        };
    }

    return {
        handled: true,
        reply: getPowninDeviceMessage("languageSet", lang)
    };
}

// ------------------------------------------------------------
// END OF PART 4/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 5/8 — ONLINE AI, API SETTINGS & HYBRID BRAIN
// ============================================================

// ------------------------------------------------------------
// 1. ONLINE AI SETTINGS
// ------------------------------------------------------------

function getPowninOnlineSettings() {
    const endpoint = endpointInput
        ? endpointInput.value.trim()
        : "";

    const model = modelInput
        ? modelInput.value.trim()
        : "";

    // Read the key only when a request is made.
    // Never save it in localStorage.
    const apiKey = apiKeyInput
        ? apiKeyInput.value.trim()
        : "";

    return {
        endpoint: endpoint,
        model: model,
        apiKey: apiKey
    };
}

// ------------------------------------------------------------
// 2. VALIDATE ONLINE ENDPOINT
// ------------------------------------------------------------

function validatePowninEndpoint(endpoint) {
    if (!endpoint) {
        return {
            success: false,
            error: "Please configure an AI backend endpoint."
        };
    }

    try {
        const url = new URL(endpoint);

        if (url.protocol !== "https:") {
            return {
                success: false,
                error: "Online AI requires a secure HTTPS endpoint."
            };
        }

        if (url.username || url.password) {
            return {
                success: false,
                error: "Credentials must not be included in the endpoint URL."
            };
        }

        return {
            success: true,
            url: url
        };
    } catch (error) {
        return {
            success: false,
            error: "The AI endpoint URL is invalid."
        };
    }
}

// ------------------------------------------------------------
// 3. SYSTEM INSTRUCTIONS
// ------------------------------------------------------------

function getPowninSystemPrompt(language) {
    const lang = normalizePowninLanguage(language);

    const languageInstructions = {
        "bn-IN": "Reply naturally in Bengali. Understand Bengali and Banglish.",
        "hi-IN": "Reply naturally in Hindi. Understand Hindi and common Hinglish.",
        "en-IN": "Reply naturally in English."
    };

    return [
        "You are Pownin, a helpful multilingual AI voice assistant.",
        languageInstructions[lang],
        "Be friendly, clear, accurate and concise.",
        "Do not claim to control a device unless the native command confirms it.",
        "If you do not know something, say so honestly.",
        "Do not invent facts or pretend to have performed actions.",
        "Use simple language suitable for everyday conversation."
    ].join(" ");
}

// ------------------------------------------------------------
// 4. CREATE ONLINE AI REQUEST
// ------------------------------------------------------------

function createPowninAIRequest(command, language) {
    const settings = getPowninOnlineSettings();

    const validation = validatePowninEndpoint(settings.endpoint);

    if (!validation.success) {
        throw new Error(validation.error);
    }

    if (!settings.model) {
        throw new Error("Please enter an AI model name.");
    }

    const messages = [
        {
            role: "system",
            content: getPowninSystemPrompt(language)
        }
    ];

    getPowninHistory().forEach(function (item) {
        messages.push({
            role: item.role,
            content: item.content
        });
    });

    // The current user command is already included in history
    // when this function is called after showUserMessage().
    const lastMessage = messages[messages.length - 1];

    if (
        !lastMessage ||
        lastMessage.role !== "user" ||
        lastMessage.content !== command
    ) {
        messages.push({
            role: "user",
            content: command
        });
    }

    return {
        endpoint: settings.endpoint,
        model: settings.model,
        apiKey: settings.apiKey,
        body: {
            model: settings.model,
            messages: messages,
            temperature: 0.7,
            stream: false
        }
    };
}

// ------------------------------------------------------------
// 5. EXTRACT AI RESPONSE
// ------------------------------------------------------------

function extractPowninAIResponse(data) {
    if (!data || typeof data !== "object") {
        throw new Error("The AI server returned an invalid response.");
    }

    // OpenAI-compatible chat completion response.
    const choice = Array.isArray(data.choices)
        ? data.choices[0]
        : null;

    if (choice && choice.message) {
        const content = choice.message.content;

        if (typeof content === "string" && content.trim()) {
            return content.trim();
        }

        // Some providers return content as an array.
        if (Array.isArray(content)) {
            const combined = content
                .map(function (part) {
                    return typeof part === "string"
                        ? part
                        : part && typeof part.text === "string"
                            ? part.text
                            : "";
                })
                .join("")
                .trim();

            if (combined) {
                return combined;
            }
        }
    }

    // Simple custom backend response.
    if (typeof data.reply === "string" && data.reply.trim()) {
        return data.reply.trim();
    }

    if (typeof data.response === "string" && data.response.trim()) {
        return data.response.trim();
    }

    throw new Error("No readable AI reply was found.");
}

// ------------------------------------------------------------
// 6. ONLINE AI REQUEST
// ------------------------------------------------------------

async function askPowninOnlineAI(command, language) {
    const request = createPowninAIRequest(command, language);

    const controller = new AbortController();

    activePowninAbortController = controller;

    const timeoutId = setTimeout(function () {
        controller.abort();
    }, 30000);

    try {
        const headers = {
            "Content-Type": "application/json"
        };

        // For a private backend, prefer server-side authentication.
        // This optional field is never stored by this script.
        if (request.apiKey) {
            headers.Authorization = "Bearer " + request.apiKey;
        }

        const response = await fetch(request.endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(request.body),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(
                "AI server error: HTTP " + response.status
            );
        }

        const data = await response.json();

        return extractPowninAIResponse(data);

    } finally {
        clearTimeout(timeoutId);

        if (activePowninAbortController === controller) {
            activePowninAbortController = null;
        }
    }
}

// ------------------------------------------------------------
// 7. OFFLINE / ONLINE / HYBRID MODE
// ------------------------------------------------------------

async function getPowninSmartReply(command, language, token) {
    const mode = currentMode;
    const lang = normalizePowninLanguage(language);

    if (token !== powninCommandToken) {
        return null;
    }

    if (mode === "offline") {
        return getPowninOfflineReply(command, lang);
    }

    if (mode === "online") {
        setStatus("Connecting to Online AI...");

        return await askPowninOnlineAI(command, lang);
    }

    // Hybrid mode: try Online AI first.
    try {
        setStatus("Hybrid AI is thinking...");

        const onlineReply = await askPowninOnlineAI(command, lang);

        if (token !== powninCommandToken) {
            return null;
        }

        return onlineReply;

    } catch (error) {
        if (token !== powninCommandToken) {
            return null;
        }

        console.warn(
            "Pownin Online AI unavailable. Using offline brain:",
            error
        );

        setNetworkStatus("OFFLINE FALLBACK");

        return getPowninOfflineReply(command, lang);
    }
}

// ------------------------------------------------------------
// 8. CANCEL ACTIVE ONLINE REQUEST
// ------------------------------------------------------------

function abortPowninOnlineRequest() {
    if (activePowninAbortController) {
        try {
            activePowninAbortController.abort();
        } catch (error) {
            console.warn("Pownin request cancellation failed:", error);
        }

        activePowninAbortController = null;
    }
}

// ------------------------------------------------------------
// 9. API KEY CLEAR CONTROL
// ------------------------------------------------------------

function clearPowninApiKey() {
    if (apiKeyInput) {
        apiKeyInput.value = "";
    }

    setStatus("API key cleared from this input.");
}

// ------------------------------------------------------------
// 10. ONLINE CONNECTION STATUS
// ------------------------------------------------------------

function getPowninConnectionStatus() {
    if (!navigator.onLine) {
        return "OFFLINE";
    }

    if (currentMode === "offline") {
        return "OFFLINE MODE";
    }

    if (currentMode === "online") {
        return "ONLINE AI";
    }

    return "HYBRID MODE";
}

// ------------------------------------------------------------
// END OF PART 5/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 6/8 — VOICE SYSTEM, SPEECH RECOGNITION & NOTES
// ============================================================

// ------------------------------------------------------------
// 1. SPEECH LANGUAGE DETECTION
// ------------------------------------------------------------

function getPowninSpeechLanguage(text) {
    return normalizePowninLanguage(
        detectPowninLanguage(text || "")
    );
}

// ------------------------------------------------------------
// 2. TEXT TO SPEECH
// ------------------------------------------------------------

function speak(text) {
    if (!speechEnabled) {
        return false;
    }

    const message = String(text || "").trim();

    if (!message) {
        return false;
    }

    const language = getPowninSpeechLanguage(message);
    const bridge = getPowninAndroidBridge();

    // Prefer native Android TextToSpeech.
    if (bridge && typeof bridge.speak === "function") {
        try {
            const result = bridge.speak(message);

            if (result !== false) {
                setVoiceStatus("NATIVE TTS");
                return true;
            }
        } catch (error) {
            console.warn("Native TTS failed:", error);
        }
    }

    // Browser speech fallback.
    if (
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
    ) {
        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = language;
            utterance.rate = 1;
            utterance.pitch = 1;

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

            return true;
        } catch (error) {
            console.warn("Browser TTS failed:", error);
        }
    }

    setVoiceStatus("VOICE UNAVAILABLE");
    return false;
}

// ------------------------------------------------------------
// 3. STOP SPEAKING
// ------------------------------------------------------------

function stopSpeaking() {
    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.stopSpeaking === "function") {
        try {
            bridge.stopSpeaking();
        } catch (error) {
            console.warn("Native speech stop failed:", error);
        }
    }

    if ("speechSynthesis" in window) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn("Browser speech stop failed:", error);
        }
    }

    setVoiceStatus("VOICE STOPPED");
}


// ------------------------------------------------------------
// 4. START LISTENING
// FIX 3 — AUTO PROCESS VOICE COMMAND
// ------------------------------------------------------------

function startPowninListening() {
    if (isListening) {
        return false;
    }

    const bridge = getPowninAndroidBridge();

    // Native Android speech recognition.
    if (bridge && typeof bridge.startListening === "function") {
        try {
            const result = bridge.startListening(
                normalizePowninLanguage(selectedLanguage)
            );

            if (result !== false) {
                isListening = true;
                setStatus("Listening...");
                setVoiceStatus("LISTENING");
                return true;
            }
        } catch (error) {
            console.warn("Native speech recognition failed:", error);
        }
    }

    // Browser speech recognition fallback.
    const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Recognition) {
        setStatus("Speech recognition is unavailable.", true);
        return false;
    }

    try {
        const recognition = new Recognition();

        recognition.lang = normalizePowninLanguage(selectedLanguage);
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        window.powninBrowserRecognition = recognition;

        recognition.onstart = function () {
            isListening = true;
            setStatus("Listening...");
            setVoiceStatus("LISTENING");
        };

        recognition.onresult = function (event) {
            const transcript =
                event.results &&
                event.results[0] &&
                event.results[0][0]
                    ? String(event.results[0][0].transcript || "").trim()
                    : "";

            if (!transcript) {
                setStatus("No speech detected.", true);
                return;
            }

            if (commandInput) {
                commandInput.value = transcript;
                updatePowninCharacterCount();
            }

            // Automatically process recognized speech.
            processCommand(transcript);
        };

        recognition.onerror = function (event) {
            console.warn("Speech recognition error:", event.error);
            isListening = false;
            setVoiceStatus("READY");
            setStatus("Speech recognition error: " + event.error, true);
        };

        recognition.onend = function () {
            isListening = false;
            setVoiceStatus("READY");
        };

        recognition.start();
        return true;

    } catch (error) {
        isListening = false;
        setVoiceStatus("READY");
        setStatus("Could not start listening.", true);
        console.warn(error);
        return false;
    }
}

// ------------------------------------------------------------
// 5. STOP LISTENING
// ------------------------------------------------------------

function stopPowninListening() {
    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.stopListening === "function") {
        try {
            bridge.stopListening();
        } catch (error) {
            console.warn("Native listening stop failed:", error);
        }
    }

    const recognition = window.powninBrowserRecognition;

    if (recognition) {
        try {
            recognition.stop();
        } catch (error) {
            console.warn("Browser listening stop failed:", error);
        }

        window.powninBrowserRecognition = null;
    }

    isListening = false;
    setVoiceStatus("READY");
}

// ------------------------------------------------------------
// 6. NATIVE SPEECH CALLBACKS
// Called by Android if the bridge invokes these functions.
// ------------------------------------------------------------

window.onNativeSpeechResult = function (text) {
    const transcript = String(text || "").trim();

    isListening = false;
    setVoiceStatus("READY");

    if (!transcript || !commandInput) {
        return;
    }

    commandInput.value = transcript;
    updatePowninCharacterCount();

    setStatus("Speech recognized.");
};

window.onNativeSpeechError = function (error) {
    isListening = false;
    setVoiceStatus("VOICE ERROR");

    const message = String(error || "Unknown speech error");

    setStatus("Speech recognition error: " + message, true);
};

// ------------------------------------------------------------
// 7. NOTE COMMAND DETECTION
// ------------------------------------------------------------

function detectPowninNoteAction(command) {
    const text = String(command || "").trim();

    const savePatterns = [
        /^(save note|remember this|save this note)\s*[:,-]?\s*(.+)$/i,
        /^নোট লেখো\s+(.+)$/i,
        /^নোট সেভ করো\s+(.+)$/i,
        /^মনে রাখো\s+(.+)$/i,
        /^নোট সংরক্ষণ করো\s+(.+)$/i,
        /^note save koro\s+(.+)$/i,
        /^eta mone rakho\s+(.+)$/i,
        /^yaad rakho\s+(.+)$/i,
        /^नोट सेव करो\s+(.+)$/i,
        /^याद रखो\s+(.+)$/i
    ];

    for (const pattern of savePatterns) {
        const match = text.match(pattern);

        if (match) {
            return {
                action: "save",
                text: match[match.length - 1].trim()
            };
        }
    }

    if (
        /^(show notes|read notes|my notes|list notes)$/i.test(text) ||
        /নোট দেখাও|আমার নোট দেখাও/.test(text) ||
        /নোটস দেখাও|নোট পড়ে শোনাও/.test(text) ||
        /नोट्स दिखाओ|मेरे नोट दिखाओ/.test(text)
    ) {
        return {
            action: "show"
        };
    }

    if (
        /^(clear notes|delete notes|remove all notes)$/i.test(text) ||
        /সব নোট মুছে ফেলো|নোট মুছে ফেলো/.test(text) ||
        /सभी नोट हटाओ|नोट मिटा दो/.test(text)
    ) {
        return {
            action: "clear"
        };
    }

    return null;
}

// ------------------------------------------------------------
// 8. PROCESS NOTE COMMAND
// ------------------------------------------------------------

function processPowninNoteCommand(command, language) {
    const lang = normalizePowninLanguage(language);
    const noteCommand = detectPowninNoteAction(command);

    if (!noteCommand) {
        return {
            handled: false
        };
    }

    if (noteCommand.action === "save") {
        if (!noteCommand.text) {
            return {
                handled: true,
                reply: getPowninText("empty", lang)
            };
        }

        if (noteCommand.text.length > MAX_NOTE_LENGTH) {
            return {
                handled: true,
                reply: getPowninText("tooLong", lang)
            };
        }

        const saved = savePowninNote(noteCommand.text);

        return {
            handled: true,
            reply: saved
                ? getPowninText("saved", lang)
                : getPowninText("unknown", lang)
        };
    }

    if (noteCommand.action === "show") {
        return {
            handled: true,
            reply: formatPowninNotes(lang)
        };
    }

    if (noteCommand.action === "clear") {
        const cleared = clearPowninNotes();

        return {
            handled: true,
            reply: cleared
                ? getPowninText("notesCleared", lang)
                : getPowninText("unknown", lang)
        };
    }

    return {
        handled: false
    };
}

// ------------------------------------------------------------
// END OF PART 6/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 7/8 — COMMAND ROUTER, STOP/CANCEL & COMMAND PROCESSING
// ============================================================

// ------------------------------------------------------------
// 1. STOP COMMAND DETECTION
// Only "stop" and "exit" are stop commands.
// ------------------------------------------------------------

function isPowninStopCommand(command) {
    const text = normalizePowninText(command);

    return [
        "stop",
        "exit",
        "থামো",
        "বন্ধ করো",
        "বন্ধ কর",
        "रुको",
        "बंद करो"
    ].includes(text);
}

// ------------------------------------------------------------
// 2. CANCEL CURRENT PROCESSING
// ------------------------------------------------------------

function cancelPowninProcessing() {
    // Invalidate the current command.
    powninCommandToken++;

    // Stop any active online request.
    abortPowninOnlineRequest();

    // Stop voice output and input.
    stopSpeaking();
    stopPowninListening();

    isProcessing = false;

    setStatus("Command cancelled.");
}

// ------------------------------------------------------------
// 3. STOP COMMAND RESPONSE
// ------------------------------------------------------------

function getPowninStopReply(language) {
    const lang = normalizePowninLanguage(language);

    if (lang === "bn-IN") {
        return "ঠিক আছে। Pownin থেমে গেছে।";
    }

    if (lang === "hi-IN") {
        return "ठीक है। Pownin रुक गया है।";
    }

    return "Okay. Pownin has stopped.";
}

// ------------------------------------------------------------
// 4. PROCESS SPECIAL COMMANDS
// FIX 1 — SETTINGS ROUTING PRIORITY
// ------------------------------------------------------------

function processPowninSpecialCommand(command, language) {
    const lang = normalizePowninLanguage(language);

    // 1. Notes.
    const noteResult = processPowninNoteCommand(command, lang);

    if (noteResult.handled) {
        return noteResult;
    }

    // 2. Device settings — check BEFORE app control.
    if (isPowninSettingsCommand(command)) {
        return processPowninSettingsCommand(lang);
    }

    // 3. Open supported apps.
    if (isPowninOpenAppCommand(command)) {
        return processPowninOpenAppCommand(command, lang);
    }

    // 4. Volume control.
    const volumeAction = detectPowninVolumeAction(command);

    if (volumeAction) {
        return processPowninVolumeCommand(volumeAction, lang);
    }

    // 5. Voice style.
    const voiceStyle = detectPowninVoiceStyle(command);

    if (voiceStyle) {
        return processPowninVoiceStyleCommand(voiceStyle, lang);
    }

    // 6. Voice language.
    const voiceLanguage = detectPowninVoiceLanguage(command);

    if (voiceLanguage) {
        return processPowninVoiceLanguageCommand(voiceLanguage);
    }

    return {
        handled: false
    };
}

// ------------------------------------------------------------
// 5. OFFLINE COMMAND ROUTER
// ------------------------------------------------------------

function runPowninOfflineCommand(command, language) {
    const lang = normalizePowninLanguage(language);

    const specialResult = processPowninSpecialCommand(
        command,
        lang
    );

    if (specialResult.handled) {
        return specialResult.reply;
    }

    return getPowninOfflineReply(command, lang);
}

// ------------------------------------------------------------
// 6. PROCESS ONE COMMAND
// ------------------------------------------------------------

async function processCommand(rawCommand) {
    const command = String(rawCommand || "").trim();

    if (!command) {
        setStatus(getPowninText("empty"));
        return;
    }

    if (command.length > MAX_COMMAND_LENGTH) {
        setStatus(getPowninText("tooLong"), true);
        return;
    }

    // Stop must be handled even when another command is running.
    if (isPowninStopCommand(command)) {
        const language = detectPowninLanguage(command);

        cancelPowninProcessing();

        showUserMessage(command);

        const reply = getPowninStopReply(language);

        // Do not speak the stop response.
        showReply(reply);

        setStatus("Stopped.");
        return;
    }

    // Ignore a new command while another one is processing.
    if (isProcessing) {
        setStatus("Please wait. Pownin is processing the previous command.");
        return;
    }

    const token = ++powninCommandToken;

    const language = detectPowninLanguage(command);

    lastUserCommand = command;
    selectedLanguage = language;

    if (languageSelect) {
        languageSelect.value = language;
    }

    showUserMessage(command);

    isProcessing = true;
    setStatus("Pownin is thinking...");

    try {
        // First check local/device commands.
        const specialResult = processPowninSpecialCommand(
            command,
            language
        );

        if (specialResult.handled) {
            if (token !== powninCommandToken) {
                return;
            }

            showReply(specialResult.reply, {
                speak: true
            });

            setStatus("Ready.");
            return;
        }

        // Then use the selected brain mode.
        const reply = await getPowninSmartReply(
            command,
            language,
            token
        );

        // Ignore replies from cancelled or older requests.
        if (token !== powninCommandToken) {
            return;
        }

        if (reply) {
            showReply(reply, {
                speak: true
            });

            setStatus("Ready.");
        }

    } catch (error) {
        if (token !== powninCommandToken) {
            return;
        }

        console.error("Pownin command error:", error);

        const lang = normalizePowninLanguage(language);

        let errorReply;

        if (lang === "bn-IN") {
            errorReply = "দুঃখিত, কমান্ডটি সম্পন্ন করতে সমস্যা হয়েছে।";
        } else if (lang === "hi-IN") {
            errorReply = "क्षमा करें, कमांड पूरा करने में समस्या हुई।";
        } else {
            errorReply = "Sorry, I couldn't complete that command.";
        }

        showReply(errorReply, {
            speak: true
        });

        setStatus(getPowninErrorMessage(error), true);

    } finally {
        // Only the active command may reset processing state.
        if (token === powninCommandToken) {
            isProcessing = false;
        }
    }
}

// ------------------------------------------------------------
// 7. COMMAND INPUT HELPER
// ------------------------------------------------------------

function submitPowninCommand() {
    if (!commandInput) {
        return;
    }

    const command = commandInput.value.trim();

    if (!command) {
        setStatus(getPowninText("empty"));
        return;
    }

    commandInput.value = "";
    updatePowninCharacterCount();

    processCommand(command);
}

// ------------------------------------------------------------
// 8. MANUAL CANCEL HELPER
// ------------------------------------------------------------

function stopPowninEverything() {
    cancelPowninProcessing();

    setStatus("Pownin stopped.");
}

// ------------------------------------------------------------
// END OF PART 7/8
// ============================================================

// ============================================================
// POWNIN SMART BRAIN v5.3
// PART 8/8 — EVENTS, SETTINGS & FINAL INITIALIZATION
// ============================================================

 // ------------------------------------------------------------
 // 1. SEND BUTTON AND FORM EVENTS
 // FIX 2 — SEND BUTTON + ENTER
 // ------------------------------------------------------------

function bindPowninCommandEvents() {

    // Form submission (Enter key).
    if (commandForm && !commandForm.dataset.powninBound) {
        commandForm.dataset.powninBound = "true";

        commandForm.addEventListener("submit", function (event) {
            event.preventDefault();
            submitPowninCommand();
        });
    }

    // Send button click.
    if (sendBtn && !sendBtn.dataset.powninBound) {
        sendBtn.dataset.powninBound = "true";

        sendBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            submitPowninCommand();
        });
    }

    // Input character count and Enter handling.
    if (commandInput && !commandInput.dataset.powninBound) {
        commandInput.dataset.powninBound = "true";

        commandInput.addEventListener("input", function () {
            updatePowninCharacterCount();
        });

        commandInput.addEventListener("keydown", function (event) {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !commandForm
            ) {
                event.preventDefault();
                submitPowninCommand();
            }
        });
    }
}

// ------------------------------------------------------------
// 2. VOICE BUTTON EVENTS
// ------------------------------------------------------------

function bindPowninVoiceEvents() {
    if (micBtn && !micBtn.dataset.powninBound) {
        micBtn.dataset.powninBound = "true";

        micBtn.addEventListener("click", function () {
            if (isListening) {
                stopPowninListening();
                setStatus("Listening stopped.");
            } else {
                startPowninListening();
            }
        });
    }

    if (speakBtn && !speakBtn.dataset.powninBound) {
        speakBtn.dataset.powninBound = "true";

        speakBtn.addEventListener("click", function () {
            if (lastReply) {
                speak(lastReply);
            } else {
                setStatus("There is no reply to speak yet.");
            }
        });
    }

    if (stopSpeakBtn && !stopSpeakBtn.dataset.powninBound) {
        stopSpeakBtn.dataset.powninBound = "true";

        stopSpeakBtn.addEventListener("click", function () {
            stopPowninEverything();
        });
    }
}

// ------------------------------------------------------------
// 3. CHAT CLEAR EVENT
// ------------------------------------------------------------

function bindPowninChatEvents() {
    if (clearChatBtn && !clearChatBtn.dataset.powninBound) {
        clearChatBtn.dataset.powninBound = "true";

        clearChatBtn.addEventListener("click", function () {
            cancelPowninProcessing();
            clearChat();
        });
    }
}

// ------------------------------------------------------------
// 4. MODE AND LANGUAGE EVENTS
// ------------------------------------------------------------

function bindPowninModeEvents() {
    if (modeSelect && !modeSelect.dataset.powninBound) {
        modeSelect.dataset.powninBound = "true";

        modeSelect.addEventListener("change", function () {
            const changed = setPowninMode(modeSelect.value);

            if (changed) {
                setStatus("Pownin mode changed.");
            }
        });
    }

    if (languageSelect && !languageSelect.dataset.powninBound) {
        languageSelect.dataset.powninBound = "true";

        languageSelect.addEventListener("change", function () {
            selectedLanguage = normalizePowninLanguage(
                languageSelect.value
            );

            callPowninAndroid("setTtsLanguage", [
                selectedLanguage
            ]);

            setStatus("Voice language preference updated.");
        });
    }
}

// ------------------------------------------------------------
// 5. SETTINGS PANEL EVENTS
// ------------------------------------------------------------

function bindPowninSettingsEvents() {
    if (settingsBtn && !settingsBtn.dataset.powninBound) {
        settingsBtn.dataset.powninBound = "true";

        settingsBtn.addEventListener("click", function () {
            if (!settingsPanel) {
                return;
            }

            settingsPanel.hidden = false;
            settingsPanel.classList.add("open");
        });
    }

    if (closeSettingsBtn && !closeSettingsBtn.dataset.powninBound) {
        closeSettingsBtn.dataset.powninBound = "true";

        closeSettingsBtn.addEventListener("click", function () {
            if (!settingsPanel) {
                return;
            }

            settingsPanel.hidden = true;
            settingsPanel.classList.remove("open");
        });
    }

    if (clearKeyBtn && !clearKeyBtn.dataset.powninBound) {
        clearKeyBtn.dataset.powninBound = "true";

        clearKeyBtn.addEventListener("click", function () {
            clearPowninApiKey();
        });
    }
}

// ------------------------------------------------------------
// 6. NETWORK STATUS EVENTS
// ------------------------------------------------------------

function bindPowninNetworkEvents() {
    window.addEventListener("online", function () {
        setNetworkStatus(getPowninConnectionStatus());
    });

    window.addEventListener("offline", function () {
        setNetworkStatus("OFFLINE");
    });
}

// ------------------------------------------------------------
// 7. SAVE MODE PREFERENCE
// ------------------------------------------------------------

function restorePowninMode() {
    try {
        const savedMode = localStorage.getItem(
            "pownin_mode_v53"
        );

        if (
            savedMode === "offline" ||
            savedMode === "online" ||
            savedMode === "hybrid"
        ) {
            setPowninMode(savedMode);
        } else {
            setPowninMode("hybrid");
        }
    } catch (error) {
        console.warn("Could not restore Pownin mode:", error);
        setPowninMode("hybrid");
    }
}

function savePowninModePreference() {
    try {
        localStorage.setItem(
            "pownin_mode_v53",
            currentMode
        );
    } catch (error) {
        console.warn("Could not save Pownin mode:", error);
    }
}

// ------------------------------------------------------------
// 8. MODE CHANGE STORAGE
// ------------------------------------------------------------

function bindPowninModeStorage() {
    if (!modeSelect || modeSelect.dataset.powninStorageBound) {
        return;
    }

    modeSelect.dataset.powninStorageBound = "true";

    modeSelect.addEventListener("change", function () {
        savePowninModePreference();
    });
}

// ------------------------------------------------------------
// 9. CLOCK INITIALIZATION
// ------------------------------------------------------------

function initializePowninClock() {
    updatePowninClock();

    // Prevent duplicate clock intervals.
    if (window.powninClockInterval) {
        clearInterval(window.powninClockInterval);
    }

    window.powninClockInterval = setInterval(
        updatePowninClock,
        30000
    );
}

// ------------------------------------------------------------
// 10. INITIALIZE ALL EVENTS
// ------------------------------------------------------------

function initializePownin() {
    // Prevent duplicate initialization.
    if (window.powninInitialized === true) {
        return;
    }

    window.powninInitialized = true;

    try {
        bindPowninCommandEvents();
        bindPowninVoiceEvents();
        bindPowninChatEvents();
        bindPowninModeEvents();
        bindPowninSettingsEvents();
        bindPowninNetworkEvents();
        bindPowninModeStorage();

        restorePowninMode();

        if (languageSelect) {
            selectedLanguage = normalizePowninLanguage(
                languageSelect.value || "en-IN"
            );
        }

        updatePowninCharacterCount();
        initializePowninClock();

        setNetworkStatus(getPowninConnectionStatus());
        setVoiceStatus("READY");
        setStatus("Pownin Smart Brain v5.3 ready.");

        console.log(
            "Pownin Smart Brain v" + POWNIN_VERSION + " initialized."
        );

    } catch (error) {
        window.powninInitialized = false;

        console.error("Pownin initialization failed:", error);

        setStatus("Pownin initialization failed.", true);
    }
}

// ------------------------------------------------------------
// 11. STARTUP
// ------------------------------------------------------------

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializePownin,
        { once: true }
    );
} else {
    initializePownin();
}

// ------------------------------------------------------------
// 12. GLOBAL ERROR HANDLING
// ------------------------------------------------------------

window.addEventListener("error", function (event) {
    console.error(
        "Pownin JavaScript error:",
        event.message,
        event.filename,
        event.lineno
    );
});

window.addEventListener("unhandledrejection", function (event) {
    console.error(
        "Pownin asynchronous error:",
        event.reason
    );
});

// ------------------------------------------------------------
// END OF PART 8/8
// ============================================================
