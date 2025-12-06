"use client";

import { useState, useMemo } from "react";

interface FormatData {
  line: string;
  id: string;
  ext: string;
  resolution: string;
  filesize?: number;
}

interface FormatsTableProps {
  url: string;
  formats: FormatData[];
  onDownload: (formatId: string, line: string, convert?: boolean, targetFormat?: string) => void;
  isDownloading?: boolean;
  showConvertibleFormats?: boolean;
}

interface ParsedFormat {
  id: string;
  ext: string;
  resolution: string;
  isAudioOnly: boolean;
  quality: string;
  qualityLabel: string;
  line: string;
  filesize?: number;
  filesizeFormatted?: string;
  needsConversion: boolean;
  targetFormat?: string;
}

// Map resolution to quality labels
const getQualityLabel = (resolution: string): string => {
  const match = resolution.match(/(\d+)x(\d+)/);
  if (!match) return "";

  const height = parseInt(match[2]);

  if (height >= 4320) return "8K";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  if (height >= 360) return "360p";
  if (height >= 240) return "240p";
  if (height >= 144) return "144p";

  return `${height}p`;
};

export default function FormatsTable({
  url,
  formats,
  onDownload,
  isDownloading = false,
  showConvertibleFormats = false,
}: FormatsTableProps) {
  const [filter, setFilter] = useState<"all" | "video" | "audio">("all");
  const [sortBy, setSortBy] = useState<"quality" | "size">("quality");

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    } else if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
  };

  const parsedFormats = useMemo(() => {
    return formats
      .map((format): ParsedFormat | null => {
        const { line, id, ext, resolution, filesize } = format;
        const isAudioOnly = line.toLowerCase().includes("audio only");
        const extLower = ext.toLowerCase();

        // Determine if format needs conversion
        let needsConversion = false;
        let targetFormat: string | undefined;

        if (isAudioOnly) {
          // Audio format
          if (extLower === "mp3") {
            // Pure MP3 - no conversion needed
            needsConversion = false;
          } else if (extLower === "m4a" || extLower === "webm" || extLower === "opus") {
            // Can convert to MP3
            if (!showConvertibleFormats) return null; // Hide if setting is off
            needsConversion = true;
            targetFormat = "mp3";
          } else {
            // Unknown audio format - hide
            return null;
          }
        } else {
          // Video format
          if (extLower === "mp4") {
            // Pure MP4 - no conversion needed
            needsConversion = false;
          } else if (extLower === "webm") {
            // Can convert to MP4
            if (!showConvertibleFormats) return null; // Hide if setting is off
            needsConversion = true;
            targetFormat = "mp4";
          } else {
            // Unknown video format - hide
            return null;
          }
        }

        // Extract quality info
        let quality = "";
        let qualityLabel = "";

        if (isAudioOnly) {
          // Audio - no quality label
          quality = "Audio";
          qualityLabel = "";
        } else if (resolution) {
          // Video - show quality label
          quality = resolution;
          qualityLabel = getQualityLabel(resolution);
        }

        return {
          id,
          ext,
          resolution,
          isAudioOnly,
          quality,
          qualityLabel,
          line,
          filesize,
          filesizeFormatted: formatFileSize(filesize),
          needsConversion,
          targetFormat,
        };
      })
      .filter((f): f is ParsedFormat => f !== null);
  }, [formats, showConvertibleFormats]);

  const filteredFormats = useMemo(() => {
    let filtered = parsedFormats;

    if (filter === "video") {
      filtered = filtered.filter((f) => !f.isAudioOnly);
    } else if (filter === "audio") {
      filtered = filtered.filter((f) => f.isAudioOnly);
    }

    // Sort
    if (sortBy === "quality") {
      filtered = [...filtered].sort((a, b) => {
        // Audio formats go to bottom
        if (a.isAudioOnly && !b.isAudioOnly) return 1;
        if (!a.isAudioOnly && b.isAudioOnly) return -1;

        // Extract numeric quality for comparison
        const getQualityNum = (f: ParsedFormat) => {
          if (f.resolution) {
            const match = f.resolution.match(/(\d+)x(\d+)/);
            return match ? parseInt(match[2]) : 0;
          }
          return 0;
        };
        return getQualityNum(b) - getQualityNum(a);
      });
    } else if (sortBy === "size") {
      filtered = [...filtered].sort((a, b) => {
        const sizeA = a.filesize || 0;
        const sizeB = b.filesize || 0;
        return sizeB - sizeA; // Largest first
      });
    }

    return filtered;
  }, [parsedFormats, filter, sortBy]);

  if (!url) return null;

  return (
    <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Available Formats</h2>
          <span className="text-xs text-slate-400">{filteredFormats.length} formats</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950/60 rounded-lg p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                filter === "all"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("video")}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                filter === "video"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Video
            </button>
            <button
              onClick={() => setFilter("audio")}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                filter === "audio"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Audio
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "quality" | "size")}
              className="text-xs bg-slate-950/60 border border-slate-700 text-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              <option value="quality">Quality</option>
              <option value="size">File Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formats List */}
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {filteredFormats.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No formats available
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredFormats.map((format) => (
              <div
                key={format.id}
                className="px-4 py-3 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Format Badge */}
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      format.ext === "mp4"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : format.ext === "mp3"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : format.ext === "webm"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                    }`}>
                      {format.ext.toUpperCase()}
                    </span>

                    {/* Quality Label for Videos */}
                    {format.qualityLabel && (
                      <span className="text-lg font-bold text-emerald-400">
                        {format.qualityLabel}
                      </span>
                    )}

                    {/* Audio Label */}
                    {format.isAudioOnly && (
                      <span className="text-sm text-slate-400">
                        Audio Only
                      </span>
                    )}

                    {/* Resolution for Videos */}
                    {!format.isAudioOnly && format.resolution && (
                      <span className="text-xs text-slate-500">
                        ({format.resolution})
                      </span>
                    )}
                  </div>

                  {/* File Size */}
                  <div className="text-xs text-slate-500">
                    Size: {format.filesizeFormatted}
                  </div>
                </div>

                {/* Download Button */}
                <button
                  onClick={() => onDownload(
                    format.id,
                    format.line,
                    format.needsConversion,
                    format.targetFormat
                  )}
                  disabled={isDownloading}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                    isDownloading
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : format.needsConversion
                      ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  {isDownloading
                    ? "Downloading..."
                    : format.needsConversion
                    ? `Convert to ${format.targetFormat?.toUpperCase()}`
                    : "Download"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
