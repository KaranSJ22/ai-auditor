import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

// ============================================================
// PHASE 1: FILE I/O & PARSING
// ============================================================

/**
 * Locates and parses a docker-compose file in the given directory.
 * Supports both .yml and .yaml extensions.
 * @param {string} dir - The directory to search in.
 * @returns {{ filePath: string, data: object } | null}
 */
export function loadComposeFile(dir) {
    const candidates = ['docker-compose.yml', 'docker-compose.yaml'];

    for (const fileName of candidates) {
        const filePath = path.join(dir, fileName);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(raw);
            return { filePath, data };
        }
    }

    return null;
}

// ============================================================
// PHASE 2: DATA NORMALIZATION (Building the Graph)
// ============================================================

// Known database/state-store identifiers for the security rules engine
const DB_IDENTIFIERS = ['db', 'postgres', 'postgresql', 'mysql', 'mariadb', 'redis', 'mongo', 'mongodb', 'memcached', 'elasticsearch'];

/**
 * Builds a normalized service graph from a parsed docker-compose object.
 * Each node contains the service name, its ports, and its dependencies.
 * @param {object} composeData - The parsed YAML object.
 * @returns {object} A map of service name -> node object.
 */
export function buildServiceGraph(composeData) {
    const services = composeData.services || {};
    const serviceNames = Object.keys(services);
    const graph = {};

    for (const name of serviceNames) {
        const svc = services[name];

        // Extract ports (normalize to string array)
        const ports = (svc.ports || []).map(p => String(p));

        // Extract explicit dependencies from depends_on
        let dependencies = [];
        if (Array.isArray(svc.depends_on)) {
            dependencies = [...svc.depends_on];
        } else if (svc.depends_on && typeof svc.depends_on === 'object') {
            // depends_on can be an object with conditions: { postgres: { condition: service_healthy } }
            dependencies = Object.keys(svc.depends_on);
        }

        // Extract implicit dependencies from environment variables
        const envVars = normalizeEnvironment(svc.environment);
        for (const value of Object.values(envVars)) {
            for (const otherService of serviceNames) {
                if (otherService !== name && value.includes(otherService)) {
                    if (!dependencies.includes(otherService)) {
                        dependencies.push(otherService);
                    }
                }
            }
        }

        graph[name] = {
            image: svc.image || null,
            ports,
            dependencies,
            isVulnerable: false,
            risks: []
        };
    }

    return graph;
}

/**
 * Normalizes docker-compose environment variables into a key-value object.
 * Handles both array format (["KEY=value"]) and object format ({ KEY: value }).
 * @param {Array|object|undefined} env
 * @returns {object}
 */
export function normalizeEnvironment(env) {
    if (!env) return {};

    if (Array.isArray(env)) {
        const result = {};
        for (const entry of env) {
            const eqIndex = String(entry).indexOf('=');
            if (eqIndex !== -1) {
                const key = String(entry).substring(0, eqIndex);
                const value = String(entry).substring(eqIndex + 1);
                result[key] = value;
            }
        }
        return result;
    }

    if (typeof env === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(env)) {
            result[key] = String(value);
        }
        return result;
    }

    return {};
}

// ============================================================
// PHASE 3: SECURITY RULES ENGINE
// ============================================================

/**
 * Analyzes the service graph for architectural security vulnerabilities.
 * Mutates the graph nodes by setting isVulnerable and risks.
 * @param {object} graph - The normalized service graph.
 * @returns {{ graph: object, totalRisks: number }}
 */
export function analyzeGraph(graph) {
    const serviceNames = Object.keys(graph);
    let totalRisks = 0;

    for (const name of serviceNames) {
        const node = graph[name];

        // Rule 1: Exposed State Store
        // If the service name or image contains a known DB identifier AND it exposes ports
        const isDbService = DB_IDENTIFIERS.some(id =>
            name.toLowerCase().includes(id) ||
            (node.image && node.image.toLowerCase().includes(id))
        );

        if (isDbService && node.ports.length > 0) {
            node.isVulnerable = true;
            node.risks.push({
                severity: 'HIGH',
                message: `Internal database "${name}" exposes port(s) [${node.ports.join(', ')}] to the host network. This allows direct external access to the data store, bypassing all application-layer security.`
            });
            totalRisks++;
        }

        // Rule 2: Orphaned Service
        // A service with no outgoing dependencies AND no other service depends on it
        const hasOutgoing = node.dependencies.length > 0;
        const hasIncoming = serviceNames.some(
            other => other !== name && graph[other].dependencies.includes(name)
        );

        if (!hasOutgoing && !hasIncoming && serviceNames.length > 1) {
            node.isVulnerable = true;
            node.risks.push({
                severity: 'LOW',
                message: `Service "${name}" has no connections to or from any other service. This may indicate dead code or a misconfigured dependency graph.`
            });
            totalRisks++;
        }
    }

    return { graph, totalRisks };
}

// ============================================================
// PHASE 4: TERMINAL UI RENDERING
// ============================================================

/**
 * Renders a hierarchical tree view of the service graph to the terminal.
 * @param {object} graph - The analyzed service graph.
 */
