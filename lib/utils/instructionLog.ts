import { createHash } from 'crypto';
import { FileResource } from './file.js';
import { PathResource } from './path.js';

export interface InstructionLog {
  hash: string;
  timestamp: number;
  projectName: string;
  moduleName: string;
  instructionIndex: number;
  instruction: {
    path: string;
    action: string;
    content?: string;
    pattern?: string;
    replacement?: string;
    componentName?: string;
    propName?: string;
    propValue?: string;
  };
  status: 'success' | 'skipped' | 'failed';
  error?: string;
  conditions?: Array<{
    passed: boolean;
    reason: string;
  }>;
}

export class InstructionLogResource {
  private static readonly LOG_DIR = '.zeck-logs';

  public static getLogDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    return PathResource.join(homeDir, this.LOG_DIR);
  }

  public static generateHash(
    projectName: string,
    moduleName: string,
    instructionIndex: number,
    timestamp: number
  ): string {
    const data = `${projectName}_${moduleName}_${instructionIndex}_${timestamp}`;
    return createHash('md5').update(data).digest('hex').substring(0, 12);
  }

  public static async saveLog(log: InstructionLog): Promise<void> {
    const logDir = this.getLogDir();
    FileResource.ensureDir(logDir);

    const logFile = PathResource.join(logDir, `${log.hash}.json`);
    FileResource.write(logFile, JSON.stringify(log, null, 2));
  }

  public static getLog(hash: string): InstructionLog | null {
    const logDir = this.getLogDir();
    const logFile = PathResource.join(logDir, `${hash}.json`);

    if (!FileResource.exists(logFile)) {
      return null;
    }

    return FileResource.readJson<InstructionLog>(logFile);
  }

  public static getAllLogs(): InstructionLog[] {
    const logDir = this.getLogDir();

    if (!FileResource.exists(logDir)) {
      return [];
    }

    const { readdirSync } = require('fs');
    const files = readdirSync(logDir).filter((f: string) => f.endsWith('.json'));

    return files
      .map((file: string) => {
        try {
          return this.getLog(file.replace('.json', ''));
        } catch {
          return null;
        }
      })
      .filter((log: InstructionLog | null): log is InstructionLog => log !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public static async clearOldLogs(maxAgeDays: number = 30): Promise<number> {
    const logs = this.getAllLogs();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let cleared = 0;

    for (const log of logs) {
      if (now - log.timestamp > maxAgeMs) {
        const logFile = PathResource.join(this.getLogDir(), `${log.hash}.json`);
        const { unlinkSync } = require('fs');
        
        try {
          unlinkSync(logFile);
          cleared++;
        } catch {
          // Silent fail
        }
      }
    }

    return cleared;
  }
}