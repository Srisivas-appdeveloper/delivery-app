package com.react_native_app

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONArray

class NearbyPlacesWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
    return NearbyPlacesFactory(applicationContext)
  }
}

data class NearbyWidgetPlace(
  val id: String,
  val name: String,
  val category: String,
  val address: String,
  val distanceMeters: Int,
)

class NearbyPlacesFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var places: List<NearbyWidgetPlace> = emptyList()

  override fun onCreate() {
    loadPlaces()
  }

  override fun onDataSetChanged() {
    loadPlaces()
  }

  override fun onDestroy() {
    places = emptyList()
  }

  override fun getCount(): Int = places.size

  override fun getViewAt(position: Int): RemoteViews {
    val place = places[position]
    val views = RemoteViews(context.packageName, R.layout.nearby_places_widget_item)
    views.setTextViewText(R.id.nearby_item_name, place.name)
    views.setTextViewText(R.id.nearby_item_category, place.category)
    views.setTextViewText(R.id.nearby_item_address, place.address)
    views.setTextViewText(R.id.nearby_item_distance, formatNavigationDistance(place.distanceMeters))
    views.setTextViewText(R.id.nearby_item_badge, iconFor(place.category))
    val fillIntent = Intent().putExtra(NearbyPlacesWidgetProvider.EXTRA_PLACE_ID, place.id)
    views.setOnClickFillInIntent(R.id.nearby_item_root, fillIntent)
    return views
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long = places[position].id.hashCode().toLong()

  override fun hasStableIds(): Boolean = true

  private fun loadPlaces() {
    val prefs = context.getSharedPreferences("tracking_widget", Context.MODE_PRIVATE)
    val raw = prefs.getString("nearby_places", "[]") ?: "[]"
    places = try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        NearbyWidgetPlace(
          id = item.optString("id"),
          name = item.optString("name", "Nearby place"),
          category = item.optString("category", "Place"),
          address = item.optString("address", "Nearby"),
          distanceMeters = item.optInt("distanceMeters", 0),
        )
      }
    } catch (exc: Exception) {
      emptyList()
    }
  }

  private fun iconFor(category: String): String {
    val text = category.lowercase()
    return when {
      "hotel" in text -> "H"
      "atm" in text -> "ATM"
      "bank" in text -> "B"
      "fuel" in text || "petrol" in text -> "F"
      "hospital" in text || "pharmacy" in text || "medical" in text -> "+"
      "restaurant" in text || "cafe" in text -> "E"
      "store" in text || "shop" in text || "mall" in text -> "S"
      else -> "P"
    }
  }
}
