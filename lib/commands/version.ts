import { Command } from 'commander';

import { FileResource } from '../utils/file.js';
import { PathResource } from '../utils/path.js';
import { Logger } from '../utils/logger.js';

export class VersionCommand {
  public register(program: Command): void {
    program.command('version').description('Display version information').action(() => this.execute());
  }

  private async execute(): Promise<void> {
    try {
      this.displayBanner();
      this.displayVersion();
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Unexpected error occurred');
      process.exit(1);
    }
  }

  private displayBanner(): void {
    const packageJson = this.getPackageJson();
    const name = packageJson.name.replace('-', ' ').toUpperCase();
    Logger.figlet(name);
  }

  private displayVersion(): void {
    const packageJson = this.getPackageJson();
    Logger.info(`Version: ${packageJson.version}`);
  }

  private getPackageJson(): any {
    const packagePath = PathResource.getPackagePath(import.meta.url, 'package.json');
    return FileResource.readJson(packagePath);
  }
}