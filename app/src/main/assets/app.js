/* =========================================================
   POWNIN SMART BRAIN v4.0
   PART 1/3 — CORE + LANGUAGE + MEMORY + OFFLINE BRAIN
   Bengali | Hindi | English | Banglish
   ========================================================= */

"use strict";

// ==========================================
// 1. CONFIGURATION
// ==========================================

const POWNIN_VERSION = "4.0";
const MAX_HISTORY = 40;
const MAX_COMMAND_LENGTH = 2000;
const MEMORY_KEY = "POWNIN_V4_MEMORY";
const SETTINGS_KEY = "POWNIN_V4_SETTINGS";

let conversationHistory = [];
let speechEnabled = true;
let currentMode = "hybrid";
let selectedLanguage = "auto";
let lastDetectedLanguage = "en";
let isProcessing = false;
let isListening = false;
let isSpeaking = false;

// ==========================================
// 2. HTML ELEMENTS
// ==========================================

const chat = document.getElementById("chat");
const input = document.getElementById("commandInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");

const mascotFrame = document.getElementById("mascotFrame");
const assistantState = document.getElementById("assistantState");
const modeLabel = document.getElementById("modeLabel");

const modeButtons = {
    offline: document.getElementById("offlineModeBtn"),
    online: document.getElementById("onlineModeBtn"),
    hybrid: document.getElementById("hybridModeBtn")
};

// ==========================================
// 3. STATUS SYSTEM
// ==========================================

function setStatus(message) {
    if (statusText) {
        statusText.textContent = String(message || "");
    }
}

function setAssistantState(state) {
    const value = String(state || "SYSTEM READY");

    if (assistantState) {
        assistantState.textContent = value;
    }

    if (mascotFrame) {
        mascotFrame.classList.remove(
            "listening",
            "thinking",
            "speaking"
        );

        if (value === "LISTENING") {
            mascotFrame.classList.add("listening");
        } else if (value === "THINKING") {
            mascotFrame.classList.add("thinking");
        } else if (value === "SPEAKING") {
            mascotFrame.classList.add("speaking");
        }
    }
}

function setReadyState() {
    setStatus("READY");
    setAssistantState("SYSTEM READY");
}

// ==========================================
// 4. LANGUAGE SYSTEM
// ==========================================

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function detectLanguage(text) {
    const value = String(text || "");

    // Bengali script detection
    if (/[\u0980-\u09FF]/.test(value)) {
        return "bn";
    }

    // Hindi / Devanagari script detection
    if (/[\u0900-\u097F]/.test(value)) {
        return "hi";
    }

    // Banglish detection
    const banglaWords =
        /\b(tomar|amar|amake|tumi|kemon|acho|achho|nam|name|naam|ki|kothay|bolo|bolbe|korbo|koro|kholo|bondho|shomoy|somoy|dhonnobad|bhalo|valo|ami|hobe|chai)\b/i;

    // Roman Hindi detection
    const hindiWords =
        /\b(mera|meri|mujhe|tumhara|aapka|kaise|kya|hai|haan|nahi|samay|shukriya)\b/i;

    if (banglaWords.test(value)) {
        return "bn";
    }

    if (hindiWords.test(value)) {
        return "hi";
    }

    return "en";
}

function getLanguageCode(language) {
    if (language === "bn") return "bn-IN";
    if (language === "hi") return "hi-IN";

    return "en-IN";
}

function getActiveLanguage(text) {
    if (selectedLanguage !== "auto") {
        return selectedLanguage;
    }

    return detectLanguage(text);
}

function getLanguage(text) {
    return getActiveLanguage(text);
}

function getReply(language, english, bengali, hindi) {
    if (language === "bn") {
        return bengali;
    }

    if (language === "hi") {
        return hindi;
    }

    return english;
}

// ==========================================
// 5. CHAT DISPLAY
// ==========================================

function addMessage(message, type) {
    if (!chat) return;

    const item = document.createElement("div");
    item.className = "message " + type;
    item.textContent = String(message || "");

    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
}

function showUserMessage(message) {
    addMessage(message, "user");
}

function showBotMessage(message) {
    addMessage(message, "bot");
}

// ==========================================
// 6. SMART MEMORY
// ==========================================

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);

        if (!saved) return;

        const settings = JSON.parse(saved);

        if (
            settings.language === "auto" ||
            settings.language === "bn" ||
            settings.language === "hi" ||
            settings.language === "en"
        ) {
            selectedLanguage = settings.language;
        }

        if (
            settings.mode === "offline" ||
            settings.mode === "online" ||
            settings.mode === "hybrid"
        ) {
            currentMode = settings.mode;
        }

    } catch (error) {
        console.warn("Settings load error:", error);
    }
}

function saveSettings() {
    try {
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({
                language: selectedLanguage,
                mode: currentMode
            })
        );
    } catch (error) {
        console.warn("Settings save error:", error);
    }
}

