package com.react_native_app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class TrackingForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val destination = intent?.getStringExtra("destination") ?: "Live tracking"
    val distance = intent?.getIntExtra("distance_meters", 0) ?: 0
    val eta = intent?.getIntExtra("eta_minutes", 0) ?: 0
    startForeground(1001, buildNotification(destination, distance, eta))
    return START_STICKY
  }

  private fun buildNotification(destination: String, distance: Int, eta: Int): Notification {
    val channelId = "live_tracking"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Live tracking",
        NotificationManager.IMPORTANCE_LOW,
      )
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, channelId)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
      }

    return builder
      .setContentTitle("Live tracking active")
      .setContentText("$destination · ${formatNavigationDistance(distance)} · ${eta} min")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .build()
  }
}
