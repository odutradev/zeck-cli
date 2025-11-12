import axios from 'axios';
import { FileResource } from './file.js';
import { PathResource } from './path.js';
import { Logger } from './logger.js';

interface NpmPackageInfo {
  'dist-tags': {
    latest: string;
  };
}

export class UpdaterResource {
  private static readonly NPM_REGISTRY = 'https://registry.npmjs.org/zeck-cli';
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  private static lastCheckFile = '.zeck-last-check';

  public static async checkForUpdates(silent: boolean = true): Promise<void> {
    if (!this.shouldCheck()) {
      return;
    }

    try {
      const currentVersion = this.getCurrentVersion();
      const latestVersion = await this.getLatestVersion();

      if (!latestVersion) {
        return;
      }

      if (!this.isUpToDate(currentVersion, latestVersion)) {
        this.notifyUpdate(currentVersion, latestVersion);
      }

      this.updateLastCheck();
    } catch (error) {
      if (!silent) {
        Logger.warning('Failed to check for updates');
      }
    }
  }

  private static shouldCheck(): boolean {
    try {
      const cacheDir = this.getCacheDir();
      const checkFile = PathResource.join(cacheDir, this.lastCheckFile);

      if (!FileResource.exists(checkFile)) {
        return true;
      }

      const lastCheck = parseInt(FileResource.read(checkFile), 10);
      const now = Date.now();

      return now - lastCheck > this.CHECK_INTERVAL;
    } catch {
      return true;
    }
  }

  private static getCacheDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    return PathResource.join(homeDir, '.zeck-cache');
  }

  private static updateLastCheck(): void {
    try {
      const cacheDir = this.getCacheDir();
      FileResource.ensureDir(cacheDir);

      const checkFile = PathResource.join(cacheDir, this.lastCheckFile);
      FileResource.write(checkFile, Date.now().toString());
    } catch {
      // Silent fail
    }
  }

  private static getCurrentVersion(): string {
    const packagePath = PathResource.getPackagePath(import.meta.url, 'package.json');
    const packageJson = FileResource.readJson<{ version: string }>(packagePath);
    return packageJson.version;
  }

  private static async getLatestVersion(): Promise<string | null> {
    try {
      const response = await axios.get<NpmPackageInfo>(this.NPM_REGISTRY, {
        timeout: 3000
      });
      return response.data['dist-tags'].latest;
    } catch {
      return null;
    }
  }

  private static isUpToDate(current: string, latest: string): boolean {
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

  private static notifyUpdate(current: string, latest: string): void {
    Logger.newLine();
    Logger.warning(`Update available: v${current} → v${latest}`);
    Logger.plain('Run "zeck update" to install the latest version');
    Logger.newLine();
  }
}