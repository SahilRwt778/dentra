package com.dentra.calls

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState
import com.facebook.react.uimanager.ViewManager
import java.lang.ref.WeakReference

class CallBackgroundModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "DentraCallBackground"
  override fun initialize() { super.initialize(); CallState.reactContext = WeakReference(context) }

  @ReactMethod
  fun start(expiresAt: Double, promise: Promise) {
    context.runOnUiQueueThread {
      if (context.lifecycleState != LifecycleState.RESUMED) {
        promise.reject("CALL_NOT_FOREGROUND", "Open Dentra before joining a call.")
        return@runOnUiQueueThread
      }
      try {
        CallState.expiresAt = expiresAt.toLong()
        ContextCompat.startForegroundService(context, Intent(context, CallService::class.java))
        CallState.active = true
        (context.currentActivity as? CallActivity)?.updateCallPictureInPicture()
        promise.resolve(null)
      } catch (error: Exception) {
        CallState.end(context)
        promise.reject("CALL_BACKGROUND_UNAVAILABLE", "Could not enable background calling.", error)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    context.runOnUiQueueThread {
      CallState.end(context)
      (context.currentActivity as? CallActivity)?.updateCallPictureInPicture()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun getPictureInPictureState(promise: Promise) {
    context.runOnUiQueueThread {
      promise.resolve(CallState.inPictureInPicture || CallState.enteringPictureInPicture)
    }
  }

  @ReactMethod
  fun refresh() {
    if (CallState.active && context.lifecycleState == LifecycleState.RESUMED) {
      try { ContextCompat.startForegroundService(context, Intent(context, CallService::class.java)) }
      catch (_: Exception) { CallState.end(context, "background_unavailable") }
    }
  }

  @ReactMethod fun addListener(name: String) {}
  @ReactMethod fun removeListeners(count: Double) {}

  override fun invalidate() {
    CallState.end(context)
    CallState.reactContext.clear()
    super.invalidate()
  }
}

class CallBackgroundPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(CallBackgroundModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
