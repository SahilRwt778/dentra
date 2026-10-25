package com.dentra.calls

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

internal object CallState {
  var active = false
  var inPictureInPicture = false
  var enteringPictureInPicture = false
  var expiresAt = 0L
  var reactContext = WeakReference<ReactApplicationContext>(null)

  fun emit(reason: String? = null) {
    val context = reactContext.get() ?: return
    if (!context.hasActiveReactInstance()) return
    val event = Arguments.createMap().apply {
      putBoolean("inPictureInPicture", inPictureInPicture || enteringPictureInPicture)
      if (reason != null) putString("endedReason", reason)
    }
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("DentraCallBackground", event)
  }

  fun end(context: Context, reason: String? = null) {
    active = false
    context.stopService(Intent(context, CallService::class.java))
    if (reason != null) emit(reason)
  }
}
