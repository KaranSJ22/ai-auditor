import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
