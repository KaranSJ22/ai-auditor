import test from 'node:test';
import assert from 'node:assert';
import { sleep } from '../src/utils/sleep.js';

test('Sleep: resolves after the specified duration', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;

    // Allow 50ms tolerance for timer imprecision
    assert.ok(elapsed >= 90, `Should wait at least 90ms, waited ${elapsed}ms`);
    assert.ok(elapsed < 300, `Should not wait excessively, waited ${elapsed}ms`);
});

test('Sleep: returns a Promise', () => {
    const result = sleep(10);
    assert.ok(result instanceof Promise, 'sleep should return a Promise');
});

test('Sleep: resolves with undefined', async () => {
    const result = await sleep(10);
    assert.strictEqual(result, undefined, 'sleep should resolve with undefined');
});

test('Sleep: handles zero milliseconds', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 100, 'sleep(0) should resolve almost immediately');
});
