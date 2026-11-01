
/* =====================================================
   POWNIN LIGHT v2.0
   SMART BRAIN | PART 1/3
   Languages: Bengali, Hindi, English
   ===================================================== */

"use strict";

// ==========================================
// 1. APP CONFIGURATION
// ==========================================

const POWNIN_VERSION = "2.0";
const MAX_HISTORY = 20;

let conversationHistory = [];
let speechEnabled = true;
let currentMode = "offline";
let selectedLanguage = "auto";
let isProcessing = false;

// ==========================================
// 2. HTML ELEMENTS
// ==========================================

const chat = document.getElementById("chat");
const input = document.getElementById("commandInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");

// ==========================================
// 3. STATUS CONTROL
// ==========================================

function setStatus(message) {
    if (statusText) {
        statusText.textContent = message;
    }
}

// ==========================================
// 4. LANGUAGE DETECTION
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

function getReply(language, english, bengali, hindi) {
    if (language === "bn") return bengali;
    if (language === "hi") return hindi;
    return english;
}

// ==========================================
// 5. TEXT NORMALIZATION
// ==========================================

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// ==========================================
// 6. CHAT MESSAGE SYSTEM
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
// 7. CONVERSATION MEMORY
// ==========================================

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
}

function clearConversation() {
    conversationHistory = [];

    if (chat) {
        chat.textContent = "";
    }

    showBotMessage(
        "Chat cleared. How can I help you?"
    );
}

// ==========================================
// 8. OFFLINE BRAIN - GREETINGS
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
// 9. OFFLINE BRAIN - IDENTITY
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
// 10. OFFLINE BRAIN - DATE AND TIME
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
        getLanguageCode(language)
    );

    return getReply(
        language,
        "Today's date is " + date,
        "আজকের তারিখ " + date,
        "आज की तारीख " + date + " है।"
    );
}

// ==========================================
// PART 1 END
// PART 2 WILL CONTINUE BELOW
// ==========================================


// =====================================================
// POWNIN LIGHT v2.0
// SMART BRAIN | PART 2/3
// =====================================================

// ==========================================
// 11. CALCULATOR INTEGRATION
// ==========================================

function handleCalculation(command, language) {
    if (
        !window.PowninMath ||
        typeof window.PowninMath.calculate !== "function"
    ) {
        return null;
    }

    try {
        const result = window.PowninMath.calculate(command);

        if (
            result === null ||
            result === undefined ||
            result === false
        ) {
            return null;
        }

        return getReply(
            language,
            "The answer is " + result,
            "উত্তর হলো " + result,
            "उत्तर है " + result
        );

    } catch (error) {
        console.error("Calculator error:", error);
        return null;
    }
}

// ==========================================
// 12. HELP COMMAND
// ==========================================

function handleHelp(language) {
    return getReply(
        language,
        "I can help with greetings, date, time, calculations and basic offline commands. Voice and more features are being developed.",
        "আমি greeting, তারিখ, সময়, হিসাব ও সাধারণ offline command-এ সাহায্য করতে পারি। Voice ও আরও ফিচার তৈরি হচ্ছে।",
        "मैं अभिवादन, तारीख, समय, गणना और सामान्य offline commands में मदद कर सकता हूँ। Voice और अन्य सुविधाएँ तैयार हो रही हैं।"
    );
}

// ==========================================
// 13. THANK YOU COMMAND
// ==========================================

function handleThanks(language) {
    return getReply(
        language,
        "You're welcome! I am always ready to help.",
        "স্বাগতম! আমি সাহায্য করার জন্য প্রস্তুত।",
        "आपका स्वागत है! मैं मदद के लिए तैयार हूँ।"
    );
}

// ==========================================
// 14. OFFLINE COMMAND ROUTER
// ==========================================