function loadConversationMemory() {
    try {
        const saved = localStorage.getItem(MEMORY_KEY);

        if (!saved) return;

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            conversationHistory = parsed
                .filter(item =>
                    item &&
                    typeof item.content === "string" &&
                    (item.role === "user" ||
                     item.role === "assistant")
                )
                .slice(-MAX_HISTORY);
        }

    } catch (error) {
        console.warn("Memory loading error:", error);
        conversationHistory = [];
    }
}

function saveConversationMemory() {
    try {
        localStorage.setItem(
            MEMORY_KEY,
            JSON.stringify(
                conversationHistory.slice(-MAX_HISTORY)
            )
        );
    } catch (error) {
        console.warn("Memory saving error:", error);
    }
}

function saveConversation(role, content) {
    conversationHistory.push({
        role: role,
        content: String(content),
        time: Date.now()
    });

    if (conversationHistory.length > MAX_HISTORY) {
        conversationHistory =
            conversationHistory.slice(-MAX_HISTORY);
    }

    saveConversationMemory();
}

function getRecentContext() {
    return conversationHistory.slice(-10);
}

function clearConversation() {
    conversationHistory = [];

    try {
        localStorage.removeItem(MEMORY_KEY);
    } catch (error) {
        console.warn("Memory clear error:", error);
    }

    if (chat) chat.textContent = "";

    showBotMessage(
        getReply(
            lastDetectedLanguage,
            "Chat history cleared.",
            "চ্যাট হিস্ট্রি মুছে দেওয়া হয়েছে।",
            "चैट हिस्ट्री साफ कर दी गई है।"
        )
    );

    setReadyState();
}

// ==========================================
// 7. OFFLINE GREETINGS
// ==========================================

function handleGreeting(language) {
    return getReply(
        language,
        "Hello! I am PowNin. How can I help you?",
        "হ্যালো! আমি PowNin। কীভাবে সাহায্য করতে পারি?",
        "नमस्ते! मैं PowNin हूँ। आपकी कैसे मदद कर सकता हूँ?"
    );
}

// ==========================================
// 8. IDENTITY
// ==========================================

function handleIdentity(language) {
    return getReply(
        language,
        "I am PowNin, your Android AI assistant.",
        "আমি PowNin, তোমার Android AI Assistant।",
        "मैं PowNin हूँ, आपका Android AI Assistant।"
    );
}

// ==========================================
// 9. DATE AND TIME
// ==========================================

function handleTime(language) {
    const time = new Date().toLocaleTimeString(
        getLanguageCode(language),
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );

    return getReply(
        language,
        "The current time is " + time,
        "এখন সময় " + time,
        "अभी समय " + time + " है।"
    );
}

