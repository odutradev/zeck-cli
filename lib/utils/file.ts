import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class FileResource {
  private static readonly BINARY_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.ttf', '.woff', '.woff2', '.eot'
  ];

  public static read(path: string): string {
    return readFileSync(path, 'utf-8');
  }

  public static write(path: string, content: string): void {
    writeFileSync(path, content, 'utf-8');
  }

  public static exists(path: string): boolean {
    return existsSync(path);
  }

  public static isTextFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return !this.BINARY_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
  }

  public static readJson<T>(path: string): T {
    const content = this.read(path);
    return JSON.parse(content) as T;
  }

  public static upsert(path: string, content: string): 'created' | 'updated' {
    const exists = this.exists(path);
    const dir = dirname(path);
    
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    this.write(path, content);
    return exists ? 'updated' : 'created';
  }

  public static ensureDir(path: string): void {
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
  }
}