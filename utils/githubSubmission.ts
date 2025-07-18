// Alternative submission methods for serverless architecture

export interface SubmissionMethod {
  type: 'github-issue' | 'download' | 'copy';
  data: any;
}

export class GithubSubmission {
  private static readonly REPO_OWNER = 'NewRecruitEU';
  private static readonly REPO_NAME = 'translations';

  /**
   * Create a GitHub issue with the translations (no auth needed)
   */
  static createIssueUrl(systemId: string, languageCode: string, translations: any[]): string {
    const title = `Translation update: ${systemId} - ${languageCode}`;
    
    // Format translations for issue body
    const translationData = {
      system: systemId,
      language: languageCode,
      timestamp: new Date().toISOString(),
      translations: translations.map(t => ({
        key: t.key,
        original: t.original,
        translation: t.translation,
        catalogue: t.catalogue
      }))
    };

    const body = `## Translation Submission

**System:** ${systemId}
**Language:** ${languageCode}
**Translated:** ${translations.filter(t => t.translated).length}/${translations.length}

### Translation Data
\`\`\`json
${JSON.stringify(translationData, null, 2)}
\`\`\`

---
*This issue was created by the translation tool. A maintainer will review and create a PR.*`;

    // Create GitHub issue URL with pre-filled content
    const params = new URLSearchParams({
      title,
      body,
      labels: 'translation-update,automated'
    });

    return `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/issues/new?${params}`;
  }

  /**
   * Generate a file for users to manually create a PR
   */
  static generatePRInstructions(systemId: string, languageCode: string, fileContent: string): string {
    return `# How to submit your translations

1. **Fork the repository:**
   https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/fork

2. **Create/update this file in your fork:**
   Path: \`${systemId}/${languageCode}/translations.json\`

3. **Paste this content:**
\`\`\`json
${fileContent}
\`\`\`

4. **Create a Pull Request:**
   - Go to: https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/pulls
   - Click "New pull request"
   - Click "compare across forks"
   - Select your fork
   - Create the PR with title: "Update ${languageCode} translations for ${systemId}"

Your translations will be reviewed and merged by a maintainer.`;
  }

  /**
   * Create a direct edit URL that will create a PR (users need to be logged in to GitHub)
   */
  static createDirectEditUrl(systemId: string, languageCode: string, fileContent: string): string {
    const path = `${systemId}/${languageCode}/translations.json`;
    const message = `Update ${languageCode} translations for ${systemId}`;
    const description = `Updated translation file with new/modified translations.\n\nThis PR was created using the NR Translation Tool.`;
    
    // GitHub will automatically fork the repo and create a PR if the user doesn't have write access
    const params = new URLSearchParams({
      filename: path,
      value: fileContent,
      message: message,
      description: description,
      target_branch: 'main'
    });
    
    return `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/new/main?${params}`;
  }

  /**
   * Create a URL to edit an existing file (will create PR if no write access)
   * Note: GitHub's edit URL doesn't support pre-filling content, so we use the same new file approach
   */
  static createEditFileUrl(systemId: string, languageCode: string, fileContent: string): string {
    // GitHub doesn't allow pre-filling content when editing existing files via URL
    // So we'll use the same approach as creating new files - this will show a diff
    return this.createDirectEditUrl(systemId, languageCode, fileContent);
  }
}