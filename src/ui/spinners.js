import ora from 'ora';
import chalk from 'chalk';

// Creates a standardized spinner for network requests
export function createLoadingSpinner(text) {
    return ora({
        text: chalk.blue(text),
        spinner: 'dots',
        color: 'cyan'
    });
}