/* =====================================================
   POWNIN SMART BRAIN v3.0
   PART 1/3 — CORE + OFFLINE BRAIN + MEMORY
   Bengali | Hindi | English
   ===================================================== */

"use strict";

// ==========================================
// 1. APP CONFIGURATION
// ==========================================

const POWNIN_VERSION = "3.0";
const MAX_HISTORY = 30;
const MEMORY_KEY = "POWNIN_CONVERSATION_MEMORY";

let conversationHistory = [];
let speechEnabled = true;
let currentMode = "offline";
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
// 3. STATUS + ANIMATION
// ==========================================

function setStatus(message) {
    if (statusText) {
        statusText.textContent = String(message);
    }
}

function setAssistantState(state) {
    if (assistantState) {
        assistantState.textContent =
            String(state || "SYSTEM READY");
    }

    if (mascotFrame) {
        mascotFrame.classList.remove(
            "listening",
            "thinking",
            "speaking"
        );

        if (state === "LISTENING") {
            mascotFrame.classList.add("listening");
        } else if (state === "THINKING") {
            mascotFrame.classList.add("thinking");
        } else if (state === "SPEAKING") {
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

function detectLanguage(text) {
    const value = String(text || "");

    if (/[\u0980-\u09FF]/.test(value)) {
        return "bn";
    }

    if (/[\u0900-\u097F]/.test(value)) {
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

function getReply(language, english, bengali, hindi) {
    if (language === "bn") return bengali;
    if (language === "hi") return hindi;
    return english;
}

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// ==========================================
// 5. CHAT MESSAGE SYSTEM
// ==========================================

function addMessage(message, type) {
    if (!chat) return;

    const item = document.createElement("div");

    item.className = "message " + type;
    item.textContent = String(message);

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
// 6. CONVERSATION MEMORY
// ==========================================

function loadConversationMemory() {
    try {
        const saved = localStorage.getItem(MEMORY_KEY);

        if (!saved) return;

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            conversationHistory = parsed.slice(-MAX_HISTORY);
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

function clearConversation() {
    conversationHistory = [];

    try {
        localStorage.removeItem(MEMORY_KEY);
    } catch (error) {
        console.warn("Memory clear error:", error);
    }

    if (chat) {
        chat.textContent = "";
    }

    const language = lastDetectedLanguage;

    showBotMessage(
        getReply(
            language,
            "Chat history cleared. How can I help you?",
            "চ্যাট হিস্ট্রি মুছে দেওয়া হয়েছে। কীভাবে সাহায্য করতে পারি?",
            "चैट हिस्ट्री साफ कर दी गई है। मैं आपकी कैसे मदद कर सकता हूँ?"
        )
    );

    setReadyState();
}

// ==========================================
// 7. OFFLINE BRAIN — GREETINGS
// ==========================================

function handleGreeting(language) {
    return getReply(
        language,
        "Hello! I am PowNin. How can I help you?",
        "হ্যালো! আমি PowNin। তোমাকে কীভাবে সাহায্য করতে পারি?",
        "नमस्ते! मैं PowNin हूँ। आपकी कैसे मदद कर सकता हूँ?"
    );
}

// ==========================================
// 8. OFFLINE BRAIN — IDENTITY
// ==========================================

function handleIdentity(language) {
    return getReply(
        language,
        "I am PowNin, your personal Android AI assistant.",
        "আমি PowNin, তোমার ব্যক্তিগত Android AI Assistant।",
        "मैं PowNin हूँ, आपका व्यक्तिगत Android AI Assistant।"
    );
}

// ==========================================
// 9. DATE AND TIME
// ==========================================

function handleTime(language) {
    const time = new Date().toLocaleTimeString(
        getLanguageCode(language)
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
        "I can help with greetings, date, time, calculations and basic offline commands. More Android features are being developed.",
        "আমি greeting, তারিখ, সময়, হিসাব ও সাধারণ offline command-এ সাহায্য করতে পারি। আরও Android ফিচার তৈরি হচ্ছে।",
        "मैं अभिवादन, तारीख, समय, गणना और सामान्य offline commands में मदद कर सकता हूँ। अन्य Android सुविधाएँ तैयार हो रही हैं।"
    );
}

// ==========================================
// 11. THANKS
// ==========================================

function handleThanks(language) {
    return getReply(
        language,
        "You're welcome! I am ready to help.",
        "স্বাগতম! আমি সাহায্য করার জন্য প্রস্তুত।",
        "आपका स्वागत है! मैं मदद के लिए तैयार हूँ।"
    );
}

// ==========================================
// 12. LANGUAGE SELECTION
// ==========================================

function handleLanguageCommand(text, language) {
    const value = normalizeText(text);

    if (
        value.includes("বাংলা ভাষা") ||
        value.includes("বাংলায় কথা") ||
        value.includes("bangla mode")
    ) {
        selectedLanguage = "bn";
        return "বাংলা ভাষা নির্বাচন করা হয়েছে।";
    }

    if (
        value.includes("हिंदी भाषा") ||
        value.includes("हिंदी में") ||
        value.includes("hindi mode")
    ) {
        selectedLanguage = "hi";
        return "हिंदी भाषा चुनी गई है।";
    }

    if (
        value.includes("english mode") ||
        value.includes("speak english")
    ) {
        selectedLanguage = "en";
        return "English language selected.";
    }

    if (
        value === "auto language" ||
        value === "automatic language"
    ) {
        selectedLanguage = "auto";

        return getReply(
            language,
            "Automatic language detection enabled.",
            "স্বয়ংক্রিয় ভাষা শনাক্তকরণ চালু হয়েছে।",
            "स्वचालित भाषा पहचान चालू कर दी गई है।"
        );
    }

    return null;
}

// ==========================================
// 13. CALCULATOR INTEGRATION
// ==========================================

function handleCalculation(command, language) {
    const math = window.PowninMath;

    if (!math) {
        return null;
    }

    try {
        // First try the advanced solver.
        if (typeof math.solve === "function") {
            const solved = math.solve(command);

            if (solved && solved.success === true) {
                let answer = solved.answer;

                if (Array.isArray(answer)) {
                    answer = answer.join(", ");
                }

                if (answer === null || answer === undefined) {
                    answer = "No real solution";
                }

                return getReply(
                    language,
                    "The answer is " + answer,
                    "উত্তর হলো " + answer,
                    "उत्तर है " + answer
                );
            }
        }

        // Fallback to the basic calculator.
        if (typeof math.calculate === "function") {
            const result = math.calculate(command);

            if (result !== null &&
                result !== undefined &&
                result !== false) {
                return getReply(
                    language,
                    "The answer is " + result,
                    "উত্তর হলো " + result,
                    "उत्तर है " + result
                );
            }
        }

        return null;

    } catch (error) {
        console.error("Pownin Math Error:", error);
        return null;
    }
}

// ==========================================
// POWNIN SMART APP CONTROL v1.0
// ==========================================

function handleAppCommand(command, language) {

    const text = normalizeText(command);

    const apps = [
        {
            name: "youtube",
            words: ["youtube", "ইউটিউব", "यूट्यूब"]
        },
        {
            name: "whatsapp",
            words: ["whatsapp", "হোয়াটসঅ্যাপ", "व्हाट्सएप"]
        },
        {
            name: "chrome",
            words: ["chrome", "google chrome", "ক্রোম"]
        },
        {
            name: "maps",
            words: ["google maps", "maps", "ম্যাপস", "मैप्स"]
        },
        {
            name: "settings",
            words: ["settings", "সেটিংস", "सेटिंग्स"]
        },
        {
            name: "camera",
            words: ["camera", "ক্যামেরা", "कैमरा"]
        },
        {
            name: "calculator",
            words: ["calculator", "ক্যালকুলেটর", "कैलकुलेटर"]
        },
        {
            name: "phone",
            words: ["phone", "dialer", "ফোন", "फोन"]
        },
        {
            name: "files",
            words: ["file manager", "files", "ফাইল", "फ़ाइल"]
        }
    ];

    const openPatterns = [
        /\b(open|launch|start)\b/i,
        /\b(kholo|khul|khule dao|chalu koro)\b/i
    ];

    const hasOpenCommand =
        openPatterns.some(pattern => pattern.test(text)) ||
        text.includes("খোলো") ||
        text.includes("খুলে দাও") ||
        text.includes("চালু করো") ||
        text.includes("खोलो") ||
        text.includes("खोल दो") ||
        text.includes("शुरू करो");

    if (!hasOpenCommand) {
        return null;
    }

    const selectedApp = apps.find(app =>
        app.words.some(word => text.includes(word))
    );

    if (!selectedApp) {
        return null;
    }

    const bridge = getPowninAndroidBridge();

    if (!bridge || typeof bridge.openApp !== "function") {
        return getReply(
            language,
            "Android App Control is unavailable.",
            "Android App Control এখন উপলব্ধ নয়।",
            "Android App Control अभी उपलब्ध नहीं है।"
        );
    }

    try {

        const result = bridge.openApp(selectedApp.name);

        if (result === "OPENING") {
            return getReply(
                language,
                "Opening " + selectedApp.name + ".",
                selectedApp.name + " খোলা হচ্ছে।",
                selectedApp.name + " खोला जा रहा है।"
            );
        }

        if (result === "APP_NOT_FOUND") {
            return getReply(
                language,
                selectedApp.name + " is not installed or unavailable.",
                selectedApp.name + " অ্যাপটি পাওয়া যায়নি।",
                selectedApp.name + " ऐप उपलब्ध नहीं है।"
            );
        }

        return getReply(
            language,
            "Unable to open " + selectedApp.name + ".",
            selectedApp.name + " খোলা যাচ্ছে না।",
            selectedApp.name + " नहीं खुल पाया।"
        );

    } catch (error) {

        console.error("POWNIN APP CONTROL ERROR:", error);

        return getReply(
            language,
            "App Control error.",
            "App Control-এ সমস্যা হয়েছে।",
            "App Control में समस्या हुई।"
        );
    }
}

// ==========================================
// 14. OFFLINE COMMAND ROUTER
// ==========================================

function getOfflineReply(command) {
    const text = normalizeText(command);
    const language = getActiveLanguage(command);

    if (!text) {
        return getReply(
            language,
            "Please enter a message.",
            "অনুগ্রহ করে কিছু লিখো।",
            "कृपया कुछ लिखें।"
        );
    }

    // Language selection
    const languageReply =
        handleLanguageCommand(text, language);

    if (languageReply !== null) {
        return languageReply;
    }

    // Greetings
    if (
        /^(hi|hello|hey|হ্যালো|হাই|নমস্কার|नमस्ते|हेलो)$/i.test(text)
    ) {
        return handleGreeting(language);
    }

    // Identity
    if (
        text.includes("who are you") ||
        text.includes("your name") ||
        text.includes("তুমি কে") ||
        text.includes("তোমার নাম") ||
        text.includes("তোমার নাম কি") ||
        text.includes("आप कौन हैं") ||
        text.includes("तुम कौन हो") ||
        text.includes("तुम्हारा नाम")
    ) {
        return handleIdentity(language);
    }

    // Time
    if (
        /\btime\b/i.test(text) ||
        text.includes("সময়") ||
        text.includes("সময়") ||
        text.includes("সময় কত") ||
        text.includes("समय")
    ) {
        return handleTime(language);
    }

    // Date
    if (
        /\b(date|today)\b/i.test(text) ||
        text.includes("আজ") ||
        text.includes("তারিখ") ||
        text.includes("আজকে") ||
        text.includes("आज") ||
        text.includes("तारीख")
    ) {
        return handleDate(language);
    }

    // Help
    if (
        text === "help" ||
        text.includes("সাহায্য") ||
        text.includes("মদদ") ||
        text.includes("मदद")
    ) {
        return handleHelp(language);
    }

    // Thanks
    if (
        text.includes("thank you") ||
        text.includes("thanks") ||
        text.includes("ধন্যবাদ") ||
        text.includes("शुक्रिया") ||
        text.includes("धन्यवाद")
    ) {
        return handleThanks(language);
    }

    // Calculator
    const calculation =
        handleCalculation(command, language);

    if (calculation !== null) {
        return calculation;
    }

    // Unknown command
    return getReply(
        language,
        "I don't know that yet. My offline brain is still learning. Online AI is not configured yet.",
        "এই প্রশ্নের উত্তর এখনো আমার জানা নেই। আমার Offline Brain আরও শিখছে। Online AI এখনো যুক্ত করা হয়নি।",
        "मुझे अभी इसका उत्तर नहीं पता। मेरा Offline Brain अभी सीख रहा है। Online AI अभी कॉन्फ़िगर नहीं हुआ है।"
    );
}

// ==========================================
// PART 1 END
// APPEND PART 2 BELOW THIS LINE
// ==========================================


/* =========================================================
   POWNIN SMART BRAIN v3.0
   PART 2/3 — NATIVE ANDROID VOICE ENGINE
   ========================================================= */

// ==========================================
// 15. ANDROID BRIDGE CHECK
// ==========================================

function getPowninAndroidBridge() {
    try {
        if (
            window.PowninAndroid &&
            typeof window.PowninAndroid.speak === "function" &&
            typeof window.PowninAndroid.startListening === "function"
        ) {
            return window.PowninAndroid;
        }

    } catch (error) {
        console.warn("Android bridge error:", error);
    }

    return null;
}

// ==========================================
// 16. VOICE LANGUAGE
// ==========================================

function getVoiceLanguage(text) {
    if (selectedLanguage !== "auto") {
        return getLanguageCode(selectedLanguage);
    }

    const detected = detectLanguage(text || "");

    lastDetectedLanguage = detected;

    return getLanguageCode(detected);
}

function getListeningLanguage() {
    if (selectedLanguage !== "auto") {
        return getLanguageCode(selectedLanguage);
    }

    return getLanguageCode(lastDetectedLanguage);
}

// ==========================================
// 17. NATIVE TEXT TO SPEECH
// ==========================================

function speakReply(message) {
    if (!speechEnabled) return;

    const text = String(message || "").trim();

    if (!text) return;

    const bridge = getPowninAndroidBridge();

    if (!bridge) {
        console.warn("Native Android voice bridge unavailable.");
        setStatus("VOICE UNAVAILABLE");
        setAssistantState("SYSTEM READY");
        return;
    }

    try {
        const language = getVoiceLanguage(text);

        setAssistantState("SPEAKING");
        setStatus("VOICE OUTPUT");

        bridge.speak(text, language);

        isSpeaking = true;

    } catch (error) {
        console.error("Native TTS error:", error);

        isSpeaking = false;

        setStatus("VOICE ERROR");
        setAssistantState("SYSTEM READY");
    }
}

// ==========================================
// 18. STOP NATIVE VOICE
// ==========================================

function stopPowninVoice() {
    speechEnabled = false;
    isSpeaking = false;

    const bridge = getPowninAndroidBridge();

    try {
        if (bridge) {
            bridge.stopSpeaking();
            bridge.stopListening();
        }

    } catch (error) {
        console.warn("Voice stop error:", error);
    }

    isListening = false;

    setStatus("VOICE STOPPED");
    setAssistantState("SYSTEM READY");
}

// ==========================================
// 19. ENABLE VOICE
// ==========================================

function enablePowninVoice() {
    speechEnabled = true;

    setStatus("VOICE READY");
    setAssistantState("SYSTEM READY");
}

// ==========================================
// 20. START NATIVE MICROPHONE
// ==========================================

function startPowninListening() {
    const bridge = getPowninAndroidBridge();

    if (!bridge) {
        setStatus("VOICE NOT CONNECTED");

        showBotMessage(
            getReply(
                lastDetectedLanguage,
                "Native Android microphone is unavailable.",
                "Native Android মাইক্রোফোন সংযুক্ত নেই।",
                "Native Android माइक्रोफोन उपलब्ध नहीं है।"
            )
        );

        return;
    }

    try {
        speechEnabled = true;

        const language = getListeningLanguage();

        setStatus("LISTENING");
        setAssistantState("LISTENING");

        isListening = true;

        bridge.startListening(language);

    } catch (error) {
        console.error("Microphone start error:", error);

        isListening = false;

        setStatus("MICROPHONE ERROR");
        setAssistantState("SYSTEM READY");
    }
}

// ==========================================
// 21. NATIVE SPEECH RESULT CALLBACK
// ==========================================

window.onNativeSpeechResult = function(text) {
    const spokenText = String(text || "").trim();

    isListening = false;

    setAssistantState("THINKING");
    setStatus("PROCESSING");

    if (!spokenText) {
        setReadyState();
        return;
    }

    lastDetectedLanguage = detectLanguage(spokenText);

    if (input) {
        input.value = spokenText;
    }

    if (typeof processCommand === "function") {
        processCommand(spokenText);
    }
};

// ==========================================
// 22. NATIVE SPEECH ERROR CALLBACK
// ==========================================

window.onNativeSpeechError = function(message) {
    console.warn("Native speech error:", message);

    isListening = false;
    isSpeaking = false;

    setStatus("VOICE ERROR");
    setAssistantState("SYSTEM READY");

    const language = lastDetectedLanguage;

    showBotMessage(
        getReply(
            language,
            "Voice error: " + String(message || "Unknown error"),
            "ভয়েস সমস্যা: " + String(message || "অজানা সমস্যা"),
            "वॉइस समस्या: " + String(message || "अज्ञात समस्या")
        )
    );
};

// ==========================================
// 23. NATIVE LISTENING CALLBACK
// ==========================================

window.onNativeListening = function() {
    isListening = true;

    setStatus("LISTENING");
    setAssistantState("LISTENING");
};

// ==========================================
// 24. NATIVE TTS READY CALLBACK
// ==========================================

window.onNativeTtsReady = function() {
    console.log("POWNIN Native TTS Ready");

    setStatus("VOICE READY");
};

// ==========================================
// 25. VOICE ENGINE STATUS
// ==========================================

function isPowninVoiceAvailable() {
    const bridge = getPowninAndroidBridge();

    if (!bridge) return false;

    try {
        return bridge.isVoiceReady() === true;

    } catch (error) {
        console.warn("Voice status error:", error);
        return false;
    }
}

// ==========================================
// PART 2 END
// APPEND PART 3 BELOW THIS LINE
// ==========================================


/* =========================================================
   POWNIN SMART BRAIN v3.0
   PART 3/3 — COMMAND ROUTER + UI + INITIALIZATION
   ========================================================= */

// ==========================================
// 26. MAIN COMMAND PROCESSOR
// ==========================================

function processCommand(command) {
    const text = String(command || "").trim();

    if (!text || isProcessing) return;

    if (text.length > 2000) {
        showBotMessage(
            "Message is too long. Please use a shorter message."
        );
        return;
    }

    isProcessing = true;

    const language = getActiveLanguage(text);
    lastDetectedLanguage = language;

    showUserMessage(text);
    saveConversation("user", text);

    setStatus("THINKING");
    setAssistantState("THINKING");

    try {
        let reply = "";

        if (currentMode === "offline") {
            reply = getOfflineReply(text);

        } else {
            reply = getOfflineReply(text);

            if (currentMode === "online") {
                reply = getReply(
                    language,
                    "Online AI is not configured yet. Please use Offline mode.",
                    "Online AI এখনো সংযুক্ত করা হয়নি। আপাতত Offline mode ব্যবহার করো।",
                    "Online AI अभी कॉन्फ़िगर नहीं हुआ है। कृपया Offline mode इस्तेमाल करें।"
                );

            } else if (currentMode === "hybrid") {
                reply = getReply(
                    language,
                    "Hybrid mode is selected, but its online AI service is not configured yet. I can still answer basic offline commands.",
                    "Hybrid mode নির্বাচন করা হয়েছে, কিন্তু Online AI service এখনো যুক্ত হয়নি। আমি সাধারণ Offline command-এর উত্তর দিতে পারি।",
                    "Hybrid mode चुना गया है, लेकिन Online AI service अभी कॉन्फ़िगर नहीं हुई है। मैं सामान्य Offline commands का जवाब दे सकता हूँ।"
                );
            }
        }

        showBotMessage(reply);
        saveConversation("assistant", reply);

        setStatus("READY");

        if (speechEnabled) {
            speakReply(reply);
        } else {
            setAssistantState("SYSTEM READY");
        }

    } catch (error) {
        console.error("POWNIN COMMAND ERROR:", error);

        showBotMessage(
            "Sorry, something went wrong. Please try again."
        );

        setStatus("ERROR");
        setAssistantState("SYSTEM READY");

    } finally {
        isProcessing = false;
    }
}

// ==========================================
// 27. AI MODE SYSTEM
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

    if (modeLabel) {
        modeLabel.textContent = mode.toUpperCase();
    }

    Object.keys(modeButtons).forEach(function(key) {
        const button = modeButtons[key];

        if (!button) return;

        button.classList.toggle(
            "active",
            key === mode
        );
    });

    setStatus("MODE: " + mode.toUpperCase());

    if (mode === "offline") {
        showBotMessage(
            getReply(
                lastDetectedLanguage,
                "Offline mode activated.",
                "Offline mode চালু হয়েছে।",
                "Offline mode चालू हो गया है।"
            )
        );

    } else if (mode === "online") {
        showBotMessage(
            getReply(
                lastDetectedLanguage,
                "Online mode selected. Online AI service is not configured yet.",
                "Online mode নির্বাচন করা হয়েছে। Online AI service এখনো যুক্ত হয়নি।",
                "Online mode चुना गया है। Online AI service अभी कॉन्फ़िगर नहीं हुई है।"
            )
        );

    } else {
        showBotMessage(
            getReply(
                lastDetectedLanguage,
                "Hybrid mode selected. Online AI service is not configured yet.",
                "Hybrid mode নির্বাচন করা হয়েছে। Online AI service এখনো যুক্ত হয়নি।",
                "Hybrid mode चुना गया है। Online AI service अभी कॉन्फ़िगर नहीं हुई है।"
            )
        );
    }

    setAssistantState("SYSTEM READY");

    return true;
}

// ==========================================
// 28. SEND MESSAGE
// ==========================================

function sendMessage() {
    if (!input) return;

    const message = input.value.trim();

    if (!message) return;

    input.value = "";

    processCommand(message);
}

// ==========================================
// 29. MODE BUTTON EVENTS
// ==========================================

if (modeButtons.offline) {
    modeButtons.offline.addEventListener("click", function() {
        setPowninMode("offline");
    });
}

if (modeButtons.online) {
    modeButtons.online.addEventListener("click", function() {
        setPowninMode("online");
    });
}

if (modeButtons.hybrid) {
    modeButtons.hybrid.addEventListener("click", function() {
        setPowninMode("hybrid");
    });
}

// ==========================================
// 30. SEND BUTTON EVENT
// ==========================================

if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
}

if (input) {
    input.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
}

// ==========================================
// 31. VOICE BUTTON EVENT
// ==========================================

if (voiceBtn) {
    voiceBtn.addEventListener("click", function() {
        startPowninListening();
    });
}

// ==========================================
// 32. STOP BUTTON EVENT
// ==========================================

if (stopBtn) {
    stopBtn.addEventListener("click", function() {
        stopPowninVoice();
    });
}

// ==========================================
// 33. CLEAR CHAT EVENT
// ==========================================

const clearChatButton = document.getElementById("clearChatBtn");

if (clearChatButton) {
    clearChatButton.addEventListener("click", function() {
        clearConversation();
        restoreConversationDisplay();
    });
}

// ==========================================
// 34. RESTORE CHAT MEMORY
// ==========================================

function restoreConversationDisplay() {
    if (!chat) return;

    chat.textContent = "";

    conversationHistory.forEach(function(item) {
        if (!item || !item.role) return;

        const type =
            item.role === "user" ? "user" : "bot";

        addMessage(item.content, type);
    });

    if (conversationHistory.length === 0) {
        showBotMessage(
            "Hello! How can I help you today?"
        );
    }
}

// ==========================================
// 35. APP INITIALIZATION
// ==========================================

function initializePownin() {
    try {
        loadConversationMemory();
        restoreConversationDisplay();

        currentMode = "offline";

        if (modeLabel) {
            modeLabel.textContent = "OFFLINE";
        }

        Object.keys(modeButtons).forEach(function(key) {
            if (!modeButtons[key]) return;

            modeButtons[key].classList.toggle(
                "active",
                key === "offline"
            );
        });

        setReadyState();

        console.log(
            "POWNIN initialized. Version:",
            POWNIN_VERSION
        );

        console.log(
            "Calculator:",
            window.PowninMath ? "AVAILABLE" : "NOT AVAILABLE"
        );

        console.log(
            "Android Bridge:",
            getPowninAndroidBridge()
                ? "AVAILABLE"
                : "NOT AVAILABLE"
        );

        console.log(
            "Native Voice:",
            isPowninVoiceAvailable()
                ? "READY"
                : "WAITING"
        );

    } catch (error) {
        console.error(
            "POWNIN INITIALIZATION ERROR:",
            error
        );

        setStatus("INITIALIZATION ERROR");
    }
}

// ==========================================
// 36. GLOBAL ERROR HANDLING
// ==========================================

window.addEventListener("error", function(event) {
    console.error(
        "POWNIN JAVASCRIPT ERROR:",
        event.message,
        event.filename,
        event.lineno
    );
});

window.addEventListener(
    "unhandledrejection",
    function(event) {
        console.error(
            "POWNIN PROMISE ERROR:",
            event.reason
        );
    }
);

// ==========================================
// 37. START APPLICATION
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializePownin
    );
} else {
    initializePownin();
}

// ==========================================
// POWNIN SMART BRAIN v3.0 COMPLETE
// ==========================================
