import test from 'node:test';
import assert from 'node:assert';
import { createLoadingSpinner } from '../src/ui/spinners.js';

test('Spinners: createLoadingSpinner returns an ora spinner instance', () => {
    const spinner = createLoadingSpinner('Test spinner');

    assert.ok(typeof spinner === 'object', 'Should return an object');
    assert.ok(typeof spinner.start === 'function', 'Should have a start method');
    assert.ok(typeof spinner.stop === 'function', 'Should have a stop method');
    assert.ok(typeof spinner.succeed === 'function', 'Should have a succeed method');
    assert.ok(typeof spinner.fail === 'function', 'Should have a fail method');
    assert.ok(typeof spinner.warn === 'function', 'Should have a warn method');
});

test('Spinners: createLoadingSpinner accepts text parameter', () => {
    const text = 'Loading data from API...';
    const spinner = createLoadingSpinner(text);

    // The text should be stored in the spinner (wrapped with chalk.blue)
    assert.ok(typeof spinner === 'object', 'Should create spinner with custom text');
});

test('Spinners: createLoadingSpinner returns chainable start', () => {
    const spinner = createLoadingSpinner('Chain test');

    // .start() should return the spinner itself for chaining
    const result = spinner.start();
    assert.ok(typeof result === 'object', 'start() should return the spinner for chaining');
    assert.ok(typeof result.succeed === 'function', 'Chained result should have succeed method');

    // Clean up - stop the spinner
    result.stop();
});
