import test from 'node:test';
import assert from 'node:assert';
import { buildServiceGraph } from '../src/core/serviceGraph.js';
import { buildAttackPathAnalysis, findReachablePaths, scoreToSeverity } from '../src/core/attackPath.js';
import { buildAttackPathMarkdown, generateAttackPathMermaid } from '../src/ui/attackPathReport.js';

test('Attack Path: detects public service path to critical data store', () => {
    const graph = buildServiceGraph({
        services: {
            frontend: {
                image: 'nginx:1.25',
                ports: ['8080:80'],
                depends_on: ['api'],
                user: 'nginx',
                healthcheck: { test: ['CMD', 'true'] }
            },
            api: {
                image: 'node:20',
                depends_on: ['postgres'],
                environment: ['DATABASE_URL=postgres://postgres:5432/app'],
                user: 'node',
                healthcheck: { test: ['CMD', 'true'] }
            },
            postgres: {
                image: 'postgres:15'
            }
        }
    });

    const analysis = buildAttackPathAnalysis(graph);

    assert.strictEqual(analysis.summary.publicEntryPoints, 1);
    assert.ok(
        analysis.highRiskPaths.some(item => item.path.join('>') === 'frontend>api>postgres'),
        'Should include frontend -> api -> postgres path'
    );
    assert.deepStrictEqual(
        analysis.blastRadius.frontend.reachableCriticalAssets,
        ['postgres']
    );
});

test('Attack Path: finds all reachable paths without looping cycles', () => {
    const graph = {
        api: { dependencies: ['worker'] },
        worker: { dependencies: ['api', 'db'] },
        db: { dependencies: [] }
    };

    const paths = findReachablePaths(graph, 'api');
    assert.ok(paths.some(path => path.join('>') === 'api>worker'));
    assert.ok(paths.some(path => path.join('>') === 'api>worker>db'));
    assert.ok(!paths.some(path => path.join('>').includes('api>worker>api')));
});

test('Attack Path: scores privileged public service as critical blast radius', () => {
    const graph = buildServiceGraph({
        services: {
            admin: {
                image: 'admin:latest',
                ports: ['9000:9000'],
                privileged: true,
                volumes: ['/var/run/docker.sock:/var/run/docker.sock'],
                depends_on: ['mongo']
            },
            mongo: { image: 'mongo:6' }
        }
    });

    const analysis = buildAttackPathAnalysis(graph);
    assert.strictEqual(analysis.blastRadius.admin.severity, 'CRITICAL');
    assert.ok(analysis.blastRadius.admin.score >= 25);
});

test('Attack Path: severity thresholds are stable', () => {
    assert.strictEqual(scoreToSeverity(25), 'CRITICAL');
    assert.strictEqual(scoreToSeverity(15), 'HIGH');
    assert.strictEqual(scoreToSeverity(7), 'MEDIUM');
    assert.strictEqual(scoreToSeverity(0), 'LOW');
});

test('Attack Path Report: markdown includes key sections and risky path', () => {
    const graph = buildServiceGraph({
        services: {
            web: {
                image: 'nginx:1.25',
                ports: ['80:80'],
                depends_on: ['db']
            },
            db: { image: 'postgres:15' }
        }
    });
    const analysis = buildAttackPathAnalysis(graph);
    const markdown = buildAttackPathMarkdown(analysis);

    assert.ok(markdown.includes('# Microservice Attack Path & Blast Radius Report'));
    assert.ok(markdown.includes('## High-Risk Attack Paths'));
    assert.ok(markdown.includes('web -> db'));
    assert.ok(markdown.includes('## Blast Radius'));
});

test('Attack Path Report: mermaid marks public and critical nodes', () => {
    const graph = buildServiceGraph({
        services: {
            web: { image: 'nginx:1.25', ports: ['80:80'], depends_on: ['db'] },
            db: { image: 'postgres:15' }
        }
    });
    const analysis = buildAttackPathAnalysis(graph);
    const mermaid = generateAttackPathMermaid(analysis.graph, analysis.highRiskPaths);

    assert.ok(mermaid.includes('classDef public'));
    assert.ok(mermaid.includes('classDef critical'));
    assert.ok(mermaid.includes('linkStyle'));
});
