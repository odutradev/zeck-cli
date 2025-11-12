import Table from 'cli-table';
import figlet from 'figlet';
import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'dim';

export class Logger {
  private static readonly PREFIX = chalk.redBright('[zeck]');

  public static info(message: string): void {
    console.log(`${this.PREFIX} ${chalk.cyan('ℹ')} ${message}`);
  }

  public static success(message: string): void {
    console.log(`${this.PREFIX} ${chalk.green('✓')} ${message}`);
  }

  public static error(message: string): void {
    console.error(`${this.PREFIX} ${chalk.red('✗')} ${message}`);
  }

  public static warning(message: string): void {
    console.log(`${this.PREFIX} ${chalk.yellow('⚠')} ${message}`);
  }

  public static plain(message: string): void {
    console.log(message);
  }

  public static step(message: string): void {
    console.log(`${this.PREFIX} ${chalk.cyan('→')} ${message}`);
  }

  public static stepSuccess(message: string): void {
    console.log(`${this.PREFIX} ${chalk.green('✓')} ${chalk.dim(message)}`);
  }

  public static item(message: string, level: LogLevel = 'info'): void {
    const color = this.getColor(level);
    console.log(color(`  ${message}`));
  }

  public static listItem(message: string, level: LogLevel = 'info'): void {
    const color = this.getColor(level);
    console.log(color(`    • ${message}`));
  }

  public static newLine(): void {
    console.log('');
  }

  private static getColor(level: LogLevel): (text: string) => string {
    switch (level) {
      case 'info': return chalk.cyan;
      case 'success': return chalk.green;
      case 'error': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'dim': return chalk.dim;
      default: return chalk.white;
    }
  }

  public static figlet(text: string): void {
    console.log(chalk.cyan(figlet.textSync(text)));
  }

  public static table(head: string[], colWidths: number[], data: any[][]): void {
    const table = new Table({ head, colWidths });
    data.forEach(item => table.push(item));
    console.log(table.toString());
  }
}