function handleDate(language) {
    const date = new Date().toLocaleDateString(
        getLanguageCode(language),
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    return getReply(
        language,
        "Today's date is " + date,
        "আজকের তারিখ " + date,
        "आज की तारीख " + date + " है।"
    );
}

// ==========================================
// 10. HELP
// ==========================================

function handleHelp(language) {
    return getReply(
        language,
        "I can help with time, date, calculations, voice commands, app controls and supported Android features.",
        "আমি সময়, তারিখ, হিসাব, voice command, app control এবং সমর্থিত Android feature-এ সাহায্য করতে পারি।",
        "मैं समय, तारीख, गणना, voice command, app control और समर्थित Android सुविधाओं में मदद कर सकता हूँ।"
    );
}

// ==========================================
// 11. LANGUAGE SELECTION
// ==========================================

function handleLanguageCommand(command, language) {
    const text = normalizeText(command);

    if (
        text.includes("bangla mode") ||
        text.includes("বাংলা ভাষা") ||
        text.includes("বাংলায় কথা")
    ) {
        selectedLanguage = "bn";
        saveSettings();
        return "বাংলা ভাষা নির্বাচন করা হয়েছে।";
    }

    if (
        text.includes("hindi mode") ||
        text.includes("हिंदी भाषा")
    ) {
        selectedLanguage = "hi";
        saveSettings();
        return "हिंदी भाषा चुनी गई है।";
    }

    if (
        text.includes("english mode") ||
        text.includes("speak english")
    ) {
        selectedLanguage = "en";
        saveSettings();
        return "English language selected.";
    }

    if (
        text === "auto language" ||
        text === "automatic language"
    ) {
        selectedLanguage = "auto";
        saveSettings();

        return getReply(
            language,
            "Automatic language detection enabled.",
            "স্বয়ংক্রিয় ভাষা শনাক্তকরণ চালু হয়েছে।",
            "स्वचालित भाषा पहचान चालू हो गई है।"
        );
    }

    return null;
}

// ==========================================
// 12. CALCULATOR INTEGRATION
// ==========================================

function handleCalculation(command, language) {
    const math = window.PowninMath;

    if (!math) {
        return null;
    }

    try {
        let answer = null;

        // Try solve() first
        if (typeof math.solve === "function") {
            const solved = math.solve(command);

            if (solved && solved.success === true) {
                answer = solved.answer;
            }
        }

        // Use calculate() if solve() did not return an answer
        if (
            (answer === null || answer === undefined) &&
            typeof math.calculate === "function"
        ) {
            const result = math.calculate(command);

            if (
                result !== null &&
                result !== undefined &&
                result !== false
            ) {
                answer = result;
            }
        }

        if (answer === null || answer === undefined) {
            return null;
        }

        if (Array.isArray(answer)) {
            answer = answer.join(", ");
        }

        if (typeof answer === "object") {
            if (answer.success === true && answer.answer !== undefined) {
                answer = answer.answer;
            } else {
                return null;
            }
        }

        return getReply(
            language,
            "The answer is " + answer,
            "উত্তর হলো " + answer,
            "उत्तर है " + answer
        );

    } catch (error) {
        console.error("Math error:", error);
        return null;
    }
}

// ==========================================
// 13. OFFLINE COMMAND ROUTER
// ==========================================

function getOfflineReply(command) {
    const text = normalizeText(command);
    const language = getActiveLanguage(command);

    if (!text) {
        return getReply(
            language,
            "Please enter a message.",
            "কিছু লিখে পাঠাও।",
            "कृपया कुछ लिखें।"
        );
    }

    const languageReply =
        handleLanguageCommand(text, language);

    if (languageReply !== null) {
        return languageReply;
    }

    if (/^(hi|hello|hey|হ্যালো|হাই|नमस्ते|हेलो)$/i.test(text)) {
        return handleGreeting(language);
    }

    if (
        /\b(who are you|your name)\b/.test(text) ||
        /\b(tomar nam ki|tomar name ki|tomar naam ki)\b/.test(text) ||
        text.includes("তুমি কে") ||
        text.includes("তোমার নাম") ||
        text.includes("आप कौन हैं") ||
        text.includes("तुम्हारा नाम")
    ) {
        return handleIdentity(language);
    }

    if (
        /\b(time|somoy|shomoy)\b/.test(text) ||
        text.includes("সময়") ||
        text.includes("সময়") ||
        text.includes("समय")
    ) {
        return handleTime(language);
    }

    if (
        /\b(date|today)\b/.test(text) ||
        text.includes("আজ") ||
        text.includes("তারিখ") ||
        text.includes("आज") ||
        text.includes("तारीख")
    ) {
        return handleDate(language);
    }

    if (
        text === "help" ||
        text.includes("সাহায্য") ||
        text.includes("मदद")
    ) {
        return handleHelp(language);
    }

    if (
        text.includes("thank you") ||
        text.includes("thanks") ||
        text.includes("ধন্যবাদ") ||
        text.includes("शुक्रिया")
    ) {
        return getReply(
            language,
            "You're welcome!",
            "স্বাগতম!",
            "आपका स्वागत है!"
        );
    }

    const calculation =
        handleCalculation(command, language);

    if (calculation !== null) {
        return calculation;
    }

    return getReply(
        language,
        "I don't know that yet. My offline brain is still learning.",
        "এই প্রশ্নের উত্তর এখনো আমার জানা নেই। আমার Offline Brain আরও শিখছে।",
        "मुझे अभी इसका उत्तर नहीं पता। मेरा Offline Brain अभी सीख रहा है।"
    );
}

// ==========================================
// PART 1 END
// APPEND PART 2 BELOW THIS LINE
// ==========================================


/* =========================================================
   POWNIN SMART BRAIN v4.0
   PART 2/3 — ANDROID BRIDGE + VOICE + APP CONTROL
   ========================================================= */

// ==========================================
// 14. ANDROID BRIDGE
// ==========================================

function getPowninAndroidBridge() {
    try {
        if (
            window.PowninAndroid &&
            typeof window.PowninAndroid === "object"
        ) {
            return window.PowninAndroid;
        }
    } catch (error) {
        console.warn("Android bridge unavailable:", error);
    }

    return null;
}

function isAndroidBridgeReady() {
    const bridge = getPowninAndroidBridge();

    return !!(
        bridge &&
        typeof bridge.speak === "function"
    );
}

function callAndroidMethod(methodName, ...args) {
    const bridge = getPowninAndroidBridge();

    if (
        !bridge ||
        typeof bridge[methodName] !== "function"
    ) {
        return {
            success: false,
            message: "Android feature is not available yet."
        };
    }

    try {
        const result = bridge[methodName](...args);

        return {
            success: true,
            result: result
        };

    } catch (error) {
        console.error(
            "Android method error:",
            methodName,
            error
        );

        return {
            success: false,
            message: error.message || "Android operation failed."
        };
    }
}

// ==========================================
// 15. VOICE CONFIGURATION
// ==========================================

let voiceStyle = "gaming";
let voiceRate = 0.94;
let voicePitch = 0.90;

function setVoiceStyle(style) {
    const allowed = [
        "normal",
        "gaming",
        "calm"
    ];

    if (!allowed.includes(style)) {
        return false;
    }

    voiceStyle = style;

    const bridge = getPowninAndroidBridge();

    if (
        bridge &&
        typeof bridge.setVoiceStyle === "function"
    ) {
        try {
            bridge.setVoiceStyle(style);
        } catch (error) {
            console.warn("Voice style setting failed:", error);
        }
    }

    return true;
}

function getVoiceSettings() {
    return {
        style: voiceStyle,
        rate: voiceRate,
        pitch: voicePitch
    };
}

// ==========================================
// 16. LANGUAGE-AWARE SPEECH
// ==========================================

function speak(text, language) {
    if (!speechEnabled) return;

    const message = String(text || "").trim();

    if (!message) return;

    const activeLanguage =
        language || getActiveLanguage(message);

    const languageCode =
        getLanguageCode(activeLanguage);

    const bridge = getPowninAndroidBridge();

    if (bridge && typeof bridge.speak === "function") {
        try {
            isSpeaking = true;
            setAssistantState("SPEAKING");

            // Existing bridge accepts text and language.
            bridge.speak(message, languageCode);

            return;

        } catch (error) {
            console.warn("Native TTS failed:", error);
            isSpeaking = false;
        }
    }

    // Browser speech fallback.
    if (
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
    ) {
        try {
            window.speechSynthesis.cancel();

            const utterance =
                new SpeechSynthesisUtterance(message);

            utterance.lang = languageCode;
            utterance.rate = voiceRate;
            utterance.pitch = voicePitch;

            utterance.onend = function () {
                isSpeaking = false;
                setReadyState();
            };

            utterance.onerror = function () {
                isSpeaking = false;
                setReadyState();
            };

            window.speechSynthesis.speak(utterance);

        } catch (error) {
            console.error("Browser TTS error:", error);
            isSpeaking = false;
            setReadyState();
        }
    } else {
        isSpeaking = false;
        setReadyState();
    }
}

function speakReply(message, language) {
    speak(message, language);
}

// ==========================================
// 17. STOP VOICE
// ==========================================

function stopSpeaking() {
    const bridge = getPowninAndroidBridge();

    if (
        bridge &&
        typeof bridge.stopSpeaking === "function"
    ) {
        try {
            bridge.stopSpeaking();
        } catch (error) {
            console.warn("Native stop speaking failed:", error);
        }
    }

    if ("speechSynthesis" in window) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn(error);
        }
    }

    isSpeaking = false;
    setReadyState();
}

