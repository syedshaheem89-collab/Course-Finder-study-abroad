'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  brandName: string;
  setBrandName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  brandName: 'GlobalCourse AI',
  setBrandName: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [brandName, setBrandNameState] = useState<string>('GlobalCourse AI');

  const applyThemeToDOM = (t: Theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t);
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    // 1. Theme initialization
    const savedTheme = localStorage.getItem('study_abroad_theme') as Theme;
    const initial = savedTheme || 'dark';
    setTheme(initial);
    applyThemeToDOM(initial);

    // 2. Brand Name initialization
    const savedBrand = localStorage.getItem('study_abroad_brand_name');
    if (savedBrand) {
      setBrandNameState(savedBrand);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('study_abroad_theme', next);
    applyThemeToDOM(next);
  };

  const setBrandName = (name: string) => {
    setBrandNameState(name);
    localStorage.setItem('study_abroad_brand_name', name);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, brandName, setBrandName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
