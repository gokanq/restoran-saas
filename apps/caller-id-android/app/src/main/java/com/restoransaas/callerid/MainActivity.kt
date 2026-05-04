package com.restoransaas.callerid

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var store: DeviceConfigStore
    private lateinit var baseUrlInput: EditText
    private lateinit var deviceKeyInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var statusText: TextView

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
            setPadding(40, 48, 40, 40)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val title = TextView(this).apply {
            text = "Restoran SaaS Caller ID"
            textSize = 24f
            setTypeface(null, 1)
        }

        val subtitle = TextView(this).apply {
            text = "Cihaz anahtarını kaydet, test araması gönder ve gelen aramaları backend'e ilet."
            textSize = 14f
        }

        baseUrlInput = EditText(this).apply {
            hint = "Base URL"
            setText(store.getBaseUrl())
        }

        deviceKeyInput = EditText(this).apply {
            hint = "Cihaz anahtarı"
            setText(store.getDeviceKey())
        }

        phoneInput = EditText(this).apply {
            hint = "Test telefon"
            setText("05320001122")
        }

        val saveButton = Button(this).apply {
            text = "Ayarları Kaydet"
            setOnClickListener {
                store.setBaseUrl(baseUrlInput.text.toString())
                store.setDeviceKey(deviceKeyInput.text.toString())
                statusText.text = "Ayarlar kaydedildi."
            }
        }

        val testButton = Button(this).apply {
            text = "Test Event Gönder"
            setOnClickListener {
                sendTestEvent()
            }
        }

        statusText = TextView(this).apply {
            text = "Hazır."
            textSize = 13f
        }

        root.addView(title)
        root.addView(subtitle)
        root.addView(baseUrlInput)
        root.addView(deviceKeyInput)
        root.addView(phoneInput)
        root.addView(saveButton)
        root.addView(testButton)
        root.addView(statusText)

        setContentView(root)
    }

    private fun sendTestEvent() {
        val baseUrl = baseUrlInput.text.toString()
        val deviceKey = deviceKeyInput.text.toString()
        val phone = phoneInput.text.toString()

        statusText.text = "Gönderiliyor..."

        thread {
            val result = CallerEventApi().sendIncomingCall(
                baseUrl = baseUrl,
                deviceKey = deviceKey,
                phone = phone,
                rawState = "MANUAL_TEST"
            )

            runOnUiThread {
                statusText.text = if (result.first) {
                    "Başarılı: ${result.second}"
                } else {
                    "Hata: ${result.second}"
                }
            }
        }
    }
}
