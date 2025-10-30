import inquirer from 'inquirer';

type PromptType = 'input' | 'number' | 'confirm' | 'list' | 'rawlist' | 'expand' | 'checkbox' | 'password' | 'editor';

interface PromptConfig {
  name?: string;
  message: string;
  type?: PromptType;
  choices?: string[];
  default?: any;
  validate?: (value: any) => boolean | string;
}

export class PromptResource {
  private static readonly PREFIX = '(zeck)';
  private static readonly DEFAULT_VALIDATE = (value: any): boolean | string => 
    value ? true : 'This field is required';

  public static async ask(config: PromptConfig): Promise<any> {
    const prompt = this.buildPrompt(config);
    const answer = await inquirer.prompt([prompt]);
    return answer[prompt.name];
  }

  public static async askMany(configs: PromptConfig[]): Promise<Record<string, any>> {
    const prompts = configs.map((config, index) => 
      this.buildPrompt({ ...config, name: config.name || index.toString() })
    );
    return await inquirer.prompt(prompts);
  }

  private static buildPrompt(config: PromptConfig): any {
    return {
      prefix: this.PREFIX,
      type: config.type || 'input',
      name: config.name || '0',
      message: config.message,
      choices: config.choices || [],
      default: config.default,
      validate: config.validate || this.DEFAULT_VALIDATE
    };
  }
}