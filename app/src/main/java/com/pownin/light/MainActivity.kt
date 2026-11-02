package com.pownin.light

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null

    private var ttsReady = false
    private var pendingText: String? = null
    private var pendingLanguage = "en-IN"

    private var currentLanguage = "en-IN"
    private var voiceStyle = "gaming"

    private var voiceRate = 1.05f
    private var voicePitch = 0.92f

    // ==========================================
    // MICROPHONE PERMISSION
    // ==========================================

    private val audioPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->

            if (granted) {
                launchRecognition(pendingLanguage)
            } else {
                notifyJavascript(
                    "onNativeSpeechError",
                    "Microphone permission denied"
                )
            }
        }

    // ==========================================
    // ACTIVITY CREATE
    // ==========================================

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setupTextToSpeech()
        setupSpeechRecognizer()

        setContent {

            AndroidView(
                modifier = Modifier.fillMaxSize(),

                factory = { context ->

                    webView = WebView(context)

                    webView.settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        allowFileAccess = true
                        allowContentAccess = false
                        allowFileAccessFromFileURLs = false
                        allowUniversalAccessFromFileURLs = false
                        javaScriptCanOpenWindowsAutomatically = false
                        setSupportMultipleWindows(false)

                        mixedContentMode =
                            WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    }

                    webView.webChromeClient = WebChromeClient()
                    webView.webViewClient = WebViewClient()

                    webView.addJavascriptInterface(
                        PowninBridge(),
                        "PowninAndroid"
                    )

                    webView.loadUrl(
                        "file:///android_asset/index.html"
                    )

                    webView
                }
            )
        }
    }

    // ==========================================
    // TEXT TO SPEECH INITIALIZATION
    // ==========================================

    private fun setupTextToSpeech() {

        textToSpeech = TextToSpeech(this) { status ->

            if (status == TextToSpeech.SUCCESS) {

                ttsReady = true

                applyVoiceSettings()
                setTtsLanguageNative(currentLanguage)

                pendingText?.let { text ->

                    val language = pendingLanguage

                    pendingText = null

                    speakNative(text, language)
                }

                notifyJavascript("onNativeTtsReady")

            } else {

                ttsReady = false

                notifyJavascript(
                    "onNativeSpeechError",
                    "TTS initialization failed"
                )
            }
        }
    }

    // ==========================================
    // VOICE STYLE SETTINGS
    // ==========================================

    private fun applyVoiceSettings() {

        val tts = textToSpeech ?: return
        if (!ttsReady) return

        when (voiceStyle.lowercase(Locale.ROOT)) {

            "gaming" -> {
                voiceRate = 1.05f
                voicePitch = 0.92f
            }

            "normal" -> {
                voiceRate = 1.0f
                voicePitch = 1.0f
            }

            "calm" -> {
                voiceRate = 0.90f
                voicePitch = 0.95f
            }

            else -> {
                voiceRate = 1.0f
                voicePitch = 1.0f
            }
        }

        tts.setSpeechRate(voiceRate)
        tts.setPitch(voicePitch)
    }

    private fun setTtsLanguageNative(language: String): Boolean {

        val locale = when (language) {

            "bn-IN" -> Locale.forLanguageTag("bn-IN")

            "hi-IN" -> Locale.forLanguageTag("hi-IN")

            else -> Locale.forLanguageTag("en-IN")
        }

        currentLanguage = language

        val tts = textToSpeech ?: return false
        if (!ttsReady) return false

        val result = tts.setLanguage(locale)

        return result != TextToSpeech.LANG_MISSING_DATA &&
            result != TextToSpeech.LANG_NOT_SUPPORTED
    }

    // ==========================================
    // NATIVE SPEAK
    // ==========================================

    private fun speakNative(
        text: String,
        language: String
    ) {

        if (text.isBlank()) return

        if (!ttsReady) {
            pendingText = text
            pendingLanguage = language
            return
        }

        val languageReady = setTtsLanguageNative(language)

        if (!languageReady) {

            notifyJavascript(
                "onNativeSpeechError",
                "Selected TTS language is unavailable"
            )

            return
        }

        applyVoiceSettings()

        textToSpeech?.speak(
            text,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "POWNIN_SPEECH"
        )
    }

    // ==========================================
    // SPEECH RECOGNIZER SETUP
    // ==========================================

    private fun setupSpeechRecognizer() {

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            return
        }

        speechRecognizer =
            SpeechRecognizer.createSpeechRecognizer(this)

        speechRecognizer?.setRecognitionListener(

            object : RecognitionListener {

                override fun onReadyForSpeech(params: Bundle?) {
                    notifyJavascript("onNativeListening")
                }

                override fun onBeginningOfSpeech() {}

                override fun onRmsChanged(rmsdB: Float) {}

                override fun onBufferReceived(buffer: ByteArray?) {}

                override fun onEndOfSpeech() {}

                override fun onError(error: Int) {

                    notifyJavascript(
                        "onNativeSpeechError",
                        "Speech recognition error: $error"
                    )
                }

                override fun onResults(results: Bundle?) {

                    val matches =
                        results?.getStringArrayList(
                            SpeechRecognizer.RESULTS_RECOGNITION
                        )

                    val spokenText = matches?.firstOrNull()

                    if (!spokenText.isNullOrBlank()) {

                        notifyJavascript(
                            "onNativeSpeechResult",
                            spokenText
                        )

                    } else {

                        notifyJavascript(
                            "onNativeSpeechError",
                            "No speech detected"
                        )
                    }
                }

                override fun onPartialResults(
                    partialResults: Bundle?
                ) {}

                override fun onEvent(
                    eventType: Int,
                    params: Bundle?
                ) {}
            }
        )
    }

    // ==========================================
    // START NATIVE LISTENING
    // ==========================================

    private fun startNativeListening(language: String) {

        runOnUiThread {

            pendingLanguage = language

            if (!SpeechRecognizer.isRecognitionAvailable(this)) {

                notifyJavascript(
                    "onNativeSpeechError",
                    "Speech recognition unavailable"
                )

                return@runOnUiThread
            }

            if (
                checkSelfPermission(
                    Manifest.permission.RECORD_AUDIO
                ) != PackageManager.PERMISSION_GRANTED
            ) {

                audioPermissionLauncher.launch(
                    Manifest.permission.RECORD_AUDIO
                )

                return@runOnUiThread
            }

            launchRecognition(language)
        }
    }

    private fun launchRecognition(language: String) {

        try {

            if (speechRecognizer == null) {
                setupSpeechRecognizer()
            }

            val intent = Intent(
                RecognizerIntent.ACTION_RECOGNIZE_SPEECH
            ).apply {

                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                )

                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE,
                    language
                )

                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,
                    language
                )

                putExtra(
                    RecognizerIntent.EXTRA_PARTIAL_RESULTS,
                    false
                )

                putExtra(
                    RecognizerIntent.EXTRA_MAX_RESULTS,
                    3
                )
            }

            speechRecognizer?.startListening(intent)

        } catch (error: Exception) {

            notifyJavascript(
                "onNativeSpeechError",
                error.message ?: "Unable to start listening"
            )
        }
    }

    // ==========================================
    // STOP NATIVE LISTENING
    // ==========================================

    private fun stopNativeListening() {

        runOnUiThread {

            try {
                speechRecognizer?.cancel()
            } catch (_: Exception) {
            }
        }
    }

    // PART 1 END — CONTINUE WITH PART 2

    
