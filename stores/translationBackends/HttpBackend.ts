import type { TranslationString } from "../translationStore";
import type { TranslationBackend } from "./index";
import { useAuthStore } from "../authStore";

// HTTP/REST backend implementation
export class HttpBackend implements TranslationBackend {
  constructor(private baseUrl: string, private apiKey?: string) {}

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Try to get token from auth store first, fallback to apiKey
    try {
      const authStore = useAuthStore();
      const token = authStore.getToken;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        return headers;
      }
    } catch (error) {
      // Auth store not available (SSR or not initialized)
    }

    // Fallback to apiKey if provided
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  async fetchTranslations(systemId: string, languageCode: string): Promise<TranslationString[]> {
    const url = `${this.baseUrl}/translations`;
    const headers = this.getAuthHeaders();

    const requestBody = {
      systemId,
      languageCode,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.translations || [];
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    const url = `${this.baseUrl}/translations`;
    const headers = this.getAuthHeaders();

    const requestBody = {
      systemId,
      languageCode,
      translations,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Submit failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.baseUrl;
  }

  async getStats(systemId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/stats`;
      const headers = this.getAuthHeaders();

      const requestBody = {
        systemId,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Failed to fetch stats from HTTP backend:", error);
      return null;
    }
  }
}
