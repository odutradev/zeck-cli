import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

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
  ): boolean {
    switch (condition.type) {
      case ConditionType.MODULE_EXISTS:
        return context.selectedModules.includes(condition.value || '');

      case ConditionType.MODULE_NOT_EXISTS:
        return !context.selectedModules.includes(condition.value || '');

      case ConditionType.PATTERN_EXISTS:
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) return false;
          const content = this.readFile(target);
          return content.includes(condition.value || '');
        } catch {
          return false;
        }

      case ConditionType.PATTERN_NOT_EXISTS:
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) return true;
          const content = this.readFile(target);
          return !content.includes(condition.value || '');
        } catch {
          return true;
        }

      case ConditionType.PATTERN_COUNT:
        try {
          const target = condition.target || targetPath;
          if (!existsSync(target)) return false;
          const content = this.readFile(target);
          const pattern = condition.value || '';
          const count = content.split(pattern).length - 1;
          return this.compareCount(count, condition.operator, condition.count || 0);
        } catch {
          return false;
        }

      case ConditionType.FILE_EXISTS:
        const existsTarget = condition.target || condition.value || '';
        return existsSync(existsTarget);

      case ConditionType.FILE_NOT_EXISTS:
        const notExistsTarget = condition.target || condition.value || '';
        return !existsSync(notExistsTarget);

      default:
        return true;
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
  ): boolean {
    const logic = group.logic || LogicOperator.AND;
    const results = group.conditions.map(condition => 
      this.evaluateCondition(condition, context, targetPath)
    );

    return logic === LogicOperator.AND
      ? results.every(r => r)
      : results.some(r => r);
  }

  public static shouldExecuteInstruction(
    instruction: ModifierInstruction,
    context: ModifierContext
  ): boolean {
    if (!instruction.condition) return true;

    return this.evaluateConditionGroup(
      instruction.condition,
      context,
      instruction.path
    );
  }

  public static processInstruction(
    instruction: ModifierInstruction,
    context: ModifierContext
  ): boolean {
    if (!this.shouldExecuteInstruction(instruction, context)) {
      return false;
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

    return true;
  }

  public static processInstructions(
    instructions: ModifierInstruction[],
    context: ModifierContext
  ): { executed: number; skipped: number } {
    let executed = 0;
    let skipped = 0;

    for (const instruction of instructions) {
      if (this.processInstruction(instruction, context)) {
        executed++;
      } else {
        skipped++;
      }
    }

    return { executed, skipped };
  }
}