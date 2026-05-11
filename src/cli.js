import { program } from 'commander';
import { initCommand } from './commands/init.js';
import { pushCommand } from './commands/push.js';
import { statusCommand } from './commands/status.js';
import { preflightCommand } from './commands/preflight.js';
import { resetCommand } from './commands/reset.js';
import { dsCheckCommand } from './commands/ds-check.js';
program
  .name('auditor')
  .description('AIAuditor - Unified TUI')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize credential vault and link project keys')
  .action(initCommand);

program
  .command('push')
  .description('Push code and launch live CI/CD dashboard')
  .option('-t, --target <url>', 'The local URL for the DAST scanner to attack', 'http://localhost:3000')
  .action((options) => {
    pushCommand(options.target);
  });

program
  .command('status')
  .description('Check recent CI/CD pipeline runs without pushing')
  .action(statusCommand);

program
  .command('preflight')
  .description('Run local security checks before pushing')
  .action(preflightCommand);

program
  .command('reset')
  .description('Clear all stored credentials from the local vault')
  .action(resetCommand);

program
  .command('ds-check')
  .description('Analyze Docker Compose architecture for security risks')
  .action(dsCheckCommand);

program.parse(process.argv);