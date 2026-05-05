package com.restoransaas.callerid

import android.content.Context

class DeviceConfigStore(context: Context) {
    private val prefs = context.getSharedPreferences("caller_id_config", Context.MODE_PRIVATE)

    fun getBaseUrl(): String {
        return prefs.getString("base_url", "http://213.159.6.179") ?: "http://213.159.6.179"
    }

    fun setBaseUrl(value: String) {
        prefs.edit().putString("base_url", value.trim().trimEnd('/')).apply()
    }

    fun getDeviceKey(): String {
        return prefs.getString("device_key", "") ?: ""
    }

    fun setDeviceKey(value: String) {
        prefs.edit().putString("device_key", value.trim()).apply()
    }

    fun getLoginEmail(): String {
        return prefs.getString("login_email", "") ?: ""
    }

    fun setLoginEmail(value: String) {
        prefs.edit().putString("login_email", value.trim()).apply()
    }
}