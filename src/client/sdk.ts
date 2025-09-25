import { 
  NotificationPayload, 
  CreateNotificationRequest, 
  ClientConfig, 
  NotificationStats 
} from '../types';

export class NotificationClient {
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: ClientConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      enableLogging: false,
      ...config
    };
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL is required for connection');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl!);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.emit('connected');
          
          if (this.config.enableLogging) {
            console.log('[NotificationClient] Connected to WebSocket');
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[NotificationClient] Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          this.emit('disconnected');
          
          if (this.config.enableLogging) {
            console.log('[NotificationClient] WebSocket disconnected');
          }
          
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    
    if (this.config.enableLogging) {
      console.log(`[NotificationClient] Scheduling reconnect attempt ${this.reconnectAttempts}`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect will be scheduled again in onclose
      });
    }, this.config.reconnectInterval);
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'notification':
        this.emit('notification', data.data);
        break;
      case 'stats':
        this.emit('stats', data.data);
        break;
      default:
        if (this.config.enableLogging) {
          console.log('[NotificationClient] Unknown message type:', data.type);
        }
    }
  }

  // API methods
  async createNotification(request: CreateNotificationRequest): Promise<NotificationPayload> {
    const response = await this.makeRequest('POST', '/api/notifications', request);
    return response.data;
  }

  async getNotifications(recipientId: string, options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}): Promise<NotificationPayload[]> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.unreadOnly) params.append('unreadOnly', 'true');
    if (options.type) params.append('type', options.type);

    const response = await this.makeRequest('GET', `/api/notifications?${params.toString()}`);
    return response.data;
  }

  async markAsRead(id: string): Promise<NotificationPayload> {
    const response = await this.makeRequest('PATCH', `/api/notifications/${id}/read`);
    return response.data;
  }

  async markAllAsRead(recipientId: string): Promise<{ count: number }> {
    const response = await this.makeRequest('PATCH', '/api/notifications/mark-all-read', { recipientId });
    return response.data;
  }

  async deleteNotification(id: string): Promise<void> {
    await this.makeRequest('DELETE', `/api/notifications/${id}`);
  }

  async getStats(recipientId: string): Promise<NotificationStats> {
    const response = await this.makeRequest('GET', `/api/notifications/stats?recipientId=${recipientId}`);
    return response.data;
  }

  private async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Event handling
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  // Utility methods
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}
