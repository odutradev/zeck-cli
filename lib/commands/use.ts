import { Command } from 'commander';

import { PromptResource } from '../utils/prompt.js';
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
  public register(program: Command): void {
    program
      .command('use')
      .description('Select and use a project template')
      .action(() => this.execute());
  }

  private async execute(): Promise<void> {
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
      
      await this.handleTemplateSelection(template);
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

  private async handleTemplateSelection(template: Template): Promise<void> {
    Logger.success(`Selected template: ${template.name}`);
    Logger.info(`Description: ${template.description}`);
    Logger.info(`URL: ${template.url}`);

    if (template.modules && template.modules.length > 0) {
      Logger.info('Available modules:');
      template.modules.forEach(module => {
        Logger.plain(`  - ${module.name}: ${module.description}`);
      });
    }
  }
}