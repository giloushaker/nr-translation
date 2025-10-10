<template>
  <div class="login-container">
    <div class="login-card">
      <h1>{{ isRegistering ? "Register" : "Login" }}</h1>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="login">Username</label>
          <input
            id="login"
            v-model="loginForm.login"
            type="text"
            required
            placeholder="Enter your username"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="loginForm.password"
            type="password"
            required
            placeholder="Enter your password"
            :minlength="isRegistering ? 6 : undefined"
          />
        </div>

        <div v-if="isRegistering" class="form-group">
          <label for="systems">Game Systems (optional)</label>
          <input
            id="systems"
            v-model="systemsInput"
            type="text"
            placeholder="e.g., BSData/wh40k, BSData/aos"
          />
          <small>Comma-separated list of systems you can translate</small>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          {{ isLoading ? "Please wait..." : (isRegistering ? "Register" : "Login") }}
        </button>
      </form>

      <div class="toggle-mode">
        <button @click="toggleMode" class="btn-link">
          {{ isRegistering ? "Already have an account? Login" : "Don't have an account? Register" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "~/stores/authStore";

const router = useRouter();
const authStore = useAuthStore();

const isRegistering = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");

const loginForm = ref({
  login: "",
  password: "",
});

const systemsInput = ref("");

const toggleMode = () => {
  isRegistering.value = !isRegistering.value;
  errorMessage.value = "";
};

const handleSubmit = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    let success = false;

    if (isRegistering.value) {
      // Parse systems from comma-separated input
      const translation_auth = systemsInput.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      success = await authStore.register(loginForm.value.login, loginForm.value.password, translation_auth);
    } else {
      success = await authStore.login(loginForm.value.login, loginForm.value.password);
    }

    if (success) {
      // Redirect to home page
      router.push("/");
    } else {
      errorMessage.value = isRegistering.value ? "Registration failed" : "Invalid credentials";
    }
  } catch (error: any) {
    errorMessage.value = error.message || "An error occurred";
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  border-radius: 10px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

h1 {
  margin-bottom: 30px;
  color: #333;
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

small {
  display: block;
  margin-top: 5px;
  color: #888;
  font-size: 12px;
}

.error-message {
  padding: 10px;
  margin-bottom: 20px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  font-size: 14px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-mode {
  margin-top: 20px;
  text-align: center;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.btn-link:hover {
  color: #5568d3;
}
</style>
