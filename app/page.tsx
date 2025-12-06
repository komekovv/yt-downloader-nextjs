"use client";

import { useState, useRef, useEffect } from "react";
import FormatsTable from "../components/FormatsTable";
import ProgressBar from "../components/ProgressBar";
import SettingsModal from "../components/SettingsModal";
import VideoCard from "../components/VideoCard";
import { useSettings } from "../hooks/useSettings";
import { VideoMetadata } from "@/lib/types";

export default function HomePage() {
  const { settings, updateSettings, resetSettings, isLoaded } = useSettings();
  const [url, setUrl] = useState("");
  const [formats, setFormats] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [downloadedBytes, setDownloadedBytes] = useState<number | undefined>(undefined);
  const [totalBytes, setTotalBytes] = useState<number | undefined>(undefined);
  const [downloadSpeed, setDownloadSpeed] = useState<string | undefined>(undefined);
  const [eta, setEta] = useState<string | undefined>(undefined);
  const downloadAbortController = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset formats when URL changes
  useEffect(() => {
    setFormats([]);
    setMetadata(null);
  }, [url]);

  // Auto-fetch metadata when URL changes
  useEffect(() => {
    if (settings.autoFetchMetadata && url.trim() && isValidYouTubeUrl(url)) {
      const timeoutId = setTimeout(() => {
        handleFetchMetadata(url.trim());
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setMetadata(null);
    }
  }, [url, settings.autoFetchMetadata]);

  const isValidYouTubeUrl = (urlString: string): boolean => {
    try {
      const parsedUrl = new URL(urlString);
      return (
        parsedUrl.hostname.includes("youtube.com") ||
        parsedUrl.hostname.includes("youtu.be")
      );
    } catch {
      return false;
    }
  };

  const handleFetchMetadata = async (targetUrl: string) => {
    setLoadingMetadata(true);
    setMetadata(null);

    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        console.warn("Metadata fetch failed:", data.error);
        // Show error if it's a network issue
        if (data.error && data.error.includes("connection")) {
          setError("Network error: Cannot connect to YouTube. Check firewall/proxy settings or try the proxy option in Settings.");
        }
        return;
      }

      setMetadata(data);
    } catch (err: any) {
      console.warn("Metadata fetch error:", err.message);
      // Silently fail - metadata is optional for the core functionality
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleFetchFormats = async () => {
    if (!url.trim()) {
      setError("Please paste a YouTube URL.");
      return;
    }

    if (!isValidYouTubeUrl(url.trim())) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setError(null);
    setLoadingFormats(true);
    setFormats([]);

    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch formats");
      }

      setFormats(data.formats || []);

      if (data.formats.length === 0) {
        setError("No supported formats found for this video.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while fetching formats.");
    } finally {
      setLoadingFormats(false);
    }
  };

  const startFakeProgress = () => {
    setProgress(0);
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return prev;
        const increment = prev < 50 ? 3 : prev < 80 ? 2 : 1;
        return Math.min(prev + increment, 96);
      });
    }, 300);
  };

  const stopFakeProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);
    setTimeout(() => {
      setIsDownloading(false);
      setProgress(0);
      setProgressLabel(undefined);
    }, 1200);
  };

  const cancelDownload = () => {
    if (downloadAbortController.current) {
      downloadAbortController.current.abort();
      downloadAbortController.current = null;
    }
    setIsDownloading(false);
    setProgress(0);
    setProgressLabel(undefined);
    setDownloadedBytes(undefined);
    setTotalBytes(undefined);
    setDownloadSpeed(undefined);
    setEta(undefined);
    setError("Download cancelled.");
  };

  const handleDownload = async (formatId: string, line: string, convert?: boolean, targetFormat?: string) => {
    if (!url.trim()) return;

    setError(null);
    setIsDownloading(true);
    setProgress(0);
    setDownloadedBytes(undefined);
    setTotalBytes(undefined);
    setDownloadSpeed(undefined);
    setEta(undefined);
    setProgressLabel(convert ? `Converting to ${targetFormat?.toUpperCase()}...` : `Preparing download...`);

    // Create new abort controller
    downloadAbortController.current = new AbortController();

    try {
      const res = await fetch("/api/download-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          format: formatId,
          proxy: settings.proxy || undefined,
          convert: convert || false,
          targetFormat: targetFormat,
        }),
        signal: downloadAbortController.current.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to start download.");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body.");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress") {
              setProgress(data.percent || 0);
              setDownloadedBytes(data.downloadedBytes);
              setTotalBytes(data.totalBytes);
              setDownloadSpeed(data.speed);
              setEta(data.eta);
              setProgressLabel(`Downloading format ${formatId}`);
            } else if (data.type === "complete") {
              setProgress(100);
              setProgressLabel("Download complete!");
            } else if (data.type === "file") {
              // Decode base64 and trigger download
              const binary = atob(data.data);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: data.contentType });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = data.filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(a.href);

              // Reset after a delay
              setTimeout(() => {
                setIsDownloading(false);
                setProgress(0);
                setProgressLabel(undefined);
                setDownloadedBytes(undefined);
                setTotalBytes(undefined);
                setDownloadSpeed(undefined);
                setEta(undefined);
              }, 2000);
            } else if (data.type === "error") {
              throw new Error(data.error || "Download failed.");
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Download was cancelled
        return;
      }
      setError(err.message || "Something went wrong during download.");
      setIsDownloading(false);
      setProgress(0);
      setProgressLabel(undefined);
      setDownloadedBytes(undefined);
      setTotalBytes(undefined);
      setDownloadSpeed(undefined);
      setEta(undefined);
    }
  };

  return (
    <main className="w-full px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-50">
                YouTube Downloader
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Download YouTube videos and audio in multiple formats. Powered by yt-dlp.
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Open settings"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* URL Input */}
          <section className="space-y-3">
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
              YouTube URL
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500 transition"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFetchFormats();
                  }
                }}
              />
              {!settings.autoFetchMetadata && url.trim() && isValidYouTubeUrl(url) && !metadata && (
                <button
                  onClick={() => handleFetchMetadata(url.trim())}
                  disabled={loadingMetadata}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-slate-200 shadow-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Show video preview"
                >
                  {loadingMetadata ? "..." : "Preview"}
                </button>
              )}
              <button
                onClick={handleFetchFormats}
                disabled={loadingFormats || !url.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loadingFormats ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading...
                  </>
                ) : (
                  "Get Formats"
                )}
              </button>
            </div>
          </section>

          {/* Progress Bar */}
          {(isDownloading || progress > 0) && (
            <div className="mt-4 space-y-3">
              <ProgressBar
                progress={progress}
                isActive={isDownloading || progress < 100}
                label={progressLabel}
                downloadedBytes={downloadedBytes}
                totalBytes={totalBytes}
                speed={downloadSpeed}
                eta={eta}
              />
              {isDownloading && (
                <button
                  onClick={cancelDownload}
                  className="w-full px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors"
                >
                  Cancel Download
                </button>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Video Metadata Card */}
        {metadata && !loadingMetadata && (
          <VideoCard metadata={metadata} />
        )}

        {loadingMetadata && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">Loading video info...</span>
            </div>
          </div>
        )}

        {/* Formats Table */}
        {formats.length > 0 && (
          <FormatsTable
            url={url}
            formats={formats}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            showConvertibleFormats={settings.showConvertibleFormats}
          />
        )}

        {/* Empty State */}
        {formats.length === 0 && !loadingFormats && !error && !metadata && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-300 mb-2">
              Ready to download
            </h3>
            <p className="text-sm text-slate-500">
              Paste a YouTube URL above and click &quot;Get Formats&quot; to begin
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isLoaded && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          onReset={resetSettings}
        />
      )}
    </main>
  );
}