// ==========================================
// 18. SPEECH RECOGNITION
// ==========================================

function startListening(language) {
    const bridge = getPowninAndroidBridge();

    const activeLanguage =
        language || selectedLanguage;

    const languageCode =
        activeLanguage === "auto"
            ? getLanguageCode(lastDetectedLanguage)
            : getLanguageCode(activeLanguage);

    if (
        bridge &&
        typeof bridge.startListening === "function"
    ) {
        try {
            isListening = true;
            setAssistantState("LISTENING");
            setStatus("LISTENING...");

            bridge.startListening(languageCode);
            return;

        } catch (error) {
            console.error("Native listening error:", error);
            isListening = false;
        }
    }

    // Browser fallback.
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setStatus("Speech recognition is not supported.");
        setReadyState();
        return;
    }

    try {
        if (window.powninRecognition) {
            try {
                window.powninRecognition.stop();
            } catch (error) {
                // Previous recognition may already be stopped.
            }
        }

        const recognition = new SpeechRecognition();

        recognition.lang = languageCode;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function () {
            isListening = true;
            setAssistantState("LISTENING");
            setStatus("LISTENING...");
        };

        recognition.onresult = function (event) {
            const result =
                event.results &&
                event.results[0] &&
                event.results[0][0];

            if (result && result.transcript) {
                if (input) {
                    input.value = result.transcript;
                }

                sendMessage(result.transcript);
            }
        };

        recognition.onerror = function (event) {
            console.warn(
                "Speech recognition error:",
                event.error
            );

            isListening = false;
            setStatus("Voice recognition error.");
            setReadyState();
        };

        recognition.onend = function () {
            isListening = false;
            setReadyState();
        };

        window.powninRecognition = recognition;
        recognition.start();

    } catch (error) {
        console.error("Recognition start error:", error);
        isListening = false;
        setStatus("Could not start voice recognition.");
        setReadyState();
    }
}

// ==========================================
// 19. STOP LISTENING
// ==========================================

