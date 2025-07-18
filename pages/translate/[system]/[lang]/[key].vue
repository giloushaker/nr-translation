<template>
  <div class="container">
      <!-- Main content -->
      <div class="translation-interface">
      <div class="header">
        <button @click="goBack" class="back-button">← Back to Overview</button>
        <div class="header-info">
          <h1>{{ languageName }} Translation</h1>
          <div class="progress-info"> {{ currentIndex + 1 }} of {{ totalKeys }} strings </div>
        </div>
      </div>

      <div class="navigation-bar">
        <button @click="navigateToPrevious" :disabled="currentIndex === 0" class="nav-button prev-button">
          ← Previous
        </button>

        <div class="key-info">
          <span class="catalogue-name">{{ currentCatalogue }}</span>
          <span class="key-separator">•</span>
          <span class="key-index">{{ currentIndex + 1 }} / {{ totalKeys }}</span>
        </div>

        <button @click="navigateToNext" :disabled="currentIndex === totalKeys - 1" class="nav-button next-button">
          Next →
        </button>
      </div>

      <div v-if="currentTranslation" class="translation-content">
        <div class="translation-card">
          <div class="original-section">
            <div class="original-text">{{ currentTranslation.original }}</div>
          </div>

          <div class="translation-section">
            <label class="section-label" :for="`translation-${currentTranslation.id}`">
              {{ languageName }} Translation
            </label>
            <textarea
              :id="`translation-${currentTranslation.id}`"
              v-model="currentTranslation.translation"
              @input="markAsModified"
              :placeholder="`Enter ${languageName} translation...`"
              class="translation-input"
              rows="4"
            ></textarea>

            <div class="translation-tools">
              <button
                @click="clearTranslation"
                class="tool-button clear-button"
                :disabled="!currentTranslation.translation"
              >
                Clear
              </button>
              <button @click="copyOriginal" class="tool-button copy-button"> Copy Original </button>
              <div class="status-indicator">
                <span v-if="currentTranslation.translated" class="status-badge translated"> ✓ Translated </span>
                <span v-else class="status-badge untranslated"> — Untranslated </span>
              </div>
            </div>
          </div>

          <div class="metadata-section"> </div>
        </div>
      </div>

      <div v-else class="no-translation"> Translation not found. </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTranslationStore } from "~/stores/translationStore";

const route = useRoute();
const router = useRouter();
const translationStore = useTranslationStore();

// Route params
const systemId = computed(() => route.params.system as string);
const languageCode = computed(() => route.params.lang as string);
const currentKey = computed(() => route.params.key as string);

// Translation data
const currentIndex = ref(0);

// Computed properties from store
const allTranslations = computed(() => translationStore.translations);
const totalKeys = computed(() => allTranslations.value.length);

// Current translation
const currentTranslation = computed(() => allTranslations.value[currentIndex.value]);
const currentCatalogue = computed(() => currentTranslation.value?.catalogue || "");

// Language mapping
const languageName = computed(() => {
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    zh: "Chinese",
  };
  return languageNames[languageCode.value] || languageCode.value;
});

const updateCurrentIndex = () => {
  // Find the current translation by key
  const decodedKey = decodeURIComponent(currentKey.value);
  const keyIndex = allTranslations.value.findIndex((t) => t.key === decodedKey);
  if (keyIndex !== -1) {
    currentIndex.value = keyIndex;
  } else {
    // If key not found, default to first item
    currentIndex.value = 0;
  }
};

// Navigation methods
const navigateToPrevious = () => {
  if (currentIndex.value > 0) {
    const newIndex = currentIndex.value - 1;
    navigateToIndex(newIndex);
  }
};

const navigateToNext = () => {
  if (currentIndex.value < totalKeys.value - 1) {
    const newIndex = currentIndex.value + 1;
    navigateToIndex(newIndex);
  }
};

