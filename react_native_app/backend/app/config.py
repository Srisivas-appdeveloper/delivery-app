import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = (BASE_DIR / "delivery_poc.db").as_posix()

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH}"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Geolocation & Validation Thresholds
    GPS_MAX_ACCURACY: float = 35.0  # Max acceptable GPS accuracy error in meters
    MAX_REASONABLE_SPEED: float = 45.0  # Max reasonable rider speed in m/s (~162 km/h)
    
    # ETA Calculation Settings
    ETA_FALLBACK_SPEED: float = 5.56  # Fallback city speed in m/s (~20.0 km/h)
    ETA_SMOOTHING_FACTOR: float = 0.3  # Alpha for exponential smoothing
    
    # Automated Status Proximity Triggers (in meters)
    NEARBY_DISTANCE: float = 1000.0  # <= 1 km -> nearby
    ARRIVING_DISTANCE: float = 300.0  # <= 300 m -> arriving
    DELIVERY_ELIGIBLE_DISTANCE: float = 30.0  # <= 30 m -> eligible for delivered

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    STADIA_MAPS_API_KEY: str = "b6b6bafb-0fc4-472b-bf31-f1057a3c7a46"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
