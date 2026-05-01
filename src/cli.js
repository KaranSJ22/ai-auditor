import { program } from 'commander';
import { initCommand } from './commands/init.js';
import { pushCommand } from './commands/push.js'; // <-- NEW IMPORT

program
  .name('auditor')
  .description('AI DevSecOps Auditor - Unified TUI')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize credential vault and link project keys')
  .action(async () => {
      await initCommand();
  });

program
  .command('push')
  .description('Push code and launch live CI/CD dashboard')
  .action(async () => {
      await pushCommand(); // <-- NEW ACTION EXECUTION
  });

program.parse(process.argv);