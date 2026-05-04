package com.restoransaas.callerid

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
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
    private lateinit var deviceKeyInput: EditText
    private lateinit var phoneInput: EditText
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
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 44, 36, 44)
            setBackgroundColor(Color.rgb(245, 247, 250))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val scrollView = ScrollView(this).apply {
            addView(root)
        }

        root.addView(title("Restoran SaaS Caller ID"))
        root.addView(description("Android cihazdan gelen aramaları Restoran SaaS paneline iletir. Test event gönderebilir ve gerçek aramaları yakalayabilir."))

        root.addView(sectionTitle("Bağlantı Ayarları"))

        baseUrlInput = input("Base URL").apply {
            setText(store.getBaseUrl())
        }
        root.addView(baseUrlInput)

        deviceKeyInput = input("Cihaz anahtarı").apply {
            setText(store.getDeviceKey())
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(deviceKeyInput)

        keyToggleButton = secondaryButton("Cihaz Anahtarını Göster") {
            toggleDeviceKeyVisibility()
        }
        root.addView(keyToggleButton)

        phoneInput = input("Test telefon").apply {
            setText("05320001122")
        }
        root.addView(phoneInput)

        root.addView(primaryButton("Ayarları Kaydet") {
            saveSettings()
        })

        root.addView(primaryButton("Test Event Gönder") {
            sendTestEvent()
        })

        root.addView(sectionTitle("Durum"))

        statusText = card(
            if (store.getDeviceKey().isBlank()) {
                "Cihaz anahtarı bekleniyor. Panelden yeni anahtar oluşturup buraya yapıştır."
            } else {
                "Ayarlar yüklendi. Test event gönderebilirsin."
            }
        )
        root.addView(statusText)

        root.addView(description("Not: Gerçek arama testi için telefon ve arama kayıtları izinleri açık olmalıdır. Uygulama arka planda kapanırsa Samsung pil kısıtlamaları etkileyebilir."))

        setContentView(scrollView)
    }

    private fun saveSettings() {
        store.setBaseUrl(baseUrlInput.text.toString())
        store.setDeviceKey(deviceKeyInput.text.toString())

        statusText.text = "Ayarlar kaydedildi. Base URL ve cihaz anahtarı hazır."
        Toast.makeText(this, "Ayarlar kaydedildi", Toast.LENGTH_SHORT).show()
    }

    private fun sendTestEvent() {
        saveSettings()

        val baseUrl = baseUrlInput.text.toString().trim()
        val deviceKey = deviceKeyInput.text.toString().trim()
        val phone = phoneInput.text.toString().trim()

        statusText.text = "Test event gönderiliyor..."

        thread {
            val result = CallerEventApi().sendIncomingCall(
                baseUrl = baseUrl,
                deviceKey = deviceKey,
                phone = phone,
                rawState = "MANUAL_TEST"
            )

            runOnUiThread {
                statusText.text = if (result.first) {
                    "Test event başarılı. ${result.second}"
                } else {
                    "Test event başarısız. ${result.second}"
                }

                Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
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

    private fun title(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 27f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(10, 20, 45))
            setPadding(0, 0, 0, 10)
        }
    }

    private fun description(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 15f
            setTextColor(Color.rgb(65, 80, 110))
            setPadding(0, 0, 0, 24)
        }
    }

    private fun sectionTitle(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 13f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(0, 120, 95))
            letterSpacing = 0.12f
            setPadding(0, 18, 0, 8)
        }
    }

    private fun input(hintText: String): EditText {
        return EditText(this).apply {
            hint = hintText
            textSize = 17f
            setSingleLine(true)
            setPadding(0, 16, 0, 16)
        }
    }

    private fun primaryButton(text: String, action: (View) -> Unit): Button {
        return Button(this).apply {
            this.text = text
            textSize = 15f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, 12, 0, 12)
            setOnClickListener(action)
        }
    }

    private fun secondaryButton(text: String, action: (View) -> Unit): Button {
        return Button(this).apply {
            this.text = text
            textSize = 14f
            setPadding(0, 8, 0, 8)
            setOnClickListener(action)
        }
    }

    private fun card(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 15f
            setTextColor(Color.rgb(20, 35, 65))
            setBackgroundColor(Color.WHITE)
            setPadding(22, 18, 22, 18)
            setTextIsSelectable(true)
        }
    }
}