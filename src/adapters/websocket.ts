import { WebSocketAdapter, NotificationPayload } from '../types';

export class InMemoryWebSocketAdapter implements WebSocketAdapter {
  private connections: Map<string, { recipientId: string; connectionId: string }> = new Map();
  private recipientConnections: Map<string, Set<string>> = new Map();

  async broadcastToRecipient(recipientId: string, notification: NotificationPayload): Promise<void> {
    const connections = this.recipientConnections.get(recipientId);
    if (!connections) {
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    for (const connectionId of connections) {
      try {
        // In a real implementation, you would send the message to the actual WebSocket connection
        console.log(`Broadcasting to connection ${connectionId}:`, message);
      } catch (error) {
        console.error(`Failed to send to connection ${connectionId}:`, error);
      }
    }
  }

  async broadcast(notification: NotificationPayload): Promise<void> {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    for (const [connectionId, connection] of this.connections) {
      try {
        // In a real implementation, you would send the message to the actual WebSocket connection
        console.log(`Broadcasting to all connections:`, message);
      } catch (error) {
        console.error(`Failed to send to connection ${connectionId}:`, error);
      }
    }
  }

  async sendToConnection(connectionId: string, notification: NotificationPayload): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    try {
      // In a real implementation, you would send the message to the actual WebSocket connection
      console.log(`Sending to connection ${connectionId}:`, message);
    } catch (error) {
      console.error(`Failed to send to connection ${connectionId}:`, error);
      throw error;
    }
  }

  async getConnectionCount(): Promise<number> {
    return this.connections.size;
  }

  async getRecipientConnections(recipientId: string): Promise<string[]> {
    const connections = this.recipientConnections.get(recipientId);
    return connections ? Array.from(connections) : [];
  }

  // Connection management methods
  addConnection(connectionId: string, recipientId: string): void {
    this.connections.set(connectionId, { recipientId, connectionId });
    
    if (!this.recipientConnections.has(recipientId)) {
      this.recipientConnections.set(recipientId, new Set());
    }
    this.recipientConnections.get(recipientId)!.add(connectionId);
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const recipientConnections = this.recipientConnections.get(connection.recipientId);
      if (recipientConnections) {
        recipientConnections.delete(connectionId);
        if (recipientConnections.size === 0) {
          this.recipientConnections.delete(connection.recipientId);
        }
      }
      this.connections.delete(connectionId);
    }
  }

  // Utility methods for testing and debugging
  clear(): void {
    this.connections.clear();
    this.recipientConnections.clear();
  }

  getAllConnections(): Array<{ connectionId: string; recipientId: string }> {
    return Array.from(this.connections.values());
  }
}
