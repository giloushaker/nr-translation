# Design System - Guide d'utilisation

Ce document décrit les classes CSS réutilisables disponibles dans `assets/styles/main.scss`.

## 🎨 Couleurs

### Variables disponibles
- `$primary-color`: #007bff (bleu principal)
- `$success-color`: #28a745 (vert succès)
- `$danger-color`: #dc3545 (rouge erreur)
- `$warning-color`: #ffc107 (jaune warning)

## 🔘 Boutons

### Classes de base

```html
<!-- Bouton standard -->
<button class="btn">Button</button>

<!-- Bouton primaire -->
<button class="btn-primary">Primary</button>

<!-- Bouton secondaire -->
<button class="btn-secondary">Secondary</button>

<!-- Bouton succès -->
<button class="btn-success">Success</button>

<!-- Bouton danger -->
<button class="btn-danger">Danger</button>

<!-- Bouton lien -->
<button class="btn-link">Link</button>
```

### Tailles

```html
<!-- Petit bouton -->
<button class="btn-primary btn-sm">Small</button>

<!-- Bouton normal -->
<button class="btn-primary">Normal</button>

<!-- Grand bouton -->
<button class="btn-primary btn-lg">Large</button>
```

## 📦 Cards

```html
<!-- Card simple -->
<div class="card">
  <h3>Title</h3>
  <p>Content</p>
</div>

<!-- Card interactive (hover effects) -->
<div class="card-interactive">
  <h3>Clickable card</h3>
</div>

<!-- Card avec header -->
<div class="card">
  <div class="card-header">
    <h3>Title</h3>
    <button class="btn">Action</button>
  </div>
  <p>Content</p>
</div>
```

## 📝 Formulaires

```html
<div class="form-group">
  <label class="form-label">Username</label>
  <input type="text" class="form-input" placeholder="Enter username" />
  <small class="form-help">Texte d'aide</small>
</div>

<div class="form-group">
  <label class="form-label">Country</label>
  <select class="form-select">
    <option>France</option>
    <option>Spain</option>
  </select>
</div>
```

## 📦 Containers & Layout

```html
<!-- Container standard (max-width: 1200px) -->
<div class="container">
  <h1>Page content</h1>
</div>

<!-- Container small (max-width: 800px) -->
<div class="container-sm">
  <h1>Narrower content</h1>
</div>

<!-- Page header -->
<div class="page-header">
  <h1>Page Title</h1>
  <div class="page-actions">
    <button class="btn">Action 1</button>
    <button class="btn-primary">Action 2</button>
  </div>
</div>
```

## 🎯 Grilles

```html
<!-- Grid 2 colonnes (responsive) -->
<div class="grid-2">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
</div>

<!-- Grid 3 colonnes (responsive) -->
<div class="grid-3">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
</div>
```

## 🚨 Alertes

```html
<!-- Succès -->
<div class="alert-success">Operation successful!</div>

<!-- Erreur -->
<div class="alert-error">An error occurred</div>

<!-- Warning -->
<div class="alert-warning">Please be careful</div>

<!-- Info -->
<div class="alert-info">FYI: Something to know</div>
```

## 🏷️ Badges

```html
<span class="badge-primary">New</span>
<span class="badge-success">Active</span>
<span class="badge-warning">Admin</span>
```

## 🔧 Utilities

### Texte

```html
<div class="text-center">Texte centré</div>
<div class="text-muted">Texte grisé</div>
<div class="text-primary">Texte couleur primaire</div>
```

### Espacement

```html
<!-- Margins top -->
<div class="mt-0">No margin top</div>
<div class="mt-1">0.25rem margin top</div>
<div class="mt-2">0.5rem margin top</div>
<div class="mt-3">1rem margin top</div>
<div class="mt-4">1.5rem margin top</div>

<!-- Margins bottom -->
<div class="mb-0">No margin bottom</div>
<div class="mb-1">0.25rem margin bottom</div>
<div class="mb-2">0.5rem margin bottom</div>
<div class="mb-3">1rem margin bottom</div>
<div class="mb-4">1.5rem margin bottom</div>
```

## 📋 Exemples complets

### Page avec header et grid

```vue
<template>
  <div class="container">
    <div class="page-header">
      <h1>Systems</h1>
      <div class="page-actions">
        <button class="btn">Refresh</button>
        <button class="btn-danger">Logout</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card-interactive" v-for="system in systems" :key="system.id">
        <h3>{{ system.name }}</h3>
        <p>{{ system.description }}</p>
      </div>
    </div>
  </div>
</template>
```

### Formulaire

```vue
<template>
  <div class="container-sm">
    <div class="card">
      <h1 class="mb-4">Login</h1>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" v-model="username" />
        </div>

        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" v-model="password" />
        </div>

        <div v-if="error" class="alert-error">
          {{ error }}
        </div>

        <button type="submit" class="btn-primary" style="width: 100%">
          Login
        </button>
      </form>
    </div>
  </div>
</template>
```

## 🎨 Personnalisation

Pour modifier les couleurs globales, édite les variables dans `assets/styles/main.scss`:

```scss
// Couleurs principales
$primary-color: #007bff;  // Change cette valeur
$success-color: #28a745;
$danger-color: #dc3545;

// Couleurs de texte
$text-primary: #333;
$text-secondary: #666;

// Background
$background-page: #f5f5f5;  // Fond de page par défaut
```

## ✅ Avantages

- **Cohérence**: Tous les composants utilisent les mêmes styles
- **Maintenance**: Modifier une variable change tout le site
- **Performance**: CSS compilé une seule fois
- **Responsive**: Les grids s'adaptent automatiquement
- **Accessibilité**: Focus states et hover states inclus
