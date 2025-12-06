"use client";

import { VideoMetadata } from "@/lib/types";

interface VideoCardProps {
  metadata: VideoMetadata;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatViewCount(count?: number): string {
  if (!count) return "N/A";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

export default function VideoCard({ metadata }: VideoCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-full md:w-48 h-36 bg-slate-800 rounded-lg overflow-hidden">
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z'/%3E%3C/svg%3E";
            }}
          />
          <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs font-semibold text-white">
            {formatDuration(metadata.duration)}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex-1 space-y-2 min-w-0">
          <h3 className="text-base font-semibold text-slate-50 line-clamp-2">
            {metadata.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate">{metadata.uploader}</span>
            {metadata.viewCount && (
              <>
                <span>•</span>
                <span>{formatViewCount(metadata.viewCount)} views</span>
              </>
            )}
          </div>
          {metadata.uploadDate && (
            <div className="text-xs text-slate-500">
              Uploaded: {metadata.uploadDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
