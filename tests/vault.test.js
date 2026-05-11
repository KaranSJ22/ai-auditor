import test from 'node:test';
import assert from 'node:assert';
import { saveCredentials, getCredentials, clearCredentials } from '../src/config/vault.js';

test('Vault: getCredentials returns an object with expected keys', () => {
    const creds = getCredentials();
    assert.ok(typeof creds === 'object', 'Should return an object');
    assert.ok('githubPat' in creds, 'Should have a githubPat key');
    assert.ok('geminiKey' in creds, 'Should have a geminiKey key');
});

test('Vault: saveCredentials does not throw with valid inputs', () => {
    // We pass null values to avoid overwriting real credentials
    assert.doesNotThrow(() => {
        saveCredentials(null, null);
    }, 'Should handle null inputs gracefully without throwing');
});

test('Vault: encrypt/decrypt roundtrip preserves data', () => {
    // Save a unique test token that is unlikely to collide with real credentials
    const testPat = 'ghp_TESTvaultRoundTrip_' + Date.now();
    const testKey = 'test-gemini-key-' + Date.now();

    // Save the test credentials
    saveCredentials(testPat, testKey);

    // Retrieve and verify
    const creds = getCredentials();
    assert.strictEqual(creds.githubPat, testPat, 'Decrypted PAT should match the original');
    assert.strictEqual(creds.geminiKey, testKey, 'Decrypted Gemini key should match the original');

    // Cleanup: clear the test credentials
    clearCredentials();

    // Verify clearing worked
    const clearedCreds = getCredentials();
    assert.strictEqual(clearedCreds.githubPat, null, 'PAT should be null after clearing');
    assert.strictEqual(clearedCreds.geminiKey, null, 'Gemini key should be null after clearing');
});

test('Vault: clearCredentials removes all stored data', () => {
    // Save something first
    saveCredentials('ghp_clearTest123', 'clear-test-key');

    // Clear it
    clearCredentials();

    // Verify
    const creds = getCredentials();
    assert.strictEqual(creds.githubPat, null, 'PAT should be null after clear');
    assert.strictEqual(creds.geminiKey, null, 'Key should be null after clear');
});

test('Vault: saveCredentials only writes truthy values', () => {
    // First clear everything
    clearCredentials();

    // Save only PAT
    saveCredentials('ghp_partialTest', null);
    let creds = getCredentials();
    assert.strictEqual(creds.githubPat, 'ghp_partialTest', 'PAT should be saved');
    assert.strictEqual(creds.geminiKey, null, 'Key should remain null');

    // Now save only the key (PAT should remain)
    saveCredentials(null, 'partial-key');
    creds = getCredentials();
    assert.strictEqual(creds.githubPat, 'ghp_partialTest', 'PAT should still be saved');
    assert.strictEqual(creds.geminiKey, 'partial-key', 'Key should now be saved');

    // Cleanup
    clearCredentials();
});
