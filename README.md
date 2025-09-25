# @webdevarif/notifications

A customizable, framework-agnostic notifications system with pluggable storage and WebSocket adapters.

## Features

- 🔔 **Real-time Notifications** - WebSocket support for instant delivery
- 🗄️ **Pluggable Storage** - Use any storage backend (in-memory, database, etc.)
- ⚡ **Framework Agnostic** - Works with React, Vue, Angular, or vanilla JS
- 🎯 **TypeScript Support** - Full type definitions included
- 🔧 **Customizable** - Pluggable adapters for storage and WebSocket
- 📱 **React Hooks** - Easy integration with React applications
- 🚀 **Server Ready** - Express.js server example included
- 📊 **Rich Metadata** - Priority, categories, tags, and more
- 🎨 **UI Components** - Ready-to-use notification dropdown component

## Installation

```bash
npm install @webdevarif/notifications
# or
yarn add @webdevarif/notifications
# or
pnpm add @webdevarif/notifications
```

## Quick Start

### Basic Usage

```typescript
import { NotificationsService, InMemoryStorageAdapter, InMemoryWebSocketAdapter } from '@webdevarif/notifications';

// Initialize the service
const notifications = new NotificationsService({
  storage: new InMemoryStorageAdapter(),
  websocket: new InMemoryWebSocketAdapter(),
  enableLogging: true
});

// Create a notification
const notification = await notifications.create({
  recipientId: 'user-123',
  type: 'message',
  title: 'New Message',
  body: 'You have a new message from John',
  data: { senderId: 'user-456', messageId: 'msg-789' },
  meta: {
    priority: 'high',
    category: 'communication',
    tags: ['urgent', 'message']
  }
});

// Get notifications for a user
const userNotifications = await notifications.getByRecipient('user-123', {
  limit: 10,
  unreadOnly: true
});

// Mark as read
await notifications.markAsRead(notification.id);
```

### React Integration

```tsx
import React from 'react';
import { useNotifications } from '@webdevarif/notifications/client';

function NotificationComponent() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications({
    recipientId: 'user-123',
    autoConnect: true
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Notifications ({unreadCount} unread)</h3>
      <button onClick={markAllAsRead}>Mark All as Read</button>
      
      {notifications.map(notification => (
        <div key={notification.id} className={notification.read ? 'read' : 'unread'}>
          <h4>{notification.title}</h4>
          <p>{notification.body}</p>
          <button onClick={() => markAsRead(notification.id)}>
            Mark as Read
          </button>
          <button onClick={() => deleteNotification(notification.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Server Setup

```typescript
import { createNotificationServer } from '@webdevarif/notifications/server';

const { app, server } = createNotificationServer({
  port: 3000,
  cors: {
    origin: ['http://localhost:3000', 'https://yourdomain.com'],
    credentials: true
  },
  enableLogging: true
});

server.listen(3000, () => {
  console.log('Notification server running on port 3000');
});
```

## API Reference

### NotificationsService

Main service class for managing notifications.

#### Constructor

```typescript
new NotificationsService(config: NotificationConfig)
```

#### Methods

- `create(request: CreateNotificationRequest)` - Create a new notification
- `getById(id: string)` - Get notification by ID
- `getByRecipient(recipientId, options)` - Get notifications for a recipient
- `markAsRead(id: string)` - Mark notification as read
- `markAllAsRead(recipientId: string)` - Mark all notifications as read
- `delete(id: string)` - Delete a notification
- `getStats(recipientId: string)` - Get notification statistics
- `count(recipientId: string, options)` - Count notifications

### Storage Adapters

#### InMemoryStorageAdapter

In-memory storage for development and testing.

```typescript
import { InMemoryStorageAdapter } from '@webdevarif/notifications';

const storage = new InMemoryStorageAdapter();
```

#### Custom Storage Adapter

```typescript
import { StorageAdapter, NotificationPayload } from '@webdevarif/notifications';

class DatabaseStorageAdapter implements StorageAdapter {
  async save(notification: NotificationPayload): Promise<NotificationPayload> {
    // Save to database
  }
  
  async findById(id: string): Promise<NotificationPayload | null> {
    // Find by ID in database
  }
  
  // ... implement other methods
}
```

### WebSocket Adapters

#### InMemoryWebSocketAdapter

In-memory WebSocket adapter for development.

```typescript
import { InMemoryWebSocketAdapter } from '@webdevarif/notifications';

const wsAdapter = new InMemoryWebSocketAdapter();
```

### React Hooks

#### useNotifications

```typescript
const {
  notifications,      // Array of notifications
  unreadCount,       // Number of unread notifications
  loading,           // Loading state
  error,             // Error state
  markAsRead,        // Function to mark as read
  markAllAsRead,     // Function to mark all as read
  deleteNotification, // Function to delete notification
  refresh,           // Function to refresh notifications
  connect,           // Function to connect WebSocket
  disconnect,        // Function to disconnect WebSocket
  isConnected        // WebSocket connection state
} = useNotifications({
  recipientId: 'user-123',
  autoConnect: true,
  enableLogging: false
});
```

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/websocket
```

### Client Configuration

```typescript
const client = new NotificationClient({
  apiUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000/api/websocket',
  token: 'your-auth-token',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  enableLogging: true
});
```

## Notification Types

### NotificationPayload

```typescript
interface NotificationPayload {
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
    duration?: number;
  };
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CreateNotificationRequest

```typescript
interface CreateNotificationRequest {
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
```

## Examples

### Custom UI Component

```tsx
import React from 'react';
import { useNotifications } from '@webdevarif/notifications/client';
import { formatDistanceToNow } from 'date-fns';

function NotificationDropdown({ recipientId }: { recipientId: string }) {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications({
    recipientId,
    autoConnect: true
  });

  return (
    <div className="notification-dropdown">
      <div className="header">
        <h3>Notifications</h3>
        <span className="badge">{unreadCount}</span>
      </div>
      
      <div className="notifications">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            className={`notification ${notification.read ? 'read' : 'unread'}`}
            onClick={() => markAsRead(notification.id)}
          >
            <div className="content">
              <h4>{notification.title}</h4>
              <p>{notification.body}</p>
              <span className="time">
                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
              </span>
            </div>
            <button 
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteNotification(notification.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Event Handling

```typescript
import { NotificationsService } from '@webdevarif/notifications';

const notifications = new NotificationsService({
  storage: new InMemoryStorageAdapter(),
  enableLogging: true
});

// Listen to events
notifications.on('created', (notification) => {
  console.log('New notification created:', notification);
});

notifications.on('read', (notification) => {
  console.log('Notification marked as read:', notification);
});

notifications.on('deleted', (id) => {
  console.log('Notification deleted:', id);
});

notifications.on('error', (error) => {
  console.error('Notification error:', error);
});
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@webdevarif.com or create an issue on GitHub.