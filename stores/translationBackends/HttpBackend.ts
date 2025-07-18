import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";

// HTTP/REST backend implementation
export class HttpBackend implements TranslationBackend {
  constructor(private baseUrl: string, private apiKey?: string) {}

  async sync(systemId: string, languageCode: string): Promise<TranslationString[]> {
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

  async submit(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
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

  getSystems(): Promise<Array<{ name: string; description: string; id: string }>> {
    throw new Error('HTTP backend does not support system listing yet');
  }

  getStats(systemId: string): Promise<any> {
    throw new Error('HTTP backend does not support stats yet');
  }
}