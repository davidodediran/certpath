import React, { useState } from 'react';
import { X, Sun, Moon, Type, Monitor } from 'lucide-react';
import { FONT_SCALES, getSavedScale, applyScale } from '../lib/fontScale';

/**
 * SettingsPanel — slide-in drawer with font size + theme controls.
 * Drop in any page: <SettingsPanel onClose={() => setShowSettings(false)} />
 */
export default function SettingsPanel({ onClose }) {
  const [activeScale, setActiveScale] = useState(getSavedScale);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  const handleScale = (key) => {
    applyScale(key);
    setActiveScale(key);
  };

  const setTheme = (newDark) => {
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    setIsDark(newDark);
    // Keep any ThemeToggle buttons in the nav in sync
    window.dispatchEvent(new CustomEvent('themechange', { detail: newDark }));
  };

  const SCALE_DESCRIPTIONS = ['Compact', 'Standard', 'Comfortable', 'Large'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-80 h-full shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-aws-orange" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">Display Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* ── Font Size ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Type size={15} className="text-aws-orange" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Text Size</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Scales all text and spacing across the app.</p>

            <div className="space-y-2">
              {FONT_SCALES.map(({ key, label }, i) => (
                <button
                  key={key}
                  onClick={() => handleScale(key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    activeScale === key
                      ? 'border-aws-orange bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold ${activeScale === key ? 'text-aws-orange' : 'text-gray-500 dark:text-gray-400'}`}
                      style={{ fontSize: `${12 + i * 3}px` }}
                    >
                      {label}
                    </span>
                    <span className={`text-xs ${activeScale === key ? 'text-aws-orange/80' : 'text-gray-400'}`}>
                      {SCALE_DESCRIPTIONS[i]}
                    </span>
                  </div>
                  {activeScale === key && (
                    <span className="w-2 h-2 rounded-full bg-aws-orange" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Theme ── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isDark ? <Moon size={15} className="text-aws-orange" /> : <Sun size={15} className="text-aws-orange" />}
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Theme</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Choose your preferred colour scheme.</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme(false)}
                className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  !isDark
                    ? 'border-aws-orange bg-orange-50 dark:bg-orange-900/20 text-aws-orange'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Sun size={15} /> Light
              </button>
              <button
                onClick={() => setTheme(true)}
                className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  isDark
                    ? 'border-aws-orange bg-orange-900/20 text-aws-orange'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Moon size={15} /> Dark
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 text-center">Settings are saved automatically</p>
        </div>
      </div>
    </div>
  );
}