function getOfflineReply(command) {
    const text = normalizeText(command);
    const language = detectLanguage(command);

    if (!text) {
        return getReply(
            language,
            "Please enter a message.",
            "অনুগ্রহ করে কিছু লিখো।",
            "कृपया कुछ लिखें।"
        );
    }

    // Greeting
    if (
        /^(hi|hello|hey|হ্যালো|হাই|নমস্কার|नमस्ते|हेलो)$/i.test(text)
    ) {
        return handleGreeting(language);
    }

    // Identity
    if (
        text.includes("who are you") ||
        text.includes("তুমি কে") ||
        text.includes("তোমার নাম") ||
        text.includes("तुम कौन हो") ||
        text.includes("तुम्हारा नाम")
    ) {
        return handleIdentity(language);
    }

    // Time
    if (
        /\b(time|সময়|সময়|समय)\b/i.test(text) ||
        text.includes("সময়") ||
        text.includes("সময়") ||
        text.includes("समय")
    ) {
        return handleTime(language);
    }

    // Date
    if (
        /\b(date|today)\b/i.test(text) ||
        text.includes("আজ") ||
        text.includes("তারিখ") ||
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
    const calculation = handleCalculation(
        command,
        language
    );

    if (calculation !== null) {
        return calculation;
    }

    // Unknown command
    return getReply(
        language,
        "I don't know that yet. My offline brain is still learning.",
        "এই প্রশ্নের উত্তর এখনো আমার জানা নেই। আমার Offline Brain আরও শিখছে।",
        "मुझे अभी इसका उत्तर नहीं पता। मेरा Offline Brain अभी सीख रहा है।"
    );
}

// ==========================================
// 15. MAIN COMMAND PROCESSOR
// ==========================================

function processCommand(command) {
    const text = String(command || "").trim();

    if (!text || isProcessing) {
        return;
    }

    isProcessing = true;

    showUserMessage(text);
    saveConversation("user", text);

    setStatus("THINKING");

    try {
        const reply = getOfflineReply(text);

        showBotMessage(reply);
        saveConversation("assistant", reply);

        setStatus("READY");

        if (speechEnabled) {
            speakReply(reply);
        }

    } catch (error) {
        console.error("PowNin Brain Error:", error);

        showBotMessage(
            "Sorry, something went wrong."
        );

        setStatus("ERROR");

    } finally {
        isProcessing = false;
    }
}

// ==========================================
// 16. MODE CONTROL
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

    return true;
}

// ==========================================
// 17. CHAT INPUT CONTROL
// ==========================================

function sendMessage() {
    if (!input) return;

    const message = input.value.trim();

    if (!message) return;

    input.value = "";

    processCommand(message);
}

// ==========================================
// PART 2 END
// PART 3 WILL CONTINUE BELOW
// ==========================================


// =====================================================
// POWNIN LIGHT v2.0
// SMART BRAIN | PART 3/3
// =====================================================

// ==========================================
// 18. VOICE OUTPUT
// ==========================================

function speakReply(message) {
    if (!speechEnabled) return;

    if (!("speechSynthesis" in window)) {
        console.warn("Speech synthesis unavailable.");
        return;
    }

    try {
        window.speechSynthesis.cancel();

        const utterance =
            new SpeechSynthesisUtterance(
                String(message || "")
            );

        const language = detectLanguage(message);

        utterance.lang = getLanguageCode(language);
        utterance.rate = 1.0;
        utterance.pitch = 0.9;
        utterance.volume = 1.0;

        utterance.onerror = function(event) {
            console.warn("TTS error:", event.error);
        };

        window.speechSynthesis.speak(utterance);

    } catch (error) {
        console.error("Voice output error:", error);
    }
}

// ==========================================
// 19. STOP VOICE
// ==========================================

function stopPowninVoice() {
    speechEnabled = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    setStatus("VOICE STOPPED");
}

// ==========================================
// 20. ENABLE VOICE
// ==========================================

function enablePowninVoice() {
    speechEnabled = true;
    setStatus("VOICE READY");
}

// ==========================================
// 21. VOICE INPUT PLACEHOLDER
// Native Android microphone will be added
// through MainActivity in a later step.
// ==========================================

function startPowninListening() {
    setStatus("VOICE NOT CONNECTED");

    const language = selectedLanguage === "auto"
        ? "English, Bengali and Hindi"
        : selectedLanguage;

    showBotMessage(
        "Native microphone setup is pending. Supported languages: " +
        language + "."
    );
}

// ==========================================
// 22. BUTTON EVENTS
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

if (voiceBtn) {
    voiceBtn.addEventListener(
        "click",
        startPowninListening
    );
}

if (stopBtn) {
    stopBtn.addEventListener(
        "click",
        stopPowninVoice
    );
}

// ==========================================
// 23. APP INITIALIZATION
// ==========================================

function initializePownin() {
    setStatus("READY");

    console.log(
        "PowNin initialized. Version:",
        POWNIN_VERSION
    );

    console.log(
        "Math engine:",
        window.PowninMath ? "AVAILABLE" : "NOT LOADED"
    );

    console.log(
        "Speech synthesis:",
        "speechSynthesis" in window
            ? "AVAILABLE"
            : "NOT AVAILABLE"
    );
}

// ==========================================
// 24. ERROR HANDLING
// ==========================================

window.addEventListener("error", function(event) {
    console.error(
        "PowNin JavaScript Error:",
        event.message
    );
});

window.addEventListener(
    "unhandledrejection",
    function(event) {
        console.error(
            "PowNin Promise Error:",
            event.reason
        );
    }
);

// ==========================================
// 25. START APPLICATION
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializePownin
    );
} else {
    initializePownin();
}

// =====================================================
// POWNIN LIGHT v2.0
// APP.JS COMPLETE
// =====================================================
