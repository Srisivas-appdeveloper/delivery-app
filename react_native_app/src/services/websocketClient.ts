import { ApiConstants } from '../constants/apiConstants';

export type WebSocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export type WebSocketEventListener = (data: any) => void;
export type WebSocketStatusListener = (status: WebSocketStatus) => void;

export class TrackingWebSocketService {
  private static instance: TrackingWebSocketService;
  private ws: WebSocket | null = null;
  private orderId: string | null = null;
  private isDisposed: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  public messagesReceivedCount: number = 0;
  public lastMessageTime: Date | null = null;
  public lastRawResponse: string = 'None';
  public currentStatus: WebSocketStatus = 'disconnected';

  private eventListeners: Set<WebSocketEventListener> = new Set();
  private statusListeners: Set<WebSocketStatusListener> = new Set();

  public static getInstance(): TrackingWebSocketService {
    if (!TrackingWebSocketService.instance) {
      TrackingWebSocketService.instance = new TrackingWebSocketService();
    }
    return TrackingWebSocketService.instance;
  }

  public subscribeEvents(listener: WebSocketEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeStatus(listener: WebSocketStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: WebSocketStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private notifyEvent(data: any) {
    this.eventListeners.forEach((listener) => listener(data));
  }

  public connect(orderId: string) {
    if (this.orderId === orderId && this.ws && this.currentStatus === 'connected') {
      return;
    }
    this.orderId = orderId;
    this.isDisposed = false;
    this.reconnectAttempts = 0;
    this.establishConnection();
  }

  private establishConnection() {
    if (this.isDisposed || !this.orderId) return;

    this.notifyStatus('reconnecting');
    this.cleanupSocket();

    try {
      const url = ApiConstants.orderWs(this.orderId);
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        if (!this.isDisposed && this.ws === socket) {
          this.reconnectAttempts = 0;
          this.notifyStatus('connected');
          this.startHeartbeat();
        }
      };

      socket.onmessage = (event) => {
        this.lastMessageTime = new Date();
        this.messagesReceivedCount++;
        this.lastRawResponse = String(event.data);
        this.notifyStatus('connected');

        try {
          const parsed = JSON.parse(event.data);
          this.notifyEvent(parsed);
        } catch (e) {
          console.warn('[WebSocket] JSON Parse Error:', e);
        }
      };

      socket.onerror = (error) => {
        console.warn('[WebSocket] Error:', error);
        this.scheduleReconnect();
      };

      socket.onclose = () => {
        this.scheduleReconnect();
      };
    } catch (e) {
      console.warn('[WebSocket] Connection creation failed:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDisposed || !this.orderId) return;
    this.notifyStatus('reconnecting');
    this.cleanupSocket();

    const delaySeconds = Math.min(Math.pow(2, this.reconnectAttempts), 8);
    this.reconnectAttempts++;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.establishConnection();
    }, delaySeconds * 1000);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        } catch {
          // ignore
        }
      }
    }, 15000);
  }

  public sendLocation(latitude: number, longitude: number, heading = 0, speed = 0, accuracy = 5) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.orderId) {
      const payload = {
        type: 'location_update',
        order_id: this.orderId,
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(payload));
    }
  }

  private cleanupSocket() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  public disconnect() {
    this.orderId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.notifyStatus('disconnected');
  }

  public dispose() {
    this.isDisposed = true;
    this.disconnect();
    this.eventListeners.clear();
    this.statusListeners.clear();
  }
}

export const wsService = TrackingWebSocketService.getInstance();