function stopListening() {
    const bridge = getPowninAndroidBridge();

    if (
        bridge &&
        typeof bridge.stopListening === "function"
    ) {
        try {
            bridge.stopListening();
        } catch (error) {
            console.warn(error);
        }
    }

    if (window.powninRecognition) {
        try {
            window.powninRecognition.stop();
        } catch (error) {
            console.warn(error);
        }
    }

    isListening = false;
    setReadyState();
}

// ==========================================
// 20. APP CONTROL
// ==========================================

const POWNIN_APP_COMMANDS = {
    youtube: [
        "youtube",
        "open youtube",
        "খুলে দাও ইউটিউব",
        "यूट्यूब खोलो"
    ],

    chrome: [
        "chrome",
        "open chrome",
        "খোলো ক্রোম",
        "क्रोम खोलो"
    ],

    whatsapp: [
        "whatsapp",
        "open whatsapp",
        "হোয়াটসঅ্যাপ খোলো",
        "व्हाट्सएप खोलो"
    ],

    maps: [
        "maps",
        "google maps",
        "open maps",
        "ম্যাপ খোলো",
        "मैप खोलो"
    ],

    settings: [
        "settings",
        "open settings",
        "সেটিংস খোলো",
        "सेटिंग्स खोलो"
    ],

    camera: [
        "camera",
        "open camera",
        "ক্যামেরা খোলো",
        "कैमरा खोलो"
    ],

    calculator: [
        "calculator",
        "open calculator",
        "ক্যালকুলেটর খোলো",
        "कैलकुलेटर खोलो"
    ],

    phone: [
        "phone",
        "open phone",
        "dialer",
        "ফোন খোলো",
        "फोन खोलो"
    ],

    files: [
        "files",
        "file manager",
        "open files",
        "ফাইল খোলো",
        "फाइल खोलो"
    ]
};

function findAppCommand(command) {
    const text = normalizeText(command);

    for (const appName of Object.keys(POWNIN_APP_COMMANDS)) {
        const phrases = POWNIN_APP_COMMANDS[appName];

        for (const phrase of phrases) {
            if (text === normalizeText(phrase)) {
                return appName;
            }
        }
    }

    return null;
}

function handleAppCommand(command) {
    const appName = findAppCommand(command);

    if (!appName) return null;

    const bridge = getPowninAndroidBridge();

    if (
        !bridge ||
        typeof bridge.openApp !== "function"
    ) {
        return getReply(
            getActiveLanguage(command),
            "App control is not connected to Android yet.",
            "Android App Control এখনো সংযুক্ত হয়নি।",
            "Android App Control अभी कनेक्ट नहीं है।"
        );
    }

    try {
        bridge.openApp(appName);

        return getReply(
            getActiveLanguage(command),
            "Opening " + appName + ".",
            appName + " খোলার চেষ্টা করছি।",
            appName + " खोलने की कोशिश कर रहा हूँ।"
        );

    } catch (error) {
        console.error("App launch error:", error);

        return getReply(
            getActiveLanguage(command),
            "I could not open that app.",
            "অ্যাপটি খুলতে পারলাম না।",
            "मैं वह ऐप नहीं खोल पाया।"
        );
    }
}

// ==========================================
// 21. MEDIA CONTROL INTERFACE
// ==========================================

function handleMediaCommand(command) {
    const text = normalizeText(command);

    let action = null;

    if (
        text === "play music" ||
        text === "play" ||
        text === "গান চালাও" ||
        text === "गाना चलाओ"
    ) {
        action = "play";
    } else if (
        text === "pause music" ||
        text === "pause" ||
        text === "গান থামাও" ||
        text === "गाना रोक दो"
    ) {
        action = "pause";
    } else if (
        text === "next song" ||
        text === "next track" ||
        text === "পরের গান" ||
        text === "अगला गाना"
    ) {
        action = "next";
    } else if (
        text === "previous song" ||
        text === "আগের গান" ||
        text === "पिछला गाना"
    ) {
        action = "previous";
    }

    if (!action) return null;

    const result =
        callAndroidMethod("mediaControl", action);

    const language = getActiveLanguage(command);

    if (!result.success) {
        return getReply(
            language,
            "Media control is not connected yet.",
            "Media Control-এর Android অংশ এখনো তৈরি হয়নি।",
            "Media Control का Android हिस्सा अभी तैयार नहीं है।"
        );
    }

    return getReply(
        language,
        "Media command sent.",
        "Media command পাঠানো হয়েছে।",
        "Media command भेज दिया गया है।"
    );
}

// ==========================================
// 22. CALL INTEGRATION — SAFE DIALER ONLY
// ==========================================

