
import ora from 'ora';
import chalk from 'chalk';
import { saveReportToDisk } from '../utils/fileSystem.js';
import { runLocalDastScan } from '../core/scanner.js';
import { getGitDetails, pushCode, getOctokit, getLatestWorkflowRun, getFailedJobLog } from '../core/github.js';
import { analyzeFailureLog } from '../core/ai.js';
import { createLoadingSpinner } from '../ui/spinners.js';
import { renderSecurityReport } from '../ui/reports.js';

export async function pushCommand(targetUrl) {
    console.log(chalk.blue.bold('\n Initiating Unified Secure Push...\n'));

    let gitDetails;
    try {
        gitDetails = await getGitDetails();
    } catch (err) {
        console.log(chalk.red(`Git Error: ${err.message}`));
        return;
    }

    const { branch, owner, repo } = gitDetails;
    const pushSpinner = ora(`Pushing branch '${chalk.yellow(branch)}' to origin...`).start();

    try {
        await pushCode(branch, owner, repo);
        pushSpinner.succeed(chalk.green(`Successfully pushed to origin/${branch}`));
    } catch (err) {
        pushSpinner.fail(chalk.red('Failed to push code. Ensure you have committed your changes.'));
        console.error(err.message);
        return;
    }

    console.log(chalk.magenta('\n📡 Launching Live CI/CD Dashboard...\n'));

    let octokit;
    try {
        octokit = getOctokit();
    } catch (err) {
        console.log(chalk.red(`❌ Auth Error: ${err.message} Run 'auditor init'.`));
        return;
    }

    const pollSpinner = ora('Waiting for GitHub Actions to trigger...').start();

    const interval = setInterval(async () => {
        try {
            const run = await getLatestWorkflowRun(octokit, owner, repo, branch);
            if (!run) return;

            const status = run.status;
            const conclusion = run.conclusion;

            pollSpinner.text = `Workflow Status: ${chalk.yellow(status)} | Conclusion: ${chalk.cyan(conclusion || 'Pending')} | Run ID: ${run.id}`;

            if (status === 'completed') {
                clearInterval(interval);
               if (conclusion === 'success') {
                    pollSpinner.succeed(chalk.green(' Build Passed. CI/CD Infrastructure Healthy.'));
                    
                    const dastSpinner = ora('Initiating Post-Deployment DAST Scan via OWASP ZAP Docker...').start();
                    
                    try {
                        
                        await runLocalDastScan(targetUrl || 'http://localhost:3000');
                        dastSpinner.succeed(chalk.green(' DAST Scan Passed. Runtime is secure.'));
                        
                    } catch (error) {
                        // WE TRAP THE ERROR HERE
                        dastSpinner.text = chalk.yellow('DAST Scan Failed! AI analyzing runtime vulnerabilities...');
                        
                        try {
                            // Feed the captured logs directly to Gemini
                            const dynamicDastResult = await analyzeFailureLog(error.message);
                            dastSpinner.succeed(chalk.red('AI Vulnerability Analysis Complete.'));
                            
                            // Render the UI
                            const uiBox = renderSecurityReport(dynamicDastResult);
                            console.log(`\n${uiBox}\n`);
                            
                            // Save the Markdown Report
                            const savedPath = await saveReportToDisk(repo, dynamicDastResult);
                            if (savedPath) {
                                console.log(chalk.gray(` Offline DAST audit report saved to: ${savedPath}`));
                            }
                        } catch (aiError) {
                            dastSpinner.fail(chalk.red('AI Failed to parse the logs.'));
                            console.error(aiError.message);
                        }
                    }
                }else {
                    pollSpinner.fail(chalk.red(`❌ Build Failed! CI/CD error detected in Run ID: ${run.id}`));

                    // Use your new UI helper for the AI spinner
                    const aiSpinner = createLoadingSpinner('Fetching logs and triggering Gemini AI...').start();

                    try {
                        // 1. Get the raw text logs from GitHub
                        const logContent = await getFailedJobLog(octokit, owner, repo, run.id);

                        // 2. Pass logs to Gemini to extract the OWASP issue and fix
                        const aiResult = await analyzeFailureLog(logContent);
                        aiSpinner.succeed(chalk.green('AI Remediation Analysis Complete.'));

                        // 3. Render and print the refactored UI Report
                        const uiBox = renderSecurityReport(aiResult);
                        console.log(`\n${uiBox}\n`);
                        const savedPath = await saveReportToDisk(repo, aiResult);
                        if (savedPath) {
                            console.log(chalk.gray(` Offline report saved to: ${savedPath}`));
                        }

                    } catch (error) {
                        aiSpinner.fail('AI Analysis encountered an error.');
                        console.error(chalk.red(error.message));
                    }
                }
            }
        } catch (err) {
            clearInterval(interval);
            pollSpinner.fail(chalk.red('Failed to fetch Actions status.'));
            // 🔥 THIS WILL REVEAL THE REAL BUG:
            console.error(chalk.yellow('\n---  UNMASKED ERROR ---'));
            console.error(err); 
            console.error(chalk.yellow('--------------------------\n'));
        }
    }, 5000); // 5-second polling interval
}