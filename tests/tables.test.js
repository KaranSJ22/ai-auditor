import test from 'node:test';
import assert from 'node:assert';
import { renderWorkflowTable } from '../src/ui/tables.js';

test('Tables: renderWorkflowTable renders valid table string', () => {
    const mockRuns = [
        {
            id: 12345,
            head_branch: 'main',
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-05-10T12:00:00Z'
        }
    ];

    const output = renderWorkflowTable(mockRuns);

    assert.ok(typeof output === 'string', 'Should return a string');
    assert.ok(output.includes('12345'), 'Should contain the run ID');
    assert.ok(output.includes('main'), 'Should contain the branch name');
});

test('Tables: renderWorkflowTable handles multiple runs', () => {
    const mockRuns = [
        {
            id: 100,
            head_branch: 'main',
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-05-10T12:00:00Z'
        },
        {
            id: 101,
            head_branch: 'develop',
            status: 'completed',
            conclusion: 'failure',
            created_at: '2026-05-10T13:00:00Z'
        },
        {
            id: 102,
            head_branch: 'feature/auth',
            status: 'in_progress',
            conclusion: null,
            created_at: '2026-05-10T14:00:00Z'
        }
    ];

    const output = renderWorkflowTable(mockRuns);

    assert.ok(output.includes('100'), 'Should contain first run ID');
    assert.ok(output.includes('101'), 'Should contain second run ID');
    assert.ok(output.includes('102'), 'Should contain third run ID');
    assert.ok(output.includes('develop'), 'Should contain develop branch');
    assert.ok(output.includes('In Progress'), 'Should show In Progress for null conclusion');
});

test('Tables: renderWorkflowTable handles empty runs array', () => {
    const output = renderWorkflowTable([]);
    assert.ok(typeof output === 'string', 'Should return a string even with empty data');
});

test('Tables: renderWorkflowTable contains table header columns', () => {
    const mockRuns = [
        {
            id: 1,
            head_branch: 'main',
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-05-10T12:00:00Z'
        }
    ];

    const output = renderWorkflowTable(mockRuns);

    // cli-table3 renders headers - check for column names
    assert.ok(output.includes('Run ID'), 'Should contain Run ID header');
    assert.ok(output.includes('Branch'), 'Should contain Branch header');
    assert.ok(output.includes('Status'), 'Should contain Status header');
    assert.ok(output.includes('Conclusion'), 'Should contain Conclusion header');
    assert.ok(output.includes('Time'), 'Should contain Time header');
});
