package com.react_native_app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class NearbyPlacesWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_OPEN_PLACE) {
      val placeId = intent.getStringExtra(EXTRA_PLACE_ID)
      if (!placeId.isNullOrBlank()) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
          .edit()
          .putString("selected_widget_place_id", placeId)
          .apply()
      }
      val launchIntent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
      context.startActivity(launchIntent)
    }
  }

  companion object {
    private const val PREFS = "tracking_widget"
    private const val ACTION_OPEN_PLACE = "com.react_native_app.OPEN_NEARBY_PLACE"
    const val EXTRA_PLACE_ID = "place_id"

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, NearbyPlacesWidgetProvider::class.java))
      ids.forEach { widgetId -> updateWidget(context, manager, widgetId) }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val placesJson = prefs.getString("nearby_places", "[]") ?: "[]"
      val count = Regex("\"id\"").findAll(placesJson).count()
      val views = RemoteViews(context.packageName, R.layout.nearby_places_widget)
      views.setTextViewText(R.id.nearby_widget_count, if (count > 0) "$count nearby" else "Open app to load")

      val serviceIntent = Intent(context, NearbyPlacesWidgetService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
      }
      views.setRemoteAdapter(R.id.nearby_widget_stack, serviceIntent)
      views.setEmptyView(R.id.nearby_widget_stack, R.id.nearby_widget_empty)

      val clickIntent = Intent(context, NearbyPlacesWidgetProvider::class.java).apply {
        action = ACTION_OPEN_PLACE
      }
      val flags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
      views.setPendingIntentTemplate(
        R.id.nearby_widget_stack,
        PendingIntent.getBroadcast(context, 2, clickIntent, flags),
      )
      manager.notifyAppWidgetViewDataChanged(widgetId, R.id.nearby_widget_stack)
      manager.updateAppWidget(widgetId, views)
    }
  }
}
