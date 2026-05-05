package com.restoransaas.callerid

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var store: DeviceConfigStore

    private lateinit var baseUrlInput: EditText
    private lateinit var loginEmailInput: EditText
    private lateinit var loginPasswordInput: EditText
    private lateinit var deviceKeyInput: EditText
    private lateinit var phoneInput: EditText

    private lateinit var quickInfoText: TextView
    private lateinit var statusBadge: TextView
    private lateinit var statusText: TextView
    private lateinit var keyToggleButton: Button

    private var isDeviceKeyVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        store = DeviceConfigStore(this)

        requestRuntimePermissions()
        renderUi()
    }

    private fun requestRuntimePermissions() {
        val permissions = arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG
        )

        val missingPermissions = permissions.filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            requestPermissions(missingPermissions.toTypedArray(), 1001)
        }
    }

    private fun renderUi() {
        val isDeviceReady = store.getDeviceKey().isNotBlank()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(24))
            setBackgroundColor(Color.rgb(242, 245, 249))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val scrollView = ScrollView(this).apply {
            addView(root)
        }

        root.addView(heroCard())
        root.addView(withTopMargin(statusSummaryCard(), 12))
        root.addView(withTopMargin(loginCard(), 12))

        if (isDeviceReady) {
            root.addView(withTopMargin(devicePanelCard(), 12))
        } else {
            val lockedCard = createCard()
            lockedCard.addView(sectionTitle("CİHAZ PANELİ"))
            lockedCard.addView(withTopMargin(infoText("Test ve gelişmiş ayarlar için önce panel hesabıyla giriş yap."), 8))
            root.addView(withTopMargin(lockedCard, 12))
        }

        root.addView(withTopMargin(messageCard(isDeviceReady), 12))

        setContentView(scrollView)
        refreshStatusSummary()
    }

    private fun heroCard(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(15), dp(12), dp(15), dp(12))
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.rgb(16, 94, 185), Color.rgb(0, 161, 134))
            ).apply {
                cornerRadius = dp(14).toFloat()
            }
        }

        val title = TextView(this).apply {
            text = "CALLER ID"
            textSize = 25f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
        }

        card.addView(title)
        return card
    }

    private fun loginCard(): LinearLayout {
        val card = createCard()
        card.addView(sectionTitle("PANEL HESABIYLA OTOMATİK KURULUM"))

        card.addView(withTopMargin(fieldLabel("Base URL"), 12))
        baseUrlInput = styledInput("http://213.159.6.179").apply {
            setText(store.getBaseUrl())
        }
        card.addView(baseUrlInput)

        card.addView(withTopMargin(fieldLabel("Panel e-posta"), 12))
        loginEmailInput = styledInput("manager@demo.com").apply {
            setText(store.getLoginEmail())
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        card.addView(loginEmailInput)

        card.addView(withTopMargin(fieldLabel("Panel şifresi"), 12))
        loginPasswordInput = styledInput("Şifreni gir").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        card.addView(loginPasswordInput)

        card.addView(withTopMargin(primaryButton("Giriş Yap") {
            loginAndBindDevice()
        }, 14))

        return card
    }

    private fun statusSummaryCard(): LinearLayout {
        val card = createCard()
        card.addView(sectionTitle("GENEL DURUM"))

        quickInfoText = infoText("")
        card.addView(withTopMargin(quickInfoText, 8))

        statusBadge = badge("Cihaz Hazır", true)
        card.addView(withTopMargin(statusBadge, 12))

        return card
    }

    private fun devicePanelCard(): LinearLayout {
        val panelCard = createCard()
        panelCard.addView(sectionTitle("CİHAZ PANELİ"))

        val testCard = createInnerCard()
        testCard.addView(sectionTitle("TEST VE KONTROL"))

        testCard.addView(withTopMargin(fieldLabel("Test telefon"), 12))
        phoneInput = styledInput("05320001122").apply {
            setText("05320001122")
            inputType = InputType.TYPE_CLASS_PHONE
        }
        testCard.addView(phoneInput)

        testCard.addView(withTopMargin(primaryButton("Test Event Gönder") {
            sendTestEvent()
        }, 14))

        panelCard.addView(withTopMargin(testCard, 14))

        val advancedCard = createInnerCard()
        advancedCard.addView(sectionTitle("GELİŞMİŞ AYARLAR"))

        advancedCard.addView(withTopMargin(fieldLabel("Base URL"), 12))
        baseUrlInput = styledInput("http://213.159.6.179").apply {
            setText(store.getBaseUrl())
        }
        advancedCard.addView(baseUrlInput)

        advancedCard.addView(withTopMargin(fieldLabel("Manuel cihaz anahtarı"), 12))
        deviceKeyInput = styledInput("Cihaz anahtarı").apply {
            setText(store.getDeviceKey())
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        advancedCard.addView(deviceKeyInput)

        keyToggleButton = secondaryButton("Cihaz Anahtarını Göster") {
            toggleDeviceKeyVisibility()
        }
        advancedCard.addView(withTopMargin(keyToggleButton, 12))

        advancedCard.addView(withTopMargin(secondaryButton("Ayarları Kaydet") {
            saveSettings(true)
        }, 12))

        panelCard.addView(withTopMargin(advancedCard, 14))

        return panelCard
    }

    private fun messageCard(isDeviceReady: Boolean): LinearLayout {
        val card = createCard()
        card.addView(sectionTitle("DURUM MESAJI"))

        statusText = infoText(
            if (isDeviceReady) {
                "Hazır."
            } else {
                "Panel hesabı ile giriş bekleniyor."
            }
        )

        card.addView(withTopMargin(statusText, 8))
        return card
    }

    private fun loginAndBindDevice() {
        val baseUrl = baseUrlInput.text.toString().trim()
        val email = loginEmailInput.text.toString().trim()
        val password = loginPasswordInput.text.toString().trim()

        store.setBaseUrl(baseUrl)
        store.setLoginEmail(email)

        if (baseUrl.isBlank() || email.isBlank() || password.isBlank()) {
            setStatusMessage("Base URL, panel e-posta ve şifre gerekli.")
            Toast.makeText(this, "Base URL, e-posta ve şifre gerekli", Toast.LENGTH_LONG).show()
            return
        }

        setStatusMessage("Giriş yapılıyor...")

        thread {
            val result = CallerEventApi().loginAndCreateDevice(
                baseUrl = baseUrl,
                email = email,
                password = password
            )

            runOnUiThread {
                if (result.success) {
                    store.setDeviceKey(result.deviceKey)
                    renderUi()
                    setStatus(
                        badgeText = "Cihaz Hazır",
                        message = "Giriş başarılı. Cihaz panele bağlandı. ${result.message}",
                        positive = true
                    )
                    Toast.makeText(this, "Giriş başarılı", Toast.LENGTH_LONG).show()
                } else {
                    setStatusMessage("Giriş başarısız. ${result.message}")
                    Toast.makeText(this, "Giriş başarısız", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun saveSettings(showToast: Boolean) {
        if (::baseUrlInput.isInitialized) {
            store.setBaseUrl(baseUrlInput.text.toString().trim())
        }

        if (::deviceKeyInput.isInitialized) {
            store.setDeviceKey(deviceKeyInput.text.toString().trim())
        }

        refreshStatusSummary()

        setStatus(
            badgeText = "Kaydedildi",
            message = "Ayarlar kaydedildi.",
            positive = true
        )

        if (showToast) {
            Toast.makeText(this, "Ayarlar kaydedildi", Toast.LENGTH_SHORT).show()
        }
    }

    private fun sendTestEvent() {
        saveSettings(false)

        val baseUrl = store.getBaseUrl()
        val deviceKey = store.getDeviceKey()
        val phone = phoneInput.text.toString().trim()

        if (deviceKey.isBlank()) {
            setStatus(
                badgeText = "Anahtar Gerekli",
                message = "Test için cihaz anahtarı gerekli.",
                positive = false
            )
            Toast.makeText(this, "Cihaz anahtarı gerekli", Toast.LENGTH_LONG).show()
            return
        }

        setStatus(
            badgeText = "Test",
            message = "Test event gönderiliyor...",
            positive = true
        )

        thread {
            val result = CallerEventApi().sendIncomingCall(
                baseUrl = baseUrl,
                deviceKey = deviceKey,
                phone = phone,
                rawState = "MANUAL_TEST"
            )

            runOnUiThread {
                if (result.first) {
                    setStatus(
                        badgeText = "Test Başarılı",
                        message = "Test event başarılı. ${result.second}",
                        positive = true
                    )
                } else {
                    setStatus(
                        badgeText = "Test Hatası",
                        message = "Test event başarısız. ${result.second}",
                        positive = false
                    )
                }

                refreshStatusSummary()
                Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun refreshStatusSummary() {
        if (!::quickInfoText.isInitialized) {
            return
        }

        val email = store.getLoginEmail().ifBlank { "-" }
        val baseUrl = store.getBaseUrl().ifBlank { "-" }
        val hasDeviceKey = store.getDeviceKey().isNotBlank()

        quickInfoText.text = """
            Base URL: $baseUrl

            Panel hesabı: $email

            Cihaz durumu: ${if (hasDeviceKey) "Bağlı / Hazır" else "Giriş bekliyor"}
        """.trimIndent()

        if (::statusBadge.isInitialized) {
            if (hasDeviceKey) {
                applyBadgeStyle(statusBadge, "Cihaz Hazır", true)
            } else {
                applyBadgeStyle(statusBadge, "Giriş Bekliyor", false)
            }
        }
    }

    private fun toggleDeviceKeyVisibility() {
        isDeviceKeyVisible = !isDeviceKeyVisible

        deviceKeyInput.inputType = if (isDeviceKeyVisible) {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        } else {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }

        deviceKeyInput.setSelection(deviceKeyInput.text.length)

        keyToggleButton.text = if (isDeviceKeyVisible) {
            "Cihaz Anahtarını Gizle"
        } else {
            "Cihaz Anahtarını Göster"
        }
    }

    private fun setStatusMessage(message: String) {
        if (::statusText.isInitialized) {
            statusText.text = message
        }
    }

    private fun setStatus(badgeText: String, message: String, positive: Boolean) {
        if (::statusBadge.isInitialized) {
            applyBadgeStyle(statusBadge, badgeText, positive)
        }

        if (::statusText.isInitialized) {
            statusText.text = message
        }
    }

    private fun createCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            background = roundedBackground(Color.WHITE, Color.rgb(225, 232, 242), 16)
        }
    }

    private fun createInnerCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(14))
            background = roundedBackground(Color.rgb(248, 250, 253), Color.rgb(225, 232, 242), 14)
        }
    }

    private fun sectionTitle(textValue: String): TextView {
        return TextView(this).apply {
            text = textValue
            textSize = 13f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(0, 90, 80))
            letterSpacing = 0.12f
        }
    }

    private fun fieldLabel(textValue: String): TextView {
        return TextView(this).apply {
            text = textValue
            textSize = 14f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(20, 32, 55))
        }
    }

    private fun infoText(textValue: String): TextView {
        return TextView(this).apply {
            text = textValue
            textSize = 16f
            setTextColor(Color.rgb(35, 48, 70))
            setLineSpacing(3f, 1.05f)
        }
    }

    private fun styledInput(hintText: String): EditText {
        return EditText(this).apply {
            hint = hintText
            textSize = 17f
            setSingleLine(true)
            setPadding(dp(14), 0, dp(14), 0)
            minHeight = dp(58)
            setTextColor(Color.rgb(20, 32, 55))
            setHintTextColor(Color.rgb(135, 145, 165))
            background = roundedBackground(Color.WHITE, Color.rgb(210, 218, 232), 14)
        }
    }

    private fun primaryButton(textValue: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = textValue
            textSize = 15f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            minHeight = dp(58)
            background = roundedBackground(Color.rgb(0, 118, 112), Color.rgb(0, 118, 112), 14)
            setOnClickListener { onClick() }
        }
    }

    private fun secondaryButton(textValue: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = textValue
            textSize = 15f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(20, 32, 55))
            minHeight = dp(56)
            background = roundedBackground(Color.WHITE, Color.rgb(210, 218, 232), 14)
            setOnClickListener { onClick() }
        }
    }

    private fun badge(textValue: String, positive: Boolean): TextView {
        return TextView(this).apply {
            setPadding(dp(14), dp(8), dp(14), dp(8))
            textSize = 14f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            applyBadgeStyle(this, textValue, positive)
        }
    }

    private fun applyBadgeStyle(view: TextView, textValue: String, positive: Boolean) {
        view.text = textValue
        view.setTextColor(
            if (positive) Color.rgb(0, 95, 70) else Color.rgb(150, 85, 0)
        )
        view.background = roundedBackground(
            if (positive) Color.rgb(205, 245, 230) else Color.rgb(255, 240, 210),
            if (positive) Color.rgb(125, 220, 185) else Color.rgb(245, 190, 85),
            22
        )
    }

    private fun roundedBackground(fillColor: Int, strokeColor: Int, radiusDp: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(radiusDp).toFloat()
            setColor(fillColor)
            setStroke(dp(1), strokeColor)
        }
    }

    private fun withTopMargin(view: View, marginTopDp: Int): View {
        val params = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        params.topMargin = dp(marginTopDp)
        view.layoutParams = params
        return view
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}
