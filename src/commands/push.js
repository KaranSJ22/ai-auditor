import ora from 'ora';
import chalk from 'chalk';
import { saveReportToDisk } from '../utils/fileSystem.js';
import { sleep } from '../utils/sleep.js';
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
        process.exit(1);
    }

    // FIX A3: We now extract the headSha to track the exact commit
    const { branch, owner, repo, headSha } = gitDetails;
    const pushSpinner = ora(`Pushing branch '${chalk.yellow(branch)}' to origin...`).start();

    try {
        await pushCode(branch, owner, repo);
        pushSpinner.succeed(chalk.green(`Successfully pushed to origin/${branch}`));
    } catch (err) {
        pushSpinner.fail(chalk.red('Failed to push code. Ensure you have committed your changes.'));
        console.error(err.message);
        process.exit(1);
    }

    console.log(chalk.magenta('\n Launching Live CI/CD Dashboard...\n'));

    let octokit;
    try {
        octokit = getOctokit();
    } catch (err) {
        console.log(chalk.red(` Auth Error: ${err.message} Run 'auditor init'.`));
        process.exit(1);
    }

    const pollSpinner = ora('Waiting for GitHub Actions to trigger...').start();

    // FIX A2 & A4: Replaced setInterval with a safe while loop and a timeout limit
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 60 attempts * 5 seconds = 5 minute timeout limit

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
            const run = await getLatestWorkflowRun(octokit, owner, repo, branch, headSha);

            if (!run) {
                await sleep(5000);
                continue;
            }

            const status = run.status;
            const conclusion = run.conclusion;

            pollSpinner.text = `Workflow Status: ${chalk.yellow(status)} | Conclusion: ${chalk.cyan(conclusion || 'Pending')} | Run ID: ${run.id}`;

            if (status === 'completed') {
                if (conclusion === 'success') {
                    pollSpinner.succeed(chalk.green(' Build Passed. CI/CD Infrastructure Healthy.'));

                    const dastSpinner = ora('Initiating Post-Deployment DAST Scan via OWASP ZAP Docker...').start();

                    try {
                        await runLocalDastScan(targetUrl || 'http://localhost:3000');
                        dastSpinner.succeed(chalk.green(' DAST Scan Passed. Runtime is secure.'));
                        process.exit(0);

                    } catch (error) {
                        dastSpinner.text = chalk.yellow('DAST Scan Failed! AI analyzing runtime vulnerabilities...');

                        try {
                            const dynamicDastResult = await analyzeFailureLog(error.message);
                            dastSpinner.succeed(chalk.red('AI Vulnerability Analysis Complete.'));

                            const uiBox = renderSecurityReport(dynamicDastResult);
                            console.log(`\n${uiBox}\n`);

                            const savedPath = await saveReportToDisk(repo, dynamicDastResult);
                            if (savedPath) {
                                console.log(chalk.gray(` Offline DAST audit report saved to: ${savedPath}`));
                            }
                            process.exit(1);
                        } catch (aiError) {
                            dastSpinner.fail(chalk.red('AI Failed to parse the logs.'));
                            console.error(aiError.message);
                            process.exit(1);
                        }
                    }
                }
                // FIX A5: Explicitly isolate 'failure' so we don't scan 'cancelled' or 'skipped' runs
                else if (conclusion === 'failure') {
                    pollSpinner.fail(chalk.red(` Build Failed! CI/CD error detected in Run ID: ${run.id}`));

                    const aiSpinner = createLoadingSpinner('Fetching logs and triggering Gemini AI...').start();

                    try {
                        const logContent = await getFailedJobLog(octokit, owner, repo, run.id);
                        const aiResult = await analyzeFailureLog(logContent);

                        aiSpinner.succeed(chalk.green('AI Remediation Analysis Complete.'));

                        const uiBox = renderSecurityReport(aiResult);
                        console.log(`\n${uiBox}\n`);

                        const savedPath = await saveReportToDisk(repo, aiResult);
                        if (savedPath) {
                            console.log(chalk.gray(` Offline report saved to: ${savedPath}`));
                        }
                        process.exit(1);

                    } catch (error) {
                        aiSpinner.fail('AI Analysis encountered an error.');
                        console.error(chalk.red(error.message));
                        process.exit(1);
                    }
                }
                else {
                    // Handles cancelled, skipped, timed_out, etc.
                    pollSpinner.warn(chalk.yellow(` Workflow ended with conclusion: ${conclusion}. Skipping AI analysis.`));
                    process.exit(0);
                }
            }

            // Sleep for 5 seconds before checking again
            await sleep(5000);

        } catch (err) {
            pollSpinner.fail(chalk.red('Failed to fetch Actions status.'));
            console.error(chalk.yellow('\n---  UNMASKED ERROR ---'));
            console.error(err);
            console.error(chalk.yellow('--------------------------\n'));
            process.exit(1);
        }
    }

    // If the loop finishes all 60 attempts without completing
    pollSpinner.fail(chalk.red(' Polling timeout reached. Workflow took too long to complete.'));
    process.exit(1);
}