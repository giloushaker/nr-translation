<template>
  <div class="container">
    <LoadingOverlay title="Loading System" />

    <!-- Main content -->
    <div v-if="!loadingStore.isLoading">
      <div class="header">
        <button @click="goHome" class="back-button">← Back to Home</button>
        <h1>Select Language</h1>
        <div v-if="systemName" class="system-info"> System: {{ systemName }} </div>
      </div>

      <div class="languages-grid">
        <div v-for="lang in languages" :key="lang.code" class="language-card" @click="selectLanguage(lang.code)">
          <div class="language-header">
            <h3>{{ lang.name }}</h3>
            <span class="language-code">{{ lang.code }}</span>
          </div>

          <div class="stats-container">
            <div class="stat-row">
              <span class="stat-label">Translated:</span>
              <div class="progress-bar">
                <div class="progress-fill translated" :style="{ width: lang.translatedPercent + '%' }"></div>
                <span class="progress-text">{{ lang.translatedPercent }}%</span>
              </div>
            </div>

            <div class="stat-row">
              <span class="stat-label">Reviewed:</span>
              <div class="progress-bar">
                <div class="progress-fill reviewed" :style="{ width: lang.reviewedPercent + '%' }"></div>
                <span class="progress-text">{{ lang.reviewedPercent }}%</span>
              </div>
            </div>

            <div class="stat-details">
              <div class="stat-item">
                <span class="stat-value">{{ lang.totalStrings }}</span>
                <span class="stat-sublabel">Total strings</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ lang.translatedStrings }}</span>
                <span class="stat-sublabel">Translated</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ lang.untranslatedStrings }}</span>
                <span class="stat-sublabel">Untranslated</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="languages.length === 0" class="no-languages">
        No languages available. Please load a game system first.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLoadingStore } from "~/stores/loadingStore";
import { useTranslationStore } from "~/stores/translationStore";
import { useStatsStore } from "~/stores/statsStore";
import { useAuthStore } from "~/stores/authStore";

// Explicitly disable layout for this page to prevent conflicts with translate layout
definePageMeta({
  layout: false,
  middleware: "auth",
});

interface Language {
  code: string;
  name: string;
  translatedPercent: number;
  reviewedPercent: number;
  totalStrings: number;
  translatedStrings: number;
  untranslatedStrings: number;
}

const route = useRoute();
const router = useRouter();
const loadingStore = useLoadingStore();
const translationStore = useTranslationStore();
const statsStore = useStatsStore();
const authStore = useAuthStore();
const languages = ref<Language[]>([]);
const systemName = ref("");

// Helper function to convert LanguageStats to Language interface
const convertStatsToLanguage = (stats: any): Language => ({
  code: stats.code,
  name: stats.name,
  translatedPercent: stats.translatedPercent,
  reviewedPercent: stats.reviewedPercent,
  totalStrings: stats.total,
  translatedStrings: stats.translated,
  untranslatedStrings: stats.untranslated,
});

const loadSystem = async (systemId: string) => {
  await loadingStore.withLoading(async (updateProgress) => {
    try {
      updateProgress(20, "Loading system information...");
      console.log("Loading system:", systemId);

      // Get just the system name without loading full translations
      const translationSources = await import("~/stores/translationSources");
      systemName.value = await translationSources.getSystemName(systemId);
      console.log("System name loaded:", systemName.value);

      updateProgress(50, "Loading translation statistics...");

      // Load stats using the centralized statsStore
      const systemStats = await statsStore.loadStatsForSystem(systemId);
      console.log("Stats loaded:", systemStats);

      updateProgress(80, "Preparing language data...");

      // Convert stats to language format and filter by permissions
      const allLanguages = Object.values(systemStats.languages).map(convertStatsToLanguage);

      // Filter languages based on user permissions
      const authorizedLanguages = authStore.getAuthorizedLanguages(systemId);
      if (authorizedLanguages === null) {
        // User has access to all languages (*)
        languages.value = allLanguages;
      } else {
        // Filter to show only authorized languages
        languages.value = allLanguages.filter((lang) => authorizedLanguages.includes(lang.code));
      }

      updateProgress(100, "Complete!");

      // Small delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Failed to load system:", error, "for systemId:", systemId);
      // Don't redirect to home, just show error in console and use fallback name
      systemName.value = systemId; // Fallback to systemId as name
      languages.value = [];
    }
  }, "Initializing...");
};

const initializeLanguagePage = async () => {
  const systemId = route.params.system as string;
  console.log("Languages page init:", { systemId, path: route.path });

  if (!systemId) {
    console.log("No systemId in languages page, redirecting to systems");
    router.push("/systems");
    return;
  }

  // Check if user has permission to access this system
  if (!authStore.canTranslateSystem(systemId)) {
    console.error(`❌ User does not have permission to access system: ${systemId}`);
    alert(`You do not have permission to translate this system: ${systemId}`);
    router.push("/systems");
    return;
  }

  await loadSystem(systemId);
};

onMounted(initializeLanguagePage);

// Watch for route changes to handle keepalive navigation
watch(
  () => route.params.system,
  async () => {
    await initializeLanguagePage();
  }
);

const goHome = () => {
  router.push("/systems");
};

const selectLanguage = (langCode: string) => {
  const systemId = route.params.system as string;
  router.push(`/translate/${encodeURIComponent(systemId)}/${langCode}`);
};
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
  position: relative;
}

.back-button {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);

  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.system-info {
  color: #666;
  margin-top: 0.5rem;
}

.languages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.language-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.language-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.language-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.language-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.language-code {
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: monospace;
}

.stats-container {
  margin-top: 1rem;
}

.stat-row {
  margin-bottom: 0.75rem;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.progress-bar {
  position: relative;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.translated {
  background: #4caf50;
}

.progress-fill.reviewed {
  background: #2196f3;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 500;
  color: #333;
}

.stat-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.stat-sublabel {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.no-languages {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

h1 {
  margin: 0;
  font-size: 2rem;
}
</style>
