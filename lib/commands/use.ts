import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';

import { PromptResource } from '../utils/prompt.js';
import { ProjectResource } from '../utils/project.js';
import { ModifierResource, ModifierAction, ModifierInstruction } from '../utils/modifier.js';
import { FileResource } from '../utils/file.js';
import { PathResource } from '../utils/path.js';
import githubConfigData from '../config/github.js';
import { Logger } from '../utils/logger.js';
import axios from 'axios';
import { rm } from 'fs/promises';

const execAsync = promisify(exec);

interface Module {
  name: string;
  description: string;
  path: string;
  excludes?: string[];
  includes?: string[];
  priority?: number;
}

interface Template {
  name: string;
  description: string;
  url: string;
  modules?: Module[];
}

interface TemplatesData {
  [category: string]: Template[];
}

interface ModuleInstructions {
  instructions: Array<{
    path: string;
    action: string;
    content?: string;
    pattern?: string;
    replacement?: string;
    componentName?: string;
    propName?: string;
    propValue?: string;
  }>;
}

export class UseCommand {
  private static readonly GITHUB_REPO = 'https://github.com/odutradev/zeck-templates.git';

  public register(program: Command): void {
    program
      .command('use')
      .description('Select and use a project template')
      .argument('[path]', 'Project path (default: template name, "." for current directory)')
      .action((targetPath?: string) => this.execute(targetPath));
  }

