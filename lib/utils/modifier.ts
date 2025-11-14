import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Logger } from './logger.js';
import { InstructionLogResource, InstructionLog } from './instructionLog.js';

export enum ModifierAction {
  CREATE_FILE = 'CREATE_FILE',
  DELETE_FILE = 'DELETE_FILE',
  INSERT_IMPORT = 'INSERT_IMPORT',
  INSERT_AFTER = 'INSERT_AFTER',
  INSERT_BEFORE = 'INSERT_BEFORE',
  REPLACE_CONTENT = 'REPLACE_CONTENT',
  APPEND_TO_FILE = 'APPEND_TO_FILE',
  INSERT_PROP = 'INSERT_PROP'
}

export enum ConditionType {
  MODULE_EXISTS = 'MODULE_EXISTS',
  MODULE_NOT_EXISTS = 'MODULE_NOT_EXISTS',
  PATTERN_EXISTS = 'PATTERN_EXISTS',
  PATTERN_NOT_EXISTS = 'PATTERN_NOT_EXISTS',
  PATTERN_COUNT = 'PATTERN_COUNT',
  FILE_EXISTS = 'FILE_EXISTS',
  FILE_NOT_EXISTS = 'FILE_NOT_EXISTS'
}

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_OR_EQUAL = 'GREATER_OR_EQUAL',
  LESS_OR_EQUAL = 'LESS_OR_EQUAL'
}

export enum LogicOperator {
  AND = 'AND',
  OR = 'OR'
}

export interface Condition {
  type: ConditionType;
  value?: string;
  operator?: ConditionOperator;
  count?: number;
  target?: string;
}

export interface ConditionGroup {
  conditions: Condition[];
  logic?: LogicOperator;
}

export interface ModifierInstruction {
  path: string;
  action: ModifierAction;
  content?: string;
  pattern?: string;
  replacement?: string;
  componentName?: string;
  propName?: string;
  propValue?: string;
  condition?: ConditionGroup;
}

export interface ModifierContext {
  selectedModules: string[];
  projectRoot: string;
  projectName?: string;
  moduleName?: string;
  verbose?: boolean;
}

interface ConditionEvaluationResult {
  passed: boolean;
  reason: string;
}

export class ModifierResource {
  private static ensureDirectory(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private static readFile(filePath: string): string {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return readFileSync(filePath, 'utf8');
  }

  private static writeFile(filePath: string, content: string): void {
    this.ensureDirectory(filePath);
    writeFileSync(filePath, content, 'utf8');
  }

  private static createFile(filePath: string, content: string): void {
    this.ensureDirectory(filePath);
    this.writeFile(filePath, content);
  }

  private static deleteFile(filePath: string): void {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  private static insertImport(filePath: string, importStatement: string): void {
    const content = this.readFile(filePath);
    const lines = content.split('\n');
    
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex === -1) {
      lines.unshift(importStatement);
    } else {
      lines.splice(lastImportIndex + 1, 0, importStatement);
    }

    this.writeFile(filePath, lines.join('\n'));
  }

  private static insertAfter(filePath: string, pattern: string, content: string): void {
    const fileContent = this.readFile(filePath);
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        lines.splice(i + 1, 0, content);
        break;
      }
    }

