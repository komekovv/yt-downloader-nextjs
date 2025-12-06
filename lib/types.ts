export interface AppSettings {
  proxy: string;
  preferredFormats: string[];
  theme: "dark" | "light";
  autoFetchMetadata: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  proxy: "",
  preferredFormats: ["mp4", "webm", "m4a"],
  theme: "dark",
  autoFetchMetadata: false, // Disabled by default to avoid errors if yt-dlp has issues
};

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  viewCount?: number;
  uploadDate?: string;
}