function handleCallCommand(command) {
    const text = normalizeText(command);

    const callPhrases = [
        "open dialer",
        "open phone dialer",
        "ফোন ডায়ালার খোলো",
        "डायलर खोलो"
    ];

    if (!callPhrases.includes(text)) {
        return null;
    }

    const result = callAndroidMethod("openDialer");

    const language = getActiveLanguage(command);

    if (!result.success) {
        return getReply(
            language,
            "Phone dialer integration is not available yet.",
            "Phone Dialer integration এখনো তৈরি হয়নি।",
            "Phone Dialer integration अभी उपलब्ध नहीं है।"
        );
    }

    return getReply(
        language,
        "Opening the phone dialer. You can review the number before calling.",
        "Phone Dialer খুলছি। কল করার আগে নম্বর দেখে নেবে।",
        "Phone Dialer खोल रहा हूँ। कॉल करने से पहले नंबर जाँच लें।"
    );
}

// ==========================================
// 23. NOTIFICATION FEATURE STATUS
// ==========================================

function getNotificationFeatureStatus() {
    const result =
        callAndroidMethod("isNotificationAccessEnabled");

    if (!result.success) {
        return {
            available: false,
            enabled: false
        };
    }

    return {
        available: true,
        enabled: result.result === true
    };
}

function handleNotificationCommand(command) {
    const text = normalizeText(command);

    const notificationWords = [
        "read notifications",
        "check notifications",
        "নোটিফিকেশন পড়ো",
        "নোটিফিকেশন দেখাও",
        "नोटिफिकेशन पढ़ो",
        "नोटिफिकेशन दिखाओ"
    ];

    if (!notificationWords.includes(text)) {
        return null;
    }

    const language = getActiveLanguage(command);
    const status = getNotificationFeatureStatus();

    if (!status.available) {
        return getReply(
            language,
            "Notification access is not integrated yet.",
            "Notification Access-এর Android service এখনো যোগ করা হয়নি।",
            "Notification Access की Android service अभी नहीं जोड़ी गई है।"
        );
    }

    if (!status.enabled) {
        return getReply(
            language,
            "Please enable notification access in Android settings.",
            "Android Settings থেকে Notification Access অনুমতি চালু করতে হবে।",
            "Android Settings में Notification Access की अनुमति चालू करनी होगी।"
        );
    }

    const result = callAndroidMethod("readNotifications");

    if (!result.success) {
        return getReply(
            language,
            "Could not read notifications.",
            "নোটিফিকেশন পড়তে পারলাম না।",
            "नोटिफिकेशन पढ़ नहीं पाया।"
        );
    }

    return String(result.result || "");
}

// ==========================================
// 24. NATIVE SPEECH CALLBACKS
// ==========================================

window.onNativeSpeechResult = function (text) {
    isListening = false;

    const transcript = String(text || "").trim();

    setReadyState();

    if (!transcript) return;

    if (input) {
        input.value = transcript;
    }

    sendMessage(transcript);
};

window.onNativeSpeechError = function (error) {
    isListening = false;

    console.warn("Native speech error:", error);

    setStatus("Voice recognition error.");
    setReadyState();
};

window.onNativeAppError = function (error) {
    console.warn("Native app error:", error);

    setStatus(
        String(error || "Android app operation failed.")
    );

    setReadyState();
};

window.onNativeTtsDone = function () {
    isSpeaking = false;
    setReadyState();
};

// ==========================================
// PART 2 END
// APPEND PART 3 BELOW THIS LINE
// ==========================================


/* =========================================================
   POWNIN SMART BRAIN v4.0
   PART 3/3 — ADVANCED ROUTER + AI + UI + INITIALIZATION
   ========================================================= */

// ==========================================
// 25. ONLINE AI CONFIGURATION
// ==========================================

// IMPORTANT:
// Do not put private API keys inside this Android app.
// Configure a secure backend endpoint when one is available.

const POWNIN_AI_ENDPOINT = "";

async function getOnlineReply(command, language) {
    if (!POWNIN_AI_ENDPOINT) {
        return getReply(
            language,
            "Online AI is not configured yet. I can still help with offline commands.",
            "Online AI এখনো সংযুক্ত করা হয়নি। তবে Offline Command দিয়ে সাহায্য করতে পারি।",
            "Online AI अभी कनेक्ट नहीं है। लेकिन Offline Command से मदद कर सकता हूँ।"
        );
    }

    try {
        const response = await fetch(POWNIN_AI_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: command,
                language: language,
                history: getRecentContext()
            })
        });

        if (!response.ok) {
            throw new Error("AI server returned " + response.status);
        }

        const data = await response.json();

        if (
            data &&
            typeof data.reply === "string" &&
            data.reply.trim()
        ) {
            return data.reply.trim();
        }

        throw new Error("Invalid AI response");

    } catch (error) {
        console.error("Online AI error:", error);

        return getReply(
            language,
            "I could not connect to Online AI. Please try again later.",
            "Online AI-এর সঙ্গে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করো।",
            "Online AI से कनेक्शन नहीं हो पाया। बाद में फिर कोशिश करें।"
        );
    }
}

