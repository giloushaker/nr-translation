import { defineStore } from "pinia";

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number;
}

export const useLoadingStore = defineStore("loading", {
  state: (): LoadingState => ({
    isLoading: false,
    message: "Initializing...",
    progress: 0,
  }),

  actions: {
    startLoading(message: string = "Loading...") {
      this.isLoading = true;
      this.message = message;
      this.progress = 0;
    },

    updateProgress(progress: number, message?: string) {
      this.progress = Math.max(0, Math.min(100, progress));
      if (message) {
        this.message = message;
      }
    },

    updateMessage(message: string) {
      this.message = message;
    },

    stopLoading() {
      this.isLoading = false;
      this.message = "Initializing...";
      this.progress = 0;
    },

    async withLoading<T>(
      callback: (updateProgress: (progress: number, message?: string) => void) => Promise<T>,
      initialMessage: string = "Loading..."
    ): Promise<T> {
      this.startLoading(initialMessage);
      try {
        const result = await callback((progress, message) => {
          this.updateProgress(progress, message);
        });
        return result;
      } finally {
        this.stopLoading();
      }
    },
  },
});