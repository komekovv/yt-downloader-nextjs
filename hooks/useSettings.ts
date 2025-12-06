import { useState, useEffect } from "react";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/types";

const SETTINGS_KEY = "yt-downloader-settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      console.error("Failed to reset settings:", error);
    }
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}
