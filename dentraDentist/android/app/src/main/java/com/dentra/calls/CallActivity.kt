package com.dentra.calls

import android.app.PictureInPictureParams
import android.app.PictureInPictureUiState
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.lifecycle.Lifecycle
import com.facebook.react.ReactActivity
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.common.LifecycleState
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType

open class CallActivity : ReactActivity() {
  private var pictureInPictureWasVisible = false
  private var renderingInPictureInPicture = false

  private fun updatePictureInPictureRendering() {
    val context = CallState.reactContext.get() ?: return
    if (!context.hasActiveReactInstance()) return
    val renderer = UIManagerHelper.getUIManager(context, UIManagerType.FABRIC)
      as? LifecycleEventListener ?: return
    val visible = CallState.active &&
      (CallState.inPictureInPicture || CallState.enteringPictureInPicture) &&
      lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
    if (visible) {
      // ReactActivity pauses Fabric on Home, although the PiP activity is still visible.
      // Keep only its UI renderer running; AppState and media lifecycle stay unchanged.
      renderer.onHostResume()
      renderingInPictureInPicture = true
    } else if (renderingInPictureInPicture) {
      renderingInPictureInPicture = false
      if (context.lifecycleState != LifecycleState.RESUMED) renderer.onHostPause()
    }
  }

  private fun preparePictureInPicture() {
    CallState.enteringPictureInPicture = true
    updatePictureInPictureRendering()
    CallState.emit()
  }

  fun updateCallPictureInPicture() {
    updatePictureInPictureRendering()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        !packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
    val params = PictureInPictureParams.Builder().setAspectRatio(Rational(9, 16))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setAutoEnterEnabled(CallState.active)
      params.setSeamlessResizeEnabled(true)
    }
    try { setPictureInPictureParams(params.build()) }
    catch (_: IllegalStateException) { /* The audio call can continue without PiP. */ }
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (!CallState.active || Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        !packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
    preparePictureInPicture()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      val entered = try {
        enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(9, 16)).build())
      } catch (_: IllegalStateException) { false }
      if (!entered) {
        CallState.enteringPictureInPicture = false
        updatePictureInPictureRendering()
        CallState.emit()
      }
    }
  }

  override fun onPictureInPictureUiStateChanged(pipState: PictureInPictureUiState) {
    super.onPictureInPictureUiStateChanged(pipState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM &&
        pipState.isTransitioningToPip && CallState.active) preparePictureInPicture()
  }

  override fun onPause() {
    super.onPause()
    updatePictureInPictureRendering()
  }

  override fun onPictureInPictureModeChanged(inPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(inPictureInPictureMode, newConfig)
    CallState.inPictureInPicture = inPictureInPictureMode
    CallState.enteringPictureInPicture = false
    updatePictureInPictureRendering()
    if (inPictureInPictureMode) pictureInPictureWasVisible = true
    else Handler(Looper.getMainLooper()).post {
      // Expanding PiP resumes the activity; dismissing it leaves the activity stopped.
      if (pictureInPictureWasVisible && !isInPictureInPictureMode &&
          !lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
        pictureInPictureWasVisible = false
        CallState.end(this, "pip_closed")
      }
    }
    CallState.emit()
  }

  override fun onStop() {
    super.onStop()
    CallState.enteringPictureInPicture = false
    updatePictureInPictureRendering()
    if (!isInPictureInPictureMode) {
      CallState.inPictureInPicture = false
      updatePictureInPictureRendering()
      CallState.emit()
    }
    if (pictureInPictureWasVisible && !isInPictureInPictureMode) {
      pictureInPictureWasVisible = false
      CallState.end(this, "pip_closed")
    }
  }

  override fun onResume() {
    super.onResume()
    if (!isInPictureInPictureMode) {
      pictureInPictureWasVisible = false
      CallState.inPictureInPicture = false
      CallState.enteringPictureInPicture = false
      CallState.emit()
    }
    updateCallPictureInPicture()
  }
}
