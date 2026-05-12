import { getPublicEntryPoints } from './serviceGraph.js';
import { analyzeGraph, getSeverityWeight } from './riskRules.js';

export function buildAttackPathAnalysis(graph) {
    const { totalRisks } = analyzeGraph(graph);
    const publicEntryPoints = getPublicEntryPoints(graph);
    const blastRadius = {};
    const highRiskPaths = [];

    for (const serviceName of Object.keys(graph)) {
        const paths = findReachablePaths(graph, serviceName);
        const reachableServices = [...new Set(paths.map(path => path[path.length - 1]).filter(name => name !== serviceName))];
        const reachableCriticalAssets = reachableServices.filter(name => graph[name]?.isCriticalAsset);
        const score = calculateBlastRadiusScore(graph, serviceName, reachableServices);
        const severity = scoreToSeverity(score);

        blastRadius[serviceName] = {
            service: serviceName,
            score,
            severity,
            reachableServices,
            reachableCriticalAssets,
            directDependencies: graph[serviceName].dependencies,
            riskCount: graph[serviceName].risks.length
        };

        for (const path of paths) {
            const target = path[path.length - 1];
            if (path.length > 1 && graph[target]?.isCriticalAsset) {
                highRiskPaths.push({
                    source: serviceName,
                    target,
                    path,
                    severity: pathSeverity(graph, serviceName, target),
                    reason: `"${serviceName}" can reach critical ${graph[target].assetType} "${target}".`
                });
            }
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        summary: {
            services: Object.keys(graph).length,
            publicEntryPoints: publicEntryPoints.length,
            totalRisks,
            highRiskPaths: highRiskPaths.length
        },
        graph,
        publicEntryPoints,
        blastRadius,
        highRiskPaths: sortPaths(highRiskPaths)
    };
}

export function findReachablePaths(graph, source) {
    if (!graph[source]) return [];

    const paths = [];
    const queue = graph[source].dependencies.map(dep => [source, dep]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        if (!graph[current]) continue;
        paths.push(path);

        for (const next of graph[current].dependencies) {
            if (!path.includes(next)) {
                queue.push([...path, next]);
            }
        }
    }

    return paths;
}

export function calculateBlastRadiusScore(graph, serviceName, reachableServices) {
    const node = graph[serviceName];
    let score = 0;

    if (node.isPublicEntry) score += 5;
    if (node.privileged || node.networkMode === 'host') score += 10;
    if (node.volumes.some(volume => volume.includes('/var/run/docker.sock'))) score += 10;

    for (const risk of node.risks) {
        score += getSeverityWeight(risk.severity);
    }

    for (const reachableName of reachableServices) {
        const reachableNode = graph[reachableName];
        if (!reachableNode) continue;
        if (reachableNode.isCriticalAsset) score += 8;
        score += Math.min(reachableNode.risks.length, 3);
    }

    return score;
}

export function scoreToSeverity(score) {
    if (score >= 25) return 'CRITICAL';
    if (score >= 15) return 'HIGH';
    if (score >= 7) return 'MEDIUM';
    return 'LOW';
}

function pathSeverity(graph, source, target) {
    if (graph[source]?.isPublicEntry && graph[target]?.isCriticalAsset) return 'CRITICAL';
    if (graph[target]?.isCriticalAsset) return 'HIGH';
    return 'MEDIUM';
}

function sortPaths(paths) {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return [...paths].sort((a, b) => order[a.severity] - order[b.severity] || a.path.length - b.path.length);
}
