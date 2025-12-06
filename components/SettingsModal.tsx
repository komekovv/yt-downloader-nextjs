"use client";

import { AppSettings } from "@/lib/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onReset: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onReset,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const formatOptions = [
    { value: "mp4", label: "MP4 (Video)" },
    { value: "webm", label: "WebM (Video)" },
    { value: "m4a", label: "M4A (Audio)" },
    { value: "mp3", label: "MP3 (Audio)" },
  ];

  const toggleFormat = (format: string) => {
    const newFormats = settings.preferredFormats.includes(format)
      ? settings.preferredFormats.filter((f) => f !== format)
      : [...settings.preferredFormats, format];
    onUpdateSettings({ preferredFormats: newFormats });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close settings"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Proxy Settings */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Proxy Server (Optional)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500 transition"
              placeholder="http://proxy.example.com:8080"
              value={settings.proxy}
              onChange={(e) => onUpdateSettings({ proxy: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              Enter a proxy server URL if you need to route requests through a proxy.
            </p>
          </div>

          {/* Preferred Formats */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Preferred Formats
            </label>
            <div className="space-y-2">
              {formatOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={settings.preferredFormats.includes(option.value)}
                    onChange={() => toggleFormat(option.value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-0 transition cursor-pointer"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100 transition">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Only show formats matching your selected preferences.
            </p>
          </div>

          {/* Auto-fetch Metadata */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.autoFetchMetadata}
                onChange={(e) =>
                  onUpdateSettings({ autoFetchMetadata: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-0 transition cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition">
                Auto-fetch video metadata
              </span>
            </label>
            <p className="text-xs text-slate-500 ml-7">
              Automatically fetch thumbnail and video details when a URL is pasted.
            </p>
          </div>

          {/* Show Convertible Formats */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.showConvertibleFormats}
                onChange={(e) =>
                  onUpdateSettings({ showConvertibleFormats: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-0 transition cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition">
                Show convertible formats (WebM, M4A)
              </span>
            </label>
            <p className="text-xs text-slate-500 ml-7">
              Show formats that can be converted to MP4/MP3. Conversion may take longer.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
