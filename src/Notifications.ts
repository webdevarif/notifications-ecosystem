import { EventEmitter } from 'eventemitter3';
import { 
  NotificationPayload, 
  CreateNotificationRequest, 
  NotificationConfig, 
  StorageAdapter, 
  WebSocketAdapter,
  NotificationEvents 
} from './types';

export class NotificationsService extends EventEmitter<NotificationEvents> {
  private storage: StorageAdapter;
  private websocket?: WebSocketAdapter;
  private enableLogging: boolean;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: NotificationConfig) {
    super();
    this.storage = config.storage;
    this.websocket = config.websocket;
    this.enableLogging = config.enableLogging || false;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async create(request: CreateNotificationRequest): Promise<NotificationPayload> {
    const notification: NotificationPayload = {
      id: this.generateId(),
      recipientId: request.recipientId,
      type: request.type,
      title: request.title,
      body: request.body,
      data: request.data,
      meta: {
        priority: 'normal',
        ...request.meta
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const saved = await this.storage.save(notification);
      
      if (this.enableLogging) {
        console.log('[Notifications] Created notification:', saved.id);
      }

      this.emit('created', saved);

      // Broadcast via WebSocket if available
      if (this.websocket) {
        try {
          await this.websocket.broadcastToRecipient(notification.recipientId, saved);
        } catch (error) {
          console.error('[Notifications] Failed to broadcast notification:', error);
        }
      }

      return saved;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async getById(id: string): Promise<NotificationPayload | null> {
    try {
      return await this.storage.findById(id);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async getByRecipient(
    recipientId: string, 
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<NotificationPayload[]> {
    try {
      return await this.storage.findByRecipient(recipientId, options);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<NotificationPayload | null> {
    try {
      const updated = await this.storage.markAsRead(id);
      if (updated) {
        this.emit('read', updated);
        this.emit('updated', updated);
        
        if (this.enableLogging) {
          console.log('[Notifications] Marked as read:', id);
        }
      }
      return updated;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    try {
      const count = await this.storage.markAllAsRead(recipientId);
      
      if (this.enableLogging) {
        console.log('[Notifications] Marked all as read for recipient:', recipientId, 'count:', count);
      }

      return count;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await this.storage.delete(id);
      if (deleted) {
        this.emit('deleted', id);
        
        if (this.enableLogging) {
          console.log('[Notifications] Deleted notification:', id);
        }
      }
      return deleted;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async getStats(recipientId: string) {
    try {
      return await this.storage.getStats(recipientId);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async count(recipientId: string, options: { unreadOnly?: boolean; type?: string } = {}) {
    try {
      return await this.storage.count(recipientId, options);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null> {
    try {
      const updated = await this.storage.update(id, updates);
      if (updated) {
        this.emit('updated', updated);
        
        if (this.enableLogging) {
          console.log('[Notifications] Updated notification:', id);
        }
      }
      return updated;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  // Utility methods
  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // WebSocket management
  getWebSocketAdapter(): WebSocketAdapter | undefined {
    return this.websocket;
  }

  setWebSocketAdapter(adapter: WebSocketAdapter): void {
    this.websocket = adapter;
  }

  // Storage management
  getStorageAdapter(): StorageAdapter {
    return this.storage;
  }

  setStorageAdapter(adapter: StorageAdapter): void {
    this.storage = adapter;
  }

  // Configuration
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  setRetryConfig(maxRetries: number, retryDelay: number): void {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }
}
