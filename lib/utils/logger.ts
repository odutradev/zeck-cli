import Table from 'cli-table';
import figlet from 'figlet';
import chalk from 'chalk';

export class Logger {
  private static readonly PREFIX = chalk.redBright('[zeck]');

  public static info(message: string): void {
    console.log(`${this.PREFIX} ${chalk.cyan('[info]')} ${message}`);
  }

  public static success(message: string): void {
    console.log(`${this.PREFIX} ${chalk.green('[success]')} ${message}`);
  }

  public static error(message: string): void {
    console.error(`${this.PREFIX} ${chalk.redBright('[error]')} ${chalk.red(message)}`);
  }

  public static warning(message: string): void {
    console.log(`${this.PREFIX} ${chalk.yellowBright('[warn]')} ${chalk.yellow(message)}`);
  }

  public static plain(message: string): void {
    console.log(message);
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