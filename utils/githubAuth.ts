// GitHub auth configuration
const GITHUB_REPO_OWNER = 'NewRecruitEU';
const GITHUB_REPO_NAME = 'translations';

// Token storage
const TOKEN_KEY = 'github_access_token';
const TOKEN_EXPIRY_KEY = 'github_token_expiry';

export class GithubAuth {
  static getStoredToken(): string | null {
    // Check if token exists and is not expired
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    if (!token || !expiry) return null;
    
    if (new Date().getTime() > parseInt(expiry)) {
      // Token expired, clear it
      this.clearToken();
      return null;
    }
    
    return token;
  }

  static storeToken(token: string, expiresIn?: number) {
    localStorage.setItem(TOKEN_KEY, token);
    
    // Set expiry (default 60 days if not specified)
    const expiryTime = new Date().getTime() + (expiresIn || 60 * 24 * 60 * 60) * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  static clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  static async login(): Promise<string> {
    // Check if we already have a valid token
    const existingToken = this.getStoredToken();
    if (existingToken) return existingToken;

    // Since we can't use OAuth without a server, prompt for a Personal Access Token
    const token = await this.promptForToken();
    
    if (token) {
      // Validate the token has the right permissions
      const isValid = await this.validateTokenPermissions(token);
      if (!isValid) {
        throw new Error('Token does not have required permissions. Please create a token with "public_repo" scope.');
      }
      
      this.storeToken(token);
      return token;
    }
    
    throw new Error('No token provided');
  }

  static async promptForToken(): Promise<string | null> {
    // Create a modal or use browser prompt
    const message = `Please enter a GitHub Personal Access Token with "public_repo" scope.

To create one:
1. Go to https://github.com/settings/tokens/new
2. Give it a name (e.g., "NR Translation Tool")
3. Select the "public_repo" scope
4. Click "Generate token"
5. Copy and paste it here

Note: The token will be stored locally in your browser.`;
    
    const token = window.prompt(message);
    return token ? token.trim() : null;
  }

  static async validateTokenPermissions(token: string): Promise<boolean> {
    try {
      // Check if token can access the specific repo
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) return false;
      
      // Check if we have push access (required for creating branches/PRs)
      const repo = await response.json();
      return repo.permissions?.push || false;
    } catch {
      return false;
    }
  }

  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export a function to check if user is authenticated
export function isGithubAuthenticated(): boolean {
  return !!GithubAuth.getStoredToken();
}

// Export a function to get current token or prompt for login
export async function getGithubToken(): Promise<string> {
  const token = GithubAuth.getStoredToken();
  if (token) return token;
  
  // Prompt user to login
  return await GithubAuth.login();
}

// Helper to show instructions for creating a token
export function getTokenInstructions(): string {
  return `
To contribute translations, you'll need a GitHub Personal Access Token:

1. Go to: https://github.com/settings/tokens/new
2. Token name: "NR Translation Tool" 
3. Expiration: Choose your preference
4. Select scope: "public_repo" (required for creating pull requests)
5. Click "Generate token"
6. Copy the token and paste it when prompted

Your token is stored locally and never sent to any server except GitHub.
  `;
}