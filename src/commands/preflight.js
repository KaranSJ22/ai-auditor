import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import chalk from 'chalk';
import ora from 'ora';

export async function preflightCommand() {
    console.log(chalk.blue.bold('\n🛫 Initiating Local Preflight Security Scan...\n'));
    let issuesFound = 0;

    // ==========================================
    // 1. SECRET SCANNING (.env & .gitignore)
    // ==========================================
    const secretSpinner = ora('Scanning for exposed secrets...').start();
    const cwd = process.cwd();
    const envPath = path.join(cwd, '.env');

    if (fs.existsSync(envPath)) {
        const gitignorePath = path.join(cwd, '.gitignore');
        let isGitIgnored = false;

        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            // Match .env as a standalone line pattern (not .env.example, .environment, etc.)
            const lines = gitignoreContent.split(/\r?\n/).map(l => l.trim());
            isGitIgnored = lines.some(line => line === '.env' || line === '.env*' || line === '*.env');
        }

        if (!isGitIgnored) {
            secretSpinner.fail(chalk.red('[CRITICAL] .env file found but not listed in .gitignore! Secrets will be leaked on push.'));
            issuesFound++;
        } else {
            secretSpinner.succeed(chalk.green('.env file is safely ignored.'));
        }
    } else {
        secretSpinner.succeed(chalk.green('No exposed .env files detected.'));
    }

    // ==========================================
    // 2. INFRASTRUCTURE AS CODE (Dockerfile)
    // ==========================================
    const iacSpinner = ora('Linting Infrastructure as Code...').start();
    const dockerfilePath = path.join(cwd, 'Dockerfile');

    if (fs.existsSync(dockerfilePath)) {
        const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

        // Match only the actual USER instruction at the start of a line, not comments or ENV vars
        const hasUserInstruction = /^\s*USER\s+\S/m.test(dockerfileContent);
        if (!hasUserInstruction) {
            iacSpinner.warn(chalk.yellow('[MEDIUM] Dockerfile does not specify a USER. Container will run as root.'));
            issuesFound++;
        } else {
            iacSpinner.succeed(chalk.green('Dockerfile uses secure user privileges.'));
        }
    } else {
        iacSpinner.info(chalk.gray('No Dockerfile found. Skipping IaC linting.'));
    }

    // ==========================================
    // 3. PROJECT FINGERPRINTING & SCA SCANNING
    // ==========================================
    const scaSpinner = ora('Fingerprinting project and scanning dependencies...').start();

    // ↳ FINGERPRINT A: NODE.JS
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
        scaSpinner.text = 'Node.js detected. Running npm audit...';

        try {
            const auditResult = shell.exec('npm audit --json', { silent: true });
            const auditData = JSON.parse(auditResult.stdout);

            if (auditData && auditData.metadata && auditData.metadata.vulnerabilities) {
                const vulns = auditData.metadata.vulnerabilities;
                const totalVulns = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical;

                if (totalVulns > 0) {
                    const isHighRisk = vulns.critical > 0 || vulns.high > 0;
                    scaSpinner.warn(chalk[isHighRisk ? 'red' : 'yellow'](`[${isHighRisk ? 'HIGH' : 'LOW'}] npm audit found ${totalVulns} vulnerable packages (${vulns.critical} Critical, ${vulns.high} High).`));
                    issuesFound++;
                } else {
                    scaSpinner.succeed(chalk.green('Node.js dependencies are secure.'));
                }
            }
        } catch (error) {
            scaSpinner.info(chalk.gray('Could not parse npm audit output.'));
        }
    }
    // ↳ FINGERPRINT B: PYTHON
    else if (fs.existsSync(path.join(cwd, 'requirements.txt'))) {
        scaSpinner.text = 'Python detected. Checking requirements...';
        const reqContent = fs.readFileSync(path.join(cwd, 'requirements.txt'), 'utf8').toLowerCase();

        // Basic check for common insecure practices in Python web apps
        if (reqContent.includes('flask') || reqContent.includes('fastapi')) {
            if (!reqContent.includes('secure') && !reqContent.includes('cors')) {
                scaSpinner.warn(chalk.yellow('[MEDIUM] Python web framework detected, but missing standard security middleware packages.'));
                issuesFound++;
            } else {
                scaSpinner.succeed(chalk.green('Python dependencies look reasonable.'));
            }
        } else {
            scaSpinner.info(chalk.gray('Python requirements checked.'));
        }
    }
    // ↳ UNKNOWN
    else {
        scaSpinner.info(chalk.gray('No recognizable package manager found (checked npm, pip).'));
    }

    // ==========================================
    // 4. PREFLIGHT SUMMARY
    // ==========================================
    console.log('\n' + chalk.blue('----------------------------------------'));
    if (issuesFound > 0) {
        console.log(chalk.red.bold(` Preflight failed with ${issuesFound} issue(s).`));
        console.log(chalk.yellow('Please fix these local vulnerabilities before running "auditor push".\n'));
    } else {
        console.log(chalk.green.bold(' Preflight passed! Your local workspace is secure.'));
        console.log(chalk.gray('You are clear to run "auditor push".\n'));
    }
}