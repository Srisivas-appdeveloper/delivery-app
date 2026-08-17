package com.example.delivery_app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.delivery_app/widget"
    private val PREFS_NAME = "DeliveryAppWidgetPrefs"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "updateWidget" -> {
                    val args = call.arguments as? Map<*, *>
                    if (args != null) {
                        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                        prefs.putString("store_name", args["store_name"] as? String ?: "Active Order")
                        prefs.putString("status", args["status"] as? String ?: "ON THE WAY")
                        prefs.putString("eta", args["eta"] as? String ?: "--")
                        prefs.putString("distance", args["distance"] as? String ?: "--")
                        prefs.putString("address", args["address"] as? String ?: "")
                        prefs.putString("rider", args["rider"] as? String ?: "🛵 Driver")
                        prefs.apply()

                        DeliveryWidgetProvider.updateAllWidgets(this)
                        result.success(true)
                    } else {
                        result.error("INVALID_ARGS", "Widget data is null", null)
                    }
                }
                "requestPinWidget" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val appWidgetManager = getSystemService(AppWidgetManager::class.java)
                        val myProvider = ComponentName(this, DeliveryWidgetProvider::class.java)
                        if (appWidgetManager.isRequestPinAppWidgetSupported) {
                            appWidgetManager.requestPinAppWidget(myProvider, null, null)
                            result.success(true)
                        } else {
                            result.success(false)
                        }
                    } else {
                        result.success(false)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
