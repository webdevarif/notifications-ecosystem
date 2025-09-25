import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NotificationsService } from '../Notifications';
import { InMemoryStorageAdapter } from '../adapters/storage';
import { InMemoryWebSocketAdapter } from '../adapters/websocket';
import { ServerConfig } from '../types';

export function createNotificationServer(config: ServerConfig) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Initialize storage and WebSocket adapters
  const storage = new InMemoryStorageAdapter();
  const wsAdapter = new InMemoryWebSocketAdapter();

  // Initialize notification service
  const notifications = new NotificationsService({
    storage,
    websocket: wsAdapter,
    enableLogging: config.enableLogging || false
  });

  // Middleware
  app.use(express.json());

  // CORS middleware
  if (config.cors) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (config.cors!.origin === '*' || 
          (Array.isArray(config.cors!.origin) && config.cors!.origin.includes(origin as string)) ||
          config.cors!.origin === origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', config.cors!.credentials ? 'true' : 'false');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const recipientId = url.searchParams.get('recipientId');

    if (!recipientId) {
      ws.close(1008, 'Missing recipientId parameter');
      return;
    }

    // Add connection to adapter
    wsAdapter.addConnection(connectionId, recipientId);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Handle incoming messages if needed
        console.log('Received message:', message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      wsAdapter.removeConnection(connectionId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsAdapter.removeConnection(connectionId);
    });
  });

  // API Routes
  app.post('/api/notifications', async (req, res) => {
    try {
      const notification = await notifications.create(req.body);
      res.json({ success: true, data: notification });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.get('/api/notifications', async (req, res) => {
    try {
      const { recipientId, limit, offset, unreadOnly, type } = req.query;
      
      if (!recipientId) {
        return res.status(400).json({ success: false, error: 'recipientId is required' });
      }

      const notifications_list = await notifications.getByRecipient(recipientId as string, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        unreadOnly: unreadOnly === 'true',
        type: type as string
      });

      res.json({ success: true, data: notifications_list });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      const notification = await notifications.markAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }
      res.json({ success: true, data: notification });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.patch('/api/notifications/mark-all-read', async (req, res) => {
    try {
      const { recipientId } = req.body;
      if (!recipientId) {
        return res.status(400).json({ success: false, error: 'recipientId is required' });
      }

      const count = await notifications.markAllAsRead(recipientId);
      res.json({ success: true, data: { count } });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      const deleted = await notifications.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.get('/api/notifications/stats', async (req, res) => {
    try {
      const { recipientId } = req.query;
      if (!recipientId) {
        return res.status(400).json({ success: false, error: 'recipientId is required' });
      }

      const stats = await notifications.getStats(recipientId as string);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return { app, server, notifications, wsAdapter };
}
