/**
 * Offline message queue with localStorage persistence
 */

import type { OfflineQueueConfig, OfflineMessage } from "./types";

export class OfflineQueue {
  private queue: OfflineMessage[] = [];
  private config: OfflineQueueConfig;
  private storageKey: string;

  constructor(config?: OfflineQueueConfig) {
    this.config = config || { enabled: false };
    this.storageKey = this.config.storageKey || "rhttp.io/realtime:offline-queue";
    this.load();
  }

  add(event: string, data: any, room?: string): void {
    if (!this.config.enabled) {
      return;
    }

    const maxSize = this.config.maxSize ?? 100;
    if (this.queue.length >= maxSize) {
      this.queue.shift(); // Remove oldest
    }

    const message: OfflineMessage = {
      id: this.generateId(),
      event,
      data,
      timestamp: Date.now(),
      room,
    };

    this.queue.push(message);
    this.persist();
  }

  getAll(): OfflineMessage[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    this.remove();
  }

  flush(): OfflineMessage[] {
    const messages = [...this.queue];
    this.clear();
    return messages;
  }

  length(): number {
    return this.queue.length;
  }

  private persist(): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to persist offline queue:", error);
    }
  }

  private load(): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load offline queue:", error);
      this.queue = [];
    }
  }

  private remove(): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to remove offline queue:", error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
