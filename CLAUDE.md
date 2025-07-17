The purpose of this project is for the community to translate open-source tabletop wargames files to various languages

## Expected user workflow:

Open the tool

- Select the system or import it
- View the translation status for each language
- Select their preferred language
- View the strings that need to be translated, with various ways to filter

User should quickly be able to get back to their work, with urls that get them to were they were

## Development Guidelines

Prefer using vue options api
Translation raw text display and translation input should support new lines

### Stores (Pinia)

- `stores/loadingStore.ts` - Centralized loading state management with progress tracking
- `stores/systemStore.ts` - Game system loading and management (GitHub repos, local systems)
- `stores/promptStore.ts` - User prompt/dialog state persistence
- `stores/translationStore.ts` - Translation management with IndexedDB storage and backend sync

### Components

- `components/LoadingOverlay.vue` - Reusable loading component with progress bar
- Use the loading store and overlay component instead of duplicating loading UI

### System Loading

Game systems can be loaded from:

- GitHub repositories (format: "owner/repo")
- Local storage (imported systems)

### Key Design Principles

- **Stable Keys**: Use `key` (text) for storage/sync, `id` only for UI operations
- **Incremental Operations**: Save/load individual translations, not bulk objects
- **Performance**: Map-based lookups for fast translation matching

## Code Quality Guidelines

### Refactoring Priorities

Always refactor when you see these patterns:

1. **Duplicate code** - Extract to shared functions, stores, or components
2. **Repeated loading logic** - Use the existing loading/system stores
3. **Duplicate UI patterns** - Create reusable components
4. **Hard-coded values** - Move to configuration or constants
5. **Large functions** - Break into smaller, focused functions

### Best Practices

- Use Pinia stores for shared state management
- Create reusable components for common UI patterns
- Centralize loading states and progress tracking
- Keep components focused and single-purpose
- Extract business logic from components into stores or utilities
