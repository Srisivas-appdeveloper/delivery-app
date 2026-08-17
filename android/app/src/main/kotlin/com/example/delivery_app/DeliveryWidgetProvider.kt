package com.example.delivery_app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class DeliveryWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "DeliveryAppWidgetPrefs"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, DeliveryWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val storeName = prefs.getString("store_name", "No active orders") ?: "No active orders"
            val status = prefs.getString("status", "IDLE") ?: "IDLE"
            val eta = prefs.getString("eta", "--") ?: "--"
            val distance = prefs.getString("distance", "--") ?: "--"
            val address = prefs.getString("address", "Ready to deliver") ?: "Ready to deliver"
            val rider = prefs.getString("rider", "🛵 Velox") ?: "🛵 Velox"

            val views = RemoteViews(context.packageName, R.layout.delivery_widget_layout)

            views.setTextViewText(R.id.widget_store_name, storeName)
            views.setTextViewText(R.id.widget_status, status.replace("_", " ").uppercase())
            views.setTextViewText(R.id.widget_eta, eta)
            views.setTextViewText(R.id.widget_distance, distance)
            views.setTextViewText(R.id.widget_address, address)
            views.setTextViewText(R.id.widget_rider, rider)

            // Click Intent to open App
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
