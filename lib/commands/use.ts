import { Command } from 'commander';

import { PromptResource } from '../utils/prompt.js';
import { ProjectResource } from '../utils/project.js';
import githubConfigData from '../config/github.js';
import { Logger } from '../utils/logger.js';
import axios from 'axios';

interface Module {
  name: string;
  description: string;
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
      Logger.info('No modules selected');
      return [];
    }

    Logger.success('Selected modules:');
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
    Logger.info(`Selected template: ${template.name}`);
    Logger.info(`Description: ${template.description}`);

    const destination = ProjectResource.resolveDestination(targetPath, template.name);

    Logger.info(`\nCreating project at: ${destination}`);

    await ProjectResource.validateDestination(destination);

    Logger.info('Downloading template...');
    
    await ProjectResource.createFromTemplate(
      UseCommand.GITHUB_REPO,
      template.url,
      destination
    );

    Logger.success(`\nProject created successfully!`);
    
    if (targetPath !== '.') {
      Logger.info('\nNext steps:');
      Logger.plain(`   cd ${destination.split('/').pop()}`);
      Logger.plain('   npm install');
    } else {
      Logger.info('\nNext steps:');
      Logger.plain('   npm install');
    }

    if (selectedModules.length > 0) {
      Logger.info('\nRemember to install selected modules:');
      selectedModules.forEach(module => {
        Logger.plain(`   npm install ${module.name}`);
      });
    }
  }
}