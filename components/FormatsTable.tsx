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
  onDownload: (formatId: string, line: string) => void;
  preferredFormats?: string[];
  isDownloading?: boolean;
}

interface ParsedFormat {
  id: string;
  ext: string;
  resolution: string;
  isAudioOnly: boolean;
  quality: string;
  line: string;
  filesize?: number;
  filesizeFormatted?: string;
}

export default function FormatsTable({
  url,
  formats,
  onDownload,
  preferredFormats = ["mp4", "webm", "m4a"],
  isDownloading = false,
}: FormatsTableProps) {
  const [filter, setFilter] = useState<"all" | "video" | "audio">("all");
  const [sortBy, setSortBy] = useState<"quality" | "format" | "size">("quality");

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

        // Filter by preferred formats
        if (!preferredFormats.includes(ext.toLowerCase())) {
          return null;
        }

        // Extract quality info
        let quality = "";
        if (resolution) {
          quality = resolution;
        } else if (isAudioOnly) {
          // Try to find bitrate
          const bitrateMatch = line.match(/(\d+)k/i);
          quality = bitrateMatch ? `${bitrateMatch[1]}kbps` : "audio";
        }

        return {
          id,
          ext,
          resolution,
          isAudioOnly,
          quality,
          line,
          filesize,
          filesizeFormatted: formatFileSize(filesize),
        };
      })
      .filter((f): f is ParsedFormat => f !== null);
  }, [formats, preferredFormats]);

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
        // Extract numeric quality for comparison
        const getQualityNum = (f: ParsedFormat) => {
          if (f.resolution) {
            const match = f.resolution.match(/(\d+)x(\d+)/);
            return match ? parseInt(match[2]) : 0;
          }
          const bitrateMatch = f.quality.match(/(\d+)/);
          return bitrateMatch ? parseInt(bitrateMatch[1]) : 0;
        };
        return getQualityNum(b) - getQualityNum(a);
      });
    } else if (sortBy === "format") {
      filtered = [...filtered].sort((a, b) => a.ext.localeCompare(b.ext));
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
              onChange={(e) => setSortBy(e.target.value as "quality" | "format" | "size")}
              className="text-xs bg-slate-950/60 border border-slate-700 text-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              <option value="quality">Quality</option>
              <option value="size">File Size</option>
              <option value="format">Format</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {filteredFormats.length > 0 ? (
          <table className="w-full text-sm">
            <tbody>
              {filteredFormats.map((format, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-800/70 hover:bg-slate-900/80 transition-colors"
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="font-mono text-[11px] text-slate-500">
                      ID: {format.id}
                    </div>
                    <div className="text-xs text-slate-200 mt-0.5">
                      {format.isAudioOnly ? "Audio only" : "Video"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-xs font-semibold text-slate-100 uppercase">
                      {format.ext}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {format.quality || "Unknown"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-xs font-medium text-slate-300">
                      {format.filesizeFormatted}
                    </div>
                    {format.filesize && format.filesize > 500 * 1024 * 1024 && (
                      <div className="text-[10px] text-amber-400 mt-0.5">Large file</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-right">
                    <button
                      onClick={() => onDownload(format.id, format.line)}
                      disabled={isDownloading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {isDownloading ? "Downloading..." : "Download"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No formats match your current filter.
          </div>
        )}
      </div>
    </div>
  );
}
