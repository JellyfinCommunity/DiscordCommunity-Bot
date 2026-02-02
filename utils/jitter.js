/**
 * Jitter utilities to prevent thundering herd problems
 * Adds randomness to intervals so multiple feeds don't sync up and hammer upstreams
 */

/**
 * Add jitter to an interval value
 * @param {number} baseInterval - Base interval in milliseconds
 * @param {number} jitterPercent - Percentage of jitter (0-1, default 0.1 = 10%)
 * @returns {number} Interval with jitter applied
 */
export function addJitter(baseInterval, jitterPercent = 0.1) {
    const jitterRange = baseInterval * jitterPercent;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange
    return Math.round(baseInterval + jitter);
}

/**
 * Add positive jitter only (delay, never early)
 * @param {number} baseInterval - Base interval in milliseconds
 * @param {number} maxJitterPercent - Maximum additional delay as percentage (0-1, default 0.2 = 20%)
 * @returns {number} Interval with positive jitter
 */
export function addPositiveJitter(baseInterval, maxJitterPercent = 0.2) {
    const maxJitter = baseInterval * maxJitterPercent;
    const jitter = Math.random() * maxJitter;
    return Math.round(baseInterval + jitter);
}

/**
 * Get a random delay for staggering initial startup tasks
 * @param {number} maxDelayMs - Maximum delay in milliseconds
 * @returns {number} Random delay
 */
export function getStartupDelay(maxDelayMs = 30000) {
    return Math.round(Math.random() * maxDelayMs);
}
