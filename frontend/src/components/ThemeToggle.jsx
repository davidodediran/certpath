import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * ThemeToggle — self-contained sun/moon button.
 * Reads/writes directly to the DOM class + localStorage.
 * Listens for 'themechange' events so it stays in sync when
 * the theme is also changed via the SettingsPanel.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const handler = (e) => setIsDark(e.detail);
    window.addEventListener('themechange', handler);
    return () => window.removeEventListener('themechange', handler);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  };

  return (
    <button
      onClick={toggle}
      className="text-gray-400 hover:text-white transition"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
