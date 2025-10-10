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

    console.log("🔄 Fetching translations from:", url);
    console.log("🔄 System ID:", systemId);
    console.log("🔄 Language Code:", languageCode);

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

      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`Sync failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Received data:", data);
      return data.translations || [];
    } catch (error) {
      console.error("❌ Fetch error:", error);
      throw error;
    }
  }

  async uploadTranslations(systemId: string, languageCode: string, translations: TranslationString[]): Promise<void> {
    const url = `${this.baseUrl}/translations`;

    console.log("📤 Uploading translations to:", url);
    console.log("📤 System ID:", systemId);
    console.log("📤 Language Code:", languageCode);
    console.log("📤 Translations count:", translations.length);

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

      console.log("📡 Upload response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload error response:", errorText);
        throw new Error(`Submit failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log("✅ Upload successful");
    } catch (error) {
      console.error("❌ Upload error:", error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.baseUrl;
  }

  async getStats(systemId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/stats`;

      console.log("📊 Fetching stats from:", url);
      console.log("📊 System ID:", systemId);

      const headers = this.getAuthHeaders();

      const requestBody = {
        systemId,
      };

      const response = await fetch(url, { 
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log("📡 Stats response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Stats request failed: ${response.status} ${response.statusText} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      console.log("✅ Stats data:", data);
      return data;
    } catch (error) {
      console.warn("Failed to fetch stats from HTTP backend:", error);
      return null;
    }
  }
}
