package com.react_native_app

import android.content.Intent
import android.os.Build
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sqrt
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class TrackingWidgetModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TrackingWidget"

  @ReactMethod
  fun saveTrackingState(json: String) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putString("tracking_state", json)
      .apply()
  }

  @ReactMethod
  fun getTrackingState(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    promise.resolve(prefs.getString("tracking_state", null))
  }

  @ReactMethod
  fun updateNearbyPlaces(json: String) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putString("nearby_places", json)
      .apply()
    NearbyPlacesWidgetProvider.updateAll(reactContext)
  }

  @ReactMethod
  fun getSelectedWidgetPlaceId(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    promise.resolve(prefs.getString("selected_widget_place_id", null))
  }

  @ReactMethod
  fun getNearbyPlaces(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    promise.resolve(prefs.getString("nearby_places", "[]"))
  }

  @ReactMethod
  fun saveBackendBaseUrl(url: String) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putString("backend_base_url", url)
      .apply()
  }

  @ReactMethod
  fun getBackendBaseUrl(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    promise.resolve(prefs.getString("backend_base_url", null))
  }

  @ReactMethod
  fun saveLastCompletedTrip(json: String) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putString("last_completed_trip", json)
      .apply()
  }

  @ReactMethod
  fun getLastCompletedTrip(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    promise.resolve(prefs.getString("last_completed_trip", null))
  }

  @ReactMethod
  fun clearSelectedWidgetPlaceId() {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit().remove("selected_widget_place_id").apply()
  }

  @ReactMethod
  fun updateTracking(
    destination: String,
    distanceMeters: Double,
    etaMinutes: Double,
    latitude: Double,
    longitude: Double,
    destinationLatitude: Double,
    destinationLongitude: Double,
    heading: Double,
    turnInstruction: String,
    isActive: Boolean,
    routeJson: String,
  ) {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    val cleanRouteJson = routeJson.trim()
    val hasValidRoute = cleanRouteJson.startsWith("[") && cleanRouteJson.length > 8
    val previousRouteJson = prefs.getString("route_points", "[]") ?: "[]"
    val routeChanged = hasValidRoute && cleanRouteJson != previousRouteJson
    val lastMapLatitude = prefs.getFloat("last_map_update_latitude", 0f).toDouble()
    val lastMapLongitude = prefs.getFloat("last_map_update_longitude", 0f).toDouble()
    val lastMapHeading = prefs.getFloat("last_map_update_heading", -1f).toDouble()
    val movedMeters = approximateMeters(lastMapLatitude, lastMapLongitude, latitude, longitude)
    val headingDelta = headingDifference(lastMapHeading, heading)
    val shouldUpdateMapWidget = !isActive || routeChanged || lastMapLatitude == 0.0 || lastMapLongitude == 0.0 || movedMeters >= 10.0 || headingDelta >= 25.0

    val editor = prefs.edit()
      .putBoolean("is_active", isActive)
      .putString("destination", destination)
      .putInt("distance_meters", distanceMeters.toInt())
      .putInt("eta_minutes", etaMinutes.toInt())
      .putString("latitude", String.format("%.5f", latitude))
      .putString("longitude", String.format("%.5f", longitude))
      .putFloat("latitude_value", latitude.toFloat())
      .putFloat("longitude_value", longitude.toFloat())
      .putFloat("destination_latitude_value", destinationLatitude.toFloat())
      .putFloat("destination_longitude_value", destinationLongitude.toFloat())
      .putFloat("heading", heading.toFloat())
      .putString("turn_instruction", turnInstruction)

    if (hasValidRoute) {
      editor.putString("route_points", cleanRouteJson)
    }
    if (shouldUpdateMapWidget) {
      editor
        .putFloat("last_map_update_latitude", latitude.toFloat())
        .putFloat("last_map_update_longitude", longitude.toFloat())
        .putFloat("last_map_update_heading", heading.toFloat())
    }
    editor.apply()

    TrackingWidgetProvider.updateAll(reactContext)
    if (shouldUpdateMapWidget) {
      TrackingMapWidgetProvider.updateAll(reactContext)
    }
    if (isActive) {
      try {
        val serviceIntent = Intent(reactContext, TrackingForegroundService::class.java)
        serviceIntent.putExtra("destination", destination)
        serviceIntent.putExtra("distance_meters", distanceMeters.toInt())
        serviceIntent.putExtra("eta_minutes", etaMinutes.toInt())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          reactContext.startForegroundService(serviceIntent)
        } else {
          reactContext.startService(serviceIntent)
        }
      } catch (exc: Exception) {
        // The widget state is already written; avoid crashing if Android refuses
        // a service refresh while the app is backgrounded.
      }
    }
  }

  private fun approximateMeters(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): Double {
    if (fromLat == 0.0 || fromLng == 0.0 || toLat == 0.0 || toLng == 0.0) {
      return Double.MAX_VALUE
    }
    val metersPerDegreeLat = 111_320.0
    val metersPerDegreeLng = 111_320.0 * cos(Math.toRadians((fromLat + toLat) / 2.0))
    val dx = (toLng - fromLng) * metersPerDegreeLng
    val dy = (toLat - fromLat) * metersPerDegreeLat
    return sqrt(dx * dx + dy * dy)
  }

  private fun headingDifference(previous: Double, current: Double): Double {
    if (previous < 0.0) return 360.0
    val diff = abs((current - previous + 540.0) % 360.0 - 180.0)
    return diff
  }

  @ReactMethod
  fun clearTracking() {
    val prefs = reactContext.getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putBoolean("is_active", false)
      .putString("destination", "No active tracking")
      .putInt("distance_meters", 0)
      .putInt("eta_minutes", 0)
      .putString("latitude", "--")
      .putString("longitude", "--")
      .putString("turn_instruction", "Start direction")
      .remove("route_points")
      .remove("tracking_state")
      .apply()

    TrackingWidgetProvider.updateAll(reactContext)
    TrackingMapWidgetProvider.updateAll(reactContext)
    reactContext.stopService(Intent(reactContext, TrackingForegroundService::class.java))
  }
}