// ==========================================
// SMART APP CONTROL
// ==========================================

    private fun launchAppFromCommand(
        appName: String
    ): String {

        val key = appName.trim().lowercase(Locale.ROOT)

        val intent: Intent? = when (key) {

            "youtube" ->
                packageManager.getLaunchIntentForPackage(
                    "com.google.android.youtube"
                )

            "chrome" ->
                packageManager.getLaunchIntentForPackage(
                    "com.android.chrome"
                )

            "whatsapp" ->
                packageManager.getLaunchIntentForPackage(
                    "com.whatsapp"
                )

            "maps" ->
                packageManager.getLaunchIntentForPackage(
                    "com.google.android.apps.maps"
                )

            "settings" ->
                Intent(
                    android.provider.Settings.ACTION_SETTINGS
                )

            "phone" ->
                Intent(Intent.ACTION_DIAL)

            "camera" ->
                Intent(
                    MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA
                )

            "calculator" ->
                Intent(Intent.ACTION_MAIN).apply {
                    addCategory(
                        Intent.CATEGORY_APP_CALCULATOR
                    )
                }

            "files" ->
                Intent(Intent.ACTION_MAIN).apply {
                    addCategory(
                        Intent.CATEGORY_APP_FILES
                    )
                }

            else -> null
        }

        if (intent == null) {
            return "APP_NOT_FOUND"
        }

        return try {

            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
            )

            runOnUiThread {

                try {
                    startActivity(intent)

                } catch (error: Exception) {

                    notifyJavascript(
                        "onNativeAppError",
                        error.message ?: "Unable to open app"
                    )
                }
            }

            "OPENING"

        } catch (error: Exception) {
            "ERROR"
        }
    }

