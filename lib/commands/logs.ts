import { Command } from 'commander';
import { Logger } from '../utils/logger.js';
import { InstructionLogResource, InstructionLog } from '../utils/instructionLog.js';
import { PromptResource } from '../utils/prompt.js';

export class LogsCommand {
  public register(program: Command): void {
    program
      .command('logs')
      .description('View instruction logs')
      .argument('[hash]', 'Instruction hash to view details')
      .option('--list', 'List all recent logs')
      .option('--failed', 'Show only failed instructions')
      .option('--project <name>', 'Filter by project name')
      .option('--module <name>', 'Filter by module name')
      .option('--clear', 'Clear old logs (30+ days)')
      .action((hash?: string, options?: {
        list?: boolean;
        failed?: boolean;
        project?: string;
        module?: string;
        clear?: boolean;
      }) => this.execute(hash, options));
  }

  private async execute(
    hash: string | undefined,
    options?: {
      list?: boolean;
      failed?: boolean;
      project?: string;
      module?: string;
      clear?: boolean;
    }
  ): Promise<void> {
    try {
      if (options?.clear) {
        await this.clearOldLogs();
        return;
      }

      if (hash) {
        await this.viewLogDetails(hash);
        return;
      }

      if (options?.list || options?.failed || options?.project || options?.module) {
        await this.listLogs(options);
        return;
      }

      await this.interactiveLogs();
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Failed to process logs');
      process.exit(1);
    }
  }

  private async viewLogDetails(hash: string): Promise<void> {
    const log = InstructionLogResource.getLog(hash);

    if (!log) {
      Logger.error(`Log not found: ${hash}`);
      return;
    }

    Logger.newLine();
    Logger.info(`Instruction Log: ${hash}`);
    Logger.newLine();
    
    Logger.item('Project:', 'info');
    Logger.listItem(log.projectName);
    
    Logger.item('Module:', 'info');
    Logger.listItem(log.moduleName);
    
    Logger.item('Instruction #:', 'info');
    Logger.listItem(`${log.instructionIndex + 1}`);
    
    Logger.item('Timestamp:', 'info');
    Logger.listItem(new Date(log.timestamp).toLocaleString());
    
    Logger.item('Status:', log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'warning');
    Logger.listItem(log.status.toUpperCase());

    Logger.newLine();
    Logger.item('Action:', 'info');
    Logger.listItem(log.instruction.action);
    
    Logger.item('Target Path:', 'info');
    Logger.listItem(log.instruction.path);

    if (log.instruction.content) {
      Logger.item('Content:', 'dim');
      Logger.listItem(log.instruction.content.substring(0, 100) + '...');
    }

    if (log.instruction.pattern) {
      Logger.item('Pattern:', 'dim');
      Logger.listItem(log.instruction.pattern);
    }

    if (log.instruction.replacement !== undefined) {
      Logger.item('Replacement:', 'dim');
      Logger.listItem(log.instruction.replacement);
    }

    if (log.instruction.componentName) {
      Logger.item('Component:', 'dim');
      Logger.listItem(log.instruction.componentName);
    }

    if (log.instruction.propName) {
      Logger.item('Prop:', 'dim');
      Logger.listItem(`${log.instruction.propName}${log.instruction.propValue ? `={${log.instruction.propValue}}` : ''}`);
    }

    if (log.conditions && log.conditions.length > 0) {
      Logger.newLine();
      Logger.item('Conditions:', 'info');
      log.conditions.forEach((condition, idx) => {
        const symbol = condition.passed ? '✓' : '✗';
        const color = condition.passed ? 'success' : 'error';
        Logger.item(`  ${symbol} Condition #${idx + 1}: ${condition.reason}`, color);
      });
    }

    if (log.error) {
      Logger.newLine();
      Logger.item('Error:', 'error');
      Logger.listItem(log.error);
    }

    Logger.newLine();
  }

  private async listLogs(options: {
    failed?: boolean;
    project?: string;
    module?: string;
  }): Promise<void> {
    let logs = InstructionLogResource.getAllLogs();

    if (options.failed) {
      logs = logs.filter(log => log.status === 'failed');
    }

    if (options.project) {
      logs = logs.filter(log => 
        log.projectName.toLowerCase().includes(options.project!.toLowerCase())
      );
    }

    if (options.module) {
      logs = logs.filter(log => 
        log.moduleName.toLowerCase().includes(options.module!.toLowerCase())
      );
    }

    if (logs.length === 0) {
      Logger.info('No logs found');
      return;
    }

    Logger.newLine();
    Logger.info(`Found ${logs.length} log(s)`);
    Logger.newLine();

    const displayLogs = logs.slice(0, 20);
    
    for (const log of displayLogs) {
      const statusColor = log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'warning';
      const statusSymbol = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : '○';
      
      Logger.item(`${statusSymbol} ${log.hash}`, statusColor);
      Logger.listItem(`${log.projectName} > ${log.moduleName} > #${log.instructionIndex + 1}`);
      Logger.listItem(new Date(log.timestamp).toLocaleString(), 'dim');
      
      if (log.error) {
        Logger.listItem(log.error.substring(0, 80) + '...', 'error');
      }
      
      Logger.newLine();
    }

    if (logs.length > 20) {
      Logger.plain(`... and ${logs.length - 20} more logs`);
      Logger.newLine();
    }

    Logger.plain('Use "zeck logs <hash>" to view details');
    Logger.newLine();
  }

  private async interactiveLogs(): Promise<void> {
    const logs = InstructionLogResource.getAllLogs().slice(0, 50);

    if (logs.length === 0) {
      Logger.info('No logs found');
      return;
    }

    const choices = logs.map(log => {
      const status = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : '○';
      const date = new Date(log.timestamp).toLocaleDateString();
      return {
        name: `${status} ${log.hash} - ${log.projectName} > ${log.moduleName} (${date})`,
        value: log.hash
      };
    });

    const selectedHash = await PromptResource.ask({
      type: 'list',
      message: 'Select a log to view:',
      choices
    });

    await this.viewLogDetails(selectedHash);
  }

  private async clearOldLogs(): Promise<void> {
    Logger.step('Clearing old logs...');
    
    const cleared = await InstructionLogResource.clearOldLogs();
    
    Logger.stepSuccess(`Cleared ${cleared} old log(s)`);
  }
}