  private async execute(targetPath?: string): Promise<void> {
    try {
      const response = await axios.get(githubConfigData.templateURL);
      const data = response.data;

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid templates data format');
      }

      const category = await this.selectCategory(data);
      const templates = data[category];
      
      if (!templates || templates.length === 0) {
        Logger.error('No templates found in this category');
        return;
      }

      const template = await this.selectTemplate(templates);
      const selectedModules = await this.handleModuleSelection(template);

      Logger.newLine();
      await this.downloadAndSetup(template, targetPath, selectedModules);
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Failed to process template');
      process.exit(1);
    }
  }

  private async selectCategory(data: TemplatesData): Promise<string> {
    const categories = Object.keys(data);
    
    if (categories.length === 0) {
      throw new Error('No categories found');
    }

    if (categories.length === 1) {
      return categories[0];
    }

    const choices = categories.map(cat => ({
      name: cat,
      value: cat
    }));

    return await PromptResource.ask({
      type: 'list',
      message: 'Select a project category:',
      choices
    });
  }

  private async selectTemplate(templates: Template[]): Promise<Template> {
    const choices = templates.map(t => ({
      name: `${t.name} - ${t.description}`,
      value: t
    }));

    return await PromptResource.ask({
      type: 'list',
      message: 'Select a template:',
      choices
    });
  }

  private async selectModules(modules: Module[]): Promise<Module[]> {
    const choices = modules.map(m => ({
      name: `${m.name} - ${m.description}`,
      value: m
    }));

    return await PromptResource.ask({
      type: 'checkbox',
      message: 'Select modules to include:',
      choices
    });
  }

  private addIncludedModules(selectedModules: Module[], allModules: Module[]): Module[] {
    const moduleMap = new Map(allModules.map(m => [m.name, m]));
    const finalModules = new Set<Module>(selectedModules);
    const addedModuleNames = new Set<string>();

    const addIncludes = (module: Module) => {
      if (module.includes) {
        for (const includeName of module.includes) {
          const includedModule = moduleMap.get(includeName);
          if (includedModule && !finalModules.has(includedModule)) {
            finalModules.add(includedModule);
            addedModuleNames.add(includeName);
            addIncludes(includedModule);
          }
        }
      }
    };

    selectedModules.forEach(module => addIncludes(module));

    if (addedModuleNames.size > 0) {
      Logger.item('Auto-included dependencies:', 'dim');
      addedModuleNames.forEach(name => Logger.listItem(name, 'dim'));
    }

    return Array.from(finalModules);
  }

  private filterExcludedModules(selectedModules: Module[]): Module[] {
    const moduleNames = selectedModules.map(m => m.name);
    const excludedModules = new Set<string>();

    selectedModules.forEach(module => {
      if (module.excludes) {
        module.excludes.forEach(excludeName => {
          if (moduleNames.includes(excludeName)) {
            excludedModules.add(excludeName);
          }
        });
      }
    });

    if (excludedModules.size > 0) {
      Logger.item('Excluded due to conflicts:', 'warning');
      excludedModules.forEach(name => Logger.listItem(name, 'warning'));
    }

    return selectedModules.filter(m => !excludedModules.has(m.name));
  }

  private sortModulesByPriority(modules: Module[]): Module[] {
    return modules.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });
  }

  private async handleModuleSelection(template: Template): Promise<Module[]> {
    if (!template.modules || template.modules.length === 0) {
      return [];
    }

    const selectedModules = await this.selectModules(template.modules);

    if (selectedModules.length === 0) {
      return [];
    }

    Logger.newLine();
    const modulesWithIncludes = this.addIncludedModules(selectedModules, template.modules);
    const filteredModules = this.filterExcludedModules(modulesWithIncludes);

    if (filteredModules.length === 0) {
      Logger.error('All modules were excluded due to conflicts');
      return [];
    }

    const sortedModules = this.sortModulesByPriority(filteredModules);

    Logger.item('Installation order:', 'info');
    sortedModules.forEach((module, index) => {
      const priority = module.priority ? ` (P${module.priority})` : '';
      Logger.listItem(`${module.name}${priority}`);
    });

    return sortedModules;
  }

  private async downloadAndSetup(
    template: Template,
    targetPath: string | undefined,
    selectedModules: Module[]
  ): Promise<void> {
    const destination = ProjectResource.resolveDestination(targetPath, template.name);

    await ProjectResource.validateDestination(destination);

    Logger.step('Downloading template...');
    await ProjectResource.createFromTemplate(
      UseCommand.GITHUB_REPO,
      template.url,
      destination
    );
    Logger.stepSuccess('Template downloaded');

    if (selectedModules.length > 0) {
      Logger.step(`Installing ${selectedModules.length} module(s)...`);
      await this.processModules(destination, selectedModules);
      Logger.stepSuccess('Modules installed');
    }

    Logger.newLine();
    Logger.success(`Project created at: ${destination}`);
    Logger.newLine();
    Logger.plain('Next steps:');
    if (targetPath !== '.') {
      Logger.plain(`  cd ${destination.split('/').pop()}`);
    }
    Logger.plain('  npm install');

    await this.promptOpenVSCode(destination);
  }

  private async promptOpenVSCode(projectPath: string): Promise<void> {
    try {
      const openVSCode = await PromptResource.ask({
        type: 'confirm',
        message: 'Open project in VSCode?',
        default: true
      });

      if (openVSCode) {
        await execAsync(`code "${projectPath}"`);
      }
    } catch (error) {
      Logger.warning('VSCode not found in PATH');
    }
  }

  private async processModules(destination: string, modules: Module[]): Promise<void> {
    for (const module of modules) {
      try {
        const modulePath = PathResource.join(destination, module.path);
        
        if (!FileResource.exists(modulePath)) {
          Logger.warning(`  ✗ ${module.name} (config not found)`);
          continue;
        }

        const moduleConfig = FileResource.readJson<ModuleInstructions>(modulePath);
        
        const instructions: ModifierInstruction[] = moduleConfig.instructions.map(inst => ({
          path: PathResource.join(destination, inst.path),
          action: inst.action as ModifierAction,
          content: inst.content,
          pattern: inst.pattern,
          replacement: inst.replacement,
          componentName: inst.componentName,
          propName: inst.propName,
          propValue: inst.propValue
        }));

        ModifierResource.processInstructions(instructions);
        Logger.plain(`  ✓ ${module.name}`);
      } catch (error) {
        Logger.plain(`  ✗ ${module.name} (${error instanceof Error ? error.message : 'error'})`);
      }
    }

    await this.cleanupModulesFolder(destination);
  }

  private async cleanupModulesFolder(destination: string): Promise<void> {
    try {
      const modulesPath = PathResource.join(destination, '.modules');
      
      if (FileResource.exists(modulesPath)) {
        await rm(modulesPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Silent cleanup failure
    }
  }
}