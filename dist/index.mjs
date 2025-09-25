import { EventEmitter } from 'eventemitter3';
import { useState, useCallback, useEffect } from 'react';
import { jsxs, jsx } from 'react/jsx-runtime';

// src/Notifications.ts
var Notifications = class extends EventEmitter {
  constructor(config) {
    super();
    this.notificationTypes = /* @__PURE__ */ new Map();
    this.storageAdapter = config.storageAdapter;
    this.websocketAdapter = config.websocketAdapter;
    this.hooks = config.hooks;
    this.defaultType = config.defaultType || "info";
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1e3;
    this.registerDefaultTypes();
  }
  /**
   * Register a notification type with its configuration
   */
  registerType(type, config) {
    this.notificationTypes.set(type, config);
  }
  /**
   * Get notification type configuration
   */
  getTypeConfig(type) {
    return this.notificationTypes.get(type);
  }
  /**
   * Create a new notification
   */
  async create(input) {
    try {
      let processedInput = input;
      if (this.hooks?.onBeforeCreate) {
        processedInput = await this.hooks.onBeforeCreate(input);
      }
      const id = this.generateId();
      const now = /* @__PURE__ */ new Date();
      const notification = {
        id,
        ...processedInput,
        type: processedInput.type || this.defaultType,
        read: false,
        createdAt: now,
        updatedAt: now
      };
      const savedNotification = await this.storageAdapter.save(notification);
      if (this.hooks?.onAfterCreate) {
        await this.hooks.onAfterCreate(savedNotification);
      }
      this.emit("notification:created", savedNotification);
      if (this.websocketAdapter) {
        try {
          await this.websocketAdapter.broadcastToRecipient(
            savedNotification.recipientId,
            savedNotification
          );
        } catch (error) {
          console.warn("Failed to broadcast notification via WebSocket:", error);
        }
      }
      return savedNotification;
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Get notifications with optional filters
   */
  async get(filters) {
    try {
      return await this.storageAdapter.find(filters || {});
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Get a single notification by ID
   */
  async getOne(id) {
    try {
      return await this.storageAdapter.findOne(id);
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Mark a notification as read
   */
  async markAsRead(id) {
    try {
      const notification = await this.storageAdapter.findOne(id);
      if (!notification) {
        return null;
      }
      const updatedNotification = await this.storageAdapter.update(id, { read: true });
      if (updatedNotification) {
        this.emit("notification:markedAsRead", {
          id,
          recipientId: updatedNotification.recipientId
        });
        this.emit("notification:updated", updatedNotification);
        if (this.websocketAdapter) {
          try {
            await this.websocketAdapter.broadcastToRecipient(
              updatedNotification.recipientId,
              updatedNotification
            );
          } catch (error) {
            console.warn("Failed to broadcast mark as read via WebSocket:", error);
          }
        }
      }
      return updatedNotification;
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Mark a notification as unread
   */
  async markAsUnread(id) {
    try {
      const notification = await this.storageAdapter.findOne(id);
      if (!notification) {
        return null;
      }
      const updatedNotification = await this.storageAdapter.update(id, { read: false });
      if (updatedNotification) {
        this.emit("notification:markedAsUnread", {
          id,
          recipientId: updatedNotification.recipientId
        });
        this.emit("notification:updated", updatedNotification);
        if (this.websocketAdapter) {
          try {
            await this.websocketAdapter.broadcastToRecipient(
              updatedNotification.recipientId,
              updatedNotification
            );
          } catch (error) {
            console.warn("Failed to broadcast mark as unread via WebSocket:", error);
          }
        }
      }
      return updatedNotification;
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Mark all notifications as read/unread for a recipient
   */
  async markAll(recipientId, read) {
    try {
      const notifications = await this.storageAdapter.find({ recipientId });
      let count = 0;
      for (const notification of notifications) {
        if (notification.read !== read) {
          await this.storageAdapter.update(notification.id, { read });
          count++;
        }
      }
      this.emit("notification:markedAll", {
        recipientId,
        read,
        count
      });
      if (this.websocketAdapter) {
        try {
          await this.websocketAdapter.broadcastToRecipient(
            recipientId,
            { recipientId, read, count }
          );
        } catch (error) {
          console.warn("Failed to broadcast mark all via WebSocket:", error);
        }
      }
      return count;
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Mark all notifications as read for a recipient
   */
  async markAllAsRead(recipientId, category) {
    try {
      const count = await this.markAll(recipientId.toString(), true);
      return { success: true, updatedCount: count };
    } catch (error) {
      console.error("Error in notifications service:", error);
      return { success: false, error: "Failed to mark all notifications as read" };
    }
  }
  /**
   * Delete a notification
   */
  async delete(id) {
    try {
      if (this.hooks?.onBeforeDelete) {
        const shouldDelete = await this.hooks.onBeforeDelete(id);
        if (!shouldDelete) {
          return false;
        }
      }
      const success = await this.storageAdapter.delete(id);
      if (success) {
        this.emit("notification:deleted", { id });
        if (this.hooks?.onAfterDelete) {
          await this.hooks.onAfterDelete(id);
        }
      }
      return success;
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Get notification count with optional filters
   */
  async count(filters) {
    try {
      const total = await this.storageAdapter.count(filters || {});
      const unread = await this.storageAdapter.count({ ...filters, read: false });
      const read = total - unread;
      const notifications = await this.storageAdapter.find(filters || {});
      const byType = {};
      notifications.forEach((notification) => {
        byType[notification.type] = (byType[notification.type] || 0) + 1;
      });
      return {
        total,
        unread,
        read,
        byType
      };
    } catch (error) {
      console.error("Error in notifications service:", error);
      throw error;
    }
  }
  /**
   * Emit a custom event
   */
  emitEvent(event, data) {
    return super.emit(event, data);
  }
  /**
   * Register event listener
   */
  onEvent(event, callback) {
    return super.on(event, callback);
  }
  /**
   * Remove event listener
   */
  offEvent(event, callback) {
    return super.off(event, callback);
  }
  /**
   * Get WebSocket adapter
   */
  getWebSocketAdapter() {
    return this.websocketAdapter;
  }
  /**
   * Get storage adapter
   */
  getStorageAdapter() {
    return this.storageAdapter;
  }
  /**
   * Generate a unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Register default notification types
   */
  registerDefaultTypes() {
    const defaultTypes = {
      info: {
        defaultPriority: "normal",
        defaultCategory: "general"
      },
      success: {
        defaultPriority: "normal",
        defaultCategory: "general"
      },
      warning: {
        defaultPriority: "high",
        defaultCategory: "general"
      },
      error: {
        defaultPriority: "urgent",
        defaultCategory: "general"
      },
      message: {
        defaultPriority: "normal",
        defaultCategory: "general"
      },
      system: {
        defaultPriority: "low",
        defaultCategory: "system"
      },
      order: {
        defaultPriority: "normal",
        defaultCategory: "order"
      },
      payment: {
        defaultPriority: "high",
        defaultCategory: "payment"
      },
      shipping: {
        defaultPriority: "normal",
        defaultCategory: "shipping"
      },
      custom: {
        defaultPriority: "normal",
        defaultCategory: "custom"
      }
    };
    Object.entries(defaultTypes).forEach(([type, config]) => {
      this.registerType(type, config);
    });
  }
};

// src/adapters/storage.ts
var InMemoryStorageAdapter = class {
  constructor() {
    this.notifications = /* @__PURE__ */ new Map();
  }
  async save(notification) {
    this.notifications.set(notification.id, notification);
    return notification;
  }
  async find(filters = {}) {
    let notifications = Array.from(this.notifications.values());
    if (filters.recipientId) {
      notifications = notifications.filter((n) => n.recipientId === filters.recipientId);
    }
    if (filters.read !== void 0) {
      notifications = notifications.filter((n) => n.read === filters.read);
    }
    if (filters.type) {
      notifications = notifications.filter((n) => n.type === filters.type);
    }
    if (filters.limit) {
      notifications = notifications.slice(0, filters.limit);
    }
    return notifications;
  }
  async findOne(id) {
    return this.notifications.get(id) || null;
  }
  async update(id, updates) {
    const notification = this.notifications.get(id);
    if (!notification) return null;
    const updated = { ...notification, ...updates };
    this.notifications.set(id, updated);
    return updated;
  }
  async delete(id) {
    return this.notifications.delete(id);
  }
  async count(filters = {}) {
    const notifications = await this.find(filters);
    return notifications.length;
  }
};
var DefaultWebSocketAdapter = class extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.url = url;
    this.reconnectInterval = options.reconnectInterval || 5e3;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
  }
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        import('ws').then(({ WebSocket: WebSocket2 }) => {
          this.ws = new WebSocket2(this.url);
          this.ws.on("open", () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit("connected");
            resolve();
          });
          this.ws.on("message", (data) => {
            try {
              const message = JSON.parse(data.toString());
              this.emit("message", message);
              if (message.event) {
                this.emit(message.event, message.data);
              }
            } catch (error) {
              this.emit("error", error);
            }
          });
          this.ws.on("close", () => {
            this.isConnected = false;
            this.emit("disconnected");
            this.handleReconnect();
          });
          this.ws.on("error", (error) => {
            this.emit("error", error);
            reject(error);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("reconnectFailed");
      return;
    }
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
      });
    }, this.reconnectInterval);
  }
  async broadcastToRecipient(recipientId, notification) {
    if (!this.isConnected || !this.ws) {
      throw new Error("WebSocket not connected");
    }
    const message = {
      type: "notification",
      event: "notification:created",
      recipientId,
      data: notification,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.ws.send(JSON.stringify(message));
  }
  async broadcast(notification) {
    if (!this.isConnected || !this.ws) {
      throw new Error("WebSocket not connected");
    }
    const message = {
      type: "broadcast",
      event: "notification:created",
      data: notification,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.ws.send(JSON.stringify(message));
  }
  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.isConnected = false;
  }
  get connected() {
    return this.isConnected;
  }
};

// src/client/sdk.ts
var NotificationClientSDK = class {
  constructor(config) {
    this.config = {
      autoConnect: true,
      reconnectInterval: 5e3,
      maxReconnectAttempts: 10,
      endpoints: {
        notifications: "/notifications",
        markAsRead: "/notifications/{id}/read",
        markAsUnread: "/notifications/{id}/unread",
        markAll: "/notifications/mark-all-read",
        count: "/notifications/stats"
      },
      ...config
    };
    if (this.config.autoConnect && this.config.websocketUrl) {
      this.connect();
    }
  }
  async connect() {
    if (!this.config.websocketUrl) return;
    try {
      this.ws = new WebSocket(this.config.websocketUrl);
      this.ws.onopen = () => {
        console.log("WebSocket connected");
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
      };
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }
  handleMessage(data) {
    if (data.event === "notification:created") {
      window.dispatchEvent(new CustomEvent("notification:created", { detail: data.data }));
    }
  }
  async getNotifications(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.recipientId) params.append("recipientId", filters.recipientId.toString());
      if (filters.read !== void 0) params.append("read", filters.read.toString());
      if (filters.type) params.append("type", filters.type);
      if (filters.category) params.append("category", filters.category);
      if (filters.priority) params.append("priority", filters.priority);
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.offset) params.append("offset", filters.offset.toString());
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.notifications}?${params.toString()}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to fetch notifications" };
    }
  }
  async markAsRead(id) {
    try {
      const endpoint = this.config.endpoints.markAsRead.replace("{id}", id);
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, { method: "PATCH" });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to mark notification as read" };
    }
  }
  async markAsUnread(id) {
    try {
      const endpoint = this.config.endpoints.markAsUnread.replace("{id}", id);
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, { method: "PATCH" });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to mark notification as unread" };
    }
  }
  async markAllAsRead(recipientId, category) {
    try {
      const params = new URLSearchParams();
      if (recipientId) params.append("recipientId", recipientId.toString());
      if (category) params.append("category", category);
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.markAll}?${params.toString()}`, { method: "PATCH" });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to mark all notifications as read" };
    }
  }
  async deleteNotification(id) {
    try {
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.notifications}/${id}`, { method: "DELETE" });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to delete notification" };
    }
  }
  async getNotificationStats() {
    try {
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.count}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: "Failed to fetch notification stats" };
    }
  }
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
};
function useNotifications(options = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const client = new NotificationClientSDK({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
    websocketUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000",
    autoConnect: true
  });
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.getNotifications(options);
      if (result.success) {
        setNotifications(result.data || []);
      } else {
        setError(result.error || "Failed to fetch notifications");
      }
    } catch (err) {
      setError("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [client, options]);
  const markAsRead = useCallback(async (id) => {
    try {
      const result = await client.markAsRead(id);
      if (result.success) {
        setNotifications(
          (prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n)
        );
        return true;
      }
      return false;
    } catch (error2) {
      return false;
    }
  }, [client]);
  const markAsUnread = useCallback(async (id) => {
    try {
      const result = await client.markAsUnread(id);
      if (result.success) {
        setNotifications(
          (prev) => prev.map((n) => n.id === id ? { ...n, read: false } : n)
        );
        return true;
      }
      return false;
    } catch (error2) {
      return false;
    }
  }, [client]);
  const markAllAsRead = useCallback(async (category) => {
    try {
      const result = await client.markAllAsRead(void 0, category);
      if (result.success) {
        setNotifications(
          (prev) => prev.map((n) => ({ ...n, read: true }))
        );
      }
      return result;
    } catch (error2) {
      return { success: false, error: "Failed to mark all as read" };
    }
  }, [client]);
  const deleteNotification = useCallback(async (id) => {
    try {
      const result = await client.deleteNotification(id);
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        return true;
      }
      return false;
    } catch (error2) {
      return false;
    }
  }, [client]);
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  useEffect(() => {
    if (!options.autoRefresh) return;
    const interval = setInterval(fetchNotifications, options.refreshInterval || 3e4);
    return () => clearInterval(interval);
  }, [fetchNotifications, options.autoRefresh, options.refreshInterval]);
  useEffect(() => {
    const handleNotificationCreated = (event) => {
      const notification = event.detail;
      setNotifications((prev) => [notification, ...prev]);
    };
    window.addEventListener("notification:created", handleNotificationCreated);
    return () => {
      window.removeEventListener("notification:created", handleNotificationCreated);
    };
  }, []);
  return {
    notifications,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    delete: deleteNotification
  };
}
function useNotificationStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const client = new NotificationClientSDK({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
    websocketUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000",
    autoConnect: true
  });
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.getNotificationStats();
      if (result.success) {
        setStats(result.data || null);
      } else {
        setError(result.error || "Failed to fetch notification stats");
      }
    } catch (err) {
      setError("Failed to fetch notification stats");
    } finally {
      setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  return { stats, loading, error, fetchStats };
}
var priorityColors = {
  urgent: {
    icon: "alertCircle",
    bg: "bg-red-50",
    dot: "bg-red-500",
    iconColor: "text-red-500"
  },
  high: {
    icon: "alertCircle",
    bg: "bg-orange-50",
    dot: "bg-orange-400",
    iconColor: "text-orange-400"
  },
  normal: {
    icon: "bell",
    bg: "bg-blue-50",
    dot: "bg-blue-500",
    iconColor: "text-blue-500"
  },
  low: {
    icon: "bell",
    bg: "bg-gray-100",
    dot: "bg-gray-400",
    iconColor: "text-gray-400"
  }
};
function stripMarkdown(text) {
  if (!text) return "";
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^#+\s+/gm, "").replace(/^>\s+/gm, "").replace(/^-\s+/gm, "").replace(/\n{2,}/g, "\n").replace(/\s{2,}/g, " ").trim();
}
function NotificationDropdown({
  apiBaseUrl = "/api/notifications",
  websocketUrl,
  limit = 10,
  showUnreadOnly = false,
  onNotificationClick,
  onMarkAsRead,
  onDelete,
  onMarkAllAsRead,
  className = "",
  buttonClassName = "",
  contentClassName = "",
  translations = {},
  // UI Components
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Icons,
  cn,
  formatDistanceToNow,
  toast
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [ws, setWs] = useState(null);
  const [wsErrorLogged, setWsErrorLogged] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const t = {
    title: "Notifications",
    loading: "Loading...",
    noNotifications: "No notifications",
    allCaughtUp: "You're all caught up!",
    markAllRead: "Mark all read",
    markAsRead: "Mark as read",
    delete: "Delete",
    viewMore: "View more",
    viewAllNotifications: "View all notifications",
    prev: "Prev",
    next: "Next",
    page: "Page {page} of {pageCount}",
    ...translations
  };
  const fetchNotifications = useCallback(async (pageNum = page) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());
      if (pageNum) params.append("page", pageNum.toString());
      if (showUnreadOnly) params.append("read", "false");
      const response = await fetch(`${apiBaseUrl}?${params.toString()}`);
      const result = await response.json();
      console.log("[NotificationsDropdown] API Response:", result);
      if (result.success && Array.isArray(result.data)) {
        const validNotifications = result.data.map((notification) => ({
          id: notification.id || Date.now().toString(),
          recipientId: notification.recipientId || "unknown",
          type: notification.type || "info",
          title: notification.title || "Notification",
          body: notification.body || notification.message || "",
          data: notification.data || {},
          meta: notification.meta || {},
          read: Boolean(notification.read),
          createdAt: notification.createdAt || notification.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: notification.updatedAt || notification.updated_at || (/* @__PURE__ */ new Date()).toISOString()
        }));
        const filteredNotifications = showUnreadOnly ? validNotifications.filter((n) => !n.read) : validNotifications;
        setNotifications(filteredNotifications);
        setTotal(filteredNotifications.length);
        setTotalPages(Math.ceil(filteredNotifications.length / limit));
      } else {
        console.warn("[NotificationsDropdown] No data or invalid data:", result.data);
        setNotifications([]);
        setTotal(0);
        setTotalPages(1);
        setError("No notifications found");
      }
    } catch (err) {
      setError("Failed to fetch notifications");
      console.error("Error fetching notifications:", err);
      setNotifications([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, limit, showUnreadOnly, page]);
  useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/stats`);
      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, [apiBaseUrl]);
  const markAsRead = useCallback(async (id) => {
    try {
      const idStr = id.toString();
      setNotifications(
        (prev) => prev.map((n) => n.id === idStr ? { ...n, read: true } : n)
      );
      if (onMarkAsRead) {
        const success = await onMarkAsRead(idStr);
        if (!success) {
          setNotifications(
            (prev) => prev.map((n) => n.id === idStr ? { ...n, read: false } : n)
          );
        } else if (toast) {
          toast.success(t.markAsRead);
        }
        return success;
      }
      const response = await fetch(`${apiBaseUrl}/${idStr}/read`, { method: "PATCH" });
      const result = await response.json();
      if (!result.success) {
        setNotifications(
          (prev) => prev.map((n) => n.id === idStr ? { ...n, read: false } : n)
        );
      } else if (toast) {
        toast.success(t.markAsRead);
      }
      return result.success;
    } catch (err) {
      console.error("Error marking as read:", err);
      setNotifications(
        (prev) => prev.map((n) => n.id === id.toString() ? { ...n, read: false } : n)
      );
      return false;
    }
  }, [apiBaseUrl, onMarkAsRead, toast, t.markAsRead]);
  const deleteNotification = useCallback(async (id) => {
    try {
      const idStr = id.toString();
      setNotifications((prev) => prev.filter((n) => n.id !== idStr));
      if (onDelete) {
        const success = await onDelete(idStr);
        if (!success) {
          fetchNotifications();
        } else if (toast) {
          toast.success(t.delete);
        }
        return success;
      }
      const response = await fetch(`${apiBaseUrl}/${idStr}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) {
        fetchNotifications();
      } else if (toast) {
        toast.success(t.delete);
      }
      return result.success;
    } catch (err) {
      console.error("Error deleting notification:", err);
      fetchNotifications();
      return false;
    }
  }, [apiBaseUrl, onDelete, toast, t.delete, fetchNotifications]);
  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (onMarkAllAsRead) {
        try {
          await onMarkAllAsRead();
          if (toast) toast.success(t.markAllRead);
        } catch (err) {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: false })));
          throw err;
        }
        return;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/mark-all-read`, { method: "PATCH" });
        const result = await response.json();
        if (!result.success) {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: false })));
        } else if (toast) {
          toast.success(t.markAllRead);
        }
      } catch (err) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: false })));
        console.error("Error marking all as read:", err);
      }
      const unreadNotifications = notifications.filter((n) => !n.read);
      for (const notification of unreadNotifications) {
        await markAsRead(notification.id);
      }
      if (toast) toast.success(t.markAllRead);
    } catch (err) {
      console.error("Error marking all as read:", err);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: false })));
    }
  }, [notifications, markAsRead, onMarkAllAsRead, toast, t.markAllRead]);
  const goToPage = useCallback((pageNum) => {
    setPage(pageNum);
    fetchNotifications(pageNum);
  }, [fetchNotifications]);
  useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  useEffect(() => {
    if (!websocketUrl) return;
    const connectWebSocket = () => {
      const websocket = new WebSocket(websocketUrl);
      websocket.onopen = () => {
        console.log("WebSocket connected");
        setWs(websocket);
      };
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notification" && data.event === "notification:created") {
            setNotifications((prev) => [data.data, ...prev]);
            setStats((prev) => prev ? { ...prev, total: prev.total + 1, unread: prev.unread + 1 } : null);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      websocket.onclose = () => {
        console.log("WebSocket disconnected");
        setWs(null);
        setTimeout(connectWebSocket, 3e3);
      };
      websocket.onerror = (err) => {
        if (!wsErrorLogged) {
          console.warn("WebSocket connection failed - notifications will work without real-time updates");
          setWsErrorLogged(true);
        }
      };
    };
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [websocketUrl]);
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [notificationsResponse, statsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}?${new URLSearchParams({
          limit: limit.toString(),
          page: page.toString(),
          ...showUnreadOnly && { read: "false" }
        })}`),
        fetch(`${apiBaseUrl}/stats`)
      ]);
      const [notificationsResult, statsResult] = await Promise.all([
        notificationsResponse.json(),
        statsResponse.json()
      ]);
      if (notificationsResult.success && Array.isArray(notificationsResult.data)) {
        const validNotifications = notificationsResult.data.map((notification) => ({
          id: notification.id || Date.now().toString(),
          recipientId: notification.recipientId || "unknown",
          type: notification.type || "info",
          title: notification.title || "Notification",
          body: notification.body || notification.message || "",
          data: notification.data || {},
          meta: notification.meta || {},
          read: Boolean(notification.read),
          createdAt: notification.createdAt || notification.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: notification.updatedAt || notification.updated_at || (/* @__PURE__ */ new Date()).toISOString()
        }));
        const filteredNotifications = showUnreadOnly ? validNotifications.filter((n) => !n.read) : validNotifications;
        setNotifications(filteredNotifications);
        setTotal(filteredNotifications.length);
        setTotalPages(Math.ceil(filteredNotifications.length / limit));
      } else {
        setNotifications([]);
        setTotal(0);
        setTotalPages(1);
        setError("No notifications found");
      }
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (err) {
      setError("Failed to fetch data");
      console.error("Error fetching data:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, limit, page, showUnreadOnly]);
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAll();
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  const getPriorityAvatar = (priority) => {
    const color = priorityColors[priority] || priorityColors["low"];
    const Icon = Icons?.[color.icon];
    return /* @__PURE__ */ jsx("span", { className: `flex items-center justify-center rounded-full h-8 w-8 ${color.bg}`, children: Icon ? /* @__PURE__ */ jsx(Icon, { className: `h-4 w-4 ${color.iconColor}` }) : /* @__PURE__ */ jsx("div", { className: `h-4 w-4 rounded ${color.iconColor.replace("text-", "bg-")}` }) });
  };
  const getPriorityDotClass = (priority) => {
    const color = priorityColors[priority] || priorityColors["low"];
    return color.dot;
  };
  const getTranslationData = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.log("[NotificationsDropdown] No data or invalid data:", data);
      return {};
    }
    const translationData = {
      updatedBy: data.updatedBy || "System",
      changes: data.changes || "",
      plan: data.plan || "",
      activatedBy: data.activatedBy || "System",
      deactivatedBy: data.deactivatedBy || "System",
      reason: data.reason || "",
      expiredDate: data.expiredDate || "",
      ...data
    };
    return translationData;
  };
  const getNotificationText = (text, data) => {
    const isTranslationKey = text && text.includes(".") && text.length < 50 && !text.includes(" ");
    if (isTranslationKey) {
      try {
        return text;
      } catch (error2) {
        console.log("[NotificationsDropdown] Translation failed for key:", text, "Error:", error2);
        return text;
      }
    } else {
      return text;
    }
  };
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const ButtonComponent = Button || ((props) => /* @__PURE__ */ jsx("button", { ...props }));
  const BadgeComponent = Badge || ((props) => /* @__PURE__ */ jsx("span", { ...props }));
  const DropdownMenuComponent = DropdownMenu || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  const DropdownMenuContentComponent = DropdownMenuContent || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  const DropdownMenuItemComponent = DropdownMenuItem || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  const DropdownMenuLabelComponent = DropdownMenuLabel || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  const DropdownMenuSeparatorComponent = DropdownMenuSeparator || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  const DropdownMenuTriggerComponent = DropdownMenuTrigger || ((props) => /* @__PURE__ */ jsx("button", { ...props }));
  const ScrollAreaComponent = ScrollArea || ((props) => /* @__PURE__ */ jsx("div", { ...props }));
  return /* @__PURE__ */ jsxs(DropdownMenuComponent, { open: isOpen, onOpenChange: setIsOpen, children: [
    /* @__PURE__ */ jsx(DropdownMenuTriggerComponent, { asChild: true, children: /* @__PURE__ */ jsxs(
      ButtonComponent,
      {
        variant: "outline",
        size: "icon",
        className: "h-9 w-9 relative",
        children: [
          Icons?.bell ? /* @__PURE__ */ jsx(Icons.bell, { className: "h-5 w-5" }) : /* @__PURE__ */ jsx("div", { className: "h-5 w-5" }),
          unreadCount > 0 && /* @__PURE__ */ jsx(
            BadgeComponent,
            {
              className: "h-5 min-w-5 rounded-full px-1 inline-flex justify-center items-center text-xs tabular-nums absolute -top-3 -right-3 z-50 bg-red-500 text-white",
              variant: "destructive",
              children: unreadCount > 99 ? "99+" : unreadCount
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Toggle notifications" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(DropdownMenuContentComponent, { align: "start", className: "w-80 p-0 shadow-xl rounded-xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "p-3 border-b flex items-center justify-between", children: [
        /* @__PURE__ */ jsx(DropdownMenuLabelComponent, { className: "text-base font-semibold pl-0", children: t.title }),
        unreadCount > 0 && /* @__PURE__ */ jsx(
          ButtonComponent,
          {
            variant: "ghost",
            size: "sm",
            onClick: markAllAsRead,
            className: "h-6 px-2 text-xs",
            children: t.markAllRead
          }
        )
      ] }),
      /* @__PURE__ */ jsx(ScrollAreaComponent, { className: "h-80", children: loading ? /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center p-6", children: [
        Icons?.loader ? /* @__PURE__ */ jsx(Icons.loader, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx("div", { className: "h-4 w-4 animate-spin bg-gray-300 rounded" }),
        /* @__PURE__ */ jsx("span", { className: "ml-2 text-sm text-muted-foreground", children: t.loading })
      ] }) : notifications.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center p-8 text-center", children: [
        Icons?.bell ? /* @__PURE__ */ jsx(Icons.bell, { className: "h-7 w-7 text-muted-foreground mb-2" }) : /* @__PURE__ */ jsx("div", { className: "h-7 w-7 bg-gray-300 rounded mb-2" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: t.noNotifications }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: t.allCaughtUp })
      ] }) : /* @__PURE__ */ jsx("div", { children: notifications.filter((notification) => notification && notification.id).map((notification) => {
        const dotClass = getPriorityDotClass(notification.meta?.priority || "normal");
        const isExpanded = expandedId === notification.id;
        const isRead = notification.read;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: `relative flex flex-col border-l-4 ${isRead ? "bg-white border-l-transparent hover:bg-gray-50" : "bg-blue-50/30 border-l-blue-500 hover:bg-blue-50/50"} ${notification.data?.link ? "cursor-pointer" : ""}`,
            style: { minHeight: 64 },
            onMouseEnter: () => setHoveredId(notification.id),
            onMouseLeave: () => setHoveredId(null),
            children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "flex items-start gap-3 px-3 py-2 cursor-pointer",
                  onClick: () => setExpandedId(isExpanded ? null : notification.id),
                  children: [
                    /* @__PURE__ */ jsx("div", { className: "flex-shrink-0 mt-0.5", children: getPriorityAvatar(notification.meta?.priority || "normal") }),
                    /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                        /* @__PURE__ */ jsx("span", { className: `font-semibold text-xs truncate max-w-[120px] ${isRead ? "text-muted-foreground" : "text-foreground"}`, title: getNotificationText(notification.title, getTranslationData(notification.data)), children: getNotificationText(notification.title, getTranslationData(notification.data)) }),
                        !isRead && /* @__PURE__ */ jsx("span", { className: `ml-1 h-1.5 w-1.5 rounded-full inline-block ${dotClass}` })
                      ] }),
                      /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground mt-0.5 text-left line-clamp-1", children: stripMarkdown(getNotificationText(notification.body || notification.message, getTranslationData(notification.data))) }),
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-1", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] text-muted-foreground", children: (() => {
                          try {
                            const dateStr = notification.created_at || notification.createdAt;
                            if (!dateStr) return "recently";
                            const date = new Date(dateStr);
                            if (isNaN(date.getTime())) return "recently";
                            return formatDistanceToNow ? formatDistanceToNow(date, { addSuffix: true }) : "recently";
                          } catch {
                            return "recently";
                          }
                        })() }),
                        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                          !isRead && /* @__PURE__ */ jsx(
                            ButtonComponent,
                            {
                              variant: "ghost",
                              size: "icon",
                              onClick: (e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              },
                              className: "h-5 w-5 p-0 opacity-70 hover:opacity-100",
                              title: t.markAsRead,
                              children: Icons?.check ? /* @__PURE__ */ jsx(Icons.check, { className: "h-3 w-3 text-green-600" }) : /* @__PURE__ */ jsx("div", { className: "h-3 w-3 bg-green-600 rounded" })
                            }
                          ),
                          hoveredId === notification.id && /* @__PURE__ */ jsx(
                            ButtonComponent,
                            {
                              variant: "ghost",
                              size: "icon",
                              onClick: (e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              },
                              className: "h-5 w-5 p-0 text-muted-foreground hover:text-destructive",
                              title: t.delete,
                              children: Icons?.x ? /* @__PURE__ */ jsx(Icons.x, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx("div", { className: "h-3 w-3 bg-gray-400 rounded" })
                            }
                          ),
                          /* @__PURE__ */ jsx("div", { className: "h-5 w-5 flex items-center justify-center opacity-70", children: isExpanded ? Icons?.chevronUp ? /* @__PURE__ */ jsx(Icons.chevronUp, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx("div", { className: "h-3 w-3 bg-gray-400 rounded" }) : Icons?.chevronDown ? /* @__PURE__ */ jsx(Icons.chevronDown, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx("div", { className: "h-3 w-3 bg-gray-400 rounded" }) })
                        ] })
                      ] })
                    ] })
                  ]
                }
              ),
              isExpanded && (() => {
                const dataObj = getTranslationData(notification.data);
                return /* @__PURE__ */ jsx("div", { className: "px-3 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "p-3 rounded-lg bg-gray-50/80 border border-gray-200 text-xs flex flex-col gap-2", children: [
                  /* @__PURE__ */ jsx("div", { className: "font-semibold text-sm break-words", children: getNotificationText(notification.title) }),
                  /* @__PURE__ */ jsx("div", { className: "break-words whitespace-pre-line", children: stripMarkdown(getNotificationText(notification.body || notification.message)) }),
                  dataObj.adminNotes && dataObj.adminNotes.trim() !== "" && /* @__PURE__ */ jsx("div", { className: "mt-2 relative", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md", children: [
                    Icons?.quote ? /* @__PURE__ */ jsx(Icons.quote, { className: "h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" }) : /* @__PURE__ */ jsx("div", { className: "h-4 w-4 bg-blue-500 rounded flex-shrink-0 mt-0.5" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                      /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold text-blue-800 mb-1", children: "Admin notes:" }),
                      /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-700", children: dataObj.adminNotes })
                    ] }),
                    Icons?.quote ? /* @__PURE__ */ jsx(Icons.quote, { className: "h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5 rotate-180" }) : /* @__PURE__ */ jsx("div", { className: "h-4 w-4 bg-blue-500 rounded flex-shrink-0 mt-0.5 rotate-180" })
                  ] }) }),
                  notification.data?.link && /* @__PURE__ */ jsxs(
                    "a",
                    {
                      href: notification.data.link,
                      className: "mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium",
                      onClick: async (e) => {
                        e.stopPropagation();
                        await markAsRead(notification.id);
                      },
                      children: [
                        Icons?.externalLink ? /* @__PURE__ */ jsx(Icons.externalLink, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx("div", { className: "h-3 w-3 bg-blue-600 rounded" }),
                        " ",
                        t.viewMore
                      ]
                    }
                  )
                ] }) });
              })()
            ]
          },
          notification.id
        );
      }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-t bg-white", children: [
        /* @__PURE__ */ jsx(
          ButtonComponent,
          {
            variant: "ghost",
            size: "sm",
            disabled: !hasPrev,
            onClick: () => goToPage(page - 1),
            children: t.prev
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: t.page.replace("{page}", page.toString()).replace("{pageCount}", totalPages.toString()) }),
        /* @__PURE__ */ jsx(
          ButtonComponent,
          {
            variant: "ghost",
            size: "sm",
            disabled: !hasNext,
            onClick: () => goToPage(page + 1),
            children: t.next
          }
        )
      ] }),
      /* @__PURE__ */ jsx(DropdownMenuSeparatorComponent, {}),
      /* @__PURE__ */ jsx(
        DropdownMenuItemComponent,
        {
          className: "justify-center text-xs text-muted-foreground cursor-pointer py-2",
          onClick: () => {
            setIsOpen(false);
            window.location.href = "/dashboard/notifications";
          },
          children: t.viewAllNotifications
        }
      )
    ] })
  ] });
}

export { DefaultWebSocketAdapter, InMemoryStorageAdapter, NotificationClientSDK, NotificationDropdown, Notifications, useNotificationStats, useNotifications };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map