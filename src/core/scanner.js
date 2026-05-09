import shell from 'shelljs';
import { execSync } from 'child_process';
export async function runLocalDastScan(targetUrl) {
    return new Promise((resolve, reject) => {
        // 1. Verify Docker is installed and running
        if (!shell.which('docker')) {
            return reject(new Error('Docker is not installed or not in PATH.'));
        }

        const dockerCheck = shell.exec('docker info', { silent: true });
        if (dockerCheck.code !== 0) {
            return reject(new Error('Docker daemon is not running. Please start Docker Desktop on Windows.'));
        }

        // 2. Adjust localhost for WSL2/Docker networking
        let scanUrl = targetUrl;
        if (scanUrl.includes('localhost') || scanUrl.includes('127.0.0.1')) {
            scanUrl = scanUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
        }

        // 3. Construct the OWASP ZAP Docker Command
        // We use the 'bare' image for speed. zap-baseline.py runs a fast, passive scan.
        // -t: Target URL
        // -I: Ignore warnings (only fail the script on actual errors/vulnerabilities)
        const zapCommand = `docker run --rm ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${scanUrl} -I`;

        // 4. Execute the scan asynchronously
        shell.exec(zapCommand, { silent: true, async: true }, (code, stdout, stderr) => {
            // ZAP Baseline exit codes: 0 = Pass, 1 = Fail (Vulnerabilities found), 2 = Warnings
            if (code === 0 || code === 2) {
                resolve({
                    success: true,
                    message: 'DAST Scan completed successfully.',
                    details: stdout
                });
            } else {
                const logs = stdout || stderr || 'No raw logs output by Docker.';
                reject(new Error(`DAST Scan Failed: Vulnerabilities detected.\n\n${logs}`));
            }
        });
    });
}