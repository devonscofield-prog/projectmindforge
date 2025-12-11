import { useState, useEffect, useCallback } from 'react';

export type ColorScheme = 'electric-blue' | 'deep-gold' | 'power-red';

export interface ColorSchemeOption {
  id: ColorScheme;
  name: string;
  description: string;
  preview: {
    primary: string;
    accent: string;
    sidebar: string;
  };
}

export const colorSchemes: ColorSchemeOption[] = [
  {
    id: 'electric-blue',
    name: 'Electric Blue',
    description: 'High-tech, trustworthy blue theme',
    preview: {
      primary: 'hsl(230, 90%, 60%)',
      accent: 'hsl(230, 80%, 70%)',
      sidebar: 'hsl(230, 50%, 12%)',
    },
  },
  {
    id: 'deep-gold',
    name: 'Deep Gold',
    description: 'Luxurious, premium gold theme',
    preview: {
      primary: 'hsl(40, 85%, 45%)',
      accent: 'hsl(40, 80%, 55%)',
      sidebar: 'hsl(40, 10%, 15%)',
    },
  },
  {
    id: 'power-red',
    name: 'Power Red',
    description: 'High-contrast, urgent red theme',
    preview: {
      primary: 'hsl(350, 78%, 50%)',
      accent: 'hsl(350, 70%, 60%)',
      sidebar: 'hsl(220, 15%, 15%)',
    },
  },
];

const STORAGE_KEY = 'mindforge-color-scheme';

export function useColorScheme() {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && colorSchemes.some(s => s.id === stored)) {
        return stored as ColorScheme;
      }
    }
    return 'deep-gold';
  });

  useEffect(() => {
    // Apply the color scheme class to the document
    const root = document.documentElement;
    
    // Remove all color scheme classes
    colorSchemes.forEach(scheme => {
      root.classList.remove(`theme-${scheme.id}`);
    });
    
    // Add the current color scheme class
    root.classList.add(`theme-${colorScheme}`);
    
    // Store preference
    localStorage.setItem(STORAGE_KEY, colorScheme);
  }, [colorScheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  }, []);

  return {
    colorScheme,
    setColorScheme,
    colorSchemes,
  };
}
