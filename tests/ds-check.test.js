import test from 'node:test';
import assert from 'node:assert';
import {
    buildServiceGraph,
    normalizeEnvironment,
    analyzeGraph,
    generateMermaidDiagram,
    buildArchitectureMarkdown
} from '../src/commands/ds-check.js';

// ==========================================
// Phase 2: buildServiceGraph Tests
// ==========================================

test('DS-Check Graph: builds nodes from simple compose data', () => {
    const compose = {
        services: {
            web: { image: 'nginx', ports: ['80:80'] },
            api: { image: 'node:20', depends_on: ['web'] }
        }
    };

    const graph = buildServiceGraph(compose);

    assert.ok('web' in graph, 'Should contain web service');
    assert.ok('api' in graph, 'Should contain api service');
    assert.deepStrictEqual(graph.web.ports, ['80:80'], 'Web should have port 80');
    assert.deepStrictEqual(graph.api.dependencies, ['web'], 'API should depend on web');
});

test('DS-Check Graph: extracts depends_on as object format', () => {
    const compose = {
        services: {
            app: { image: 'app:latest' },
            db: {
                image: 'postgres:15',
                depends_on: { app: { condition: 'service_healthy' } }
            }
        }
    };

    const graph = buildServiceGraph(compose);
    assert.deepStrictEqual(graph.db.dependencies, ['app'], 'Should extract keys from object depends_on');
});

test('DS-Check Graph: extracts implicit deps from environment variables', () => {
    const compose = {
        services: {
            backend: {
                image: 'node:20',
                environment: ['DATABASE_URL=postgres://postgres:5432/mydb']
            },
            postgres: { image: 'postgres:15' }
        }
    };

    const graph = buildServiceGraph(compose);
    assert.ok(
        graph.backend.dependencies.includes('postgres'),
        'Should detect postgres reference in environment variable'
    );
});

test('DS-Check Graph: handles services with no ports or deps', () => {
    const compose = {
        services: {
            worker: { image: 'worker:latest' }
        }
    };

    const graph = buildServiceGraph(compose);
    assert.deepStrictEqual(graph.worker.ports, [], 'Should have empty ports');
    assert.deepStrictEqual(graph.worker.dependencies, [], 'Should have empty deps');
});

test('DS-Check Graph: handles missing services key', () => {
    const compose = {};
    const graph = buildServiceGraph(compose);
    assert.deepStrictEqual(graph, {}, 'Should return empty graph');
});

// ==========================================
// normalizeEnvironment Tests
// ==========================================

test('DS-Check Env: normalizes array format ["KEY=value"]', () => {
    const env = ['DB_HOST=localhost', 'DB_PORT=5432'];
    const result = normalizeEnvironment(env);

    assert.strictEqual(result.DB_HOST, 'localhost');
    assert.strictEqual(result.DB_PORT, '5432');
});

test('DS-Check Env: normalizes object format { KEY: value }', () => {
    const env = { DB_HOST: 'localhost', DB_PORT: 5432 };
    const result = normalizeEnvironment(env);

    assert.strictEqual(result.DB_HOST, 'localhost');
    assert.strictEqual(result.DB_PORT, '5432');
});

test('DS-Check Env: returns empty object for undefined', () => {
    assert.deepStrictEqual(normalizeEnvironment(undefined), {});
});

test('DS-Check Env: returns empty object for null', () => {
    assert.deepStrictEqual(normalizeEnvironment(null), {});
});

test('DS-Check Env: handles values containing equals signs', () => {
    const env = ['CONNECTION_STRING=host=db;port=5432;user=admin'];
    const result = normalizeEnvironment(env);
    assert.strictEqual(result.CONNECTION_STRING, 'host=db;port=5432;user=admin');
});

// ==========================================
// Phase 3: analyzeGraph Tests
// ==========================================

test('DS-Check Security: flags database with exposed ports as HIGH risk', () => {
    const graph = {
        app: { image: 'node:20', ports: ['3000:3000'], dependencies: ['postgres'], isVulnerable: false, risks: [] },
        postgres: { image: 'postgres:15', ports: ['5432:5432'], dependencies: [], isVulnerable: false, risks: [] }
    };

    const { totalRisks } = analyzeGraph(graph);

    assert.strictEqual(graph.postgres.isVulnerable, true, 'Postgres should be flagged');
    assert.ok(totalRisks >= 1, 'Should have at least 1 risk');
    assert.strictEqual(graph.postgres.risks[0].severity, 'HIGH', 'Should be HIGH severity');
});

