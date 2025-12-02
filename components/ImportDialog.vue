<template>
  <div v-if="show" class="dialog-overlay" @click.self="handleOverlayClick">
    <div class="dialog">
      <div class="dialog-header">
        <h2>Import Translations</h2>
        <button @click="handleClose" class="close-button" :disabled="isImporting">&times;</button>
      </div>

      <div class="dialog-content">
        <!-- Show summary if import completed -->
        <div v-if="importSummary && !isImporting" class="summary-section">
          <h3>{{ importSummary.cancelled ? 'Import Stopped' : 'Import Complete' }}</h3>
          <div v-if="importSummary.cancelled" class="cancelled-message">
            Import was stopped. The translations that were processed have been saved.
          </div>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">{{ importSummary.matched }}</span>
              <span class="stat-label">Matched translations</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ importSummary.imported }}</span>
              <span class="stat-label">New translations imported</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ importSummary.skipped }}</span>
              <span class="stat-label">Skipped (already translated)</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ importSummary.notFound }}</span>
              <span class="stat-label">Not found in source</span>
            </div>
          </div>
          <button @click="handleClose" class="btn-primary">Close</button>
        </div>

        <!-- Progress display during import -->
        <div v-else-if="isImporting" class="progress-section">
          <h3>Importing...</h3>

          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
            </div>
            <span class="progress-percentage">{{ Math.round(importProgress) }}%</span>
          </div>

          <div class="progress-message">{{ progressMessage }}</div>

          <div class="live-stats">
            <div class="live-stat-item">
              <span class="live-stat-label">Matched:</span>
              <span class="live-stat-value">{{ liveStats.matched }}</span>
            </div>
            <div class="live-stat-item">
              <span class="live-stat-label">Imported:</span>
              <span class="live-stat-value">{{ liveStats.imported }}</span>
            </div>
            <div class="live-stat-item">
              <span class="live-stat-label">Skipped:</span>
              <span class="live-stat-value">{{ liveStats.skipped }}</span>
            </div>
            <div class="live-stat-item">
              <span class="live-stat-label">Not found:</span>
              <span class="live-stat-value">{{ liveStats.notFound }}</span>
            </div>
          </div>

          <button @click="handleCancel" class="btn-warning">
            Stop & Save Progress
          </button>
        </div>

        <!-- File selection -->
        <div v-else class="file-section">
          <p>Select a JSON file to import translations. The file should contain a simple key-value object:</p>
          <pre class="example-format">{
  "Unit Name": "Nom de l'unité",
  "Another String": "Une autre chaîne"
}</pre>

          <div class="file-input-wrapper">
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileSelect"
              class="file-input"
            />
            <button @click="$refs.fileInput?.click()" class="btn-secondary">
              Choose File
            </button>
            <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
          </div>

          <div class="dialog-actions">
            <button @click="handleClose" class="btn-secondary">Cancel</button>
            <button
              @click="handleImport"
              :disabled="!selectedFile"
              class="btn-primary"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue'

interface Props {
  show: boolean
  isImporting: boolean
  importSummary: { matched: number; imported: number; skipped: number; notFound: number; cancelled?: boolean } | null
  importProgress?: number
  progressMessage?: string
  liveStats?: { matched: number; imported: number; skipped: number; notFound: number }
}

interface Emits {
  (e: 'close'): void
  (e: 'import', file: File): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  importProgress: 0,
  progressMessage: 'Preparing...',
  liveStats: () => ({ matched: 0, imported: 0, skipped: 0, notFound: 0 })
})

const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const handleImport = () => {
  if (selectedFile.value) {
    emit('import', selectedFile.value)
  }
}

const handleCancel = () => {
  emit('cancel')
}

const handleClose = () => {
  if (!props.isImporting) {
    emit('close')
  }
}

const handleOverlayClick = () => {
  if (!props.isImporting) {
    emit('close')
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-button:hover {
  color: #000;
}

.dialog-content {
  padding: 1.5rem;
}

.file-section p {
  margin-bottom: 1rem;
  color: #666;
}

.example-format {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

.file-input-wrapper {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-input {
  display: none;
}

.file-name {
  color: #666;
  font-size: 0.875rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.summary-section {
  text-align: center;
}

.summary-section h3 {
  margin-bottom: 1.5rem;
  color: #4caf50;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-item {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #666;
}

.btn-primary,
.btn-secondary {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-warning {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  background: #ff9800;
  color: white;
}

.btn-warning:hover {
  background: #e68900;
}

.progress-section {
  text-align: center;
  padding: 1rem 0;
}

.progress-section h3 {
  margin-bottom: 1.5rem;
}

.progress-bar-container {
  position: relative;
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 30px;
  background: #f0f0f0;
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50 0%, #45a049 100%);
  transition: width 0.3s ease;
  position: relative;
}

.progress-percentage {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.progress-message {
  margin: 1rem 0;
  color: #666;
  font-size: 0.875rem;
  min-height: 20px;
}

.live-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f8f8f8;
  border-radius: 8px;
}

.live-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
}

.live-stat-label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
}

.live-stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.cancelled-message {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  text-align: left;
}
</style>