export function renderTerminalTree(graph) {
    const serviceNames = Object.keys(graph);

    console.log(chalk.blue.bold('\n  Docker Compose Architecture Map\n'));
    console.log(chalk.gray('  ' + '-'.repeat(50)));

    for (const name of serviceNames) {
        const node = graph[name];
        const icon = node.isVulnerable ? chalk.red('*') : chalk.green('*');
        const nameStr = node.isVulnerable
            ? chalk.red.bold(name)
            : chalk.green(name);

        // Service header
        const portInfo = node.ports.length > 0
            ? chalk.gray(` (ports: ${node.ports.join(', ')})`)
            : '';
        console.log(`\n  ${icon} ${nameStr}${portInfo}`);

        // Dependencies (edges)
        if (node.dependencies.length > 0) {
            for (let i = 0; i < node.dependencies.length; i++) {
                const isLast = i === node.dependencies.length - 1;
                const prefix = isLast ? '    +-- ' : '    |-- ';
                const dep = node.dependencies[i];
                const depNode = graph[dep];
                const depColor = depNode && depNode.isVulnerable ? chalk.red(dep) : chalk.white(dep);
                console.log(chalk.gray(prefix) + depColor);
            }
        } else {
            console.log(chalk.gray('    (no dependencies)'));
        }

        // Risk annotations
        for (const risk of node.risks) {
            const severityBadge = risk.severity === 'HIGH'
                ? chalk.bgRed.white.bold(` ${risk.severity} `)
                : chalk.bgYellow.black(` ${risk.severity} `);
            console.log(`    ${severityBadge} ${chalk.red(risk.message)}`);
        }
    }

    console.log(chalk.gray('\n  ' + '-'.repeat(50) + '\n'));
}

// ============================================================
// PHASE 5: MERMAID.JS MARKDOWN GENERATION
// ============================================================

/**
 * Generates a Mermaid.js graph definition from the service graph.
 * Applies a red danger class to vulnerable nodes.
 * @param {object} graph - The analyzed service graph.
 * @returns {string} The Mermaid diagram string.
 */
export function generateMermaidDiagram(graph) {
    const lines = ['graph TD'];
    const serviceNames = Object.keys(graph);
    const vulnerableNodes = [];

    // Define node labels with port info
    for (const name of serviceNames) {
        const node = graph[name];
        const label = node.ports.length > 0
            ? `${name}["${name}\\nports: ${node.ports.join(', ')}"]`
            : `${name}["${name}"]`;
        lines.push(`    ${label}`);
    }

    lines.push('');

    // Define edges (dependencies)
    for (const name of serviceNames) {
        const node = graph[name];
        for (const dep of node.dependencies) {
            lines.push(`    ${name} --> ${dep}`);
        }
    }

    lines.push('');

    // Collect vulnerable nodes
    for (const name of serviceNames) {
        if (graph[name].isVulnerable) {
            vulnerableNodes.push(name);
        }
    }

    // Define danger class and apply it
    if (vulnerableNodes.length > 0) {
        lines.push('    classDef danger fill:#ffcccc,stroke:#ff0000,stroke-width:2px,color:#990000');
        lines.push(`    class ${vulnerableNodes.join(',')} danger`);
    }

    return lines.join('\n');
}

/**
 * Wraps the Mermaid diagram in a Markdown file with metadata.
 * @param {string} mermaidContent - The raw Mermaid graph string.
 * @param {object} graph - The analyzed graph for the risk summary.
 * @param {number} totalRisks - Total number of risks found.
 * @returns {string} The full Markdown content.
 */
export function buildArchitectureMarkdown(mermaidContent, graph, totalRisks) {
    const serviceNames = Object.keys(graph);
    const lines = [
        '# Architecture Security Map',
        '',
        `**Generated:** ${new Date().toLocaleString()}`,
        `**Services:** ${serviceNames.length}`,
        `**Risks Found:** ${totalRisks}`,
        '',
        '## Service Dependency Graph',
        '',
        '```mermaid',
        mermaidContent,
        '```',
        ''
    ];

    // Add risk summary table if risks exist
    const riskyServices = serviceNames.filter(n => graph[n].risks.length > 0);
    if (riskyServices.length > 0) {
        lines.push('## Risk Summary');
        lines.push('');
        lines.push('| Service | Severity | Finding |');
        lines.push('|---------|----------|---------|');
        for (const name of riskyServices) {
            for (const risk of graph[name].risks) {
                lines.push(`| ${name} | ${risk.severity} | ${risk.message} |`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

// ============================================================
// COMMAND HANDLER
// ============================================================

export async function dsCheckCommand() {
    const cwd = process.cwd();

    // Phase 1: Load and parse
    console.log(chalk.blue.bold('\n  Scanning Docker Compose Architecture...\n'));

    const composeResult = loadComposeFile(cwd);
    if (!composeResult) {
        console.log(chalk.yellow('  No docker-compose.yml or docker-compose.yaml found in the current directory.'));
        console.log(chalk.gray('  Run this command from a directory containing a Docker Compose file.\n'));
        return;
    }

    console.log(chalk.green(`  Found: ${chalk.white(path.basename(composeResult.filePath))}`));

    const composeData = composeResult.data;
    if (!composeData || !composeData.services) {
        console.log(chalk.yellow('  The compose file contains no services definition.\n'));
        return;
    }

    // Phase 2: Build the graph
    const graph = buildServiceGraph(composeData);
    const serviceCount = Object.keys(graph).length;
    console.log(chalk.green(`  Extracted ${chalk.white(serviceCount)} service(s) into architecture graph.`));

    // Phase 3: Run security analysis
    const { totalRisks } = analyzeGraph(graph);

    if (totalRisks > 0) {
        console.log(chalk.red(`  Security scan found ${chalk.bold(totalRisks)} risk(s).`));
    } else {
        console.log(chalk.green('  Security scan passed. No architectural risks detected.'));
    }

    // Phase 4: Render terminal tree
    renderTerminalTree(graph);

    // Phase 5: Generate Mermaid diagram and save
    const mermaid = generateMermaidDiagram(graph);
    const markdown = buildArchitectureMarkdown(mermaid, graph, totalRisks);

    const outputPath = path.join(cwd, 'architecture.md');
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(chalk.green(`  Architecture diagram saved to: ${chalk.white(outputPath)}\n`));
}
