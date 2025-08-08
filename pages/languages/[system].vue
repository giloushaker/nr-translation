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

// Explicitly disable layout for this page to prevent conflicts with translate layout
definePageMeta({
  layout: false,
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
const languages = ref<Language[]>([]);
const systemName = ref("");

// Default language list
const defaultLanguageCodes = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
];

// Helper function to generate default language data (all zeros)
const generateDefaultLanguages = (): Language[] => {
  return defaultLanguageCodes.map((lang) => ({
    code: lang.code,
    name: lang.name,
    translatedPercent: 0,
    reviewedPercent: 0,
    totalStrings: 0,
    translatedStrings: 0,
    untranslatedStrings: 0,
  }));
};

// Helper function to get total string count (cached)
let cachedSystemStringCount: number | null = null;
const getSystemStringCount = async (systemId: string): Promise<number> => {
  if (cachedSystemStringCount !== null) {
    return cachedSystemStringCount;
  }
  
  try {
    // Check if translation store already has the data loaded
    if (translationStore.isLoaded && translationStore.currentSystemId?.includes(systemId)) {
      cachedSystemStringCount = translationStore.totalStrings;
      return cachedSystemStringCount;
    }
    
    // If not loaded, just return 0 for now - stats will update when system is loaded
    return 0;
  } catch (error) {
    console.warn("Failed to get system string count:", error);
    return 0;
  }
};

// Helper function to calculate local stats from IndexedDB (fast version)
const calculateLocalStats = async (systemId: string, languageCode: string): Promise<{ total: number; translated: number; reviewed: number }> => {
  try {
    const translationSources = await import("~/stores/translationSources");
    const source = translationSources.createTranslationSourceForSystem(systemId);
    const sourceId = source.getId();
    
    // Get total strings (fast - from cache if available)
    const totalStrings = await getSystemStringCount(systemId);
    
    // Get local translations from IndexedDB
    const systemLanguageKey = `${sourceId}-${languageCode}`;
    const db = await translationStore.dbOpen();
    const transaction = db.transaction(['translations'], 'readonly');
    const store = transaction.objectStore('translations');
    const index = store.index('systemLanguage');
    
    const savedTranslations = await new Promise<any[]>((resolve, reject) => {
      const results: any[] = [];
      const request = index.openCursor(IDBKeyRange.only(systemLanguageKey));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
    
    const translatedStrings = savedTranslations.length;
    const reviewedStrings = 0; // We don't track reviewed status yet
    
    return {
      total: totalStrings,
      translated: translatedStrings,
      reviewed: reviewedStrings
    };
    
  } catch (error) {
    console.warn("Failed to calculate local stats:", error);
    return { total: 0, translated: 0, reviewed: 0 };
  }
};

// Helper function to generate language data from backend stats or local calculations
const generateLanguageData = async (systemId: string, backendStats: any): Promise<Language[]> => {
  const results = [];
  
  for (const lang of defaultLanguageCodes) {
    // Check if backend has stats for this language
    const langStats = backendStats?.languages?.[lang.code];

    if (langStats) {
      const totalStrings = langStats.total || 0;
      const translatedStrings = langStats.translated || 0;
      const reviewedStrings = langStats.reviewed || 0;
      const untranslatedStrings = totalStrings - translatedStrings;

      results.push({
        code: lang.code,
        name: lang.name,
        translatedPercent: totalStrings > 0 ? Math.round((translatedStrings / totalStrings) * 100) : 0,
        reviewedPercent: totalStrings > 0 ? Math.round((reviewedStrings / totalStrings) * 100) : 0,
        totalStrings,
        translatedStrings,
        untranslatedStrings: Math.max(0, untranslatedStrings),
      });
    } else {
      // No backend stats, calculate from local data (fast version)
      const localStats = await calculateLocalStats(systemId, lang.code);
      const totalStrings = localStats.total;
      const translatedStrings = localStats.translated;
      const reviewedStrings = localStats.reviewed;
      const untranslatedStrings = Math.max(0, totalStrings - translatedStrings);

      results.push({
        code: lang.code,
        name: lang.name,
        translatedPercent: totalStrings > 0 ? Math.round((translatedStrings / totalStrings) * 100) : 0,
        reviewedPercent: totalStrings > 0 ? Math.round((reviewedStrings / totalStrings) * 100) : 0,
        totalStrings,
        translatedStrings,
        untranslatedStrings,
      });
    }
  }
  
  return results;
};

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

      // Try to get stats from backend if available
      let backendStats = null;
      if (translationStore.backend?.isAvailable()) {
        try {
          console.log("Loading stats from backend for system:", systemId);
          backendStats = await translationStore.backend.getStats(systemId);
          console.log("Backend stats loaded:", backendStats);
        } catch (error) {
          console.warn("Failed to load stats from backend:", error);
        }
      }

      updateProgress(80, "Preparing language data...");

      // Generate language list with backend stats or defaults
      languages.value = await generateLanguageData(systemId, backendStats);

      updateProgress(100, "Complete!");

      // Small delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Failed to load system:", error, "for systemId:", systemId);
      // Don't redirect to home, just show error in console and use fallback name
      systemName.value = systemId; // Fallback to systemId as name
      languages.value = generateDefaultLanguages();
    }
  }, "Initializing...");
};

const initializeLanguagePage = async () => {
  const systemId = route.params.system as string;
  console.log("Languages page init:", { systemId, path: route.path });

  if (!systemId) {
    console.log("No systemId in languages page, redirecting to home");
    router.push("/");
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
  router.push("/");
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