    this.writeFile(filePath, lines.join('\n'));
  }

  private static insertBefore(filePath: string, pattern: string, content: string): void {
    const fileContent = this.readFile(filePath);
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        lines.splice(i, 0, content);
        break;
      }
    }

    this.writeFile(filePath, lines.join('\n'));
  }

  private static replaceContent(filePath: string, pattern: string, replacement: string): void {
    const content = this.readFile(filePath);
    const newContent = content.split(pattern).join(replacement);
    this.writeFile(filePath, newContent);
  }

  private static appendToFile(filePath: string, content: string): void {
    const currentContent = this.readFile(filePath);
    this.writeFile(filePath, currentContent + '\n' + content);
  }

  private static insertProp(
    filePath: string,
    componentName: string,
    propName: string,
    propValue?: string
  ): void {
    const content = this.readFile(filePath);
    const componentPattern = new RegExp(`<${componentName}([^>]*)(\\/)?>`, 'g');
    
    const newContent = content.replace(componentPattern, (match, props, selfClosing) => {
      const hasSelfClosing = selfClosing === '/';
      const trimmedProps = props.trim();
      
      const newProp = propValue ? `${propName}={${propValue}}` : propName;
      
      if (trimmedProps) {
        return hasSelfClosing 
          ? `<${componentName}${props} ${newProp} />`
          : `<${componentName}${props} ${newProp}>`;
      }
      
      return hasSelfClosing
        ? `<${componentName} ${newProp} />`
        : `<${componentName} ${newProp}>`;
    });

    this.writeFile(filePath, newContent);
  }

  private static evaluateCondition(
    condition: Condition,
    context: ModifierContext,
    targetPath: string
  ): ConditionEvaluationResult {
    switch (condition.type) {
      case ConditionType.MODULE_EXISTS: {
        const moduleName = condition.value || '';
        const passed = context.selectedModules.includes(moduleName);
        return {
          passed,
          reason: passed 
            ? `Module '${moduleName}' is selected`
            : `Module '${moduleName}' is not selected`
        };
      }

      case ConditionType.MODULE_NOT_EXISTS: {
        const moduleName = condition.value || '';
        const passed = !context.selectedModules.includes(moduleName);
        return {
          passed,
          reason: passed 
            ? `Module '${moduleName}' is not selected`
            : `Module '${moduleName}' is selected`
        };
      }

      case ConditionType.PATTERN_EXISTS: {
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) {
            return {
              passed: false,
              reason: `File '${target}' does not exist`
            };
          }
          const content = this.readFile(target);
          const pattern = condition.value || '';
          const passed = content.includes(pattern);
          return {
            passed,
            reason: passed 
              ? `Pattern '${pattern}' found in file`
              : `Pattern '${pattern}' not found in file`
          };
        } catch (error) {
          return {
            passed: false,
            reason: `Error reading file: ${error instanceof Error ? error.message : 'unknown error'}`
          };
        }
      }

      case ConditionType.PATTERN_NOT_EXISTS: {
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) {
            return {
              passed: true,
              reason: `File '${target}' does not exist`
            };
          }
          const content = this.readFile(target);
          const pattern = condition.value || '';
          const passed = !content.includes(pattern);
          return {
            passed,
            reason: passed 
              ? `Pattern '${pattern}' not found in file`
              : `Pattern '${pattern}' found in file`
          };
        } catch (error) {
          return {
            passed: true,
            reason: `Error reading file (treated as not exists): ${error instanceof Error ? error.message : 'unknown error'}`
          };
        }
      }

      case ConditionType.PATTERN_COUNT: {
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) {
            return {
              passed: false,
              reason: `File '${target}' does not exist`
            };
          }
          const content = this.readFile(target);
          const pattern = condition.value || '';
          const count = content.split(pattern).length - 1;
          const expectedCount = condition.count || 0;
          const operator = condition.operator || ConditionOperator.EQUALS;
          const passed = this.compareCount(count, operator, expectedCount);
          return {
            passed,
            reason: passed 
              ? `Pattern count ${count} ${this.getOperatorSymbol(operator)} ${expectedCount}`
              : `Pattern count ${count} does not match ${this.getOperatorSymbol(operator)} ${expectedCount}`
          };
        } catch (error) {
          return {
            passed: false,
            reason: `Error reading file: ${error instanceof Error ? error.message : 'unknown error'}`
          };
        }
      }

      case ConditionType.FILE_EXISTS: {
        const target = condition.target || condition.value || '';
        const passed = existsSync(target);
        return {
          passed,
          reason: passed 
            ? `File '${target}' exists`
            : `File '${target}' does not exist`
        };
      }

      case ConditionType.FILE_NOT_EXISTS: {
        const target = condition.target || condition.value || '';
        const passed = !existsSync(target);
        return {
          passed,
          reason: passed 
            ? `File '${target}' does not exist`
            : `File '${target}' exists`
        };
      }

      default:
        return {
          passed: true,
          reason: 'No condition specified'
        };
    }
  }

  private static getOperatorSymbol(operator: ConditionOperator): string {
    switch (operator) {
      case ConditionOperator.EQUALS: return '==';
      case ConditionOperator.NOT_EQUALS: return '!=';
      case ConditionOperator.GREATER_THAN: return '>';
      case ConditionOperator.LESS_THAN: return '<';
      case ConditionOperator.GREATER_OR_EQUAL: return '>=';
      case ConditionOperator.LESS_OR_EQUAL: return '<=';
      default: return '==';
    }
  }

  private static compareCount(
    actualCount: number,
    operator: ConditionOperator | undefined,
    expectedCount: number
  ): boolean {
    if (!operator) return actualCount === expectedCount;

    switch (operator) {
      case ConditionOperator.EQUALS:
        return actualCount === expectedCount;
      case ConditionOperator.NOT_EQUALS:
        return actualCount !== expectedCount;
      case ConditionOperator.GREATER_THAN:
        return actualCount > expectedCount;
      case ConditionOperator.LESS_THAN:
        return actualCount < expectedCount;
      case ConditionOperator.GREATER_OR_EQUAL:
        return actualCount >= expectedCount;
      case ConditionOperator.LESS_OR_EQUAL:
        return actualCount <= expectedCount;
      default:
        return actualCount === expectedCount;
    }
  }

  private static evaluateConditionGroup(
    group: ConditionGroup,
    context: ModifierContext,
    targetPath: string
  ): { passed: boolean; results: ConditionEvaluationResult[] } {
    const logic = group.logic || LogicOperator.AND;
    const results = group.conditions.map(condition => 
      this.evaluateCondition(condition, context, targetPath)
    );

    const passed = logic === LogicOperator.AND
      ? results.every(r => r.passed)
      : results.some(r => r.passed);

    return { passed, results };
  }

  public static shouldExecuteInstruction(
    instruction: ModifierInstruction,
    context: ModifierContext
  ): { should: boolean; results?: ConditionEvaluationResult[]; logic?: LogicOperator } {
    if (!instruction.condition) {
      return { should: true };
    }

    const evaluation = this.evaluateConditionGroup(
      instruction.condition,
      context,
      instruction.path
    );

    return { 
      should: evaluation.passed, 
      results: evaluation.results,
      logic: instruction.condition.logic || LogicOperator.AND
    };
  }

  private static async saveInstructionLog(
    instruction: ModifierInstruction,
    context: ModifierContext,
    instructionIndex: number,
    status: 'success' | 'skipped' | 'failed',
    error?: string,
    conditionResults?: ConditionEvaluationResult[]
  ): Promise<string> {
    const timestamp = Date.now();
    const projectName = context.projectName || 'unknown';
    const moduleName = context.moduleName || 'unknown';
    
    const hash = InstructionLogResource.generateHash(
      projectName,
      moduleName,
      instructionIndex,
      timestamp
    );

    const log: InstructionLog = {
      hash,
      timestamp,
      projectName,
      moduleName,
      instructionIndex,
      instruction: {
        path: instruction.path,
        action: instruction.action,
        content: instruction.content,
        pattern: instruction.pattern,
        replacement: instruction.replacement,
        componentName: instruction.componentName,
        propName: instruction.propName,
        propValue: instruction.propValue
      },
      status,
      error,
      conditions: conditionResults
    };

    await InstructionLogResource.saveLog(log);
    return hash;
  }

  public static async processInstruction(
    instruction: ModifierInstruction,
    context: ModifierContext,
    instructionIndex: number
  ): Promise<boolean> {
    const verbose = context.verbose || false;
    
    if (verbose) {
      Logger.newLine();
      Logger.item(`Instruction #${instructionIndex + 1}:`, 'info');
      Logger.listItem(`Action: ${instruction.action}`);
      Logger.listItem(`Target: ${instruction.path}`);
    }

    const evaluation = this.shouldExecuteInstruction(instruction, context);

    if (instruction.condition && verbose) {
      Logger.listItem(`Conditions (${evaluation.logic || 'AND'} logic):`);
      evaluation.results?.forEach((result, idx) => {
        const symbol = result.passed ? '✓' : '✗';
        const color = result.passed ? 'success' : 'error';
        Logger.item(`  ${symbol} Condition #${idx + 1}: ${result.reason}`, color);
      });
    }

    if (!evaluation.should) {
      if (verbose) {
        Logger.item('Result: SKIPPED', 'warning');
        
        const hash = await this.saveInstructionLog(
          instruction,
          context,
          instructionIndex,
          'skipped',
          undefined,
          evaluation.results
        );
        
        Logger.item(`Log Hash: ${hash}`, 'dim');
      }
      return false;
    }

    if (verbose) {
      Logger.item('Result: EXECUTING', 'success');
    }

    const { 
      path: filePath, 
      action, 
      content, 
      pattern, 
      replacement, 
      componentName, 
      propName, 
      propValue 
    } = instruction;

    try {
      switch (action) {
        case ModifierAction.CREATE_FILE:
          if (!content) throw new Error('Content is required for CREATE_FILE action');
          this.createFile(filePath, content);
          break;

        case ModifierAction.DELETE_FILE:
          this.deleteFile(filePath);
          break;

        case ModifierAction.INSERT_IMPORT:
          if (!content) throw new Error('Content is required for INSERT_IMPORT action');
          this.insertImport(filePath, content);
          break;

        case ModifierAction.INSERT_AFTER:
          if (!pattern || !content) throw new Error('Pattern and content are required for INSERT_AFTER action');
          this.insertAfter(filePath, pattern, content);
          break;

        case ModifierAction.INSERT_BEFORE:
          if (!pattern || !content) throw new Error('Pattern and content are required for INSERT_BEFORE action');
          this.insertBefore(filePath, pattern, content);
          break;

        case ModifierAction.REPLACE_CONTENT:
          if (!pattern || replacement === undefined) throw new Error('Pattern and replacement are required for REPLACE_CONTENT action');
          this.replaceContent(filePath, pattern, replacement);
          break;

        case ModifierAction.APPEND_TO_FILE:
          if (!content) throw new Error('Content is required for APPEND_TO_FILE action');
          this.appendToFile(filePath, content);
          break;

        case ModifierAction.INSERT_PROP:
          if (!componentName || !propName) throw new Error('ComponentName and propName are required for INSERT_PROP action');
          this.insertProp(filePath, componentName, propName, propValue);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (verbose) {
        Logger.item('Status: COMPLETED', 'success');
        
        const hash = await this.saveInstructionLog(
          instruction,
          context,
          instructionIndex,
          'success',
          undefined,
          evaluation.results
        );
        
        Logger.item(`Log Hash: ${hash}`, 'dim');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      
      if (verbose) {
        Logger.item(`Status: FAILED - ${errorMessage}`, 'error');
        
        const hash = await this.saveInstructionLog(
          instruction,
          context,
          instructionIndex,
          'failed',
          errorMessage,
          evaluation.results
        );
        
        Logger.item(`Log Hash: ${hash}`, 'error');
      }
      
      throw error;
    }
  }

  public static async processInstructions(
    instructions: ModifierInstruction[],
    context: ModifierContext
  ): Promise<{ executed: number; skipped: number }> {
    let executed = 0;
    let skipped = 0;

    const verbose = context.verbose || false;

    if (verbose) {
      Logger.item(`Total instructions: ${instructions.length}`, 'info');
    }

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      try {
        if (await this.processInstruction(instruction, context, i)) {
          executed++;
        } else {
          skipped++;
        }
      } catch (error) {
        skipped++;
        if (verbose) {
          Logger.error(`Instruction #${i + 1} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }

    return { executed, skipped };
  }
}