const navigateToIndex = (newIndex: number) => {
  if (newIndex >= 0 && newIndex < totalKeys.value) {
    currentIndex.value = newIndex;
    const newKey = allTranslations.value[newIndex]?.key;
    if (newKey && newKey !== currentKey.value) {
      router.replace({
        params: {
          ...route.params,
          key: encodeURIComponent(newKey),
        },
      });
    }
  }
};

// Translation methods
const markAsModified = () => {
  if (currentTranslation.value) {
    translationStore.updateTranslation(
      currentTranslation.value.id,
      currentTranslation.value.translation,
      systemId.value,
      languageCode.value
    );
  }
};

const clearTranslation = () => {
  if (currentTranslation.value) {
    translationStore.updateTranslation(currentTranslation.value.id, "", systemId.value, languageCode.value);
  }
};

const copyOriginal = () => {
  if (currentTranslation.value) {
    translationStore.updateTranslation(
      currentTranslation.value.id,
      currentTranslation.value.original,
      systemId.value,
      languageCode.value
    );
  }
};

const goBack = () => {
  router.push(`/translate/${encodeURIComponent(systemId.value)}/${languageCode.value}`);
};

// Watch for route changes to update current index
watch(
  () => currentKey.value,
  (newKey) => {
    if (newKey && allTranslations.value.length > 0) {
      updateCurrentIndex();
    }
  }
);

// Watch for translation data changes to update index
watch(
  () => allTranslations.value.length,
  (newLength) => {
    if (newLength > 0) {
      updateCurrentIndex();
    }
  }
);

// Keyboard navigation
const handleKeyPress = (event: KeyboardEvent) => {
  if (event.target && (event.target as HTMLElement).tagName === "TEXTAREA") {
    return; // Don't interfere when typing in textarea
  }

  if (event.key === "ArrowLeft" && currentIndex.value > 0) {
    navigateToPrevious();
  } else if (event.key === "ArrowRight" && currentIndex.value < totalKeys.value - 1) {
    navigateToNext();
  }
};

onMounted(() => {
  // Set initial index based on current key
  updateCurrentIndex();
  
  // Add keyboard listeners
  window.addEventListener("keydown", handleKeyPress);
});

// Cleanup keyboard listeners
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyPress);
});
</script>

<style scoped>

.translation-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  background: #f8f9fa;
  padding: 1rem 2rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.back-button {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.back-button:hover {
  background: #f0f0f0;
}

.header-info {
  flex: 1;
}

.header-info h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
}

.progress-info {
  color: #666;
  font-size: 0.875rem;
}

.navigation-bar {
  background: #fff;
  padding: 1rem 2rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-button {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 120px;
}

.nav-button:hover:not(:disabled) {
  background: #0056b3;
}

.nav-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.key-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.catalogue-name {
  font-weight: 600;
  color: #333;
}

.key-separator {
  color: #999;
}

.translation-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.translation-card {
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.original-section,
.translation-section {
  margin-bottom: 2rem;
}

.section-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.original-text {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.translation-input {
  width: calc(100% - 2rem - 2px);
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical;
  min-height: 80px;
  white-space: pre-wrap;
}

.translation-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
}

.translation-tools {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.tool-button {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.tool-button:hover:not(:disabled) {
  background: #f8f9fa;
}

.tool-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-button:hover:not(:disabled) {
  border-color: #dc3545;
  color: #dc3545;
}

.copy-button:hover:not(:disabled) {
  border-color: #007bff;
  color: #007bff;
}

.status-indicator {
  margin-left: auto;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.translated {
  background: #d4edda;
  color: #155724;
}

.status-badge.untranslated {
  background: #f8d7da;
  color: #721c24;
}

.metadata-section {
  border-top: 1px solid #dee2e6;
  padding-top: 1rem;
  display: flex;
  gap: 2rem;
}

.metadata-item {
  display: flex;
  gap: 0.5rem;
}

.metadata-label {
  font-weight: 600;
  color: #666;
}

.metadata-value {
  color: #333;
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
}

.quick-nav {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
}

.quick-nav h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #333;
}

.filter-buttons {
  display: flex;
  gap: 1rem;
}

.filter-button {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.filter-button:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.no-translation {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}
</style>
