package com.react_native_app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONArray
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

class TrackingMapWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_REFRESH -> {
        val manager = AppWidgetManager.getInstance(context)
        val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
          updateWidget(context, manager, widgetId)
        } else {
          updateAll(context)
        }
      }
      ACTION_ZOOM_IN, ACTION_ZOOM_OUT -> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = prefs.getInt("map_zoom_bias", 0)
        val next =
          if (intent.action == ACTION_ZOOM_OUT) {
            min(6, current + 1)
          } else {
            max(-2, current - 1)
          }
        prefs.edit().putInt("map_zoom_bias", next).apply()
        val manager = AppWidgetManager.getInstance(context)
        val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
          updateWidget(context, manager, widgetId)
        } else {
          updateAll(context)
        }
      }
    }
  }

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    updateWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    private const val PREFS = "tracking_widget"
    private const val ACTION_REFRESH = "com.react_native_app.MAP_WIDGET_REFRESH"
    private const val ACTION_ZOOM_IN = "com.react_native_app.MAP_WIDGET_ZOOM_IN"
    private const val ACTION_ZOOM_OUT = "com.react_native_app.MAP_WIDGET_ZOOM_OUT"

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TrackingMapWidgetProvider::class.java))
      ids.forEach { widgetId -> updateWidget(context, manager, widgetId) }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val isActive = prefs.getBoolean("is_active", false)
      val destination = prefs.getString("destination", "No active tracking") ?: "No active tracking"
      val distanceMeters = prefs.getInt("distance_meters", 0)
      val etaMinutes = prefs.getInt("eta_minutes", 0)
      val turnInstruction = prefs.getString("turn_instruction", "Start direction") ?: "Start direction"
      val lat = prefs.getFloat("latitude_value", 0f)
      val lng = prefs.getFloat("longitude_value", 0f)
      val destLat = prefs.getFloat("destination_latitude_value", 0f)
      val destLng = prefs.getFloat("destination_longitude_value", 0f)
      val heading = prefs.getFloat("heading", 0f)
      val zoomBias = prefs.getInt("map_zoom_bias", 0)
      val routeJson = prefs.getString("route_points", "[]") ?: "[]"
      val options = manager.getAppWidgetOptions(widgetId)
      val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
      val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
      val density = context.resources.displayMetrics.density
      val bitmapWidth = max(360, ceil(widthDp * density).toInt())
      val bitmapHeight = max(180, ceil((heightDp * density * 0.62f)).toInt())

      val views = RemoteViews(context.packageName, R.layout.tracking_map_widget)
      views.setTextViewText(R.id.map_widget_status, if (isActive) turnInstruction else "Start direction")
      views.setTextViewText(R.id.map_widget_destination, destination)
      views.setTextViewText(
        R.id.map_widget_meta,
        if (isActive) "${formatNavigationDistance(distanceMeters)} · ${etaMinutes} min" else "No active route",
      )
      views.setImageViewBitmap(
        R.id.map_widget_image,
        renderMapBitmap(isActive, lat, lng, destLat, destLng, heading, zoomBias, routeJson, bitmapWidth, bitmapHeight),
      )

      val flags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
      val intent = Intent(context, MainActivity::class.java)
      views.setOnClickPendingIntent(R.id.map_widget_root, PendingIntent.getActivity(context, 1, intent, flags))
      views.setOnClickPendingIntent(
        R.id.map_widget_zoom_out,
        PendingIntent.getBroadcast(context, widgetId * 10 + 2, Intent(context, TrackingMapWidgetProvider::class.java).apply {
          action = ACTION_ZOOM_OUT
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        }, flags),
      )
      views.setOnClickPendingIntent(
        R.id.map_widget_zoom_in,
        PendingIntent.getBroadcast(context, widgetId * 10 + 1, Intent(context, TrackingMapWidgetProvider::class.java).apply {
          action = ACTION_ZOOM_IN
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        }, flags),
      )
      views.setOnClickPendingIntent(
        R.id.map_widget_refresh,
        PendingIntent.getBroadcast(context, widgetId * 10 + 4, Intent(context, TrackingMapWidgetProvider::class.java).apply {
          action = ACTION_REFRESH
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        }, flags),
      )
      manager.updateAppWidget(widgetId, views)
    }

    private data class WidgetPoint(val latitude: Float, val longitude: Float)

    private fun parseRoutePoints(routeJson: String): List<WidgetPoint> {
      return try {
        val array = JSONArray(routeJson)
        val points = mutableListOf<WidgetPoint>()
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          val latitude = item.optDouble("latitude", Double.NaN)
          val longitude = item.optDouble("longitude", Double.NaN)
          if (!latitude.isNaN() && !longitude.isNaN() && latitude != 0.0 && longitude != 0.0) {
            points.add(WidgetPoint(latitude.toFloat(), longitude.toFloat()))
          }
        }
        points
      } catch (exc: Exception) {
        emptyList()
      }
    }

    private fun renderMapBitmap(
      isActive: Boolean,
      lat: Float,
      lng: Float,
      destLat: Float,
      destLng: Float,
      heading: Float,
      zoomBias: Int,
      routeJson: String,
      width: Int,
      height: Int,
    ): Bitmap {
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      canvas.drawColor(Color.rgb(15, 23, 42))

      val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(70, 148, 163, 184)
        strokeWidth = 2f
      }
      for (x in 0..width step 90) {
        canvas.drawLine(x.toFloat(), 0f, x.toFloat(), height.toFloat(), gridPaint)
      }
      for (y in 0..height step 75) {
        canvas.drawLine(0f, y.toFloat(), width.toFloat(), y.toFloat(), gridPaint)
      }

      if (!isActive || lat == 0f || lng == 0f || destLat == 0f || destLng == 0f) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.rgb(148, 163, 184)
          textSize = 34f
          textAlign = Paint.Align.CENTER
        }
        canvas.drawText("No live route", width / 2f, height / 2f, paint)
        return bitmap
      }

      val storedRoute = parseRoutePoints(routeJson)
      val displayPoints = if (storedRoute.size >= 2) {
        storedRoute
      } else {
        listOf(WidgetPoint(lat, lng), WidgetPoint(destLat, destLng))
      }
      val allPoints = displayPoints + WidgetPoint(lat, lng) + WidgetPoint(destLat, destLng)
      val minLat = allPoints.minOf { it.latitude }
      val maxLat = allPoints.maxOf { it.latitude }
      val minLng = allPoints.minOf { it.longitude }
      val maxLng = allPoints.maxOf { it.longitude }
      val maxSpan = max(maxLat - minLat, maxLng - minLng)
      val autoZoomOut = when {
        maxSpan < 0.002f -> 1
        maxSpan < 0.006f -> 0
        else -> -1
      }
      val zoomMultiplier = max(0.45f, 1f + ((zoomBias + autoZoomOut).coerceAtLeast(-2) * 0.45f))
      val latCenter = (minLat + maxLat) / 2f
      val lngCenter = (minLng + maxLng) / 2f
      val latSpan = max(0.0008f, (maxLat - minLat) * zoomMultiplier)
      val lngSpan = max(0.0008f, (maxLng - minLng) * zoomMultiplier)
      val fitSpan = max(latSpan, lngSpan)
      val paddedMinLat = latCenter - fitSpan / 2f
      val paddedMinLng = lngCenter - fitSpan / 2f

      fun xFor(value: Float): Float = 70f + ((value - paddedMinLng) / fitSpan) * (width - 140f)
      fun yFor(value: Float): Float = height - 50f - ((value - paddedMinLat) / fitSpan) * (height - 100f)

      val sx = xFor(lng)
      val sy = yFor(lat)
      val dx = xFor(destLng)
      val dy = yFor(destLat)

      val routePath = Path()
      displayPoints.forEachIndexed { index, point ->
        val x = xFor(point.longitude)
        val y = yFor(point.latitude)
        if (index == 0) {
          routePath.moveTo(x, y)
        } else {
          routePath.lineTo(x, y)
        }
      }

      val routeGlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(90, 0, 229, 255)
        strokeWidth = 18f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }
      val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(0, 229, 255)
        strokeWidth = 8f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }
      canvas.drawPath(routePath, routeGlowPaint)
      canvas.drawPath(routePath, routePaint)

      val destPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(249, 115, 22) }
      canvas.drawCircle(dx, dy, 16f, destPaint)

      val userPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(0, 229, 255) }
      canvas.drawCircle(sx, sy, 19f, userPaint)

      val arrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
      }
      val radians = Math.toRadians(heading.toDouble() - 90.0)
      val tipX = sx + cos(radians).toFloat() * 34f
      val tipY = sy + sin(radians).toFloat() * 34f
      val leftX = sx + cos(radians + 2.45).toFloat() * 18f
      val leftY = sy + sin(radians + 2.45).toFloat() * 18f
      val rightX = sx + cos(radians - 2.45).toFloat() * 18f
      val rightY = sy + sin(radians - 2.45).toFloat() * 18f
      val arrow = Path()
      arrow.moveTo(tipX, tipY)
      arrow.lineTo(leftX, leftY)
      arrow.lineTo(rightX, rightY)
      arrow.close()
      canvas.drawPath(arrow, arrowPaint)

      return bitmap
    }
  }
}
