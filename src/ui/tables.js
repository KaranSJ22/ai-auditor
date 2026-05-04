import Table from 'cli-table3';
import chalk from 'chalk';

export function renderWorkflowTable(runs) {
    // 1. Initialize the table headers
    const table = new Table({
        head: [
            chalk.cyan.bold('Run ID'),
            chalk.cyan.bold('Branch'),
            chalk.cyan.bold('Status'),
            chalk.cyan.bold('Conclusion'),
            chalk.cyan.bold('Time')
        ]
    });

    // 2. Loop through the GitHub API data and populate the rows
    runs.forEach(run => {
        const statusColor = run.status === 'completed' ? chalk.green : chalk.yellow;
        
        let conclusionColor = chalk.gray;
        if (run.conclusion === 'success') conclusionColor = chalk.green;
        if (run.conclusion === 'failure') conclusionColor = chalk.red;

        table.push([
            run.id,
            run.head_branch,
            statusColor(run.status),
            conclusionColor(run.conclusion || 'In Progress'),
            new Date(run.created_at).toLocaleString()
        ]);
    });

    return table.toString();
}