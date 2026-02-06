/**
 * Atomic JSON file operations
 * Prevents data corruption by using temp files and atomic renames
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('atomic-json');

/**
 * Write JSON data atomically to a file.
 * Pattern: write to .tmp, backup existing to .bak, then atomic rename.
 * @param {string} filePath - Path to the JSON file
 * @param {*} data - Data to serialize and write
 */
export async function writeJsonAtomic(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;
    const jsonData = JSON.stringify(data, null, 2);

    try {
        // Write to temp file first
        await fs.writeFile(tempPath, jsonData, 'utf8');

        // Backup existing file if it exists
        try {
            await fs.access(filePath);
            await fs.copyFile(filePath, backupPath);
        } catch {
            // File doesn't exist yet, no backup needed
        }

        // Atomic rename temp to target
        await fs.rename(tempPath, filePath);
    } catch (error) {
        // Clean up temp file on failure
        try {
            await fs.unlink(tempPath);
        } catch {
            // Ignore cleanup errors
        }
        log.error({ err: error, filePath }, 'Failed to write JSON atomically');
        throw error;
    }
}

/**
 * Write JSON data atomically to a file (synchronous version).
 * Pattern: write to .tmp, backup existing to .bak, then atomic rename.
 * @param {string} filePath - Path to the JSON file
 * @param {*} data - Data to serialize and write
 */
export function writeJsonAtomicSync(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;
    const jsonData = JSON.stringify(data, null, 2);

    try {
        // Write to temp file first
        fsSync.writeFileSync(tempPath, jsonData, 'utf8');

        // Backup existing file if it exists
        if (fsSync.existsSync(filePath)) {
            fsSync.copyFileSync(filePath, backupPath);
        }

        // Atomic rename temp to target
        fsSync.renameSync(tempPath, filePath);
    } catch (error) {
        // Clean up temp file on failure
        try {
            fsSync.unlinkSync(tempPath);
        } catch {
            // Ignore cleanup errors
        }
        log.error({ err: error, filePath }, 'Failed to write JSON atomically (sync)');
        throw error;
    }
}

/**
 * Read JSON file with automatic recovery from backup.
 * If the main file is corrupted or missing, attempts to restore from .bak file.
 * @param {string} filePath - Path to the JSON file
 * @param {*} defaultValue - Default value if file and backup don't exist
 * @returns {Promise<*>} Parsed JSON data or default value
 */
export async function readJsonWithRecovery(filePath, defaultValue = null) {
    const backupPath = `${filePath}.bak`;

    // Try reading main file
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (mainError) {
        // Main file failed, try backup
        if (mainError.code !== 'ENOENT') {
            log.warn({ err: mainError, filePath }, 'Main JSON file corrupted, trying backup');
        }

        try {
            const backupData = await fs.readFile(backupPath, 'utf8');
            const parsed = JSON.parse(backupData);
            log.info({ filePath }, 'Recovered from backup file');

            // Restore backup to main file
            try {
                await writeJsonAtomic(filePath, parsed);
                log.info({ filePath }, 'Restored main file from backup');
            } catch {
                // Log but don't fail - we have the data
                log.warn({ filePath }, 'Could not restore main file from backup');
            }

            return parsed;
        } catch (backupError) {
            // Both files failed
            if (mainError.code === 'ENOENT' && backupError.code === 'ENOENT') {
                // Neither file exists, return default
                return defaultValue;
            }

            log.error({ mainError, backupError, filePath }, 'Both main and backup files failed');
            return defaultValue;
        }
    }
}

/**
 * Read JSON file with automatic recovery from backup (synchronous version).
 * If the main file is corrupted or missing, attempts to restore from .bak file.
 * @param {string} filePath - Path to the JSON file
 * @param {*} defaultValue - Default value if file and backup don't exist
 * @returns {*} Parsed JSON data or default value
 */
export function readJsonWithRecoverySync(filePath, defaultValue = null) {
    const backupPath = `${filePath}.bak`;

    // Try reading main file
    try {
        const data = fsSync.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (mainError) {
        // Main file failed, try backup
        if (mainError.code !== 'ENOENT') {
            log.warn({ err: mainError, filePath }, 'Main JSON file corrupted, trying backup');
        }

        try {
            const backupData = fsSync.readFileSync(backupPath, 'utf8');
            const parsed = JSON.parse(backupData);
            log.info({ filePath }, 'Recovered from backup file');

            // Restore backup to main file
            try {
                writeJsonAtomicSync(filePath, parsed);
                log.info({ filePath }, 'Restored main file from backup');
            } catch {
                // Log but don't fail - we have the data
                log.warn({ filePath }, 'Could not restore main file from backup');
            }

            return parsed;
        } catch (backupError) {
            // Both files failed
            if (mainError.code === 'ENOENT' && backupError.code === 'ENOENT') {
                // Neither file exists, return default
                return defaultValue;
            }

            log.error({ mainError, backupError, filePath }, 'Both main and backup files failed');
            return defaultValue;
        }
    }
}
