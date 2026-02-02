/**
 * Centralized timer management for graceful shutdown
 * Tracks all intervals, timeouts, and cron jobs to enable proper cleanup
 */

import { createModuleLogger } from './logger.js';

const log = createModuleLogger('timer-manager');

class TimerManager {
    constructor() {
        this.intervals = new Map();
        this.timeouts = new Map();
        this.cronJobs = new Map();
        this.isShuttingDown = false;
    }

    /**
     * Register a setInterval with automatic tracking.
     * @param {string} name - Unique identifier for the interval
     * @param {Function} callback - Interval callback function
     * @param {number} delay - Interval delay in milliseconds
     * @returns {NodeJS.Timeout|null} Interval ID or null if shutting down
     */
    setInterval(name, callback, delay) {
        if (this.isShuttingDown) {
            log.warn({ timer: name }, 'Timer not started - shutdown in progress');
            return null;
        }

        // Clear existing interval with same name if any
        if (this.intervals.has(name)) {
            clearInterval(this.intervals.get(name));
        }

        const id = setInterval(callback, delay);
        this.intervals.set(name, id);
        log.debug({ timer: name, intervalSeconds: Math.round(delay / 1000) }, 'Interval registered');
        return id;
    }

    /**
     * Register a setTimeout with automatic tracking.
     * @param {string} name - Unique identifier for the timeout
     * @param {Function} callback - Timeout callback function
     * @param {number} delay - Timeout delay in milliseconds
     * @returns {NodeJS.Timeout|null} Timeout ID or null if shutting down
     */
    setTimeout(name, callback, delay) {
        if (this.isShuttingDown) {
            log.warn({ timer: name }, 'Timeout not started - shutdown in progress');
            return null;
        }

        // Clear existing timeout with same name if any
        if (this.timeouts.has(name)) {
            clearTimeout(this.timeouts.get(name));
        }

        const id = setTimeout(() => {
            this.timeouts.delete(name);
            callback();
        }, delay);

        this.timeouts.set(name, id);
        return id;
    }

    /**
     * Register a cron job with automatic tracking.
     * @param {string} name - Unique identifier for the cron job
     * @param {Object} job - Cron job instance (from node-cron)
     * @returns {Object|null} The cron job or null if shutting down
     */
    registerCron(name, job) {
        if (this.isShuttingDown) {
            log.warn({ cron: name }, 'Cron not registered - shutdown in progress');
            return null;
        }

        // Stop existing job with same name if any
        if (this.cronJobs.has(name)) {
            this.cronJobs.get(name).stop();
        }

        this.cronJobs.set(name, job);
        log.debug({ cron: name }, 'Cron job registered');
        return job;
    }

    /**
     * Clear a specific timeout by name.
     * @param {string} name - Timeout identifier
     */
    clearTimeout(name) {
        if (this.timeouts.has(name)) {
            clearTimeout(this.timeouts.get(name));
            this.timeouts.delete(name);
        }
    }

    /**
     * Clear a specific interval by name.
     * @param {string} name - Interval identifier
     */
    clearInterval(name) {
        if (this.intervals.has(name)) {
            clearInterval(this.intervals.get(name));
            this.intervals.delete(name);
        }
    }

    /**
     * Stop a specific cron job by name.
     * @param {string} name - Cron job identifier
     */
    stopCron(name) {
        if (this.cronJobs.has(name)) {
            this.cronJobs.get(name).stop();
            this.cronJobs.delete(name);
        }
    }

    /**
     * Clear all registered timers (for graceful shutdown).
     */
    clearAll() {
        this.isShuttingDown = true;

        if (this.intervals.size > 0) {
            log.info({ count: this.intervals.size }, 'Clearing intervals');
            for (const [name, id] of this.intervals) {
                clearInterval(id);
                log.debug({ timer: name }, 'Cleared interval');
            }
            this.intervals.clear();
        }

        if (this.timeouts.size > 0) {
            log.info({ count: this.timeouts.size }, 'Clearing timeouts');
            for (const [name, id] of this.timeouts) {
                clearTimeout(id);
                log.debug({ timer: name }, 'Cleared timeout');
            }
            this.timeouts.clear();
        }

        if (this.cronJobs.size > 0) {
            log.info({ count: this.cronJobs.size }, 'Stopping cron jobs');
            for (const [name, job] of this.cronJobs) {
                job.stop();
                log.debug({ cron: name }, 'Stopped cron');
            }
            this.cronJobs.clear();
        }

        log.info('All timers cleared');
    }

    /**
     * Get timer statistics.
     * @returns {Object} Timer counts
     */
    getStats() {
        return {
            intervals: this.intervals.size,
            timeouts: this.timeouts.size,
            cronJobs: this.cronJobs.size,
            isShuttingDown: this.isShuttingDown
        };
    }
}

// Singleton instance
export const timerManager = new TimerManager();
