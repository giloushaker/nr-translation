<template>
  <div class="login-container">
    <HelpUs />
    <div class="login-card card">
      <h1>Login</h1>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="login" class="form-label">Username</label>
          <input
            id="login"
            v-model="loginForm.login"
            type="text"
            required
            placeholder="Enter your username"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            v-model="loginForm.password"
            type="password"
            required
            placeholder="Enter your password"
            class="form-input"
          />
        </div>

        <div v-if="errorMessage" class="alert-error">
          {{ errorMessage }}
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          {{ isLoading ? "Please wait..." : "Login" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "~/stores/authStore";

const router = useRouter();
const authStore = useAuthStore();

const isLoading = ref(false);
const errorMessage = ref("");

const loginForm = ref({
  login: "",
  password: "",
});

const handleSubmit = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const success = await authStore.login(loginForm.value.login, loginForm.value.password);

    if (success) {
      // Redirect to systems page
      router.push("/systems");
    } else {
      errorMessage.value = "Invalid credentials";
    }
  } catch (error: any) {
    errorMessage.value = error.message || "An error occurred";
  } finally {
    isLoading.value = false;
  }
};

// Redirect if already logged in
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push("/systems");
  }
});
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  flex-direction: column;
}

.login-card {
  max-width: 400px;
  width: 100%;
  padding: 2.5rem;
}

h1 {
  margin: 0 0 2rem 0;
  text-align: center;
}

.form-group input {
  width: 100%;
}

.btn-primary {
  width: 100%;
}
</style>
