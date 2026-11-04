package com.pownin.light

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.media.AudioManager
import android.os.Bundle
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
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

    // ==========================================
    // SPEECH SESSION SAFETY
    // ==========================================

    private var speechSessionId = 0
    private var activeSpeechSessionId = 0
    private var speechSessionActive = false
    private var permissionRequestSessionId = 0

    // ==========================================
    // TEXT TO SPEECH STATE
    // ==========================================

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

            val requestedSession = permissionRequestSessionId

            if (
                !speechSessionActive ||
                requestedSession != activeSpeechSessionId
            ) {
                return@registerForActivityResult
            }

            if (granted) {
                launchRecognition(
                    pendingLanguage,
                    requestedSession
                )
            } else {
                finishSpeechSession(requestedSession)

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

                // CHECK AVAILABLE TTS VOICES

                val availableVoices = textToSpeech?.voices

                android.util.Log.d(
                    "POWNIN_TTS",
                    "TOTAL VOICES: ${availableVoices?.size ?: 0}"
                )

                availableVoices?.forEach { voice ->

                    android.util.Log.d(
                        "POWNIN_TTS",
                        "Voice: ${voice.name} | " +
                            "Language: ${voice.locale} | " +
                            "Quality: ${voice.quality}"
                    )
                }

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

                android.util.Log.e(
                    "POWNIN_TTS",
                    "TextToSpeech initialization failed. Status: $status"
                )

                notifyJavascript(
                    "onNativeSpeechError",
                    "TTS initialization failed"
                )
            }
        }
    }

    // ==========================================
    // TTS LANGUAGE
    // ==========================================

    private fun setTtsLanguageNative(
        language: String
    ): Boolean {

        val locale = when (
            language.trim().lowercase(Locale.ROOT)
        ) {

            "bn", "bn-in" -> Locale("bn", "IN")
            "hi", "hi-in" -> Locale("hi", "IN")
            "en", "en-in" -> Locale("en", "IN")

            else -> Locale("en", "IN")
        }

        val tts = textToSpeech ?: return false

        return try {

            val availability = tts.isLanguageAvailable(locale)

            if (availability < TextToSpeech.LANG_AVAILABLE) {
                false
            } else {
                tts.language = locale
                true
            }

        } catch (error: Exception) {
            false
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

            "deep" -> {
                voiceRate = 0.90f
                voicePitch = 0.85f
            }

            else -> {
                voiceRate = 1.0f
                voicePitch = 1.0f
            }
        }

        tts.setSpeechRate(voiceRate)
        tts.setPitch(voicePitch)
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

        val languageReady =
            setTtsLanguageNative(language)

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
    // SPEECH SESSION VALIDATION
    // ==========================================

    private fun isCurrentSpeechSession(
        sessionId: Int
    ): Boolean {

        return speechSessionActive &&
            activeSpeechSessionId == sessionId
    }

    private fun finishSpeechSession(
        sessionId: Int
    ) {

        if (activeSpeechSessionId != sessionId) {
            return
        }

        speechSessionActive = false
    }

    // ==========================================
    // SPEECH RECOGNIZER SETUP
    // ==========================================

    private fun setupSpeechRecognizer(
        sessionId: Int
    ): Boolean {

        try {

            speechRecognizer?.destroy()
            speechRecognizer = null

            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                return false
            }

            val recognizer =
                SpeechRecognizer.createSpeechRecognizer(this)

            speechRecognizer = recognizer

            recognizer.setRecognitionListener(

                object : RecognitionListener {

                    override fun onReadyForSpeech(params: Bundle?) {

                        if (!isCurrentSpeechSession(sessionId)) return

                        notifyJavascript("onNativeListening")
                    }

                    override fun onBeginningOfSpeech() {
                        if (!isCurrentSpeechSession(sessionId)) return
                    }

                    override fun onRmsChanged(rmsdB: Float) {}

                    override fun onBufferReceived(buffer: ByteArray?) {}

                    override fun onEndOfSpeech() {}

                    override fun onError(error: Int) {

                        if (!isCurrentSpeechSession(sessionId)) return

                        finishSpeechSession(sessionId)

                        notifyJavascript(
                            "onNativeSpeechError",
                            "Speech recognition error: $error"
                        )
                    }

                    override fun onResults(results: Bundle?) {

                        if (!isCurrentSpeechSession(sessionId)) return

                        val matches =
                            results?.getStringArrayList(
                                SpeechRecognizer.RESULTS_RECOGNITION
                            )

                        val spokenText = matches?.firstOrNull()

                        finishSpeechSession(sessionId)

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

            return true

        } catch (error: Exception) {

            return false
        }
    }

    // ==========================================
    // START NATIVE LISTENING
    // ==========================================

    private fun startNativeListening(language: String) {

        runOnUiThread {

            speechSessionId++

            val newSessionId = speechSessionId

            activeSpeechSessionId = newSessionId
            speechSessionActive = true
            pendingLanguage = language
            permissionRequestSessionId = newSessionId

            if (!SpeechRecognizer.isRecognitionAvailable(this)) {

                finishSpeechSession(newSessionId)

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

            launchRecognition(language, newSessionId)
        }
    }

    // ==========================================
    // LAUNCH RECOGNITION
    // ==========================================

    private fun launchRecognition(
        language: String,
        sessionId: Int
    ) {

        if (!isCurrentSpeechSession(sessionId)) return

        try {

            val recognizerReady =
                setupSpeechRecognizer(sessionId)

            if (!recognizerReady) {

                finishSpeechSession(sessionId)

                notifyJavascript(
                    "onNativeSpeechError",
                    "Unable to create speech recognizer"
                )

                return
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

            if (!isCurrentSpeechSession(sessionId)) return

            speechRecognizer?.startListening(intent)

        } catch (error: Exception) {

            if (!isCurrentSpeechSession(sessionId)) return

            finishSpeechSession(sessionId)

            notifyJavascript(
                "onNativeSpeechError",
                error.message ?: "Unable to start listening"
            )
        }
    }

    // ==========================================
    // STOP NATIVE LISTENING
    // INVALIDATE OLD SESSION
    // ==========================================

    private fun stopNativeListening() {

        runOnUiThread {

            speechSessionId++

            activeSpeechSessionId = speechSessionId
            speechSessionActive = false
            permissionRequestSessionId = 0

            try {
                speechRecognizer?.cancel()
            } catch (_: Exception) {
            }

            try {
                speechRecognizer?.destroy()
            } catch (_: Exception) {
            }

            speechRecognizer = null
        }
    }

    // ==========================================
    // SMART APP DISCOVERY
    // ==========================================

    private fun findInstalledApp(
        requestedName: String
    ): ResolveInfo? {

        val query = requestedName
            .trim()
            .lowercase(Locale.ROOT)

        if (query.isBlank()) return null

        val launcherIntent = Intent(
            Intent.ACTION_MAIN
        ).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val installedApps = packageManager
            .queryIntentActivities(launcherIntent, 0)

        // Exact app name match

        val exactMatch = installedApps.firstOrNull { info ->

            val label = info.loadLabel(packageManager)
                .toString()
                .trim()
                .lowercase(Locale.ROOT)

            label == query
        }

        if (exactMatch != null) {
            return exactMatch
        }

        // Partial app name match

        return installedApps.firstOrNull { info ->

            val label = info.loadLabel(packageManager)
                .toString()
                .trim()
                .lowercase(Locale.ROOT)

            label.contains(query)
        }
    }

    // ==========================================
    // SMART APP LAUNCHER
    // ==========================================

    private fun launchAppFromCommand(
        appName: String
    ): String {

        val key = appName.trim()
            .lowercase(Locale.ROOT)

        if (key.isBlank()) {
            return "INVALID_APP"
        }

        return try {

            // Known application shortcuts

            val knownIntent: Intent? = when (key) {

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

                "maps", "google maps" ->
                    packageManager.getLaunchIntentForPackage(
                        "com.google.android.apps.maps"
                    )

                "settings" ->
                    Intent(
                        android.provider.Settings.ACTION_SETTINGS
                    )

                "phone", "dialer" ->
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

                "files", "file manager" ->
                    Intent(Intent.ACTION_MAIN).apply {
                        addCategory(
                            Intent.CATEGORY_APP_FILES
                        )
                    }

                else -> null
            }

            // Discover other installed launcher apps

            val appIntent = knownIntent ?: run {

                val appInfo = findInstalledApp(key)
                    ?: return "APP_NOT_FOUND"

                val activityInfo = appInfo.activityInfo
                    ?: return "APP_NOT_FOUND"

                Intent(Intent.ACTION_MAIN).apply {

                    addCategory(Intent.CATEGORY_LAUNCHER)

                    setClassName(
                        activityInfo.packageName,
                        activityInfo.name
                    )
                }
            }

            appIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
            )

            // Launch on Android UI thread

            runOnUiThread {

                try {

                    startActivity(appIntent)

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

    // ==========================================
    // TEXT TO SPEECH
    // ==========================================

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

    // ==========================================
    // SPEECH RECOGNITION
    // ==========================================

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

    // ==========================================
    // STOP VOICE
    // ==========================================

    @JavascriptInterface
    fun stopSpeaking() {

        runOnUiThread {
            textToSpeech?.stop()
        }
    }

    // ==========================================
    // GAMING / NORMAL / DEEP VOICE STYLE
    // ==========================================

    @JavascriptInterface
    fun setVoiceStyle(style: String?): Boolean {

        if (style.isNullOrBlank()) {
            return false
        }

        val normalized =
            style.trim().lowercase(Locale.ROOT)

        if (
            normalized !in listOf(
                "gaming",
                "normal",
                "deep"
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

    // ==========================================
    // CHANGE TTS LANGUAGE
    // ==========================================

    @JavascriptInterface
    fun setTtsLanguage(language: String?): Boolean {

        val normalized = when (
            language?.lowercase(Locale.ROOT)
        ) {

            "bn-in", "bn" -> "bn-IN"

            "hi-in", "hi" -> "hi-IN"

            "en-in", "en" -> "en-IN"

            else -> return false
        }

        runOnUiThread {

            currentLanguage = normalized

            if (ttsReady) {
                setTtsLanguageNative(normalized)
            }
        }

        return true
    }

    // ==========================================
    // ANDROID MEDIA VOLUME CONTROL
    // ==========================================

    @JavascriptInterface
    fun adjustVolume(action: String?): Boolean {

        return try {

            val audioManager =
                getSystemService(AudioManager::class.java)
                    ?: return false

            val stream = AudioManager.STREAM_MUSIC

            when (action?.lowercase(Locale.ROOT)) {

                "up" -> audioManager.adjustStreamVolume(
                    stream,
                    AudioManager.ADJUST_RAISE,
                    AudioManager.FLAG_SHOW_UI
                )

                "down" -> audioManager.adjustStreamVolume(
                    stream,
                    AudioManager.ADJUST_LOWER,
                    AudioManager.FLAG_SHOW_UI
                )

                "mute" -> audioManager.adjustStreamVolume(
                    stream,
                    AudioManager.ADJUST_MUTE,
                    AudioManager.FLAG_SHOW_UI
                )

                "unmute" -> audioManager.adjustStreamVolume(
                    stream,
                    AudioManager.ADJUST_UNMUTE,
                    AudioManager.FLAG_SHOW_UI
                )

                else -> return false
            }

            true

        } catch (error: Exception) {

            false
        }
    }

    // ==========================================
    // CHECK VOICE READY
    // ==========================================

    @JavascriptInterface
    fun isVoiceReady(): Boolean {

        return ttsReady &&
            SpeechRecognizer.isRecognitionAvailable(
                this@MainActivity
            )
    }

    // ==========================================
    // SMART APP CONTROL
    // ==========================================

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

        speechSessionId++
        activeSpeechSessionId = speechSessionId
        speechSessionActive = false
        permissionRequestSessionId = 0

        if (::webView.isInitialized) {

            webView.stopLoading()

            webView.removeJavascriptInterface(
                "PowninAndroid"
            )

            webView.loadUrl("about:blank")
            webView.destroy()
        }

        try {
            speechRecognizer?.cancel()
        } catch (_: Exception) {
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
