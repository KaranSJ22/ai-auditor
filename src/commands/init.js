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
            when: () => !existingCreds.githubPat,
            validate: (input) => {
                if (!input || input.trim().length === 0) return 'PAT cannot be empty.';
                if (!input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
                    return 'Invalid PAT format. Expected prefix: ghp_ or github_pat_';
                }
                return true;
            }
        },
        {
            type: 'password',
            name: 'geminiKey',
            message: 'Enter your Gemini API Key:',
            mask: '*',
            when: () => !existingCreds.geminiKey,
            validate: (input) => {
                if (!input || input.trim().length === 0) return 'API Key cannot be empty.';
                return true;
            }
        }
    ]);

    const hasNewCreds = answers.githubPat || answers.geminiKey;

    if (hasNewCreds) {
        saveCredentials(answers.githubPat, answers.geminiKey);
        console.log(chalk.green('\n Credentials securely stored locally.'));
    } else {
        console.log(chalk.yellow('\n Credentials already exist in the vault. Ready to go!'));
    }
}