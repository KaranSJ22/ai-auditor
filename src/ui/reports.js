import boxen from 'boxen';
import chalk from 'chalk';

// Takes the raw AI JSON and renders a beautiful terminal box
export function renderSecurityReport(aiResult) {
    const reportContent = `
${chalk.red.bold('OWASP Category:')} ${chalk.white(aiResult.owaspCategory)}

${chalk.yellow.bold('Explanation:')}
${chalk.white(aiResult.explanation)}

${chalk.green.bold('Remediation:')}
${chalk.white(aiResult.remediation)}
    `.trim();

    return boxen(reportContent, {
        title: 'AI DevSec Auditor Report',
        titleAlignment: 'center',
        padding: 1,
        margin: 1,
        borderColor: 'red',
        borderStyle: 'double'
    });
}