import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

interface FormatInfo {
  line: string;
  id: string;
  ext: string;
  resolution: string;
  filesize?: number;
}

function parseFormats(stdout: string): FormatInfo[] {
  const lines = stdout.split("\n");
  const result: FormatInfo[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    // Skip header lines and storyboards
    if (
      lower.startsWith("id") ||
      lower.includes("storyboard") ||
      lower.includes("format code")
    ) {
      continue;
    }

    // Include mp4, m4a, mp3, webm formats
    if (
      lower.includes("mp4") ||
      lower.includes("m4a") ||
      lower.includes("mp3") ||
      lower.includes("webm")
    ) {
      const parts = line.split(/\s+/).filter(Boolean);
      const id = parts[0] || "";
      const ext = parts[1] || "";
      const resolution = parts.find((p) => p.includes("x")) || "";

      // Try to find filesize in the line (format: ~123MiB or 123.45MiB)
      let filesize: number | undefined;
      const sizeMatch = line.match(/~?(\d+\.?\d*)(MiB|KiB|GiB)/i);
      if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        if (unit === "mib") filesize = value * 1024 * 1024;
        else if (unit === "kib") filesize = value * 1024;
        else if (unit === "gib") filesize = value * 1024 * 1024 * 1024;
      }

      result.push({ line, id, ext, resolution, filesize });
    }
  }

  return result;
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
    // Use execFile instead of exec to prevent command injection
    const { stdout, stderr } = await execFileAsync("yt-dlp", ["-F", url], {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });

    const formats = parseFormats(stdout);
    return NextResponse.json({ formats });
  } catch (err: any) {
    console.error("yt-dlp error:", err);

    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "yt-dlp is not installed on the server." },
        { status: 500 }
      );
    }

    if (err.killed) {
      return NextResponse.json(
        { error: "Request timeout. The video may be too long or unavailable." },
        { status: 504 }
      );
    }

    // Check for network/connection errors
    const stderr = err.stderr || "";
    if (stderr.includes("connection") || stderr.includes("WinError 10061")) {
      return NextResponse.json(
        { error: "Network connection error. yt-dlp cannot connect to YouTube. This may be caused by firewall, antivirus, or network restrictions. Try configuring a proxy in Settings." },
        { status: 503 }
      );
    }

    const message = err.stderr || err.message || "Failed to fetch formats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
