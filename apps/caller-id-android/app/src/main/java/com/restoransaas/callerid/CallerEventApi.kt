package com.restoransaas.callerid

import android.os.Build
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class CallerEventApi {
    data class DeviceSetupResult(
        val success: Boolean,
        val deviceKey: String,
        val message: String
    )

    fun sendIncomingCall(
        baseUrl: String,
        deviceKey: String,
        phone: String,
        rawState: String = "RINGING"
    ): Pair<Boolean, String> {
        if (baseUrl.isBlank()) return Pair(false, "Base URL boş.")
        if (deviceKey.isBlank()) return Pair(false, "Cihaz anahtarı boş.")
        if (phone.isBlank()) return Pair(false, "Telefon numarası boş.")

        val endpoint = buildEndpoint(baseUrl, "/api/caller-device-events/incoming")
        val connection = URL(endpoint).openConnection() as HttpURLConnection

        return try {
            val safeModel = "${Build.MANUFACTURER} ${Build.MODEL}".replace("\"", "")
            val body = JSONObject()
                .put("phone", phone)
                .put("source", "ANDROID_CALLER_ID")
                .put(
                    "payload",
                    JSONObject()
                        .put("appVersion", "0.1.0")
                        .put("platform", "android")
                        .put("deviceModel", safeModel)
                        .put("eventType", "incoming_call")
                        .put("rawState", rawState)
                )
                .toString()

            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
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

    fun loginAndCreateDevice(
        baseUrl: String,
        email: String,
        password: String
    ): DeviceSetupResult {
        if (baseUrl.isBlank()) return DeviceSetupResult(false, "", "Base URL boş.")
        if (email.trim().isBlank()) return DeviceSetupResult(false, "", "Panel e-posta boş.")
        if (password.trim().isBlank()) return DeviceSetupResult(false, "", "Panel şifresi boş.")

        val loginResult = login(baseUrl, email.trim(), password.trim())

        if (!loginResult.success || loginResult.token.isBlank()) {
            return DeviceSetupResult(false, "", loginResult.message)
        }

        val registerResult = createCallerDevice(baseUrl, loginResult.token)

        if (!registerResult.success || registerResult.deviceKey.isBlank()) {
            return DeviceSetupResult(false, "", registerResult.message)
        }

        return DeviceSetupResult(
            success = true,
            deviceKey = registerResult.deviceKey,
            message = registerResult.message
        )
    }

    private data class LoginResult(
        val success: Boolean,
        val token: String,
        val message: String
    )

    private data class RegisterResult(
        val success: Boolean,
        val deviceKey: String,
        val message: String
    )

    private fun login(baseUrl: String, email: String, password: String): LoginResult {
        val endpoint = buildEndpoint(baseUrl, "/api/auth/login")
        val connection = URL(endpoint).openConnection() as HttpURLConnection

        return try {
            val body = JSONObject()
                .put("email", email)
                .put("password", password)
                .toString()

            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(body)
                writer.flush()
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader()?.use { it.readText() } ?: ""

            if (code !in 200..299) {
                return LoginResult(false, "", "Login başarısız. HTTP $code $responseText")
            }

            val token = JSONObject(responseText).optString("accessToken", "")

            if (token.isBlank()) {
                LoginResult(false, "", "Login başarılı fakat token alınamadı.")
            } else {
                LoginResult(true, token, "Login başarılı.")
            }
        } catch (error: Exception) {
            LoginResult(false, "", error.message ?: "Login bağlantı hatası.")
        } finally {
            connection.disconnect()
        }
    }

    private fun createCallerDevice(baseUrl: String, token: String): RegisterResult {
        val endpoint = buildEndpoint(baseUrl, "/api/caller-devices")
        val connection = URL(endpoint).openConnection() as HttpURLConnection

        return try {
            val model = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
            val deviceName = "Android Caller ID - $model"

            val body = JSONObject()
                .put("name", deviceName)
                .toString()

            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(body)
                writer.flush()
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader()?.use { it.readText() } ?: ""

            if (code !in 200..299) {
                return RegisterResult(false, "", "Cihaz oluşturulamadı. HTTP $code $responseText")
            }

            val json = JSONObject(responseText)
            val deviceKey = json.optString("deviceKey", "")
            val deviceId = json.optString("id", "")

            if (deviceKey.isBlank()) {
                RegisterResult(false, "", "Cihaz oluşturuldu fakat deviceKey alınamadı.")
            } else {
                RegisterResult(true, deviceKey, "Device ID: $deviceId")
            }
        } catch (error: Exception) {
            RegisterResult(false, "", error.message ?: "Cihaz oluşturma bağlantı hatası.")
        } finally {
            connection.disconnect()
        }
    }

    private fun buildEndpoint(baseUrl: String, pathWithApi: String): String {
        val cleanBaseUrl = baseUrl.trim().trimEnd('/')

        return if (cleanBaseUrl.endsWith("/api")) {
            cleanBaseUrl + pathWithApi.removePrefix("/api")
        } else {
            cleanBaseUrl + pathWithApi
        }
    }
}