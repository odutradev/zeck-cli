import { resolve, relative, normalize, join, dirname } from 'path';
import { fileURLToPath } from 'url';

export class PathResource {
  public static resolve(path: string): string {
    return resolve(path);
  }

  public static relative(from: string, to: string): string {
    return relative(from, to);
  }

  public static normalize(path: string): string {
    return normalize(path);
  }

  public static join(...paths: string[]): string {
    return join(...paths);
  }

  public static isAbsolute(path: string): boolean {
    return resolve(path) === normalize(path);
  }

  public static getPackageRoot(importMetaUrl: string): string {
    const __filename = fileURLToPath(importMetaUrl);
    const __dirname = dirname(__filename);
    return resolve(__dirname, '../..');
  }

  public static getPackagePath(importMetaUrl: string, ...paths: string[]): string {
    const root = this.getPackageRoot(importMetaUrl);
    return join(root, ...paths);
  }
}