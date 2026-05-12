const DB_IDENTIFIERS = ['db', 'postgres', 'postgresql', 'mysql', 'mariadb', 'redis', 'mongo', 'mongodb', 'memcached', 'elasticsearch'];
const QUEUE_IDENTIFIERS = ['queue', 'rabbitmq', 'kafka', 'sqs', 'activemq', 'nats'];

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

export function buildServiceGraph(composeData) {
    const services = composeData.services || {};
    const serviceNames = Object.keys(services);
    const graph = {};

    for (const name of serviceNames) {
        const svc = services[name] || {};
        const ports = (svc.ports || []).map(p => String(p));
        const volumes = (svc.volumes || []).map(v => String(v));

        let dependencies = [];
        if (Array.isArray(svc.depends_on)) {
            dependencies = [...svc.depends_on];
        } else if (svc.depends_on && typeof svc.depends_on === 'object') {
            dependencies = Object.keys(svc.depends_on);
        }

        const envVars = normalizeEnvironment(svc.environment);
        for (const value of Object.values(envVars)) {
            const lowerValue = value.toLowerCase();
            for (const otherService of serviceNames) {
                if (otherService !== name && lowerValue.includes(otherService.toLowerCase())) {
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
            environment: envVars,
            volumes,
            networks: normalizeNetworks(svc.networks),
            user: svc.user || null,
            privileged: svc.privileged === true,
            networkMode: svc.network_mode || null,
            hasHealthcheck: Boolean(svc.healthcheck),
            isCriticalAsset: isCriticalAsset(name, svc.image),
            assetType: getAssetType(name, svc.image),
            isPublicEntry: ports.length > 0,
            isVulnerable: false,
            risks: []
        };
    }

    return graph;
}

export function isCriticalAsset(name, image) {
    return getAssetType(name, image) !== 'service';
}

export function getAssetType(name, image) {
    const combined = `${name} ${image || ''}`.toLowerCase();
    if (DB_IDENTIFIERS.some(id => combined.includes(id))) return 'data-store';
    if (QUEUE_IDENTIFIERS.some(id => combined.includes(id))) return 'message-bus';
    return 'service';
}

export function getPublicEntryPoints(graph) {
    return Object.entries(graph)
        .filter(([, node]) => node.isPublicEntry)
        .map(([name, node]) => ({
            service: name,
            ports: node.ports,
            reason: `Exposes host port(s): ${node.ports.join(', ')}`
        }));
}

function normalizeNetworks(networks) {
    if (!networks) return [];
    if (Array.isArray(networks)) return networks.map(String);
    if (typeof networks === 'object') return Object.keys(networks);
    return [String(networks)];
}
