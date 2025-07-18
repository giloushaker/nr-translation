<template>
  <div class="oauth-callback">
    <div v-if="loading" class="loading">
      <h2>Authenticating with GitHub...</h2>
      <p>Please wait while we complete the login process.</p>
    </div>
    <div v-else-if="error" class="error">
      <h2>Authentication Failed</h2>
      <p>{{ error }}</p>
      <button @click="closeWindow">Close Window</button>
    </div>
    <div v-else class="success">
      <h2>Authentication Successful!</h2>
      <p>You can now close this window.</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: true,
      error: null
    }
  },
  
  async mounted() {
    try {
      // Get the authorization code from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (!code) {
        throw new Error('No authorization code received');
      }
      
      // Verify state to prevent CSRF attacks
      const savedState = sessionStorage.getItem('github_oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter');
      }
      
      // Exchange code for token
      // Note: This should be done through your backend to keep the client secret secure
      // For now, we'll send a message back to the parent window with the code
      // and let the parent handle the token exchange through a backend API
      
      // Send success message to parent window
      if (window.opener) {
        // In a real implementation, you would exchange the code for a token here
        // through your backend API, then send the token to the parent
        window.opener.postMessage({
          type: 'github-oauth-success',
          code: code // In production, send the actual token here
        }, window.location.origin);
        
        // Close window after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      }
      
      this.loading = false;
    } catch (error) {
      this.error = error.message;
      this.loading = false;
      
      // Send error message to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'github-oauth-error',
          error: error.message
        }, window.location.origin);
      }
    }
  },
  
  methods: {
    closeWindow() {
      window.close();
    }
  }
}
</script>

<style scoped>
.oauth-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
}

.loading, .error, .success {
  max-width: 400px;
}

.error {
  color: #dc3545;
}

.success {
  color: #28a745;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #0366d6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0256c7;
}
</style>