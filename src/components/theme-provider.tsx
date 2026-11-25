'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  brandName: string;
  setBrandName: (name: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  brandName: 'Orbis',
  setBrandName: async () => false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [brandName, setBrandNameState] = useState<string>('Orbis');

  const syncBrandInTitle = (brand: string) => {
    if (typeof document === 'undefined' || !brand) return;
    const current = document.title || '';
    if (!current) {
      document.title = `${brand} — The Global Course Finder`;
      return;
    }
    if (current.includes('GlobalCourse AI') && brand !== 'GlobalCourse AI') {
      document.title = current.replace(/GlobalCourse AI/g, brand);
    } else if (current.includes('Course Engine') && brand !== 'Course Engine') {
      document.title = current.replace(/Course Engine/g, brand);
    } else if (current.includes('Orbis') && brand !== 'Orbis') {
      document.title = current.replace(/Orbis/g, brand);
    }
  };

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
    const savedTheme = localStorage.getItem('study_abroad_theme_v2') as Theme | null;
    const initial: Theme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyThemeToDOM(initial);

    const savedBrand = localStorage.getItem('study_abroad_brand_name_v2');
    if (savedBrand) {
      setBrandNameState(savedBrand);
      syncBrandInTitle(savedBrand);
    }

    fetch('/api/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && typeof d.brandName === 'string' && d.brandName.trim()) {
          const globalBrand = d.brandName.trim();
          setBrandNameState(globalBrand);
          localStorage.setItem('study_abroad_brand_name_v2', globalBrand);
          syncBrandInTitle(globalBrand);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('study_abroad_theme_v2', next);
    applyThemeToDOM(next);
  };

  const setBrandName = async (name: string): Promise<boolean> => {
    const clean = name.trim();
    if (!clean) return false;
    setBrandNameState(clean);
    localStorage.setItem('study_abroad_brand_name_v2', clean);
    syncBrandInTitle(clean);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: clean }),
      });
      const data = await res.json().catch(() => ({}));
      return Boolean(res.ok && data?.success);
    } catch {
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, brandName, setBrandName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
