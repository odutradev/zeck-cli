import { Command } from 'commander';

import { PromptResource } from '../utils/prompt.js';
import { ProjectResource } from '../utils/project.js';
import { ModifierResource, ModifierAction, ModifierInstruction } from '../utils/modifier.js';
import { FileResource } from '../utils/file.js';
import { PathResource } from '../utils/path.js';
import githubConfigData from '../config/github.js';
import { Logger } from '../utils/logger.js';
import axios from 'axios';
import { rm } from 'fs/promises';

interface Module {
  name: string;
  description: string;
  path: string;
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
      Logger.info('Fetching templates from GitHub...');
      
      const response = await axios.get(githubConfigData.templateURL);
      const data = response.data;

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid templates data format');
      }

      const category = await this.selectCategory(data);
      const templates = data[category];
      
      if (!templates || templates.length === 0) {
        Logger.warning(`No templates found in category: ${category}`);
        return;
      }

      const template = await this.selectTemplate(templates);
      
      const selectedModules = await this.handleModuleSelection(template);

      await this.downloadAndSetup(template, targetPath, selectedModules);
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Failed to process template selection');
      process.exit(1);
    }
  }

  private async selectCategory(data: TemplatesData): Promise<string> {
    const categories = Object.keys(data);
    
    if (categories.length === 0) {
      throw new Error('No categories found');
    }

    if (categories.length === 1) {
      Logger.info(`Using category: ${categories[0]}`);
      return categories[0];
    }

    const choices = categories.map(cat => ({
      name: cat,
      value: cat
    }));

    const category = await PromptResource.ask({
      type: 'list',
      message: 'Select a project category:',
      choices
    });

    return category;
  }

  private async selectTemplate(templates: Template[]): Promise<Template> {
    const choices = templates.map(t => ({
      name: `${t.name} - ${t.description}`,
      value: t
    }));

    const template = await PromptResource.ask({
      type: 'list',
      message: 'Select a template:',
      choices
    });

    return template;
  }

  private async selectModules(modules: Module[]): Promise<Module[]> {
    const choices = modules.map(m => ({
      name: `${m.name} - ${m.description}`,
      value: m
    }));

    const selectedModules = await PromptResource.ask({
      type: 'checkbox',
      message: 'Select modules to include:',
      choices
    });

    return selectedModules;
  }

  private async handleModuleSelection(template: Template): Promise<Module[]> {
    if (!template.modules || template.modules.length === 0) {
      return [];
    }

    const selectedModules = await this.selectModules(template.modules);

    if (selectedModules.length === 0) {
      Logger.plain('No modules selected');
      return [];
    }

    Logger.plain('Selected modules:');
    selectedModules.forEach(module => {
      Logger.plain(`  - ${module.name}: ${module.description}`);
    });

    return selectedModules;
  }

  private async downloadAndSetup(
    template: Template,
    targetPath: string | undefined,
    selectedModules: Module[]
  ): Promise<void> {
    Logger.plain(`Selected template: ${template.name}`);
    Logger.plain(`Description: ${template.description}`);

    const destination = ProjectResource.resolveDestination(targetPath, template.name);

    Logger.info(`Creating project at: ${destination}`);

    await ProjectResource.validateDestination(destination);

    Logger.info('Downloading template...');
    
    await ProjectResource.createFromTemplate(
      UseCommand.GITHUB_REPO,
      template.url,
      destination
    );

    Logger.success('Project created successfully!');

    if (selectedModules.length > 0) {
      await this.processModules(destination, selectedModules);
    }
    
    if (targetPath !== '.') {
      Logger.plain('Next steps:');
      Logger.plain(`   cd ${destination.split('/').pop()}`);
    } else {
      Logger.plain('Next steps:');
    }
    Logger.plain('npm install');
  }

  private async processModules(destination: string, modules: Module[]): Promise<void> {
    Logger.info('Processing modules...');

    for (const module of modules) {
      try {
        Logger.info(`Installing module: ${module.name}`);
        
        const modulePath = PathResource.join(destination, module.path);
        
        if (!FileResource.exists(modulePath)) {
          Logger.warning(`Module configuration not found: ${module.path}`);
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
        
        Logger.success(`Module ${module.name} installed successfully`);
      } catch (error) {
        Logger.error(`Failed to install module ${module.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await this.cleanupModulesFolder(destination);
  }

  private async cleanupModulesFolder(destination: string): Promise<void> {
    try {
      const modulesPath = PathResource.join(destination, '.modules');
      
      if (FileResource.exists(modulesPath)) {
        await rm(modulesPath, { recursive: true, force: true });
        Logger.success('Cleaned up modules configuration');
      }
    } catch (error) {
      Logger.warning('Failed to cleanup .modules folder');
    }
  }
}