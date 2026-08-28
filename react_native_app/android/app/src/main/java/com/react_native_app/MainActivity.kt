package com.react_native_app

import android.os.Bundle
import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "react_native_app"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun onDestroy() {
    if (isFinishing) {
      clearLiveTrackingWidgets()
    }
    super.onDestroy()
  }

  private fun clearLiveTrackingWidgets() {
    val prefs = getSharedPreferences("tracking_widget", 0)
    prefs.edit()
      .putBoolean("is_active", false)
      .putString("destination", "No active tracking")
      .putInt("distance_meters", 0)
      .putInt("eta_minutes", 0)
      .putString("latitude", "--")
      .putString("longitude", "--")
      .putString("turn_instruction", "Start direction")
      .remove("tracking_state")
      .apply()

    TrackingWidgetProvider.updateAll(this)
    TrackingMapWidgetProvider.updateAll(this)
    stopService(Intent(this, TrackingForegroundService::class.java))
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
