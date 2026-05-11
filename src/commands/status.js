import chalk from 'chalk';
import { getGitDetails, getOctokit } from '../core/github.js';
import { createLoadingSpinner } from '../ui/spinners.js';
import { renderWorkflowTable } from '../ui/tables.js';

export async function statusCommand() {
    console.log(chalk.blue.bold('\n Fetching CI/CD Pipeline Status...\n'));

    let gitDetails;
    try {
        gitDetails = await getGitDetails();
    } catch (err) {
        console.log(chalk.red(` Git Error: ${err.message}`));
        return;
    }

    const { owner, repo, branch } = gitDetails;

    let octokit;
    try {
        octokit = getOctokit();
    } catch (err) {
        console.log(chalk.red(` Auth Error: ${err.message} Run 'auditor init'.`));
        return;
    }

    // Use the refactored UI spinner
    const spinner = createLoadingSpinner(`Fetching recent workflow runs for ${chalk.yellow(branch)}...`).start();

    try {
        // Fetch the last 5 workflow runs for the current branch
        const response = await octokit.rest.actions.listWorkflowRunsForRepo({
            owner,
            repo,
            branch,
            per_page: 5
        });

        spinner.succeed('Workflow history retrieved.');

        const runs = response.data.workflow_runs;

        if (runs.length === 0) {
            console.log(chalk.yellow(`\nNo workflow runs found for branch: ${branch}\n`));
            return;
        }

        // Render the UI Table
        const tableUI = renderWorkflowTable(runs);
        console.log(`\n${tableUI}\n`);

    } catch (err) {
        spinner.fail(chalk.red('Failed to fetch workflow status.'));
        console.error(err.message);
    }
}