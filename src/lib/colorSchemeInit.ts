import { useEffect } from 'react';

const STORAGE_KEY = 'mindforge-color-scheme';
const validSchemes = ['electric-blue', 'deep-gold', 'power-red'];

/**
 * Initializes the color scheme from localStorage on app load.
 * This runs once before React hydration to prevent flash of wrong theme.
 */
export function initializeColorScheme() {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && validSchemes.includes(stored)) {
    document.documentElement.classList.add(`theme-${stored}`);
  } else {
    document.documentElement.classList.add('theme-deep-gold');
  }
}

/**
 * Component that ensures color scheme is applied.
 * Use this in App.tsx to ensure the theme is maintained.
 */
export function ColorSchemeInitializer() {
  useEffect(() => {
    initializeColorScheme();
  }, []);
  
  return null;
}
