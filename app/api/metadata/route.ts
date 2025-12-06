import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  view_count?: number;
  upload_date?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  // Basic URL validation
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("youtube.com") && !parsedUrl.hostname.includes("youtu.be")) {
      return NextResponse.json(
        { error: "Only YouTube URLs are supported." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
  }

  try {
    // Use yt-dlp to fetch metadata in JSON format
    const { stdout } = await execFileAsync(
      "yt-dlp",
      [
        "--dump-json",
        "--no-playlist",
        "--skip-download",
        url,
      ],
      {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      }
    );

    const metadata: VideoMetadata = JSON.parse(stdout);

    return NextResponse.json({
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      uploader: metadata.uploader,
      viewCount: metadata.view_count,
      uploadDate: metadata.upload_date,
    });
  } catch (err: any) {
    console.error("yt-dlp metadata error:", err);

    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "yt-dlp is not installed on the server." },
        { status: 500 }
      );
    }

    if (err.killed) {
      return NextResponse.json(
        { error: "Request timeout. The video may be unavailable." },
        { status: 504 }
      );
    }

    // Check for network/connection errors
    const stderr = err.stderr || "";
    if (stderr.includes("connection") || stderr.includes("WinError 10061")) {
      return NextResponse.json(
        { error: "Network connection error. yt-dlp cannot connect to YouTube. This may be caused by firewall, antivirus, or network restrictions." },
        { status: 503 }
      );
    }

    const message = err.stderr || err.message || "Failed to fetch video metadata.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
