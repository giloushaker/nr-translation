<template>
  <div class="container">
    <div class="header">
      <h1>Select Language</h1>
      <div v-if="systemName" class="system-info">
        System: {{ systemName }}
      </div>
    </div>

    <div class="languages-grid">
      <div 
        v-for="lang in languages" 
        :key="lang.code"
        class="language-card"
        @click="selectLanguage(lang.code)"
      >
        <div class="language-header">
          <h3>{{ lang.name }}</h3>
          <span class="language-code">{{ lang.code }}</span>
        </div>
        
        <div class="stats-container">
          <div class="stat-row">
            <span class="stat-label">Translated:</span>
            <div class="progress-bar">
              <div 
                class="progress-fill translated"
                :style="{ width: lang.translatedPercent + '%' }"
              ></div>
              <span class="progress-text">{{ lang.translatedPercent }}%</span>
            </div>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">Reviewed:</span>
            <div class="progress-bar">
              <div 
                class="progress-fill reviewed"
                :style="{ width: lang.reviewedPercent + '%' }"
              ></div>
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

interface Language {
  code: string
  name: string
  translatedPercent: number
  reviewedPercent: number
  totalStrings: number
  translatedStrings: number
  untranslatedStrings: number
}

const router = useRouter()
const systemName = ref('')
const languages = ref<Language[]>([])

// Sample languages data - this should be populated from actual translation data
const sampleLanguages: Language[] = [
  {
    code: 'en',
    name: 'English',
    translatedPercent: 100,
    reviewedPercent: 100,
    totalStrings: 1500,
    translatedStrings: 1500,
    untranslatedStrings: 0
  },
  {
    code: 'es',
    name: 'Spanish',
    translatedPercent: 85,
    reviewedPercent: 72,
    totalStrings: 1500,
    translatedStrings: 1275,
    untranslatedStrings: 225
  },
  {
    code: 'fr',
    name: 'French',
    translatedPercent: 92,
    reviewedPercent: 85,
    totalStrings: 1500,
    translatedStrings: 1380,
    untranslatedStrings: 120
  },
  {
    code: 'de',
    name: 'German',
    translatedPercent: 78,
    reviewedPercent: 65,
    totalStrings: 1500,
    translatedStrings: 1170,
    untranslatedStrings: 330
  },
  {
    code: 'it',
    name: 'Italian',
    translatedPercent: 65,
    reviewedPercent: 45,
    totalStrings: 1500,
    translatedStrings: 975,
    untranslatedStrings: 525
  },
  {
    code: 'pt',
    name: 'Portuguese',
    translatedPercent: 70,
    reviewedPercent: 60,
    totalStrings: 1500,
    translatedStrings: 1050,
    untranslatedStrings: 450
  },
  {
    code: 'ru',
    name: 'Russian',
    translatedPercent: 55,
    reviewedPercent: 40,
    totalStrings: 1500,
    translatedStrings: 825,
    untranslatedStrings: 675
  },
  {
    code: 'ja',
    name: 'Japanese',
    translatedPercent: 45,
    reviewedPercent: 30,
    totalStrings: 1500,
    translatedStrings: 675,
    untranslatedStrings: 825
  },
  {
    code: 'zh',
    name: 'Chinese',
    translatedPercent: 40,
    reviewedPercent: 25,
    totalStrings: 1500,
    translatedStrings: 600,
    untranslatedStrings: 900
  }
]

onMounted(() => {
  // Check if system is loaded
  if (globalThis.system?.gameSystem) {
    systemName.value = globalThis.system.gameSystem.gameSystem.name
    languages.value = sampleLanguages
  } else {
    // Redirect back to index if no system loaded
    router.push('/')
  }
})

const selectLanguage = (langCode: string) => {
  // Navigate to translation editor for selected language
  router.push(`/translate/${langCode}`)
}
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