import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getGitDetails, pushCode, getOctokit, getLatestWorkflowRun, getFailedJobLog } from '../core/github.js';
import { analyzeFailureLog } from '../core/ai.js';

export async function pushCommand() {
    console.log(chalk.blue.bold('\n🚀 Initiating Unified Secure Push...\n'));

    let gitDetails;
    try {
        gitDetails = await getGitDetails();
    } catch (err) {
        console.log(chalk.red(`❌ Git Error: ${err.message}`));
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
                    pollSpinner.succeed(chalk.green('✅ Build Passed! Infrastructure Healthy.'));
                } else {
                    pollSpinner.fail(chalk.red(`❌ Build Failed! CI/CD error detected in Run ID: ${run.id}`));

                    const aiSpinner = ora('Fetching logs and triggering Gemini AI...').start();

                    try {
                        // 1. Get the raw text logs from GitHub
                        const logContent = await getFailedJobLog(octokit, owner, repo, run.id);

                        // 2. Pass logs to Gemini to extract the OWASP issue and fix
                        const aiResult = await analyzeFailureLog(logContent);
                        aiSpinner.succeed(chalk.green('AI Remediation Analysis Complete.'));

                        // 3. Format the Boxen report
                        const report = `
                            ${chalk.red.bold('OWASP Category:')} ${aiResult.owaspCategory}

                            ${chalk.white.bold('Explanation:')} 
                            ${aiResult.explanation}

                            ${chalk.green.bold('Remediation:')}
                            ${aiResult.remediation}
                        `;

                        // 4. Render the UI
                        console.log(boxen(report, {
                            padding: 1,
                            margin: 1,
                            borderStyle: 'double',
                            borderColor: 'red',
                            title: '🧠 AI DevSecOps Auditor Report',
                            titleAlignment: 'center'
                        }));

                    } catch (error) {
                        aiSpinner.fail('AI Analysis encountered an error.');
                        console.error(chalk.red(error.message));
                    }
                }
            }
        } catch (err) {
            clearInterval(interval);
            pollSpinner.fail(chalk.red('Failed to fetch Actions status.'));
        }
    }, 5000); // 5-second polling interval
}