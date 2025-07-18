<template>
  <div v-if="show" class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>Sync Translations</h2>
        <button @click="$emit('close')" class="dialog-close">×</button>
      </div>
      <div class="dialog-content">
        <div v-if="!canSync">
          <p><strong>No backend configured</strong></p>
          <p>Select a translation file to import:</p>
          <div class="file-input-section">
            <input 
              type="file" 
              ref="fileInput"
              @change="handleFileSelect"
              accept=".json,.po,.csv"
              class="file-input"
            />
            <p class="file-help">Supported formats: JSON, PO (gettext), CSV</p>
            <div v-if="selectedFile" class="selected-file">
              Selected: {{ selectedFile.name }}
            </div>
          </div>
        </div>
        
        <div v-else>
          <p>Backend configured and ready for sync</p>
        </div>

        <div v-if="syncConflicts.length > 0" class="conflict-info">
          <p><strong>{{ syncConflicts.length }} conflicts detected</strong></p>
          <p>Some translations have been modified both locally and on the server.</p>
        </div>

        <div v-if="selectedFile || canSync" class="sync-options">
          <p>How would you like to handle conflicts?</p>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="server-wins" />
            <span>Import wins</span>
            <small>Overwrite local changes with imported versions</small>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="client-wins" />
            <span>Keep local changes</span>
            <small>Keep your local translations, ignore imported changes</small>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="ask-user" />
            <span>Ask me for each conflict</span>
            <small>Show me each conflict and let me choose</small>
          </label>
        </div>

        <div v-if="isSyncing" class="sync-status">
          <p>{{ selectedFile ? 'Importing translations...' : 'Syncing translations...' }}</p>
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="$emit('close')" class="dialog-button cancel">Cancel</button>
        <button 
          @click="handleSync" 
          class="dialog-button primary" 
          :disabled="isSyncing || (!selectedFile && !canSync)"
        >
          {{ isSyncing ? (selectedFile ? "Importing..." : "Syncing...") : (selectedFile ? "Import" : "Sync") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue'

interface Props {
  show: boolean
  syncConflicts: Array<{ key: string; original: string; local: string; server: string }>
  selectedFile: File | null
  isSyncing: boolean
  canSync: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'file-select', file: File): void
  (e: 'sync', data: { 
    syncStrategy: 'server-wins' | 'client-wins' | 'ask-user'
    selectedFile: File | null
  }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement | null>(null)
const syncStrategy = ref<'server-wins' | 'client-wins' | 'ask-user'>('ask-user')

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('file-select', target.files[0])
  }
}

const handleSync = () => {
  emit('sync', {
    syncStrategy: syncStrategy.value,
    selectedFile: props.selectedFile
  })
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
  min-width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-close:hover {
  color: #495057;
}

.dialog-content {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.file-input-section {
  margin: 1rem 0;
  padding: 1rem;
  border: 2px dashed #dee2e6;
  border-radius: 4px;
  text-align: center;
}

.file-input {
  margin: 0.5rem 0;
  padding: 0.5rem;
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.file-help {
  font-size: 0.875rem;
  color: #6c757d;
  margin: 0.5rem 0;
}

.selected-file {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  font-weight: 500;
  color: #0056b3;
}

.conflict-info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.conflict-info p {
  margin: 0.5rem 0;
}

.sync-options {
  margin: 1rem 0;
}

.sync-options p {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.radio-option {
  display: block;
  margin-bottom: 0.75rem;
  cursor: pointer;
}

.radio-option input[type="radio"] {
  margin-right: 0.5rem;
}

.radio-option span {
  font-weight: 500;
  margin-right: 0.5rem;
}

.radio-option small {
  display: block;
  margin-left: 1.5rem;
  color: #6c757d;
  font-size: 0.8rem;
}

.sync-status {
  text-align: center;
  padding: 1rem;
  color: #17a2b8;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.dialog-button {
  padding: 0.5rem 1.25rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.dialog-button:hover {
  background: #f8f9fa;
}

.dialog-button.cancel {
  color: #6c757d;
}

.dialog-button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.dialog-button.primary:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.dialog-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>