import test from 'node:test';
import assert from 'node:assert';
import { logger } from '../src/utils/logger.js';

test('Logger: exports an object with all required methods', () => {
    assert.ok(typeof logger === 'object', 'Logger should be an object');
    assert.ok(typeof logger.info === 'function', 'Should have info method');
    assert.ok(typeof logger.success === 'function', 'Should have success method');
    assert.ok(typeof logger.warn === 'function', 'Should have warn method');
    assert.ok(typeof logger.error === 'function', 'Should have error method');
    assert.ok(typeof logger.header === 'function', 'Should have header method');
    assert.ok(typeof logger.divider === 'function', 'Should have divider method');
});

test('Logger: info method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.info('Test info message');
    }, 'info should handle string input without throwing');
});

test('Logger: success method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.success('Test success message');
    }, 'success should handle string input without throwing');
});

test('Logger: warn method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.warn('Test warning message');
    }, 'warn should handle string input without throwing');
});

test('Logger: error method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.error('Test error message');
    }, 'error should handle string input without throwing');
});

test('Logger: header method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.header('Test Header');
    }, 'header should handle string input without throwing');
});

test('Logger: divider method does not throw', () => {
    assert.doesNotThrow(() => {
        logger.divider();
    }, 'divider should execute without throwing');
});
