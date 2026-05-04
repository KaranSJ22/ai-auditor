import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { saveReportToDisk } from '../src/utils/fileSystem.js';

test('File System: saveReportToDisk should create a markdown file', async () => {
    // 1. Arrange
    const dummyRepo = 'test-repo';
    const mockAiResult = {
        owaspCategory: 'Test-Category',
        explanation: 'Test explanation',
        remediation: 'Test remediation'
    };

    // 2. Act
    const savedPath = await saveReportToDisk(dummyRepo, mockAiResult);

    // 3. Assert
    assert.ok(savedPath, 'Should return a valid file path');
    assert.ok(savedPath.endsWith('.md'), 'File should be a markdown file');

    // Verify the file actually exists on disk
    try {
        const fileContent = await fs.readFile(savedPath, 'utf-8');
        assert.ok(fileContent.includes('test-repo'), 'File should contain the repo name');
        assert.ok(fileContent.includes('Test-Category'), 'File should contain the OWASP category');
        
        // 4. Cleanup (Delete the test file so we don't clutter the system)
        await fs.unlink(savedPath);
    } catch (error) {
        assert.fail(`Test file was not created or could not be read: ${error.message}`);
    }
});