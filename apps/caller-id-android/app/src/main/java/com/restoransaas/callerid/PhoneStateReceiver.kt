package com.restoransaas.callerid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import kotlin.concurrent.thread

class PhoneStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            return
        }

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return

        if (state != TelephonyManager.EXTRA_STATE_RINGING) {
            return
        }

        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: return

        val store = DeviceConfigStore(context)
        val baseUrl = store.getBaseUrl()
        val deviceKey = store.getDeviceKey()

        thread {
            CallerEventApi().sendIncomingCall(
                baseUrl = baseUrl,
                deviceKey = deviceKey,
                phone = incomingNumber,
                rawState = state
            )
        }
    }
}
