export function generateAttackPathMermaid(graph, highRiskPaths = []) {
    const lines = ['graph TD'];
    const riskyEdges = new Set();

    for (const item of highRiskPaths) {
        for (let i = 0; i < item.path.length - 1; i++) {
            riskyEdges.add(`${item.path[i]}-->${item.path[i + 1]}`);
        }
    }

    for (const [name, node] of Object.entries(graph)) {
        const labelParts = [name];
        if (node.ports.length > 0) labelParts.push(`ports: ${node.ports.join(', ')}`);
        if (node.isCriticalAsset) labelParts.push(node.assetType);
        lines.push(`    ${name}["${labelParts.join('\\n')}"]`);
    }

    lines.push('');

    let edgeIndex = 0;
    const riskyEdgeIndexes = [];
    for (const [name, node] of Object.entries(graph)) {
        for (const dep of node.dependencies) {
            lines.push(`    ${name} --> ${dep}`);
            if (riskyEdges.has(`${name}-->${dep}`)) {
                riskyEdgeIndexes.push(edgeIndex);
            }
            edgeIndex++;
        }
    }

    lines.push('');
    lines.push('    classDef public fill:#fff4cc,stroke:#b7791f,stroke-width:2px,color:#5f370e');
    lines.push('    classDef critical fill:#ffe0e0,stroke:#d00000,stroke-width:2px,color:#7f0000');
    lines.push('    classDef risky fill:#ffd6d6,stroke:#a00000,stroke-width:3px,color:#650000');

    const publicNodes = Object.entries(graph).filter(([, node]) => node.isPublicEntry).map(([name]) => name);
    const criticalNodes = Object.entries(graph).filter(([, node]) => node.isCriticalAsset).map(([name]) => name);
    const vulnerableNodes = Object.entries(graph).filter(([, node]) => node.isVulnerable).map(([name]) => name);

    if (publicNodes.length > 0) lines.push(`    class ${publicNodes.join(',')} public`);
    if (criticalNodes.length > 0) lines.push(`    class ${criticalNodes.join(',')} critical`);
    if (vulnerableNodes.length > 0) lines.push(`    class ${vulnerableNodes.join(',')} risky`);
    for (const index of riskyEdgeIndexes) {
        lines.push(`    linkStyle ${index} stroke:#d00000,stroke-width:3px`);
    }

    return lines.join('\n');
}

export function buildAttackPathMarkdown(analysis) {
    const lines = [
        '# Microservice Attack Path & Blast Radius Report',
        '',
        `**Generated:** ${new Date(analysis.generatedAt).toLocaleString()}`,
        `**Services:** ${analysis.summary.services}`,
        `**Public Entry Points:** ${analysis.summary.publicEntryPoints}`,
        `**Total Risks:** ${analysis.summary.totalRisks}`,
        `**High-Risk Paths:** ${analysis.summary.highRiskPaths}`,
        '',
        '## Service Attack Graph',
        '',
        '```mermaid',
        generateAttackPathMermaid(analysis.graph, analysis.highRiskPaths),
        '```',
        ''
    ];

    lines.push('## Public Entry Points');
    lines.push('');
    if (analysis.publicEntryPoints.length === 0) {
        lines.push('No host-exposed service ports were detected.');
    } else {
        for (const entry of analysis.publicEntryPoints) {
            lines.push(`- **${entry.service}:** ${entry.reason}`);
        }
    }
    lines.push('');

    lines.push('## High-Risk Attack Paths');
    lines.push('');
    if (analysis.highRiskPaths.length === 0) {
        lines.push('No service-to-critical-asset paths were detected.');
    } else {
        for (const item of analysis.highRiskPaths) {
            lines.push(`- **${item.severity}:** ${item.path.join(' -> ')} - ${item.reason}`);
        }
    }
    lines.push('');

    lines.push('## Blast Radius');
    lines.push('');
    lines.push('| Service | Severity | Score | Reachable Services | Critical Assets |');
    lines.push('|---------|----------|-------|--------------------|-----------------|');
    for (const item of Object.values(analysis.blastRadius)) {
        lines.push(`| ${item.service} | ${item.severity} | ${item.score} | ${formatList(item.reachableServices)} | ${formatList(item.reachableCriticalAssets)} |`);
    }
    lines.push('');

    lines.push('## Fix Recommendations');
    lines.push('');
    for (const [service, node] of Object.entries(analysis.graph)) {
        for (const risk of node.risks) {
            lines.push(`- **${service} / ${risk.severity}:** ${risk.remediation}`);
        }
    }

    if (lines[lines.length - 1] === '## Fix Recommendations') {
        lines.push('No remediation actions were generated.');
    }

    lines.push('');
    return lines.join('\n');
}

function formatList(values) {
    return values.length > 0 ? values.join(', ') : '-';
}
