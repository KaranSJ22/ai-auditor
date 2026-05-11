import test from 'node:test';
import assert from 'node:assert';

test('Preflight: .gitignore logic - .env standalone matches', () => {
    const lines = 'node_modules/\n.env\ndist/'.split(/\r?\n/).map(l => l.trim());
    const match = lines.some(l => l === '.env' || l === '.env*' || l === '*.env');
    assert.strictEqual(match, true);
});

test('Preflight: .gitignore logic - missing .env not matched', () => {
    const lines = 'node_modules/\ndist/'.split(/\r?\n/).map(l => l.trim());
    const match = lines.some(l => l === '.env' || l === '.env*' || l === '*.env');
    assert.strictEqual(match, false);
});

test('Preflight: .gitignore logic - .environment is not a false positive', () => {
    const lines = '.environment'.split(/\r?\n/).map(l => l.trim());
    const match = lines.some(l => l === '.env' || l === '.env*' || l === '*.env');
    assert.strictEqual(match, false);
});

test('Preflight: .gitignore logic - .env* wildcard matches', () => {
    const lines = '.env*'.split(/\r?\n/).map(l => l.trim());
    const match = lines.some(l => l === '.env' || l === '.env*' || l === '*.env');
    assert.strictEqual(match, true);
});

test('Preflight: Dockerfile USER regex - valid USER detected', () => {
    const content = 'FROM node:20\nUSER nodeapp\nCMD ["node"]';
    assert.strictEqual(/^\s*USER\s+\S/m.test(content), true);
});

test('Preflight: Dockerfile USER regex - comment USER ignored', () => {
    const content = 'FROM node:20\n# USER nodeapp\nCMD ["node"]';
    assert.strictEqual(/^\s*USER\s+\S/m.test(content), false);
});

test('Preflight: Dockerfile USER regex - ENV USER ignored', () => {
    const content = 'FROM node:20\nENV DB_USER admin\nCMD ["node"]';
    assert.strictEqual(/^\s*USER\s+\S/m.test(content), false);
});

test('Preflight: Dockerfile USER regex - indented USER detected', () => {
    const content = 'FROM node:20\n    USER appuser\nCMD ["node"]';
    assert.strictEqual(/^\s*USER\s+\S/m.test(content), true);
});

test('Preflight: Dockerfile USER regex - missing USER detected', () => {
    const content = 'FROM node:20\nRUN npm install\nCMD ["node"]';
    assert.strictEqual(/^\s*USER\s+\S/m.test(content), false);
});
