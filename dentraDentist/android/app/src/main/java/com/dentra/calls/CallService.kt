package com.dentra.calls

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/** Keeps only an explicitly joined call alive. Never restarts a call after process death. */
class CallService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private val expire = Runnable { CallState.end(this, "deadline") }

  override fun onBind(intent: Intent?) = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val remaining = CallState.expiresAt - System.currentTimeMillis()
    if (remaining <= 0) { stopSelf(); return START_NOT_STICKY }
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel("dentra_active_call", "Active consultation", NotificationManager.IMPORTANCE_LOW))
      }
      val launch = packageManager.getLaunchIntentForPackage(packageName)!!.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val open = PendingIntent.getActivity(this, 10, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val notification = NotificationCompat.Builder(this, "dentra_active_call")
        .setSmallIcon(android.R.drawable.sym_call_incoming)
        .setContentTitle("Video consultation")
        .setContentText("Call in progress. Tap to return to Dentra.")
        .setContentIntent(open).setOngoing(true).setCategory(NotificationCompat.CATEGORY_CALL)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE).build()
      var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
        types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
      ServiceCompat.startForeground(this, 9871, notification, types)
      handler.removeCallbacks(expire)
      handler.postDelayed(expire, remaining)
      if (wakeLock?.isHeld != true) {
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:consultation")
        wakeLock?.acquire(remaining.coerceAtMost(3 * 60 * 60 * 1000L))
      }
    } catch (_: Exception) {
      CallState.end(this, "background_unavailable")
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    CallState.end(this, "task_removed")
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (wakeLock?.isHeld == true) wakeLock?.release()
    wakeLock = null
    super.onDestroy()
  }
}
