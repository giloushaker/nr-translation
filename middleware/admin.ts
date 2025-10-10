export default defineNuxtRouteMiddleware((to, from) => {
  if (process.server) return;

  const authStore = useAuthStore();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo("/");
  }

  // Check if user has admin permission (100)
  if (!authStore.isAdmin) {
    console.error("❌ Access denied: Admin permission required");
    alert("Access denied: Admin permission (100) required");
    return navigateTo("/systems");
  }
});
