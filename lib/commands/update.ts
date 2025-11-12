import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

import { FileResource } from '../utils/file.js';
import { PathResource } from '../utils/path.js';
import { PromptResource } from '../utils/prompt.js';
import { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);

interface NpmPackageInfo {
  'dist-tags': {
    latest: string;
  };
  versions: {
    [key: string]: any;
  };
}

export class UpdateCommand {
  private static readonly NPM_REGISTRY = 'https://registry.npmjs.org/zeck-cli';

  public register(program: Command): void {
    program
      .command('update')
      .description('Check for updates and update zeck-cli')
      .option('--check', 'Only check for updates without installing')
      .action((options?: { check?: boolean }) => this.execute(options?.check || false));
  }

  private async execute(checkOnly: boolean): Promise<void> {
    try {
      Logger.step('Checking for updates...');

      const currentVersion = this.getCurrentVersion();
      const latestVersion = await this.getLatestVersion();

      if (!latestVersion) {
        Logger.error('Failed to fetch latest version from npm');
        return;
      }

      Logger.stepSuccess('Version check complete');
      Logger.newLine();

      if (this.isUpToDate(currentVersion, latestVersion)) {
        Logger.success(`You are using the latest version (v${currentVersion})`);
        return;
      }

      Logger.info(`Current version: v${currentVersion}`);
      Logger.success(`Latest version: v${latestVersion}`);
      Logger.newLine();

      if (checkOnly) {
        Logger.plain('Run "zeck update" to install the latest version');
        return;
      }

      const shouldUpdate = await this.promptUpdate();

      if (!shouldUpdate) {
        Logger.plain('Update cancelled');
        return;
      }

      await this.performUpdate();
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Failed to check for updates');
      process.exit(1);
    }
  }

  private getCurrentVersion(): string {
    const packagePath = PathResource.getPackagePath(import.meta.url, 'package.json');
    const packageJson = FileResource.readJson<{ version: string }>(packagePath);
    return packageJson.version;
  }

  private async getLatestVersion(): Promise<string | null> {
    try {
      const response = await axios.get<NpmPackageInfo>(UpdateCommand.NPM_REGISTRY);
      return response.data['dist-tags'].latest;
    } catch (error) {
      return null;
    }
  }

  private isUpToDate(current: string, latest: string): boolean {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const curr = currentParts[i] || 0;
      const lat = latestParts[i] || 0;

      if (curr < lat) return false;
      if (curr > lat) return true;
    }

    return true;
  }

  private async promptUpdate(): Promise<boolean> {
    return await PromptResource.ask({
      type: 'confirm',
      message: 'Do you want to update now?',
      default: true
    });
  }

  private async performUpdate(): Promise<void> {
    try {
      Logger.step('Updating zeck-cli...');
      Logger.plain('This may take a few moments...');
      Logger.newLine();

      await execAsync('npm install -g zeck-cli@latest');

      Logger.newLine();
      Logger.success('zeck-cli has been updated successfully!');
      Logger.plain('Restart your terminal to use the new version');
    } catch (error) {
      Logger.newLine();
      Logger.error('Failed to update zeck-cli');
      Logger.plain('Try running manually: npm install -g zeck-cli@latest');
      throw error;
    }
  }
}