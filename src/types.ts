// Core notification types
export interface NotificationPayload {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  meta?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
    tags?: string[];
    expiresAt?: Date;
    scheduledFor?: Date;
    duration?: number; // in milliseconds
  };
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationRequest {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  meta?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
    tags?: string[];
    expiresAt?: Date;
    scheduledFor?: Date;
    duration?: number;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

// Storage adapter interface
export interface StorageAdapter {
  save(notification: NotificationPayload): Promise<NotificationPayload>;
  findById(id: string): Promise<NotificationPayload | null>;
  findByRecipient(recipientId: string, options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  }): Promise<NotificationPayload[]>;
  update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null>;
  delete(id: string): Promise<boolean>;
  markAsRead(id: string): Promise<NotificationPayload | null>;
  markAllAsRead(recipientId: string): Promise<number>;
  getStats(recipientId: string): Promise<NotificationStats>;
  count(recipientId: string, options?: {
    unreadOnly?: boolean;
    type?: string;
  }): Promise<number>;
}

// WebSocket adapter interface
export interface WebSocketAdapter {
  broadcastToRecipient(recipientId: string, notification: NotificationPayload): Promise<void>;
  broadcast(notification: NotificationPayload): Promise<void>;
  sendToConnection(connectionId: string, notification: NotificationPayload): Promise<void>;
  getConnectionCount(): Promise<number>;
  getRecipientConnections(recipientId: string): Promise<string[]>;
}

// Event types
export interface NotificationEvents {
  created: (notification: NotificationPayload) => void;
  updated: (notification: NotificationPayload) => void;
  deleted: (id: string) => void;
  read: (notification: NotificationPayload) => void;
  error: (error: Error) => void;
}

// Configuration types
export interface NotificationConfig {
  storage: StorageAdapter;
  websocket?: WebSocketAdapter;
  enableLogging?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Client configuration
export interface ClientConfig {
  apiUrl: string;
  wsUrl?: string;
  token?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableLogging?: boolean;
}

// Server configuration
export interface ServerConfig {
  port: number;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  enableLogging?: boolean;
}

// React hook types
export interface UseNotificationsOptions {
  recipientId?: string;
  autoConnect?: boolean;
  enableLogging?: boolean;
}

export interface UseNotificationsReturn {
  notifications: NotificationPayload[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

// Component props
export interface NotificationDropdownProps {
  recipientId: string;
  maxNotifications?: number;
  showUnreadOnly?: boolean;
  onNotificationClick?: (notification: NotificationPayload) => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
  // UI component props
  Button?: React.ComponentType<any>;
  Badge?: React.ComponentType<any>;
  DropdownMenu?: React.ComponentType<any>;
  DropdownMenuTrigger?: React.ComponentType<any>;
  DropdownMenuContent?: React.ComponentType<any>;
  DropdownMenuItem?: React.ComponentType<any>;
  DropdownMenuSeparator?: React.ComponentType<any>;
  ScrollArea?: React.ComponentType<any>;
  Bell?: React.ComponentType<any>;
  Check?: React.ComponentType<any>;
  Trash2?: React.ComponentType<any>;
  MoreHorizontal?: React.ComponentType<any>;
  Clock?: React.ComponentType<any>;
  X?: React.ComponentType<any>;
}
