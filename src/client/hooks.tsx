import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  NotificationPayload, 
  UseNotificationsOptions, 
  UseNotificationsReturn,
  ClientConfig 
} from '../types';
import { NotificationClient } from './sdk';

// Global client instance
let globalClient: NotificationClient | null = null;

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const clientRef = useRef<NotificationClient | null>(null);
  const { recipientId, autoConnect = true, enableLogging = false } = options;

  // Initialize client
  useEffect(() => {
    if (!globalClient) {
      const config: ClientConfig = {
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/api/websocket',
        enableLogging,
      };
      globalClient = new NotificationClient(config);
    }
    clientRef.current = globalClient;
  }, [enableLogging]);

  // Connect to WebSocket
  useEffect(() => {
    if (autoConnect && clientRef.current && recipientId) {
      clientRef.current.connect().then(() => {
        setIsConnected(true);
      }).catch((err) => {
        setError(err);
      });
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        setIsConnected(false);
      }
    };
  }, [autoConnect, recipientId]);

  // Set up event listeners
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const handleNotification = (notification: NotificationPayload) => {
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleConnected = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    client.on('notification', handleNotification);
    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);

    return () => {
      client.off('notification', handleNotification);
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
    };
  }, []);

  // Load initial notifications
  useEffect(() => {
    if (recipientId && clientRef.current) {
      loadNotifications();
    }
  }, [recipientId]);

  const loadNotifications = useCallback(async () => {
    if (!clientRef.current || !recipientId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await clientRef.current.getNotifications(recipientId, { limit: 50 });
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  const markAsRead = useCallback(async (id: string) => {
    if (!clientRef.current) return;

    try {
      const updated = await clientRef.current.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? updated : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!clientRef.current || !recipientId) return;

    try {
      await clientRef.current.markAllAsRead(recipientId);
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err as Error);
    }
  }, [recipientId]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.deleteNotification(id);
      setNotifications(prev => {
        const notification = prev.find(n => n.id === id);
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.connect().then(() => {
        setIsConnected(true);
      }).catch((err) => {
        setError(err);
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsConnected(false);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    connect,
    disconnect,
    isConnected,
  };
}
