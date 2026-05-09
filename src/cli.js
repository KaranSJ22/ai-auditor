import { program } from 'commander';
import { initCommand } from './commands/init.js';
import { pushCommand } from './commands/push.js';
import { statusCommand } from './commands/status.js';

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

program.parse(process.argv);