const SECRET_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)/i;

export function analyzeGraph(graph) {
    const serviceNames = Object.keys(graph);
    let totalRisks = 0;

    for (const name of serviceNames) {
        const node = graph[name];
        node.risks = [];
        node.isVulnerable = false;

        const risks = evaluateServiceRisks(name, node, graph);
        for (const risk of risks) {
            addRisk(node, risk);
            totalRisks++;
        }
    }

    return { graph, totalRisks };
}

export function evaluateServiceRisks(name, node, graph) {
    const risks = [];
    const serviceNames = Object.keys(graph);

    if (node.isCriticalAsset && node.ports.length > 0) {
        risks.push({
            id: 'EXPOSED_STATE_STORE',
            severity: 'HIGH',
            message: `Internal ${node.assetType} "${name}" exposes port(s) [${node.ports.join(', ')}] to the host network.`,
            remediation: 'Remove host port mappings from internal stateful services and expose them only on private Docker networks.'
        });
    }

    if (node.privileged) {
        risks.push({
            id: 'PRIVILEGED_CONTAINER',
            severity: 'CRITICAL',
            message: `Service "${name}" runs with privileged: true, giving the container broad host-level capabilities.`,
            remediation: 'Remove privileged mode and grant only the specific Linux capabilities required.'
        });
    }

    if (node.networkMode === 'host') {
        risks.push({
            id: 'HOST_NETWORK',
            severity: 'CRITICAL',
            message: `Service "${name}" uses host networking, bypassing container network isolation.`,
            remediation: 'Use bridge or dedicated application networks instead of network_mode: host.'
        });
    }

    if (node.volumes.some(volume => volume.includes('/var/run/docker.sock'))) {
        risks.push({
            id: 'DOCKER_SOCKET_MOUNT',
            severity: 'CRITICAL',
            message: `Service "${name}" mounts the Docker socket, which can allow host container control if compromised.`,
            remediation: 'Remove the Docker socket mount or replace it with a narrow, audited proxy.'
        });
    }

    const plaintextSecrets = Object.keys(node.environment || {}).filter(key => SECRET_KEY_PATTERN.test(key));
    if (plaintextSecrets.length > 0) {
        risks.push({
            id: 'PLAINTEXT_SECRET',
            severity: 'HIGH',
            message: `Service "${name}" defines likely secrets in environment variables: ${plaintextSecrets.join(', ')}.`,
            remediation: 'Move secrets into a secret manager or Docker/Kubernetes secrets and inject them at runtime.'
        });
    }

    if (!node.hasHealthcheck && !node.isCriticalAsset) {
        risks.push({
            id: 'MISSING_HEALTHCHECK',
            severity: 'LOW',
            message: `Service "${name}" has no healthcheck, reducing deployment safety and dependency reliability.`,
            remediation: 'Add a healthcheck that verifies the service is ready before dependent services start.'
        });
    }

    if (!node.user) {
        risks.push({
            id: 'RUNS_AS_ROOT',
            severity: 'MEDIUM',
            message: `Service "${name}" does not define a non-root user.`,
            remediation: 'Set a least-privilege user in the image or compose service definition.'
        });
    }

    if (node.image && /:latest$/i.test(node.image)) {
        risks.push({
            id: 'FLOATING_IMAGE_TAG',
            severity: 'MEDIUM',
            message: `Service "${name}" uses the floating image tag "${node.image}".`,
            remediation: 'Pin images to immutable version tags or digests for repeatable builds.'
        });
    }

    const hasOutgoing = node.dependencies.length > 0;
    const hasIncoming = serviceNames.some(
        other => other !== name && graph[other].dependencies.includes(name)
    );

    if (!hasOutgoing && !hasIncoming && serviceNames.length > 1) {
        risks.push({
            id: 'ORPHANED_SERVICE',
            severity: 'LOW',
            message: `Service "${name}" has no connections to or from any other service.`,
            remediation: 'Remove the service if unused, or define the missing dependency/network relationship.'
        });
    }

    return risks;
}

export function getSeverityWeight(severity) {
    const weights = {
        CRITICAL: 10,
        HIGH: 7,
        MEDIUM: 4,
        LOW: 1
    };
    return weights[severity] || 0;
}

function addRisk(node, risk) {
    node.isVulnerable = true;
    node.risks.push(risk);
}
