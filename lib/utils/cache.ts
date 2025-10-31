import { FileResource } from './file.js';
import { PathResource } from './path.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class CacheResource {
  private static readonly CACHE_DIR = '.zeck-cache';
  
  public static getCachePath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    return PathResource.join(homeDir, this.CACHE_DIR);
  }

  public static getTempPath(identifier: string): string {
    return PathResource.join(this.getCachePath(), identifier);
  }

  public static async ensureCache(): Promise<void> {
    const cachePath = this.getCachePath();
    FileResource.ensureDir(cachePath);
  }

  public static async clearTemp(identifier: string): Promise<void> {
    const tempPath = this.getTempPath(identifier);
    
    if (!FileResource.exists(tempPath)) return;

    await this.removeDirectory(tempPath);
  }

  public static async clearAll(): Promise<void> {
    const cachePath = this.getCachePath();
    
    if (!FileResource.exists(cachePath)) return;

    await this.removeDirectory(cachePath);
  }

  private static async removeDirectory(dir: string, retries: number = 3): Promise<void> {
    const { rm } = await import('fs/promises');
    
    for (let i = 0; i < retries; i++) {
      try {
        await rm(dir, { recursive: true, force: true, maxRetries: 5 });
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        await this.sleep(1000);
      }
    }
  }

  public static async cloneRepository(repo: string, subdir: string, identifier: string): Promise<string> {
    await this.ensureCache();
    const tempPath = this.getTempPath(identifier);
    
    FileResource.ensureDir(tempPath);

    await execAsync('git init', { cwd: tempPath });
    await execAsync(`git remote add origin ${repo}`, { cwd: tempPath });
    await execAsync('git config core.sparseCheckout true', { cwd: tempPath });

    const { writeFile } = await import('fs/promises');
    await writeFile(
      PathResource.join(tempPath, '.git', 'info', 'sparse-checkout'),
      subdir
    );

    await execAsync('git pull --depth=1 origin master', { cwd: tempPath });

    return PathResource.join(tempPath, subdir);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}