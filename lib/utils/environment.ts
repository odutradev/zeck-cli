import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './logger.js';

const execAsync = promisify(exec);

interface ToolCheck {
  name: string;
  command: string;
  versionCommand: string;
  required: boolean;
  minVersion?: string;
}

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export class EnvironmentResource {
  private static readonly TOOLS: ToolCheck[] = [
    {
      name: 'Node.js',
      command: 'node',
      versionCommand: 'node --version',
      required: true,
      minVersion: '16.0.0'
    },
    {
      name: 'Git',
      command: 'git',
      versionCommand: 'git --version',
      required: true
    },
    {
      name: 'npm',
      command: 'npm',
      versionCommand: 'npm --version',
      required: false
    }
  ];

  public static async validate(): Promise<ValidationResult> {
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const tool of this.TOOLS) {
      const result = await this.checkTool(tool);
      
      if (!result.installed) {
        if (tool.required) {
          missing.push(tool.name);
        } else {
          warnings.push(tool.name);
        }
      } else if (result.version && tool.minVersion) {
        if (!this.isVersionValid(result.version, tool.minVersion)) {
          warnings.push(`${tool.name} (found v${result.version}, requires v${tool.minVersion}+)`);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    };
  }

  private static async checkTool(tool: ToolCheck): Promise<{ installed: boolean; version?: string }> {
    try {
      const { stdout } = await execAsync(tool.versionCommand);
      const version = this.extractVersion(stdout);
      return { installed: true, version };
    } catch {
      return { installed: false };
    }
  }

  private static extractVersion(output: string): string {
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '';
  }

  private static isVersionValid(current: string, required: string): boolean {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const curr = currentParts[i] || 0;
      const req = requiredParts[i] || 0;
      
      if (curr > req) return true;
      if (curr < req) return false;
    }

    return true;
  }

  public static displayValidationResult(result: ValidationResult): void {
    if (result.missing.length > 0) {
      Logger.newLine();
      Logger.error('Missing required tools:');
      result.missing.forEach(tool => Logger.listItem(tool, 'error'));
      Logger.newLine();
      this.displayInstallInstructions(result.missing);
    }

    if (result.warnings.length > 0) {
      Logger.newLine();
      Logger.warning('Optional tools not found or outdated:');
      result.warnings.forEach(tool => Logger.listItem(tool, 'warning'));
    }
  }

  private static displayInstallInstructions(missing: string[]): void {
    Logger.plain('Installation instructions:');
    Logger.newLine();

    missing.forEach(tool => {
      switch (tool) {
        case 'Node.js':
          Logger.plain('  Node.js: https://nodejs.org/');
          break;
        case 'Git':
          Logger.plain('  Git: https://git-scm.com/downloads');
          break;
        case 'npm':
          Logger.plain('  npm: Comes with Node.js installation');
          break;
      }
    });
  }
}