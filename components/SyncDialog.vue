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

        <!-- Individual conflict resolution -->
        <div v-if="syncConflicts.length > 0 && syncStrategy === 'ask-user'" class="conflict-resolution">
          <h3>Resolve Conflicts</h3>
          
          <div v-if="currentConflict" class="conflict-item">
            <div class="conflict-header">
              <h4>{{ currentConflict.key }}</h4>
              <span class="conflict-count">{{ currentConflictIndex + 1 }} of {{ syncConflicts.length }}</span>
            </div>
            
            <div class="conflict-original">
              <strong>Original text:</strong>
              <div class="text-preview">{{ currentConflict.original }}</div>
            </div>
            
            <div class="conflict-choices">
              <div class="conflict-choice">
                <label class="choice-option">
                  <input 
                    type="radio" 
                    name="current-conflict"
                    value="local"
                    v-model="conflictResolutions[currentConflict.key]"
                  />
                  <span class="choice-label">Use Local Version</span>
                </label>
                <div class="choice-preview local">{{ currentConflict.local }}</div>
              </div>
              
              <div class="conflict-choice">
                <label class="choice-option">
                  <input 
                    type="radio" 
                    name="current-conflict"
                    value="server"
                    v-model="conflictResolutions[currentConflict.key]"
                  />
                  <span class="choice-label">Use Server Version</span>
                </label>
                <div class="choice-preview server">{{ currentConflict.server }}</div>
              </div>
            </div>
            
            <!-- Navigation buttons -->
            <div class="conflict-navigation">
              <button 
                @click="previousConflict" 
                class="nav-button secondary"
                :disabled="currentConflictIndex === 0"
              >
                ← Previous
              </button>
              
              <button 
                @click="nextConflict" 
                class="nav-button primary"
                :disabled="!conflictResolutions[currentConflict.key]"
                v-if="currentConflictIndex < syncConflicts.length - 1"
              >
                Next →
              </button>
              
              <button 
                @click="completeResolution" 
                class="nav-button primary"
                :disabled="!allConflictsResolved"
                v-if="currentConflictIndex === syncConflicts.length - 1"
              >
                Complete Resolution
              </button>
            </div>
          </div>
        </div>

        <div v-if="(selectedFile || canSync) && !syncSummary && !(syncConflicts.length > 0 && syncStrategy === 'ask-user')" class="sync-options">
          <p>How would you like to handle conflicts?</p>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="server-wins" />
            <span>Server wins (for conflicts)</span>
            <small>Use server version when both local and server have changes. Upload all local translations to server.</small>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="client-wins" />
            <span>Local wins (for conflicts)</span>
            <small>Keep local version when both local and server have changes. Upload all local translations to server.</small>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="syncStrategy" value="ask-user" />
            <span>Ask me for each conflict</span>
            <small>Let me choose for each conflict. Upload all local translations to server after resolving conflicts.</small>
          </label>
        </div>

        <div v-if="isSyncing" class="sync-status">
          <p>{{ selectedFile ? 'Importing translations...' : 'Syncing translations...' }}</p>
        </div>

        <div v-if="syncSummary" class="sync-summary">
          <h3>Sync Complete!</h3>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-number">{{ syncSummary.received }}</span>
              <span class="stat-label">translations received from server</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ syncSummary.uploaded }}</span>
              <span class="stat-label">translations uploaded to server</span>
            </div>
            <div class="stat-item" v-if="syncSummary.conflicts > 0">
              <span class="stat-number">{{ syncSummary.conflicts }}</span>
              <span class="stat-label">conflicts resolved</span>
            </div>
          </div>
          <div class="summary-message">
            <p v-if="syncSummary.uploaded > 0 && syncSummary.received > 0">
              ✅ Bidirectional sync completed successfully
            </p>
            <p v-else-if="syncSummary.uploaded > 0">
              ✅ Local translations uploaded to server
            </p>
            <p v-else-if="syncSummary.received > 0">
              ✅ Server translations downloaded
            </p>
            <p v-else>
              ✅ Sync completed - no changes needed
            </p>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="$emit('close')" class="dialog-button cancel">
          {{ syncSummary ? 'Close' : 'Cancel' }}
        </button>
        <button 
          v-if="!syncSummary && !isInConflictResolutionMode"
          @click="handleSync" 
          class="dialog-button primary" 
          :disabled="isSyncing || (!selectedFile && !canSync)"
        >
          {{ isSyncing ? (selectedFile ? "Importing..." : "Syncing...") : getSyncButtonText() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, computed } from 'vue'

interface Props {
  show: boolean
  syncConflicts: Array<{ key: string; original: string; local: string; server: string }>
  selectedFile: File | null
  isSyncing: boolean
  canSync: boolean
  syncSummary: { received: number; uploaded: number; conflicts: number } | null
}

interface Emits {
  (e: 'close'): void
  (e: 'file-select', file: File): void
  (e: 'sync', data: { 
    syncStrategy: 'server-wins' | 'client-wins' | 'ask-user'
    selectedFile: File | null
  }): void
  (e: 'resolve-conflicts', resolutions: Array<{ key: string; choice: 'local' | 'server'; server: string }>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement | null>(null)
const syncStrategy = ref<'server-wins' | 'client-wins' | 'ask-user'>('ask-user')
const conflictResolutions = ref<Record<string, 'local' | 'server'>>({})
const currentConflictIndex = ref(0)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('file-select', target.files[0])
  }
}

const handleSync = () => {
  // Standard sync - conflict resolution is handled separately
  emit('sync', {
    syncStrategy: syncStrategy.value,
    selectedFile: props.selectedFile
  })
}

// Computed properties
const currentConflict = computed(() => {
  if (props.syncConflicts.length === 0) return null
  return props.syncConflicts[currentConflictIndex.value] || null
})

const allConflictsResolved = computed(() => {
  return props.syncConflicts.every(conflict => conflictResolutions.value[conflict.key])
})

const isInConflictResolutionMode = computed(() => {
  return props.syncConflicts.length > 0 && syncStrategy.value === 'ask-user'
})

// Navigation methods
const nextConflict = () => {
  if (currentConflictIndex.value < props.syncConflicts.length - 1) {
    currentConflictIndex.value++
  }
}

const previousConflict = () => {
  if (currentConflictIndex.value > 0) {
    currentConflictIndex.value--
  }
}

const completeResolution = () => {
  if (!allConflictsResolved.value) {
    return
  }
  
  // All conflicts resolved, emit the resolutions
  const resolutions = props.syncConflicts.map(conflict => ({
    key: conflict.key,
    choice: conflictResolutions.value[conflict.key],
    server: conflict.server
  }))
  
  emit('resolve-conflicts', resolutions)
}

// Reset conflict resolutions when conflicts change
watch(() => props.syncConflicts, () => {
  conflictResolutions.value = {}
  currentConflictIndex.value = 0
})

const getSyncButtonText = () => {
  if (props.syncConflicts.length > 0 && syncStrategy.value === 'ask-user') {
    return 'Resolve Conflicts'
  }
  return props.selectedFile ? 'Import' : 'Sync'
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

.sync-summary {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1.5rem;
  margin: 1rem 0;
}

.sync-summary h3 {
  margin: 0 0 1rem 0;
  color: #28a745;
  font-size: 1.125rem;
  text-align: center;
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.stat-item {
  text-align: center;
  flex: 1;
  min-width: 120px;
}

.stat-number {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: #007bff;
  line-height: 1;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.summary-message {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.summary-message p {
  margin: 0;
  font-weight: 500;
  color: #28a745;
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

/* Conflict resolution styles */
.conflict-resolution {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #f8f9fa;
}

.conflict-resolution h3 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1.125rem;
}

.conflict-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.conflict-item:last-child {
  margin-bottom: 0;
}

.conflict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e9ecef;
}

.conflict-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #495057;
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
}

.conflict-count {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.conflict-original {
  margin-bottom: 1rem;
}

.conflict-original strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #495057;
  font-size: 0.875rem;
}

.text-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 3px;
  padding: 0.75rem;
  font-family: inherit;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.conflict-choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.conflict-choice {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.choice-option {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  margin: 0;
}

.choice-option:hover {
  background: #e9ecef;
}

.choice-option input[type="radio"] {
  margin-right: 0.5rem;
}

.choice-label {
  font-weight: 500;
  color: #495057;
}

.choice-preview {
  padding: 0.75rem;
  background: white;
  font-family: inherit;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  min-height: 3rem;
}

.choice-preview.local {
  border-left: 3px solid #007bff;
}

.choice-preview.server {
  border-left: 3px solid #28a745;
}

/* Navigation buttons */
.conflict-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
  gap: 1rem;
}

.nav-button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 120px;
}

.nav-button:hover:not(:disabled) {
  background: #f8f9fa;
  transform: translateY(-1px);
}

.nav-button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.nav-button.primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
  transform: translateY(-1px);
}

.nav-button.secondary {
  color: #6c757d;
}

.nav-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.nav-button:disabled:hover {
  background: white;
  transform: none;
}

.nav-button.primary:disabled:hover {
  background: #007bff;
}

@media (max-width: 768px) {
  .conflict-choices {
    grid-template-columns: 1fr;
  }
  
  .conflict-navigation {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .nav-button {
    width: 100%;
    min-width: unset;
  }
}
</style>