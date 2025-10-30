import { Command } from 'commander';

import { GithubResource } from '../utils/github.js';
import { Logger } from '../utils/logger.js';

interface Template {
  name: string;
  description?: string;
  url?: string;
  [key: string]: any;
}

interface TemplatesData {
  templates?: Template[];
  [key: string]: any;
}

export class UseCommand {
  public register(program: Command): void {
    program
      .command('use')
      .description('Fetch and display available templates from GitHub')
      .action(() => this.execute());
  }

  private async execute(): Promise<void> {
    try {
      Logger.info('Fetching templates from GitHub...');
      
      const data = await GithubResource.fetchTemplates<TemplatesData>();
      
      this.displayTemplates(data);
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : 'Failed to fetch templates');
      process.exit(1);
    }
  }

  private displayTemplates(data: TemplatesData): void {
    if (data.templates && Array.isArray(data.templates)) {
      this.displayAsTable(data.templates);
    } else {
      this.displayAsJson(data);
    }
  }

  private displayAsTable(templates: Template[]): void {
    if (templates.length === 0) {
      Logger.warning('No templates found');
      return;
    }

    const head = ['Name', 'Description'];
    const colWidths = [30, 70];
    const rows = templates.map(template => [
      template.name || 'N/A',
      template.description || 'No description'
    ]);

    Logger.table(head, colWidths, rows);
    Logger.success(`Found ${templates.length} template(s)`);
  }

  private displayAsJson(data: any): void {
    Logger.plain(JSON.stringify(data, null, 2));
  }
}