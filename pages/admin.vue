<template>
  <div class="admin-container">
    <div class="header">
      <h1>User Permissions Management</h1>
      <div class="header-actions">
        <button @click="goHome" class="back-btn">← Back to Systems</button>
        <button @click="refreshUsers" class="refresh-btn">🔄 Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading users...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="!loading && users.length > 0" class="users-list">
      <div v-for="user in users" :key="user._id" class="user-card">
        <div class="user-header">
          <h2>
            {{ user.login }}
            <span v-if="user.permission === 100" class="admin-badge">Admin</span>
          </h2>
          <button v-if="editingUser !== user._id" @click="startEditing(user)" class="edit-btn">
            ✏️ Edit Permissions
          </button>
          <div v-else class="edit-actions">
            <button @click="savePermissions(user)" class="save-btn">💾 Save</button>
            <button @click="cancelEditing" class="cancel-btn">❌ Cancel</button>
          </div>
        </div>

        <div class="permissions-section">
          <h3>System Permissions:</h3>

          <!-- Display mode -->
          <div v-if="editingUser !== user._id" class="permissions-display">
            <div v-if="user.translation_auth.length === 0" class="no-permissions">
              No permissions assigned
            </div>
            <div v-for="perm in user.translation_auth" :key="perm.systemId" class="permission-item">
              <strong>{{ perm.systemId }}</strong>
              <span class="languages-list">
                Languages: {{ perm.languages.includes('*') ? 'All (*)' : perm.languages.join(', ') }}
              </span>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="permissions-edit">
            <div v-for="(perm, index) in editingPermissions" :key="index" class="edit-permission-item">
              <div class="system-select">
                <label>System:</label>
                <select v-model="perm.systemId">
                  <option value="">Select system...</option>
                  <option value="newrecruit">NewRecruit</option>
                  <option value="BSData/wh40k-10e">Warhammer 40k 10th Edition</option>
                  <option value="BSData/wh40k-9e">Warhammer 40k 9th Edition</option>
                  <option value="BSData/age-of-sigmar-4th">Age of Sigmar 4.0</option>
                  <option value="BSData/wh40k-killteam">Kill Team (2024)</option>
                  <option value="BSData/horus-heresy-2nd-edition">Horus Heresy (2022)</option>
                  <option value="Fawkstrot11/TrenchCrusade">Trench Crusade</option>
                </select>
              </div>

              <div class="languages-select">
                <label>Languages (comma-separated, or * for all):</label>
                <input
                  v-model="perm.languagesInput"
                  type="text"
                  placeholder="fr, es, de or *"
                />
              </div>

              <button @click="removePermission(index)" class="remove-perm-btn">🗑️ Remove</button>
            </div>

            <button @click="addPermission" class="add-perm-btn">➕ Add System Permission</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && users.length === 0" class="no-users">
      No users found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore, type SystemPermission } from '~/stores/authStore';

definePageMeta({
  middleware: ['auth', 'admin'],
});

interface User {
  _id: string;
  login: string;
  translation_auth: SystemPermission[];
  permission: number;
  createdAt: Date;
}

interface EditablePermission extends SystemPermission {
  languagesInput: string;
}

const router = useRouter();
const authStore = useAuthStore();

const users = ref<User[]>([]);
const loading = ref(false);
const error = ref('');
const editingUser = ref<string | null>(null);
const editingPermissions = ref<EditablePermission[]>([]);

// Check if current user is admin
onMounted(async () => {
  if (!authStore.isAdmin) {
    alert('Admin access required');
    router.push('/systems');
    return;
  }
  await loadUsers();
});

const loadUsers = async () => {
  loading.value = true;
  error.value = '';

  try {
    const config = useRuntimeConfig();
    const baseURL = config.public.apiUrl || 'http://localhost:3005';

    const response = await $fetch<{ success: boolean; users: User[] }>(
      `${baseURL}/api/admin/users`,
      {
        headers: {
          Authorization: `Bearer ${authStore.getToken}`,
        },
      }
    );

    if (response.success) {
      users.value = response.users;
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load users';
    console.error('Failed to load users:', err);
  } finally {
    loading.value = false;
  }
};

const startEditing = (user: User) => {
  editingUser.value = user._id;
  editingPermissions.value = user.translation_auth.map(perm => ({
    systemId: perm.systemId,
    languages: perm.languages,
    languagesInput: perm.languages.join(', '),
  }));
};

const cancelEditing = () => {
  editingUser.value = null;
  editingPermissions.value = [];
};

const addPermission = () => {
  editingPermissions.value.push({
    systemId: '',
    languages: [],
    languagesInput: '*',
  });
};

const removePermission = (index: number) => {
  editingPermissions.value.splice(index, 1);
};

const savePermissions = async (user: User) => {
  try {
    // Convert languagesInput strings to arrays
    const translation_auth: SystemPermission[] = editingPermissions.value
      .filter(perm => perm.systemId) // Only include permissions with a system selected
      .map(perm => ({
        systemId: perm.systemId,
        languages: perm.languagesInput
          .split(',')
          .map(lang => lang.trim())
          .filter(lang => lang.length > 0),
      }));

    const config = useRuntimeConfig();
    const baseURL = config.public.apiUrl || 'http://localhost:3005';

    await $fetch(`${baseURL}/api/admin/users`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.getToken}`,
        'Content-Type': 'application/json',
      },
      body: {
        userId: user._id,
        translation_auth,
      },
    });

    alert('Permissions updated successfully!');
    editingUser.value = null;
    editingPermissions.value = [];
    await loadUsers();
  } catch (err: any) {
    alert(`Failed to save permissions: ${err.message}`);
    console.error('Failed to save permissions:', err);
  }
};

const refreshUsers = () => {
  loadUsers();
};

const goHome = () => {
  router.push('/systems');
};
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.back-btn,
.refresh-btn {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.back-btn:hover,
.refresh-btn:hover {
  background: #fff;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.loading,
.error,
.no-users {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #dc3545;
  background: #f8d7da;
  border-radius: 4px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.user-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.user-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-badge {
  background: #ffc107;
  color: #000;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.edit-btn,
.save-btn,
.cancel-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.edit-btn {
  background: #fff;
  color: #333;
}

.edit-btn:hover {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.save-btn {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.save-btn:hover {
  background: #218838;
}

.cancel-btn {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.cancel-btn:hover {
  background: #5a6268;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.permissions-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1rem;
  color: #666;
}

.permissions-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-permissions {
  color: #999;
  font-style: italic;
}

.permission-item {
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.permission-item strong {
  color: #333;
}

.languages-list {
  font-size: 0.875rem;
  color: #666;
}

.permissions-edit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.edit-permission-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
}

.system-select,
.languages-select {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.system-select label,
.languages-select label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
}

.system-select select,
.languages-select input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.remove-perm-btn {
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
}

.remove-perm-btn:hover {
  background: #c82333;
}

.add-perm-btn {
  padding: 0.75rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.add-perm-btn:hover {
  background: #0056b3;
}

h1 {
  margin: 0;
}
</style>
