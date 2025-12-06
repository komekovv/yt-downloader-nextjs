interface ProgressBarProps {
  progress: number; // 0-100
  isActive: boolean;
  label?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: string;
  eta?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

export default function ProgressBar({
  progress,
  isActive,
  label,
  downloadedBytes,
  totalBytes,
  speed,
  eta
}: ProgressBarProps) {
  if (!isActive) return null;

  const clamped = Math.max(0, Math.min(100, progress));
  const showDetailedProgress = downloadedBytes !== undefined && totalBytes !== undefined;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-300">
          {label || "Downloading..."}
        </div>
        <div className="text-xs font-semibold text-emerald-400">
          {clamped < 100 ? `${clamped.toFixed(1)}%` : "Complete"}
        </div>
      </div>

      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>

      {showDetailedProgress && (
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
            </span>
            {speed && speed !== "0 B/s" && (
              <span className="text-emerald-400">↓ {speed}</span>
            )}
          </div>
          {eta && eta !== "Unknown" && (
            <span>ETA: {eta}</span>
          )}
        </div>
      )}
    </div>
  );
}
