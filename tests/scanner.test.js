import test from 'node:test';
import assert from 'node:assert';
import { runLocalDastScan } from '../src/core/scanner.js';

test('Scanner: rejects URLs with invalid protocol (ftp)', async () => {
    await assert.rejects(
        () => runLocalDastScan('ftp://localhost:3000'),
        (err) => {
            assert.ok(err.message.includes('Invalid URL protocol'), 'Should mention invalid protocol');
            return true;
        },
        'Should reject ftp:// protocol'
    );
});

test('Scanner: rejects URLs with invalid protocol (file)', async () => {
    await assert.rejects(
        () => runLocalDastScan('file:///etc/passwd'),
        (err) => {
            assert.ok(err.message.includes('Invalid URL protocol'), 'Should mention invalid protocol');
            return true;
        },
        'Should reject file:// protocol'
    );
});

test('Scanner: rejects malformed URLs', async () => {
    await assert.rejects(
        () => runLocalDastScan('not-a-url'),
        (err) => {
            assert.ok(err.message.includes('Security block'), 'Should mention security block');
            return true;
        },
        'Should reject malformed input'
    );
});

test('Scanner: rejects command injection attempts', async () => {
    await assert.rejects(
        () => runLocalDastScan('http://localhost; rm -rf /'),
        (err) => {
            assert.ok(
                err.message.includes('Security block'),
                'Should block command injection attempts'
            );
            return true;
        },
        'Should reject injection payloads'
    );
});

test('Scanner: rejects empty string input', async () => {
    await assert.rejects(
        () => runLocalDastScan(''),
        (err) => {
            assert.ok(err.message.includes('Security block'), 'Should block empty input');
            return true;
        },
        'Should reject empty strings'
    );
});

test('Scanner: accepts valid http URL (will fail at Docker check if Docker is not running)', async () => {
    // This test validates that valid URLs pass the URL validation stage.
    // It will either succeed (if Docker is running) or fail with a Docker-related error,
    // NOT a URL validation error.
    try {
        await runLocalDastScan('http://localhost:3000');
    } catch (err) {
        // If it fails, it should be because of Docker, not because of URL validation
        assert.ok(
            err.message.includes('Docker') || err.message.includes('DAST'),
            `Error should be Docker-related, not URL-related. Got: ${err.message}`
        );
    }
});

test('Scanner: accepts valid https URL (will fail at Docker check if Docker is not running)', async () => {
    try {
        await runLocalDastScan('https://example.com');
    } catch (err) {
        assert.ok(
            err.message.includes('Docker') || err.message.includes('DAST'),
            `Error should be Docker-related, not URL-related. Got: ${err.message}`
        );
    }
});
