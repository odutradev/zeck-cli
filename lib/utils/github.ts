import config from '../config/github.js';

interface GithubConfig {
  templatesUrl: string;
}

export class GithubResource {
  private static convertToRawUrl(url: string): string {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }

  public static async fetchTemplates<T>(): Promise<T> {
    const rawUrl = this.convertToRawUrl(config.templatesUrl);
    
    const response = await fetch(rawUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    
    return await response.json() as T;
  }

  public static async fetchJson<T>(url: string): Promise<T> {
    const rawUrl = this.convertToRawUrl(url);
    
    const response = await fetch(rawUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
    }
    
    return await response.json() as T;
  }

  public static async fetchRaw(url: string): Promise<string> {
    const rawUrl = this.convertToRawUrl(url);
    
    const response = await fetch(rawUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
    }
    
    return await response.text();
  }
}