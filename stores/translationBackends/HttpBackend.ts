import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";

// HTTP/REST backend implementation
export class HttpBackend implements TranslationBackend {
  constructor(private baseUrl: string, private apiKey?: string) { }

  async fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]> {
    const url = `${this.baseUrl}/translations/${systemId}/${languageCode}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.translations || [];
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    const url = `${this.baseUrl}/translations/${systemId}/${languageCode}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ translations }),
    });

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${response.statusText}`);
    }
  }

  isAvailable(): boolean {
    return !!this.baseUrl;
  }

  async getStats(systemId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/stats/${systemId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.warn(`Stats request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch stats from HTTP backend:', error);
      return null;
    }
  }
}