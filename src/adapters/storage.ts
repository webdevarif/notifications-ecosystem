import { StorageAdapter, NotificationPayload, NotificationStats } from '../types';

export class InMemoryStorageAdapter implements StorageAdapter {
  private notifications: Map<string, NotificationPayload> = new Map();

  async save(notification: NotificationPayload): Promise<NotificationPayload> {
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async findById(id: string): Promise<NotificationPayload | null> {
    return this.notifications.get(id) || null;
  }

  async findByRecipient(
    recipientId: string, 
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<NotificationPayload[]> {
    const { limit = 50, offset = 0, unreadOnly = false, type } = options;
    
    let filtered = Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === recipientId);

    if (unreadOnly) {
      filtered = filtered.filter(notification => !notification.read);
    }

    if (type) {
      filtered = filtered.filter(notification => notification.type === type);
    }

    // Sort by createdAt descending (newest first)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return filtered.slice(offset, offset + limit);
  }

  async update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null> {
    const notification = this.notifications.get(id);
    if (!notification) {
      return null;
    }

    const updated = {
      ...notification,
      ...updates,
      updatedAt: new Date()
    };

    this.notifications.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  async markAsRead(id: string): Promise<NotificationPayload | null> {
    return this.update(id, { read: true });
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    let count = 0;
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.recipientId === recipientId && !notification.read) {
        notification.read = true;
        notification.updatedAt = new Date();
        this.notifications.set(id, notification);
        count++;
      }
    }
    return count;
  }

  async getStats(recipientId: string): Promise<NotificationStats> {
    const notifications = Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === recipientId);

    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = total - unread;

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    notifications.forEach(notification => {
      // Count by type
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      
      // Count by priority
      const priority = notification.meta?.priority || 'normal';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    return {
      total,
      unread,
      read,
      byType,
      byPriority
    };
  }

  async count(
    recipientId: string, 
    options: { unreadOnly?: boolean; type?: string } = {}
  ): Promise<number> {
    const { unreadOnly = false, type } = options;
    
    let filtered = Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === recipientId);

    if (unreadOnly) {
      filtered = filtered.filter(notification => !notification.read);
    }

    if (type) {
      filtered = filtered.filter(notification => notification.type === type);
    }

    return filtered.length;
  }

  // Utility methods for testing and debugging
  clear(): void {
    this.notifications.clear();
  }

  getAll(): NotificationPayload[] {
    return Array.from(this.notifications.values());
  }

  size(): number {
    return this.notifications.size;
  }
}
