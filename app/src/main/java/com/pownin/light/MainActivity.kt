package com.pownin.light

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
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

    private var ttsReady = false
    private var pendingText: String? = null
    private var pendingLanguage = "en-IN"

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

    // TEXT TO SPEECH

    private fun setupTextToSpeech() {

        textToSpeech = TextToSpeech(this) { status ->

            if (status == TextToSpeech.SUCCESS) {

                ttsReady = true

                pendingText?.let { text ->
                    speakNative(text, pendingLanguage)
                    pendingText = null
                }

                notifyJavascript("onNativeTtsReady")

            } else {

                notifyJavascript(
                    "onNativeSpeechError",
                    "TTS initialization failed"
                )
            }
        }
    }

    private fun speakNative(
        text: String,
        language: String
    ) {

        if (!ttsReady || text.isBlank()) return

        val locale = when (language) {
            "bn-IN" -> Locale.forLanguageTag("bn-IN")
            "hi-IN" -> Locale.forLanguageTag("hi-IN")
            else -> Locale.forLanguageTag("en-IN")
        }

        val result = textToSpeech?.setLanguage(locale)

        if (result == TextToSpeech.LANG_MISSING_DATA ||
            result == TextToSpeech.LANG_NOT_SUPPORTED
        ) {
            notifyJavascript(
                "onNativeSpeechError",
                "Selected TTS language is unavailable"
            )
            return
        }

        textToSpeech?.setSpeechRate(1.0f)
        textToSpeech?.setPitch(0.9f)

        textToSpeech?.speak(
            text,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "POWNIN_SPEECH"
        )
    }

    // SPEECH RECOGNITION

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

                    val matches = results?.getStringArrayList(
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

            if (checkSelfPermission(
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

        } catch (e: Exception) {

            notifyJavascript(
                "onNativeSpeechError",
                e.message ?: "Unable to start listening"
            )
        }
    }

    private fun stopNativeListening() {

        runOnUiThread {

            try {
                speechRecognizer?.cancel()
            } catch (_: Exception) {
            }
        }
    }

    // JAVASCRIPT CALLBACK

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

    // JAVASCRIPT BRIDGE

    inner class PowninBridge {

        @JavascriptInterface
        fun speak(text: String?, language: String?) {

            if (text.isNullOrBlank()) return

            runOnUiThread {

                val lang = language ?: "en-IN"

                if (ttsReady) {
                    speakNative(text, lang)
                } else {
                    pendingText = text
                    pendingLanguage = lang
                }
            }
        }

        @JavascriptInterface
        fun startListening(language: String?) {
            startNativeListening(language ?: "en-IN")
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

        @JavascriptInterface
        fun isVoiceReady(): Boolean {
            return ttsReady &&
                SpeechRecognizer.isRecognitionAvailable(
                    this@MainActivity
                )
        }
    }

    override fun onDestroy() {

        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeJavascriptInterface("PowninAndroid")
            webView.loadUrl("about:blank")
            webView.destroy()
        }

        speechRecognizer?.destroy()
        speechRecognizer = null

        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null

        super.onDestroy()
    }
}
