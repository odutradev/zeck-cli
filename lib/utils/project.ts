import { readdir, copyFile, mkdir } from 'fs/promises';

import { CacheResource } from './cache.js';
import { FileResource } from './file.js';
import { PathResource } from './path.js';

export class ProjectResource {
  public static resolveDestination(targetPath: string | undefined, defaultName: string): string {
    const cwd = process.cwd();

    if (!targetPath) {
      return PathResource.join(cwd, defaultName);
    }

    if (targetPath === '.') {
      return cwd;
    }

    if (PathResource.isAbsolute(targetPath)) {
      return targetPath;
    }

    return PathResource.join(cwd, targetPath);
  }

  public static async createFromTemplate(
    repo: string,
    subdir: string,
    destination: string
  ): Promise<void> {
    const identifier = `temp-${Date.now()}`;

    try {
      const sourcePath = await CacheResource.cloneRepository(repo, subdir, identifier);

      await this.copyDirectory(sourcePath, destination);

      await CacheResource.clearTemp(identifier);
    } catch (error) {
      await CacheResource.clearTemp(identifier);
      throw error;
    }
  }

  private static async copyDirectory(src: string, dest: string): Promise<void> {
    
    await mkdir(dest, { recursive: true });
    
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = PathResource.join(src, entry.name);
      const destPath = PathResource.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  public static async validateDestination(destination: string): Promise<void> {
    if (FileResource.exists(destination)) {
      const files = await readdir(destination);
      
      if (files.length > 0) {
        throw new Error(`Destination '${destination}' is not empty`);
      }
    }
  }
}