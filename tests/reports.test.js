import test from 'node:test';
import assert from 'node:assert';
import { renderSecurityReport } from '../src/ui/reports.js';

test('UI Helper: renderSecurityReport should contain correct AI data', () => {
    // 1. Arrange (Set up mock data)
    const mockAiResult = {
        owaspCategory: 'A03:2021-Injection',
        explanation: 'The code does not sanitize SQL inputs.',
        remediation: 'Use parameterized queries.'
    };

    // 2. Act (Run the function)
    const output = renderSecurityReport(mockAiResult);

    // 3. Assert (Verify the results)
    assert.ok(output.includes('A03:2021-Injection'), 'Report must contain the OWASP category');
    assert.ok(output.includes('The code does not sanitize SQL inputs.'), 'Report must contain the explanation');
    assert.ok(output.includes('Use parameterized queries.'), 'Report must contain the remediation');
    assert.ok(output.includes('AI DevSec Auditor Report'), 'Report must contain the Boxen title');
});