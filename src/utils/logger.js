import chalk from 'chalk';

// Centralized logging utility to ensure consistent terminal output
export const logger = {
    info: (message) => console.log(chalk.blue(message)),
    success: (message) => console.log(chalk.green(`✅ ${message}`)),
    warn: (message) => console.log(chalk.yellow(`⚠️ ${message}`)),
    error: (message) => console.error(chalk.red.bold(`❌ ERROR: ${message}`)),
    header: (message) => {
        console.log('\n' + chalk.magenta.bold.underline(message) + '\n');
    },
    divider: () => console.log(chalk.gray('-'.repeat(50)))
};