// ==========================================
// JAVASCRIPT CALLBACK
// ==========================================

    private fun notifyJavascript(
        function: String,
        message: String? = null
    ) {

        if (!::webView.isInitialized) return

        runOnUiThread {

            val script = if (message == null) {

                "window.$function && window.$function();"

            } else {

                val safeMessage =
                    org.json.JSONObject.quote(message)

                "window.$function && window.$function($safeMessage);"
            }

            webView.evaluateJavascript(script, null)
        }
    }

// ==========================================
// JAVASCRIPT BRIDGE
// ==========================================

    inner class PowninBridge {

        // JavaScript should call speak(text, language).
        @JavascriptInterface
        fun speak(
            text: String?,
            language: String?
        ) {

            if (text.isNullOrBlank()) return

            val selectedLang =
                language?.takeIf { it.isNotBlank() }
                    ?: currentLanguage

            runOnUiThread {

                if (ttsReady) {

                    speakNative(text, selectedLang)

                } else {

                    pendingText = text
                    pendingLanguage = selectedLang
                }
            }
        }

        @JavascriptInterface
        fun startListening(language: String?) {

            startNativeListening(
                language ?: currentLanguage
            )
        }

        @JavascriptInterface
        fun stopListening() {
            stopNativeListening()
        }

        @JavascriptInterface
        fun stopSpeaking() {

            runOnUiThread {
                textToSpeech?.stop()
            }
        }

        // GAMING / NORMAL / CALM VOICE STYLE

        @JavascriptInterface
        fun setVoiceStyle(style: String?): Boolean {

            if (style.isNullOrBlank()) return false

            val normalized =
                style.trim().lowercase(Locale.ROOT)

            if (
                normalized !in listOf(
                    "gaming",
                    "normal",
                    "calm"
                )
            ) {
                return false
            }

            runOnUiThread {

                voiceStyle = normalized
                applyVoiceSettings()
            }

            return true
        }

        // CHANGE TTS LANGUAGE

        @JavascriptInterface
        fun setTtsLanguage(language: String?): Boolean {

            val normalized = when (language) {

                "bn-IN", "bn" -> "bn-IN"

                "hi-IN", "hi" -> "hi-IN"

                "en-IN", "en" -> "en-IN"

                else -> return false
            }

            currentLanguage = normalized

            runOnUiThread {

                if (ttsReady) {
                    setTtsLanguageNative(normalized)
                }
            }

            return true
        }

        @JavascriptInterface
        fun isVoiceReady(): Boolean {

            return ttsReady &&
                SpeechRecognizer.isRecognitionAvailable(
                    this@MainActivity
                )
        }

        // SMART APP CONTROL

        @JavascriptInterface
        fun openApp(appName: String?): String {

            if (appName.isNullOrBlank()) {
                return "INVALID_APP"
            }

            return launchAppFromCommand(appName)
        }
    }

// ==========================================
// ACTIVITY DESTROY
// ==========================================

    override fun onDestroy() {

        if (::webView.isInitialized) {

            webView.stopLoading()

            webView.removeJavascriptInterface(
                "PowninAndroid"
            )

            webView.loadUrl("about:blank")
            webView.destroy()
        }

        speechRecognizer?.destroy()
        speechRecognizer = null

        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null

        ttsReady = false

        super.onDestroy()
    }
}
