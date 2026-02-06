/**
 * Generic validation utilities
 * Single Responsibility: Validate data structures against schemas
 */

import { botLogger as log } from './logger.js';

/**
 * Validate JSON data against expected structure
 * @param {any} data - Data to validate
 * @param {Object} schema - Simple schema definition
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStructure(data, schema) {
    const errors = [];

    function validate(value, schemaNode, path = '') {
        if (schemaNode.type === 'object') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                errors.push(`${path || 'root'}: expected object`);
                return;
            }
            if (schemaNode.properties) {
                for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
                    const propPath = path ? `${path}.${key}` : key;
                    if (propSchema.required && !(key in value)) {
                        errors.push(`${propPath}: required property missing`);
                    } else if (key in value) {
                        validate(value[key], propSchema, propPath);
                    }
                }
            }
        } else if (schemaNode.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`${path || 'root'}: expected array`);
                return;
            }
            if (schemaNode.items) {
                value.forEach((item, index) => {
                    validate(item, schemaNode.items, `${path}[${index}]`);
                });
            }
        } else if (schemaNode.type === 'string') {
            if (typeof value !== 'string') {
                errors.push(`${path || 'root'}: expected string`);
            }
        } else if (schemaNode.type === 'number') {
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`${path || 'root'}: expected number`);
            }
        } else if (schemaNode.type === 'boolean') {
            if (typeof value !== 'boolean') {
                errors.push(`${path || 'root'}: expected boolean`);
            }
        }
    }

    validate(data, schema);
    return { valid: errors.length === 0, errors };
}

/**
 * Log and handle validation failures
 * @param {string} context - Context description
 * @param {Object} validation - Validation result
 * @returns {boolean} Whether validation passed
 */
export function logValidationResult(context, validation) {
    if (!validation.valid) {
        log.warn({ context, errors: validation.errors || validation.error }, 'Validation failed');
    }
    return validation.valid;
}
