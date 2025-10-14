<template>
  <div class="container">
    <div class="page-header">
      <h1>User Permissions Management</h1>
      <div class="page-actions">
        <button @click="goHome" class="btn">← Back to Systems</button>
      </div>
    </div>

    <div class="search-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search users by login (min 2 characters)..."
        class="form-input"
        @input="debounceSearch"
      />
      <div v-if="users.length > 0" class="search-info">Found {{ users.length }} user(s)</div>
      <div v-if="!loading && searchQuery.length > 0 && searchQuery.length < 2" class="text-muted">
        Please enter at least 2 characters
      </div>
    </div>

    <div v-if="loading" class="text-center text-muted" style="padding: 2rem">Searching...</div>
    <div v-if="error" class="alert-error">{{ error }}</div>

    <div v-if="!loading && users.length > 0" class="users-list">
      <div v-for="user in users" :key="user._id" class="card">
        <div class="card-header">
          <h2>
            {{ user.login }}
            <span v-if="user.permission === 100" class="badge-warning">Admin</span>
          </h2>
          <button v-if="editingUser !== user._id" @click="startEditing(user)" class="btn"> Edit Permissions </button>
          <div v-else class="edit-actions">
            <button @click="savePermissions(user)" class="btn-success">Save</button>
            <button @click="cancelEditing" class="btn-secondary">Cancel</button>
          </div>
        </div>

        <div class="permissions-section">
          <h3>System Permissions:</h3>

          <!-- Display mode -->
          <div v-if="editingUser !== user._id" class="permissions-display">
            <div v-if="user.translation_auth.length === 0" class="text-muted"> No permissions assigned </div>
            <div v-for="perm in user.translation_auth" :key="perm.systemId" class="permission-item">
              <strong>{{ perm.systemId }}</strong>
              <span class="languages-list">
                Languages: {{ perm.languages.includes("*") ? "All (*)" : perm.languages.join(", ") }}
              </span>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="permissions-edit">
            <div v-for="(perm, index) in editingPermissions" :key="index" class="edit-permission-item">
              <div class="form-group">
                <label class="form-label">System:</label>
                <select v-model="perm.systemId" class="form-select">
                  <option value="">Select system...</option>
                  <option value="newrecruit">NewRecruit</option>
                  <option value="BSData/wh40k-10e">Warhammer 40k 10th Edition</option>
                  <option value="BSData/wh40k-9e">Warhammer 40k 9th Edition</option>
                  <option value="BSData/age-of-sigmar-4th">Age of Sigmar 4.0</option>
                  <option value="BSData/wh40k-killteam">Kill Team (2024)</option>
                  <option value="BSData/horus-heresy-2nd-edition">Horus Heresy (2022)</option>
                  <option value="Fawkstrot11/TrenchCrusade">Trench Crusade</option>
                  <option value="vflam/Warhammer-The-Old-World">The Old World</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Languages (comma-separated, or * for all):</label>
                <input v-model="perm.languagesInput" type="text" class="form-input" placeholder="fr, es, de or *" />
              </div>

              <button @click="removePermission(index)" class="btn-danger btn-sm">Remove</button>
            </div>

            <button @click="addPermission" class="btn-primary">Add System Permission</button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!loading && searchQuery.length >= 2 && users.length === 0"
      class="text-center text-muted"
      style="padding: 2rem"
    >
      No users found matching "{{ searchQuery }}"
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore, type SystemPermission } from "~/stores/authStore";

definePageMeta({
  middleware: ["auth", "admin"],
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
const error = ref("");
const editingUser = ref<string | null>(null);
const editingPermissions = ref<EditablePermission[]>([]);
const searchQuery = ref("");

let searchTimeout: NodeJS.Timeout | null = null;

// Check if current user is admin
onMounted(async () => {
  if (!authStore.isAdmin) {
    alert("Admin access required");
    router.push("/systems");
    return;
  }
  // Don't load users on mount, wait for search
});

const loadUsers = async () => {
  if (searchQuery.value.length < 2) {
    users.value = [];
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const config = useRuntimeConfig();
    const baseURL = config.public.apiUrl || "";
    const token = authStore.getToken;

    console.log(`🔍 Searching users with query: "${searchQuery.value}"`);

    const response = await $fetch<{ success: boolean; users: User[]; message?: string }>(
      `${baseURL}/api/admin/users?search=${encodeURIComponent(searchQuery.value)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("📦 Response received:", response);

    if (response.success) {
      users.value = response.users;
      console.log("✅ Found", users.value.length, "users");
    } else {
      error.value = response.message || "API returned success=false";
    }
  } catch (err: any) {
    console.error("❌ Failed to search users:", err);
    console.error("❌ Error data:", err.data);
    error.value = err.data?.statusMessage || err.message || "Failed to search users";
  } finally {
    loading.value = false;
  }
};

const debounceSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    loadUsers();
  }, 500);
};

const startEditing = (user: User) => {
  editingUser.value = user._id;
  editingPermissions.value = user.translation_auth.map((perm) => ({
    systemId: perm.systemId,
    languages: perm.languages,
    languagesInput: perm.languages.join(", "),
  }));
};

const cancelEditing = () => {
  editingUser.value = null;
  editingPermissions.value = [];
};

const addPermission = () => {
  editingPermissions.value.push({
    systemId: "",
    languages: [],
    languagesInput: "*",
  });
};

const removePermission = (index: number) => {
  editingPermissions.value.splice(index, 1);
};

const savePermissions = async (user: User) => {
  try {
    // Convert languagesInput strings to arrays
    const translation_auth: SystemPermission[] = editingPermissions.value
      .filter((perm) => perm.systemId) // Only include permissions with a system selected
      .map((perm) => ({
        systemId: perm.systemId,
        languages: perm.languagesInput
          .split(",")
          .map((lang) => lang.trim())
          .filter((lang) => lang.length > 0),
      }));

    const config = useRuntimeConfig();
    const baseURL = config.public.apiUrl || "";

    await $fetch(`${baseURL}/api/admin/users`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authStore.getToken}`,
        "Content-Type": "application/json",
      },
      body: {
        userId: user._id,
        translation_auth,
      },
    });

    alert("Permissions updated successfully!");
    editingUser.value = null;
    editingPermissions.value = [];
    await loadUsers(); // Reload automatically after save
  } catch (err: any) {
    alert(`Failed to save permissions: ${err.message}`);
    console.error("Failed to save permissions:", err);
  }
};

const goHome = () => {
  router.push("/systems");
};
</script>

<style scoped>
.search-section {
  margin-bottom: 2rem;
}

.search-section .form-input {
  width: 100%;
  margin-bottom: 0.5rem;
}

.search-info {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.5rem;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
</style>
