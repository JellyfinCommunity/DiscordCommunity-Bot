/**
 * Soft rate limiting to prevent command abuse without breaking normal usage
 * Uses a sliding window approach per user
 */

import { botLogger as log } from './logger.js';

class RateLimiter {
    constructor() {
        // Map of userId -> { timestamps: number[], warned: boolean }
        this.userRequests = new Map();

        // Default limits (can be overridden per command)
        this.defaults = {
            windowMs: 60000,      // 1 minute window
            maxRequests: 10,      // Max 10 requests per window
            warnThreshold: 8,     // Warn at 8 requests
            blockDurationMs: 30000 // Block for 30 seconds after exceeding
        };

        // Per-command overrides
        this.commandLimits = new Map();

        // Blocked users: userId -> unblockTime
        this.blocked = new Map();

        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Set custom limits for a specific command
     * @param {string} commandName - Command name
     * @param {Object} limits - Custom limits
     */
    setCommandLimits(commandName, limits) {
        this.commandLimits.set(commandName, { ...this.defaults, ...limits });
    }

    /**
     * Get limits for a command (custom or default)
     * @param {string} commandName - Command name
     * @returns {Object} Limits configuration
     */
    getLimits(commandName) {
        return this.commandLimits.get(commandName) || this.defaults;
    }

    /**
     * Check if a user can execute a command
     * @param {string} userId - Discord user ID
     * @param {string} commandName - Command being executed
     * @returns {{ allowed: boolean, warning: boolean, retryAfter?: number, message?: string }}
     */
    check(userId, commandName = 'default') {
        const now = Date.now();
        const limits = this.getLimits(commandName);

        // Check if user is blocked
        const unblockTime = this.blocked.get(userId);
        if (unblockTime && now < unblockTime) {
            const retryAfter = Math.ceil((unblockTime - now) / 1000);
            return {
                allowed: false,
                warning: false,
                retryAfter,
                message: `You're sending commands too quickly. Please wait ${retryAfter} seconds.`
            };
        } else if (unblockTime) {
            this.blocked.delete(userId);
        }

        // Get or create user entry
        const key = `${userId}:${commandName}`;
        let userData = this.userRequests.get(key);
        if (!userData) {
            userData = { timestamps: [], warned: false };
            this.userRequests.set(key, userData);
        }

        // Clean old timestamps outside the window
        const windowStart = now - limits.windowMs;
        userData.timestamps = userData.timestamps.filter(ts => ts > windowStart);

        // Check if at limit
        if (userData.timestamps.length >= limits.maxRequests) {
            // Block the user
            this.blocked.set(userId, now + limits.blockDurationMs);
            log.warn({ userId, commandName, requests: userData.timestamps.length }, 'User rate limited');

            return {
                allowed: false,
                warning: false,
                retryAfter: Math.ceil(limits.blockDurationMs / 1000),
                message: `You've exceeded the rate limit. Please wait ${Math.ceil(limits.blockDurationMs / 1000)} seconds.`
            };
        }

        // Check if approaching limit (warn once per window)
        let warning = false;
        if (userData.timestamps.length >= limits.warnThreshold && !userData.warned) {
            userData.warned = true;
            warning = true;
        }

        // Reset warned flag if requests drop below threshold
        if (userData.timestamps.length < limits.warnThreshold) {
            userData.warned = false;
        }

        // Record this request
        userData.timestamps.push(now);

        return {
            allowed: true,
            warning,
            remaining: limits.maxRequests - userData.timestamps.length,
            message: warning ? `You're approaching the rate limit. Please slow down.` : undefined
        };
    }

    /**
     * Clean up old entries to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();

        // Clean user requests older than 10 minutes
        for (const [key, userData] of this.userRequests.entries()) {
            if (userData.timestamps.length === 0 ||
                Math.max(...userData.timestamps) < now - 10 * 60 * 1000) {
                this.userRequests.delete(key);
            }
        }

        // Clean expired blocks
        for (const [userId, unblockTime] of this.blocked.entries()) {
            if (now >= unblockTime) {
                this.blocked.delete(userId);
            }
        }

        log.debug({
            activeUsers: this.userRequests.size,
            blockedUsers: this.blocked.size
        }, 'Rate limiter cleanup complete');
    }

    /**
     * Get current stats
     * @returns {Object} Current rate limiter stats
     */
    getStats() {
        return {
            trackedUsers: this.userRequests.size,
            blockedUsers: this.blocked.size,
            commandOverrides: this.commandLimits.size
        };
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
