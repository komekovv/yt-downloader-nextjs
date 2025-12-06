import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 3600; // 60 minutes (1 hour) - Allow long downloads

// Maximum file size: 2GB (in bytes)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const execFileAsync = promisify(execFile);

interface DownloadRequest {
  url: string;
  format: string;
  proxy?: string;
}

export async function POST(req: Request) {
  let tempFilePath: string | null = null;

  try {
    const body: DownloadRequest = await req.json();
    const { url, format, proxy } = body;

    if (!url || !format) {
      return NextResponse.json(
        { error: "Both 'url' and 'format' are required." },
        { status: 400 }
      );
    }

    // Validate URL
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

    // Create unique temp file path
    const tmpDir = os.tmpdir();
    const uniqueId = randomBytes(16).toString("hex");
    const outputTemplate = path.join(tmpDir, `yt-dl-${uniqueId}.%(ext)s`);

    // Build yt-dlp arguments securely
    const args = ["-f", format, "-o", outputTemplate];

    if (proxy) {
      args.push("--proxy", proxy);
    }

    args.push(url);

    // Execute yt-dlp
    await execFileAsync("yt-dlp", args, {
      timeout: 300000, // 5 minutes
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for output
    });

    // Find the downloaded file
    const files = fs.readdirSync(tmpDir);
    const downloadedFile = files.find((f) => f.startsWith(`yt-dl-${uniqueId}.`));

    if (!downloadedFile) {
      return NextResponse.json(
        { error: "Downloaded file not found in temp directory." },
        { status: 500 }
      );
    }

    tempFilePath = path.join(tmpDir, downloadedFile);
    const ext = path.extname(downloadedFile).toLowerCase().replace(".", "");

    // Check file size
    const stats = fs.statSync(tempFilePath);
    if (stats.size > MAX_FILE_SIZE) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
      return NextResponse.json(
        { error: `File too large (${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB). Maximum supported size is 2GB.` },
        { status: 413 }
      );
    }

    // Determine content type
    let contentType = "application/octet-stream";
    switch (ext) {
      case "mp4":
        contentType = "video/mp4";
        break;
      case "m4a":
        contentType = "audio/mp4";
        break;
      case "mp3":
        contentType = "audio/mpeg";
        break;
      case "webm":
        contentType = "video/webm";
        break;
    }

    // For files larger than 100MB, use streaming
    // For smaller files, read into buffer (faster)
    const USE_STREAMING_THRESHOLD = 100 * 1024 * 1024; // 100MB

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="download-${format}.${ext}"`);
    headers.set("Content-Length", stats.size.toString());

    if (stats.size > USE_STREAMING_THRESHOLD) {
      // Stream large files
      const readStream = fs.createReadStream(tempFilePath);

      // Create a web-compatible ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          readStream.on("data", (chunk: string | Buffer) => {
            const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
          });
          readStream.on("end", () => {
            controller.close();
            // Clean up after streaming completes
            try {
              if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
            } catch (err) {
              console.error("Failed to clean up temp file:", err);
            }
          });
          readStream.on("error", (err: Error) => {
            controller.error(err);
            // Clean up on error
            try {
              if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
            } catch (cleanupErr) {
              console.error("Failed to clean up temp file:", cleanupErr);
            }
          });
        },
      });

      return new NextResponse(webStream, {
        status: 200,
        headers,
      });
    } else {
      // Read small files into buffer
      const fileBuffer = fs.readFileSync(tempFilePath);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });
    }
  } catch (err: any) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error("Failed to clean up temp file:", cleanupErr);
      }
    }

    console.error("Download error:", err);

    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "yt-dlp is not installed on the server." },
        { status: 500 }
      );
    }

    if (err.killed) {
      return NextResponse.json(
        { error: "Download timeout. The video may be too large or unavailable." },
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

    const message = err.stderr || err.message || "Failed to download video.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
