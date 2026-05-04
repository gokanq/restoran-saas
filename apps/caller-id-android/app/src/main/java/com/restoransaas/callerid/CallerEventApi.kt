package com.restoransaas.callerid

import android.os.Build
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class CallerEventApi {
    fun sendIncomingCall(
        baseUrl: String,
        deviceKey: String,
        phone: String,
        rawState: String = "RINGING"
    ): Pair<Boolean, String> {
        if (baseUrl.isBlank()) {
            return Pair(false, "Base URL boş.")
        }

        if (deviceKey.isBlank()) {
            return Pair(false, "Cihaz anahtarı boş.")
        }

        if (phone.isBlank()) {
            return Pair(false, "Telefon numarası boş.")
        }

        val endpoint = "${baseUrl.trimEnd('/')}/api/caller-device-events/incoming"
        val connection = URL(endpoint).openConnection() as HttpURLConnection

        return try {
            val safePhone = phone.replace("\"", "")
            val safeState = rawState.replace("\"", "")
            val safeModel = "${Build.MANUFACTURER} ${Build.MODEL}".replace("\"", "")

            val body = """
                {
                  "phone": "$safePhone",
                  "source": "ANDROID_CALLER_ID",
                  "payload": {
                    "appVersion": "0.1.0",
                    "platform": "android",
                    "deviceModel": "$safeModel",
                    "eventType": "incoming_call",
                    "rawState": "$safeState"
                  }
                }
            """.trimIndent()

            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("x-caller-device-key", deviceKey)

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(body)
                writer.flush()
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader()?.use { it.readText() } ?: ""

            Pair(code in 200..299, "HTTP $code $responseText")
        } catch (error: Exception) {
            Pair(false, error.message ?: "Bilinmeyen bağlantı hatası.")
        } finally {
            connection.disconnect()
        }
    }
}