// ==========================================
// 26. MODE SYSTEM
// ==========================================

function setPowninMode(mode) {
    const allowedModes = [
        "offline",
        "online",
        "hybrid"
    ];

    if (!allowedModes.includes(mode)) {
        return false;
    }

    currentMode = mode;
    saveSettings();

    if (modeLabel) {
        modeLabel.textContent =
            mode.toUpperCase();
    }

    Object.keys(modeButtons).forEach(function (key) {
        const button = modeButtons[key];

        if (button) {
            button.classList.toggle(
                "active",
                key === mode
            );
        }
    });

    setStatus(mode.toUpperCase() + " MODE ENABLED");

    return true;
}

function handleModeCommand(command, language) {
    const text = normalizeText(command);

    if (
        text === "offline mode" ||
        text === "অফলাইন মোড" ||
        text === "ऑफलाइन मोड"
    ) {
        setPowninMode("offline");

        return getReply(
            language,
            "Offline mode enabled.",
            "Offline Mode চালু হয়েছে।",
            "Offline Mode चालू हो गया है।"
        );
    }

    if (
        text === "online mode" ||
        text === "অনলাইন মোড" ||
        text === "ऑनलाइन मोड"
    ) {
        setPowninMode("online");

        return getReply(
            language,
            "Online mode enabled.",
            "Online Mode চালু হয়েছে।",
            "Online Mode चालू हो गया है।"
        );
    }

    if (
        text === "hybrid mode" ||
        text === "হাইব্রিড মোড" ||
        text === "हाइब्रिड मोड"
    ) {
        setPowninMode("hybrid");

        return getReply(
            language,
            "Hybrid mode enabled.",
            "Hybrid Mode চালু হয়েছে।",
            "Hybrid Mode चालू हो गया है।"
        );
    }

    return null;
}

// ==========================================
// 27. STOP COMMANDS
// ==========================================

function handleStopCommand(command, language) {
    const text = normalizeText(command);

    const stopCommands = [
        "stop",
        "exit",
        "stop voice",
        "stop speaking",
        "voice stop",
        "বন্ধ করো",
        "থামো",
        "आवाज़ बंद करो",
        "रुको"
    ];

    if (!stopCommands.includes(text)) {
        return null;
    }

    stopSpeaking();
    stopListening();

    return getReply(
        language,
        "Stopped.",
        "বন্ধ করা হয়েছে।",
        "रोक दिया गया है।"
    );
}

// ==========================================
// 28. CLEAR CHAT COMMAND
// ==========================================

function handleClearCommand(command, language) {
    const text = normalizeText(command);

    const clearCommands = [
        "clear chat",
        "clear history",
        "delete chat",
        "চ্যাট পরিষ্কার করো",
        "চ্যাট মুছে দাও",
        "चैट साफ करो",
        "चैट हटाओ"
    ];

    if (!clearCommands.includes(text)) {
        return null;
    }

    clearConversation();

    return getReply(
        language,
        "Chat cleared.",
        "চ্যাট পরিষ্কার করা হয়েছে।",
        "चैट साफ कर दी गई है।"
    );
}

// ==========================================
// 29. COMMAND ROUTER
// ==========================================

