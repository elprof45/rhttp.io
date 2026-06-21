/**
 * POLLING MANAGER - CORRECTED VERSION
 * Fixes:
 * 1. Execute immediately on first poll (don't wait interval)
 * 2. Return last result when maxAttempts reached
 * 3. Proper promise resolution
 */

import type { PollingConfig } from "./types";

export class PollingManager {
  private defaultOptions: Partial<PollingConfig>;
  private timers: Map<string, { timer: NodeJS.Timeout; resolve: (value: any) => void }> = new Map();
  private lastResults: Map<string, any> = new Map();

  constructor(defaultOptions: Partial<PollingConfig> = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Poll with immediate first execution
   * @param fn Function to execute repeatedly
   * @param config Polling configuration
   * @param requestId Unique ID for this polling session
   * @returns Promise that resolves when stopCondition is met or maxAttempts reached
   */
  async poll<T>(
    fn: () => Promise<T>,
    config?: Partial<PollingConfig>,
    requestId: string = "default"
  ): Promise<T> {
    const mergedConfig = {
      interval: 1000,
      maxAttempts: Infinity,
      ...this.defaultOptions,
      ...config,
    };

    let attempt = 0;
    const maxAttempts = mergedConfig.maxAttempts ?? Infinity;
    let lastResult: T | undefined;

    return new Promise((resolve, reject) => {
      const executePoll = async () => {
        try {
          attempt++;

          // Check maxAttempts BEFORE executing
          if (attempt > maxAttempts) {
            this.timers.delete(requestId);
            this.lastResults.delete(requestId);
            // Return last result or undefined
            resolve(lastResult as T);
            return;
          }

          // Execute the polling function
          const result = await fn();
          lastResult = result;

          // Store result for later retrieval
          this.lastResults.set(requestId, result);

          // Check stop condition
          if (mergedConfig.stopCondition?.(result)) {
            this.timers.delete(requestId);
            this.lastResults.delete(requestId);
            resolve(result);
            return;
          }

          // Schedule next poll - DON'T create a new Promise, just reschedule
          const timer = setTimeout(executePoll, mergedConfig.interval);
          this.timers.set(requestId, { timer, resolve });
        } catch (error) {
          this.timers.delete(requestId);
          this.lastResults.delete(requestId);
          reject(error);
        }
      };

      // Execute IMMEDIATELY for first attempt (don't delay)
      executePoll().catch((err) => {
        reject(err);
      });
    });
  }

  /**
   * Poll with interval between first and subsequent requests
   * Use this if you want to delay the first request
   */
  async pollWithDelay<T>(
    fn: () => Promise<T>,
    config?: Partial<PollingConfig>,
    requestId: string = "default"
  ): Promise<T> {
    const mergedConfig = {
      interval: 1000,
      maxAttempts: Infinity,
      ...this.defaultOptions,
      ...config,
    };

    let attempt = 0;
    const maxAttempts = mergedConfig.maxAttempts ?? Infinity;
    let lastResult: T | undefined;

    return new Promise((resolve, reject) => {
      const executePoll = async () => {
        try {
          attempt++;

          if (attempt > maxAttempts) {
            this.timers.delete(requestId);
            this.lastResults.delete(requestId);
            resolve(lastResult as T);
            return;
          }

          const result = await fn();
          lastResult = result;
          this.lastResults.set(requestId, result);

          if (mergedConfig.stopCondition?.(result)) {
            this.timers.delete(requestId);
            this.lastResults.delete(requestId);
            resolve(result);
            return;
          }

          const timer = setTimeout(executePoll, mergedConfig.interval);
          this.timers.set(requestId, { timer, resolve });
        } catch (error) {
          this.timers.delete(requestId);
          this.lastResults.delete(requestId);
          reject(error);
        }
      };

      // Delay first execution
      const timer = setTimeout(executePoll, mergedConfig.interval);
      this.timers.set(requestId, { timer, resolve });
    });
  }

  stop(requestId: string = "default") {
    const entry = this.timers.get(requestId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.resolve(this.lastResults.get(requestId));
      this.timers.delete(requestId);
      this.lastResults.delete(requestId);
    }
  }

  stopAll() {
    for (const entry of this.timers.values()) {
      clearTimeout(entry.timer);
      entry.resolve(undefined);
    }
    this.timers.clear();
    this.lastResults.clear();
  }

  getLastResult(requestId: string = "default") {
    return this.lastResults.get(requestId);
  }
}
