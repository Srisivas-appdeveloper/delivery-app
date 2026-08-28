package com.react_native_app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class TrackingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  companion object {
    private const val PREFS = "tracking_widget"

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TrackingWidgetProvider::class.java))
      ids.forEach { widgetId -> updateWidget(context, manager, widgetId) }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val isActive = prefs.getBoolean("is_active", false)
      val destination = prefs.getString("destination", "No active tracking") ?: "No active tracking"
      val distanceMeters = prefs.getInt("distance_meters", 0)
      val etaMinutes = prefs.getInt("eta_minutes", 0)
      val turnInstruction = prefs.getString("turn_instruction", "Start direction") ?: "Start direction"
      val lat = prefs.getString("latitude", "--") ?: "--"
      val lng = prefs.getString("longitude", "--") ?: "--"

      val views = RemoteViews(context.packageName, R.layout.tracking_widget)
      views.setTextViewText(R.id.widget_status, if (isActive) "NEXT DIRECTION" else "TRACKING PAUSED")
      views.setTextViewText(R.id.widget_instruction, if (isActive) turnInstruction else "Start direction")
      views.setTextViewText(R.id.widget_destination, destination)
      views.setTextViewText(
        R.id.widget_distance,
        if (isActive) "${formatNavigationDistance(distanceMeters)} remaining" else "Start direction in the app",
      )
      views.setTextViewText(R.id.widget_eta, if (isActive) "${etaMinutes} min" else "--")
      views.setTextViewText(R.id.widget_location, "GPS $lat, $lng")

      val intent = Intent(context, MainActivity::class.java)
      val flags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
      views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent, flags))
      manager.updateAppWidget(widgetId, views)
    }
  }
}
