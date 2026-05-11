import chalk from 'chalk';
import inquirer from 'inquirer';
import { clearCredentials } from '../config/vault.js';

export async function resetCommand() {
    console.log(chalk.yellow.bold('\n Warning: This will permanently delete all stored credentials.\n'));

    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear the credential vault?',
            default: false
        }
    ]);

    if (confirm) {
        clearCredentials();
        console.log(chalk.green('\n Credential vault has been cleared. Run "auditor init" to reconfigure.\n'));
    } else {
        console.log(chalk.gray('\n Reset cancelled. Your credentials remain intact.\n'));
    }
}
