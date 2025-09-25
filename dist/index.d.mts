import { EventEmitter } from 'eventemitter3';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

/**
 * Core Types for @webdevarif/notifications
 */
interface NotificationPayload {
    id: string;
    recipientId: string | number;
    type: string;
    title: string;
    body: string;
    data?: any;
    meta?: {
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        category?: string;
        entity_type?: string;
        entity_id?: string | number;
        link?: string;
        language?: string;
        useAI?: boolean;
        [key: string]: any;
    };
    read: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
}
interface CreateNotificationInput {
    recipientId: string | number;
    type: string;
    title: string;
    body: string;
    data?: any;
    meta?: any;
}
interface NotificationFilters {
    recipientId?: string | number;
    read?: boolean;
    type?: string;
    category?: string;
    priority?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
interface NotificationCount {
    total: number;
    unread: number;
    read: number;
    byType: Record<string, number>;
}
interface NotificationConfig {
    storageAdapter: StorageAdapter$1;
    websocketAdapter?: WebSocketAdapter;
    hooks?: NotificationHooks;
    defaultType?: string;
    maxRetries?: number;
    retryDelay?: number;
}
interface NotificationHooks {
    onBeforeCreate?: (notification: CreateNotificationInput) => Promise<CreateNotificationInput> | CreateNotificationInput;
    onAfterCreate?: (notification: NotificationPayload) => Promise<void> | void;
    onBeforeDelete?: (id: string) => Promise<boolean> | boolean;
    onAfterDelete?: (id: string) => Promise<void> | void;
}
interface NotificationEvents {
    'notification:created': (notification: NotificationPayload) => void;
    'notification:updated': (notification: NotificationPayload) => void;
    'notification:deleted': (id: string) => void;
}
interface NotificationType {
    name: string;
    config: NotificationTypeConfig;
}
interface NotificationTypeConfig {
    defaultPriority?: 'low' | 'normal' | 'high' | 'urgent';
    defaultCategory?: string;
    autoRead?: boolean;
    expiresIn?: number;
    retryable?: boolean;
    maxRetries?: number;
}
interface StorageAdapter$1 {
    save(notification: NotificationPayload): Promise<NotificationPayload>;
    find(filters: NotificationFilters): Promise<NotificationPayload[]>;
    findOne(id: string): Promise<NotificationPayload | null>;
    update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null>;
    delete(id: string): Promise<boolean>;
    count(filters?: NotificationFilters): Promise<number>;
}
interface WebSocketAdapter {
    broadcastToRecipient(recipientId: string | number, notification: NotificationPayload): Promise<void>;
    broadcast(notification: NotificationPayload): Promise<void>;
}
interface NotificationService<T = any> {
    create(input: CreateNotificationInput): Promise<NotificationPayload>;
    get(filters: NotificationFilters): Promise<NotificationPayload[]>;
    getOne(id: string): Promise<NotificationPayload | null>;
    markAsRead(id: string): Promise<NotificationPayload | null>;
    markAsUnread(id: string): Promise<NotificationPayload | null>;
    markAllAsRead(recipientId: string | number, category?: string): Promise<{
        success: boolean;
        updatedCount?: number;
        error?: string;
    }>;
    delete(id: string): Promise<boolean>;
    count(filters?: NotificationFilters): Promise<NotificationCount>;
}

/**
 * Core Notifications service
 */

declare class Notifications extends EventEmitter implements NotificationService {
    private storageAdapter;
    private websocketAdapter?;
    private hooks?;
    private defaultType;
    private maxRetries;
    private retryDelay;
    private notificationTypes;
    constructor(config: NotificationConfig);
    /**
     * Register a notification type with its configuration
     */
    registerType(type: string, config: NotificationTypeConfig): void;
    /**
     * Get notification type configuration
     */
    getTypeConfig(type: string): NotificationTypeConfig | undefined;
    /**
     * Create a new notification
     */
    create(input: CreateNotificationInput): Promise<NotificationPayload>;
    /**
     * Get notifications with optional filters
     */
    get(filters?: NotificationFilters): Promise<NotificationPayload[]>;
    /**
     * Get a single notification by ID
     */
    getOne(id: string): Promise<NotificationPayload | null>;
    /**
     * Mark a notification as read
     */
    markAsRead(id: string): Promise<NotificationPayload | null>;
    /**
     * Mark a notification as unread
     */
    markAsUnread(id: string): Promise<NotificationPayload | null>;
    /**
     * Mark all notifications as read/unread for a recipient
     */
    markAll(recipientId: string, read: boolean): Promise<number>;
    /**
     * Mark all notifications as read for a recipient
     */
    markAllAsRead(recipientId: string | number, category?: string): Promise<{
        success: boolean;
        updatedCount?: number;
        error?: string;
    }>;
    /**
     * Delete a notification
     */
    delete(id: string): Promise<boolean>;
    /**
     * Get notification count with optional filters
     */
    count(filters?: Omit<NotificationFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>): Promise<NotificationCount>;
    /**
     * Emit a custom event
     */
    emitEvent(event: keyof NotificationEvents, data: any): boolean;
    /**
     * Register event listener
     */
    onEvent(event: keyof NotificationEvents, callback: (data: any) => void): this;
    /**
     * Remove event listener
     */
    offEvent(event: keyof NotificationEvents, callback: (data: any) => void): this;
    /**
     * Get WebSocket adapter
     */
    getWebSocketAdapter(): WebSocketAdapter | undefined;
    /**
     * Get storage adapter
     */
    getStorageAdapter(): StorageAdapter$1;
    /**
     * Generate a unique ID
     */
    private generateId;
    /**
     * Register default notification types
     */
    private registerDefaultTypes;
}

/**
 * Storage Adapter Interface and Implementations
 */

interface StorageAdapter {
    save(notification: NotificationPayload): Promise<NotificationPayload>;
    find(filters: any): Promise<NotificationPayload[]>;
    findOne(id: string): Promise<NotificationPayload | null>;
    update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null>;
    delete(id: string): Promise<boolean>;
    count(filters?: any): Promise<number>;
}
declare class InMemoryStorageAdapter implements StorageAdapter {
    private notifications;
    save(notification: NotificationPayload): Promise<NotificationPayload>;
    find(filters?: any): Promise<NotificationPayload[]>;
    findOne(id: string): Promise<NotificationPayload | null>;
    update(id: string, updates: Partial<NotificationPayload>): Promise<NotificationPayload | null>;
    delete(id: string): Promise<boolean>;
    count(filters?: any): Promise<number>;
}

/**
 * WebSocket adapters for the notifications system
 */

/**
 * Default WebSocket adapter using the 'ws' library
 */
declare class DefaultWebSocketAdapter extends EventEmitter implements WebSocketAdapter {
    private ws;
    private url;
    private reconnectInterval;
    private maxReconnectAttempts;
    private reconnectAttempts;
    private isConnected;
    private reconnectTimer?;
    constructor(url: string, options?: {
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
    });
    connect(): Promise<void>;
    private handleReconnect;
    broadcastToRecipient(recipientId: string | number, notification: any): Promise<void>;
    broadcast(notification: any): Promise<void>;
    close(): void;
    get connected(): boolean;
}

/**
 * Client SDK for @webdevarif/notifications
 */

interface ClientConfig {
    baseUrl: string;
    websocketUrl?: string;
    autoConnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    endpoints?: {
        notifications: string;
        markAsRead: string;
        markAsUnread: string;
        markAll: string;
        count: string;
    };
}
declare class NotificationClientSDK {
    private config;
    private ws?;
    constructor(config: ClientConfig);
    private connect;
    private handleMessage;
    getNotifications(filters?: NotificationFilters): Promise<{
        success: boolean;
        data?: NotificationPayload[];
        total?: number;
        error?: string;
    }>;
    markAsRead(id: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    markAsUnread(id: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    markAllAsRead(recipientId?: string | number, category?: string): Promise<{
        success: boolean;
        updatedCount?: number;
        error?: string;
    }>;
    deleteNotification(id: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getNotificationStats(): Promise<{
        success: boolean;
        data?: NotificationCount;
        error?: string;
    }>;
    close(): void;
}

/**
 * React Hooks for @webdevarif/notifications
 */

interface UseNotificationsOptions extends NotificationFilters {
    autoRefresh?: boolean;
    refreshInterval?: number;
}
interface UseNotificationsReturn {
    notifications: NotificationPayload[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    markAsRead: (id: string) => Promise<boolean>;
    markAsUnread: (id: string) => Promise<boolean>;
    markAllAsRead: (category?: string) => Promise<{
        success: boolean;
        updatedCount?: number;
        error?: string;
    }>;
    delete: (id: string) => Promise<boolean>;
}
declare function useNotifications(options?: UseNotificationsOptions): UseNotificationsReturn;
declare function useNotificationStats(): {
    stats: NotificationCount | null;
    loading: boolean;
    error: string | null;
    fetchStats: () => Promise<void>;
};

interface NotificationDropdownProps {
    apiBaseUrl?: string;
    websocketUrl?: string;
    limit?: number;
    showUnreadOnly?: boolean;
    onNotificationClick?: (notification: NotificationPayload) => void;
    onMarkAsRead?: (id: string) => Promise<boolean>;
    onDelete?: (id: string) => Promise<boolean>;
    onMarkAllAsRead?: () => Promise<void>;
    className?: string;
    buttonClassName?: string;
    contentClassName?: string;
    translations?: {
        title?: string;
        loading?: string;
        noNotifications?: string;
        allCaughtUp?: string;
        markAllRead?: string;
        markAsRead?: string;
        delete?: string;
        viewMore?: string;
        viewAllNotifications?: string;
        prev?: string;
        next?: string;
        page?: string;
    };
    Button?: React.ComponentType<any>;
    Badge?: React.ComponentType<any>;
    DropdownMenu?: React.ComponentType<any>;
    DropdownMenuContent?: React.ComponentType<any>;
    DropdownMenuItem?: React.ComponentType<any>;
    DropdownMenuLabel?: React.ComponentType<any>;
    DropdownMenuSeparator?: React.ComponentType<any>;
    DropdownMenuTrigger?: React.ComponentType<any>;
    ScrollArea?: React.ComponentType<any>;
    Icons?: {
        bell?: React.ComponentType<any>;
        loader?: React.ComponentType<any>;
        check?: React.ComponentType<any>;
        x?: React.ComponentType<any>;
        chevronDown?: React.ComponentType<any>;
        chevronUp?: React.ComponentType<any>;
        externalLink?: React.ComponentType<any>;
        quote?: React.ComponentType<any>;
        alertCircle?: React.ComponentType<any>;
    };
    cn?: (classes: string) => string;
    formatDistanceToNow?: (date: Date, options?: any) => string;
    toast?: {
        success: (message: string) => void;
        error: (message: string) => void;
    };
}
declare function NotificationDropdown({ apiBaseUrl, websocketUrl, limit, showUnreadOnly, onNotificationClick, onMarkAsRead, onDelete, onMarkAllAsRead, className, buttonClassName, contentClassName, translations, Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, ScrollArea, Icons, cn, formatDistanceToNow, toast }: NotificationDropdownProps): react_jsx_runtime.JSX.Element;

export { type ClientConfig, type CreateNotificationInput, DefaultWebSocketAdapter, InMemoryStorageAdapter, NotificationClientSDK, type NotificationConfig, type NotificationCount, NotificationDropdown, type NotificationDropdownProps, type NotificationEvents, type NotificationFilters, type NotificationHooks, type NotificationPayload, type NotificationService, type NotificationType, type NotificationTypeConfig, Notifications, type StorageAdapter, type UseNotificationsOptions, type UseNotificationsReturn, type WebSocketAdapter, useNotificationStats, useNotifications };
