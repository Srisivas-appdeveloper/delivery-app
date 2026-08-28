package com.react_native_app

fun formatNavigationDistance(distanceMeters: Int): String {
  val safeMeters = distanceMeters.coerceAtLeast(0)
  if (safeMeters >= 1000) {
    val km = safeMeters / 1000.0
    return if (km >= 10) {
      "${km.toInt()} km"
    } else {
      String.format("%.1f km", km)
    }
  }
  return "$safeMeters m"
}
