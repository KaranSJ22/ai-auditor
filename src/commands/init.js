import inquirer from 'inquirer';
import chalk from 'chalk';
import { saveCredentials, getCredentials } from '../config/vault.js';

export async function initCommand() {
    console.log(chalk.blue.bold('\n Initializing DevSecOps Credential Vault\n'));

    const existingCreds = getCredentials();

    const answers = await inquirer.prompt([
        {
            type: 'password',
            name: 'githubPat',
            message: 'Enter your GitHub Personal Access Token (PAT):',
            mask: '*',
            when: () => !existingCreds.githubPat
        },
        {
            type: 'password',
            name: 'geminiKey',
            message: 'Enter your Gemini API Key:',
            mask: '*',
            when: () => !existingCreds.geminiKey
        }
    ]);

    saveCredentials(answers.githubPat, answers.geminiKey);

    if (answers.githubPat || answers.geminiKey) {
        console.log(chalk.green('\n Credentials securely stored locally.'));
    } else {
        console.log(chalk.yellow('\n Credentials already exist in the vault. Ready to go!'));
    }
}