import { defineStore } from "pinia";

export interface SystemPermission {
  systemId: string;
  languages: string[]; // Array of language codes, or ["*"] for all languages
}

interface User {
  login: string;
  translation_auth: SystemPermission[];
  permission?: number; // Permission level (100 = admin)
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: null,
    user: null,
    isAuthenticated: false,
  }),

  persist: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
  },

  getters: {
    getToken(): string | null {
      return this.token;
    },

    canTranslateSystem:
      (state) =>
      (systemId: string): boolean => {
        if (!state.user) return false;
        return state.user.translation_auth.some((perm) => perm.systemId === systemId);
      },

    canTranslateLanguage:
      (state) =>
      (systemId: string, languageCode: string): boolean => {
        if (!state.user) return false;
        const systemPerm = state.user.translation_auth.find((perm) => perm.systemId === systemId);
        if (!systemPerm) return false;
        return systemPerm.languages.includes("*") || systemPerm.languages.includes(languageCode);
      },

    getAuthorizedLanguages:
      (state) =>
      (systemId: string): string[] | null => {
        if (!state.user) return null;
        const systemPerm = state.user.translation_auth.find((perm) => perm.systemId === systemId);
        if (!systemPerm) return null;
        // Return null if all languages (*), otherwise return the specific list
        return systemPerm.languages.includes("*") ? null : systemPerm.languages;
      },

    isAdmin(): boolean {
      return this.user?.permission === 100;
    },
  },

  actions: {
    async login(login: string, password: string): Promise<boolean> {
      try {
        const config = useRuntimeConfig();
        const baseURL = config.public.apiUrl || "";

        const response = await $fetch<{ success: boolean; token: string; user: User }>(`${baseURL}/api/auth/login`, {
          method: "POST",
          body: { login, password },
        });

        if (response.success && response.token) {
          this.token = response.token;
          this.user = response.user;
          this.isAuthenticated = true;
          return true;
        }

        return false;
      } catch (error: any) {
        console.error("❌ Login failed:", error);
        this.logout();
        return false;
      }
    },

    async register(login: string, password: string, translation_auth: SystemPermission[] = []): Promise<boolean> {
      try {
        const config = useRuntimeConfig();
        const baseURL = config.public.apiUrl || "";

        const response = await $fetch<{ success: boolean; token: string; user: User }>(`${baseURL}/api/auth/register`, {
          method: "POST",
          body: { login, password, translation_auth },
        });

        if (response.success && response.token) {
          this.token = response.token;
          this.user = response.user;
          this.isAuthenticated = true;
          return true;
        }

        return false;
      } catch (error: any) {
        console.error("❌ Registration failed:", error);
        return false;
      }
    },

    async refreshPermissions(): Promise<boolean> {
      try {
        const config = useRuntimeConfig();
        const baseURL = config.public.apiUrl || "";

        const response = await $fetch<{ success: boolean; token: string; user: User }>(`${baseURL}/api/auth/refresh`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (response.success && response.token) {
          this.token = response.token;
          this.user = response.user;
          this.isAuthenticated = true;
          return true;
        }

        return false;
      } catch (error: any) {
        console.error("❌ Failed to refresh permissions:", error);
        return false;
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
    },

    // Restore auth state from localStorage on app init
    restoreAuth() {
      // This is handled automatically by pinia-plugin-persistedstate
      if (this.token && this.user) {
        this.isAuthenticated = true;
      }
    },
  },
});
