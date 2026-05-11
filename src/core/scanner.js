import { execFile } from 'child_process';
import { execSync } from 'child_process';

export async function runLocalDastScan(targetUrl) {
    return new Promise((resolve, reject) => {

        //  FIX: Command Injection Prevention

        // We use Node's native URL class to parse and validate the input.
        // If a user types "http://localhost; ls", new URL() throws a TypeError.
        let parsedUrl;
        try {
            parsedUrl = new URL(targetUrl);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return reject(new Error('Invalid URL protocol. Only http and https are supported.'));
            }
        } catch (err) {
            return reject(new Error(`Security block: Invalid target URL format provided -> ${targetUrl}`));
        }

        // 1. Verify Docker is installed and running
        try {
            execSync('docker --version', { stdio: 'ignore' });
        } catch {
            return reject(new Error('Docker is not installed or not in PATH.'));
        }

        try {
            execSync('docker info', { stdio: 'ignore' });
        } catch {
            return reject(new Error('Docker daemon is not running. Please start Docker Desktop on Windows.'));
        }

        // 2. Adjust localhost for WSL2/Docker networking Safely
        if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
            parsedUrl.hostname = 'host.docker.internal';
        }

        // Safely reconstruct the string after validation
        const scanUrl = parsedUrl.href;

        // 3. Execute using execFile to avoid shell interpretation entirely.
        // Each argument is passed directly to the process, preventing injection.
        const args = [
            'run', '--rm',
            'ghcr.io/zaproxy/zaproxy:stable',
            'zap-baseline.py',
            '-t', scanUrl,
            '-I'
        ];

        // 4. Execute the scan asynchronously using execFile (no shell)
        const child = execFile('docker', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            const exitCode = error ? error.code : 0;
            // ZAP Baseline exit codes: 0 = Pass, 1 = Fail (Vulnerabilities found), 2 = Warnings
            if (exitCode === 0 || exitCode === 2) {
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