test('DS-Check Security: does NOT flag database without exposed ports', () => {
    const graph = {
        app: { image: 'node:20', ports: ['3000:3000'], dependencies: ['postgres'], isVulnerable: false, risks: [] },
        postgres: { image: 'postgres:15', ports: [], dependencies: [], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.postgres.isVulnerable, false, 'Postgres without ports should be safe');
});

test('DS-Check Security: detects DB by service name (redis)', () => {
    const graph = {
        cache: { image: 'custom-image', ports: [], dependencies: ['redis'], isVulnerable: false, risks: [] },
        redis: { image: 'redis:7', ports: ['6379:6379'], dependencies: [], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.redis.isVulnerable, true, 'Redis with ports should be flagged');
});

test('DS-Check Security: detects DB by image name', () => {
    const graph = {
        mystore: { image: 'mongo:6', ports: ['27017:27017'], dependencies: [], isVulnerable: false, risks: [] },
        app: { image: 'node:20', ports: [], dependencies: ['mystore'], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.mystore.isVulnerable, true, 'Mongo detected by image name should be flagged');
});

test('DS-Check Security: flags orphaned services as LOW risk', () => {
    const graph = {
        app: { image: 'node:20', ports: ['3000:3000'], dependencies: ['db'], isVulnerable: false, risks: [] },
        db: { image: 'postgres:15', ports: [], dependencies: [], isVulnerable: false, risks: [] },
        orphan: { image: 'stale:latest', ports: [], dependencies: [], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.orphan.isVulnerable, true, 'Orphan should be flagged');
    assert.ok(
        graph.orphan.risks.some(r => r.severity === 'LOW'),
        'Orphan risk should be LOW severity'
    );
});

test('DS-Check Security: single service is NOT flagged as orphaned', () => {
    const graph = {
        app: { image: 'node:20', ports: ['3000:3000'], dependencies: [], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.app.isVulnerable, false, 'Single service should not be orphaned');
});

test('DS-Check Security: non-DB service with ports is safe', () => {
    const graph = {
        frontend: { image: 'nginx', ports: ['80:80'], dependencies: [], isVulnerable: false, risks: [] }
    };

    analyzeGraph(graph);
    assert.strictEqual(graph.frontend.isVulnerable, false, 'Non-DB services can safely expose ports');
});

// ==========================================
// Phase 5: Mermaid Generation Tests
// ==========================================

test('DS-Check Mermaid: generates valid graph TD header', () => {
    const graph = {
        app: { image: 'node:20', ports: [], dependencies: [], isVulnerable: false, risks: [] }
    };

    const mermaid = generateMermaidDiagram(graph);
    assert.ok(mermaid.startsWith('graph TD'), 'Should start with graph TD');
});

test('DS-Check Mermaid: includes edges for dependencies', () => {
    const graph = {
        frontend: { image: 'nginx', ports: ['80:80'], dependencies: ['backend'], isVulnerable: false, risks: [] },
        backend: { image: 'node:20', ports: [], dependencies: ['db'], isVulnerable: false, risks: [] },
        db: { image: 'postgres', ports: [], dependencies: [], isVulnerable: false, risks: [] }
    };

    const mermaid = generateMermaidDiagram(graph);
    assert.ok(mermaid.includes('frontend --> backend'), 'Should have frontend->backend edge');
    assert.ok(mermaid.includes('backend --> db'), 'Should have backend->db edge');
});

test('DS-Check Mermaid: applies danger class to vulnerable nodes', () => {
    const graph = {
        app: { image: 'node', ports: [], dependencies: ['db'], isVulnerable: false, risks: [] },
        db: { image: 'postgres', ports: ['5432:5432'], dependencies: [], isVulnerable: true, risks: [{ severity: 'HIGH', message: 'exposed' }] }
    };

    const mermaid = generateMermaidDiagram(graph);
    assert.ok(mermaid.includes('classDef danger'), 'Should define danger class');
    assert.ok(mermaid.includes('class db danger'), 'Should apply danger class to db');
});

test('DS-Check Mermaid: omits danger class when no vulnerabilities', () => {
    const graph = {
        app: { image: 'node', ports: ['3000:3000'], dependencies: [], isVulnerable: false, risks: [] }
    };

    const mermaid = generateMermaidDiagram(graph);
    assert.ok(!mermaid.includes('classDef danger'), 'Should not define danger class when all safe');
});

test('DS-Check Mermaid: includes port info in node labels', () => {
    const graph = {
        web: { image: 'nginx', ports: ['80:80', '443:443'], dependencies: [], isVulnerable: false, risks: [] }
    };

    const mermaid = generateMermaidDiagram(graph);
    assert.ok(mermaid.includes('80:80'), 'Should include port mapping in label');
    assert.ok(mermaid.includes('443:443'), 'Should include second port');
});

// ==========================================
// Markdown Generation Tests
// ==========================================

test('DS-Check Markdown: includes header and metadata', () => {
    const graph = {
        app: { ports: [], dependencies: [], isVulnerable: false, risks: [] }
    };

    const md = buildArchitectureMarkdown('graph TD\n    app', graph, 0);
    assert.ok(md.includes('# Architecture Security Map'), 'Should have title');
    assert.ok(md.includes('**Services:** 1'), 'Should show service count');
    assert.ok(md.includes('**Risks Found:** 0'), 'Should show risk count');
});

test('DS-Check Markdown: wraps Mermaid in code fence', () => {
    const graph = { app: { ports: [], dependencies: [], isVulnerable: false, risks: [] } };
    const md = buildArchitectureMarkdown('graph TD\n    app', graph, 0);

    assert.ok(md.includes('```mermaid'), 'Should have mermaid code fence start');
    assert.ok(md.includes('graph TD'), 'Should contain the diagram');
});

test('DS-Check Markdown: includes risk summary table when risks exist', () => {
    const graph = {
        db: {
            ports: ['5432:5432'], dependencies: [], isVulnerable: true,
            risks: [{ severity: 'HIGH', message: 'Port exposed' }]
        }
    };

    const md = buildArchitectureMarkdown('graph TD', graph, 1);
    assert.ok(md.includes('## Risk Summary'), 'Should have risk summary section');
    assert.ok(md.includes('| db |'), 'Should list the risky service');
    assert.ok(md.includes('HIGH'), 'Should show severity');
});

test('DS-Check Markdown: omits risk table when no risks', () => {
    const graph = { app: { ports: [], dependencies: [], isVulnerable: false, risks: [] } };
    const md = buildArchitectureMarkdown('graph TD', graph, 0);

    assert.ok(!md.includes('## Risk Summary'), 'Should not have risk table');
});
