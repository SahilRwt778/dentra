package com.dentra.patient

import com.dentra.calls.CallBackgroundPackage
import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(CallBackgroundPackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel("dentra_appointments", "Appointment updates", NotificationManager.IMPORTANCE_DEFAULT)
      channel.description = "Appointment updates and reminders from Dentra"
      channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
    loadReactNative(this)
  }
}