async function processCommand(rawCommand) {
    const command = String(rawCommand || "").trim();

    if (!command) {
        setStatus("Please enter a command.");
        return;
    }

    if (command.length > MAX_COMMAND_LENGTH) {
        const language = getActiveLanguage(command);

        showBotMessage(
            getReply(
                language,
                "That message is too long.",
                "মেসেজটি অনেক বড়।",
                "यह संदेश बहुत लंबा है।"
            )
        );

        return;
    }

    if (isProcessing) {
        return;
    }

    const language = getActiveLanguage(command);
    lastDetectedLanguage = language;

    isProcessing = true;

    showUserMessage(command);
    saveConversation("user", command);

    setAssistantState("THINKING");
    setStatus("PROCESSING...");

    try {
        // 1. Stop commands
        const stopReply =
            handleStopCommand(command, language);

        if (stopReply !== null) {
            showBotMessage(stopReply);
            saveConversation("assistant", stopReply);
            speakReply(stopReply, language);
            return;
        }

        // 2. Clear chat
        const clearReply =
            handleClearCommand(command, language);

        if (clearReply !== null) {
            speakReply(clearReply, language);
            return;
        }

        // 3. Mode commands
        const modeReply =
            handleModeCommand(command, language);

        if (modeReply !== null) {
            showBotMessage(modeReply);
            saveConversation("assistant", modeReply);
            speakReply(modeReply, language);
            return;
        }

        // 4. App commands
        const appReply =
            handleAppCommand(command);

        if (appReply !== null) {
            showBotMessage(appReply);
            saveConversation("assistant", appReply);
            speakReply(appReply, language);
            return;
        }

        // 5. Media commands
        const mediaReply =
            handleMediaCommand(command);

        if (mediaReply !== null) {
            showBotMessage(mediaReply);
            saveConversation("assistant", mediaReply);
            speakReply(mediaReply, language);
            return;
        }

        // 6. Safe phone dialer command
        const callReply =
            handleCallCommand(command);

        if (callReply !== null) {
            showBotMessage(callReply);
            saveConversation("assistant", callReply);
            speakReply(callReply, language);
            return;
        }

        // 7. Notification commands
        const notificationReply =
            handleNotificationCommand(command);

        if (notificationReply !== null) {
            showBotMessage(notificationReply);
            saveConversation("assistant", notificationReply);
            speakReply(notificationReply, language);
            return;
        }

        // 8. Offline mode
        if (currentMode === "offline") {
            const reply = getOfflineReply(command);

            showBotMessage(reply);
            saveConversation("assistant", reply);
            speakReply(reply, language);

            return;
        }

        // 9. ONLINE / HYBRID MODE

        if (currentMode === "online") {
            const onlineReply =
                await getOnlineReply(command, language);

            showBotMessage(onlineReply);
            saveConversation("assistant", onlineReply);
            speakReply(onlineReply, language);

            return;
        }

        if (currentMode === "hybrid") {
            let onlineReply = null;

            try {
                onlineReply =
                    await getOnlineReply(command, language);
            } catch (error) {
                console.warn(
                    "Online AI unavailable. Using offline brain.",
                    error
                );
            }

            if (
                onlineReply &&
                !onlineReply.includes("not configured") &&
                !onlineReply.includes("unavailable") &&
                !onlineReply.includes("could not connect")
            ) {
                showBotMessage(onlineReply);
                saveConversation("assistant", onlineReply);
                speakReply(onlineReply, language);
            } else {
                const offlineReply =
                    getOfflineReply(command);

                showBotMessage(offlineReply);
                saveConversation("assistant", offlineReply);
                speakReply(offlineReply, language);
            }

            return;
        }
// ==========================================
// 30. SEND MESSAGE
// ==========================================

function sendMessage(optionalText) {
    const command = String(
        optionalText !== undefined
            ? optionalText
            : input
                ? input.value
                : ""
    ).trim();

    if (!command) return;

    if (input && optionalText === undefined) {
        input.value = "";
    }

    processCommand(command);
}

// ==========================================
// 31. BUTTON EVENTS
// ==========================================

function initializeEventListeners() {
    if (sendBtn) {
        sendBtn.addEventListener("click", function () {
            sendMessage();
        });
    }

    if (input) {
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (voiceBtn) {
        voiceBtn.addEventListener("click", function () {
            if (isListening) {
                stopListening();
            } else {
                startListening(selectedLanguage);
            }
        });
    }

       const clearChatBtn = document.getElementById("clearChatBtn");

    if (clearChatBtn) {
        clearChatBtn.addEventListener("click", function () {
            clearConversation();
        });
    }
   
    if (stopBtn) {
        stopBtn.addEventListener("click", function () {
            stopSpeaking();
            stopListening();
        });
    }

    if (modeButtons.offline) {
        modeButtons.offline.addEventListener("click", function () {
            setPowninMode("offline");
        });
    }

    if (modeButtons.online) {
        modeButtons.online.addEventListener("click", function () {
            setPowninMode("online");
        });
    }

    if (modeButtons.hybrid) {
        modeButtons.hybrid.addEventListener("click", function () {
            setPowninMode("hybrid");
        });
    }
}

// ==========================================
// 32. INITIALIZATION
// ==========================================

function initializePownin() {
    try {
        loadSettings();
        loadConversationMemory();

        initializeEventListeners();

        setPowninMode(currentMode);

        setReadyState();

        console.log(
            "PowNin Smart Brain v" +
            POWNIN_VERSION +
            " initialized."
        );

        const welcome = getReply(
            lastDetectedLanguage,
            "Hello! PowNin is ready.",
            "হ্যালো! PowNin প্রস্তুত।",
            "नमस्ते! PowNin तैयार है।"
        );

        showBotMessage(welcome);

    } catch (error) {
        console.error("PowNin initialization error:", error);
        setStatus("Initialization failed.");
    }
}

// ==========================================
// 33. GLOBAL ERROR HANDLING
// ==========================================

window.addEventListener("error", function (event) {
    console.error(
        "PowNin JavaScript error:",
        event.message,
        event.filename,
        event.lineno
    );
});

window.addEventListener(
    "unhandledrejection",
    function (event) {
        console.error(
            "PowNin async error:",
            event.reason
        );
    }
);

// ==========================================
// 34. START APPLICATION
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializePownin,
        { once: true }
    );
} else {
    initializePownin();
}

// ==========================================
// POWNIN SMART BRAIN v4.0 END
// ==========================================
