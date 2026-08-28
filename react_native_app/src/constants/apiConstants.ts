class ApiConfig {
  private _baseUrl: string = 'http://192.168.0.3:8000';

  private normalizeBackendUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) {
      return this._baseUrl;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `http://${trimmed}`;
  }

  set baseUrl(value: string) {
    this._baseUrl = this.normalizeBackendUrl(value);
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  get host(): string {
    try {
      return new URL(this._baseUrl).host;
    } catch {
      return this._baseUrl.replace(/^https?:\/\//i, '');
    }
  }

  set host(value: string) {
    this.baseUrl = value;
  }

  get port(): number {
    const parsed = Number(new URL(this._baseUrl).port);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this._baseUrl.startsWith('https://') ? 443 : 80;
  }

  set port(value: number) {
    try {
      const url = new URL(this._baseUrl);
      (url as any).port = String(value);
      this._baseUrl = url.toString().replace(/\/+$/, '');
    } catch {
      this._baseUrl = `http://${this.host}:${value}`;
    }
  }

  get httpBaseUrl(): string {
    return this._baseUrl;
  }

  get wsBaseUrl(): string {
    return this._baseUrl.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  }

  // REST Endpoints
  get orders(): string {
    return `${this.httpBaseUrl}/api/orders`;
  }

  orderById(id: string): string {
    return `${this.httpBaseUrl}/api/orders/${id}`;
  }

  orderLocation(id: string): string {
    return `${this.httpBaseUrl}/api/orders/${id}/location`;
  }

  orderStatus(id: string): string {
    return `${this.httpBaseUrl}/api/orders/${id}/status`;
  }

  orderTracking(id: string): string {
    return `${this.httpBaseUrl}/api/orders/${id}/tracking`;
  }

  orderStats(id: string): string {
    return `${this.httpBaseUrl}/api/orders/${id}/stats`;
  }

  nearbyPlaces(lat: number, lng: number, radiusM = 2000): string {
    return `${this.httpBaseUrl}/api/places/nearby?lat=${lat}&lng=${lng}&radius_m=${radiusM}`;
  }

  // WebSocket Endpoint
  orderWs(id: string): string {
    return `${this.wsBaseUrl}/ws/orders/${id}`;
  }
}

export const ApiConstants = new ApiConfig();
