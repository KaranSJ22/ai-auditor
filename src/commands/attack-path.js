import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadComposeFile } from '../core/compose.js';
import { buildServiceGraph } from '../core/serviceGraph.js';
import { buildAttackPathAnalysis } from '../core/attackPath.js';
import { buildAttackPathMarkdown } from '../ui/attackPathReport.js';

export async function attackPathCommand() {
    const cwd = process.cwd();

    console.log(chalk.blue.bold('\n  Microservice Attack Path & Blast Radius Audit\n'));

    const composeResult = loadComposeFile(cwd);
    if (!composeResult) {
        console.log(chalk.yellow('  No docker-compose.yml or docker-compose.yaml found in the current directory.'));
        console.log(chalk.gray('  Run this command from a microservice project root containing Docker Compose.\n'));
        return;
    }

    if (!composeResult.data || !composeResult.data.services) {
        console.log(chalk.yellow('  The compose file contains no services definition.\n'));
        return;
    }

    const graph = buildServiceGraph(composeResult.data);
    const analysis = buildAttackPathAnalysis(graph);

    console.log(chalk.green(`  Found ${analysis.summary.services} service(s) in ${chalk.white(path.basename(composeResult.filePath))}.`));
    console.log(chalk.green(`  Public entry points: ${chalk.white(analysis.summary.publicEntryPoints)}`));
    console.log(chalk[analysis.summary.highRiskPaths > 0 ? 'red' : 'green'](`  High-risk attack paths: ${chalk.white(analysis.summary.highRiskPaths)}\n`));

    renderBlastRadiusTable(analysis);
    renderTopAttackPaths(analysis);

    const reportsDir = path.join(cwd, 'audit-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const markdownPath = path.join(reportsDir, 'attack-path-report.md');
    const jsonPath = path.join(reportsDir, 'attack-path.json');

    await fs.writeFile(markdownPath, buildAttackPathMarkdown(analysis), 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2), 'utf8');

    console.log(chalk.green(`\n  Attack path report saved to: ${chalk.white(markdownPath)}`));
    console.log(chalk.green(`  Machine-readable findings saved to: ${chalk.white(jsonPath)}\n`));
}

function renderBlastRadiusTable(analysis) {
    const table = new Table({
        head: [
            chalk.cyan.bold('Service'),
            chalk.cyan.bold('Severity'),
            chalk.cyan.bold('Score'),
            chalk.cyan.bold('Critical Assets')
        ]
    });

    const rows = Object.values(analysis.blastRadius)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    for (const item of rows) {
        table.push([
            item.service,
            colorSeverity(item.severity),
            item.score,
            item.reachableCriticalAssets.length > 0 ? item.reachableCriticalAssets.join(', ') : '-'
        ]);
    }

    console.log(table.toString());
}

function renderTopAttackPaths(analysis) {
    const paths = analysis.highRiskPaths.slice(0, 5);
    if (paths.length === 0) {
        console.log(chalk.green('\n  No paths from services to critical assets were detected.'));
        return;
    }

    console.log(chalk.red.bold('\n  Top Attack Paths'));
    for (const item of paths) {
        console.log(`  ${colorSeverity(item.severity)} ${item.path.join(chalk.gray(' -> '))}`);
    }
}

function colorSeverity(severity) {
    if (severity === 'CRITICAL') return chalk.bgRed.white.bold(` ${severity} `);
    if (severity === 'HIGH') return chalk.red.bold(severity);
    if (severity === 'MEDIUM') return chalk.yellow(severity);
    return chalk.gray(severity);
}
