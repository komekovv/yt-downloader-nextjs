import { NextRequest } from "next/server";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

interface DownloadProgress {
  type: "progress" | "complete" | "error";
  downloadedBytes?: number;
  totalBytes?: number;
  percent?: number;
  speed?: string;
  eta?: string;
  filename?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let tempFilePath: string | null = null;
      let ytdlpProcess: any = null;
      let isCancelled = false;

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        isCancelled = true;
        console.log("Client disconnected, cleaning up...");

        // Kill yt-dlp process
        if (ytdlpProcess && !ytdlpProcess.killed) {
          ytdlpProcess.kill("SIGTERM");
        }

        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (err) {
            console.error("Failed to clean up temp file:", err);
          }
        }

        // Close the stream controller safely
        try {
          if (controller.desiredSize !== null) {
            controller.close();
          }
        } catch (err) {
          // Controller already closed, ignore
        }
      });

      try {
        const body = await req.json();
        const { url, format, proxy } = body;

        if (!url || !format) {
          const errorData: DownloadProgress = {
            type: "error",
            error: "Both 'url' and 'format' are required.",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
          return;
        }

        // Validate URL
        try {
          const parsedUrl = new URL(url);
          if (!parsedUrl.hostname.includes("youtube.com") && !parsedUrl.hostname.includes("youtu.be")) {
            const errorData: DownloadProgress = {
              type: "error",
              error: "Only YouTube URLs are supported.",
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
            controller.close();
            return;
          }
        } catch {
          const errorData: DownloadProgress = {
            type: "error",
            error: "Invalid URL format.",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
          return;
        }

        // Create unique temp file path
        const tmpDir = os.tmpdir();
        const uniqueId = randomBytes(16).toString("hex");
        const outputTemplate = path.join(tmpDir, `yt-dl-${uniqueId}.%(ext)s`);

        // Build yt-dlp arguments
        const args = [
          "-f", format,
          "-o", outputTemplate,
          "--newline", // Force progress on new lines
        ];

        if (proxy) {
          args.push("--proxy", proxy);
        }

        args.push(url);

        // Spawn yt-dlp process
        ytdlpProcess = spawn("yt-dlp", args);

        let lastProgress = 0;
        let downloadedFile = "";

        // Parse progress from stdout (yt-dlp outputs progress here)
        ytdlpProcess.stdout.on("data", (data) => {
          if (isCancelled) return; // Don't process if cancelled

          const output = data.toString();
          console.log("yt-dlp progress:", output.trim());

          // Parse download progress
          // Format: [download]  45.5% of 123.45MiB at 1.23MiB/s ETA 00:12
          const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+~?(\d+\.?\d*)(MiB|KiB|GiB)(?:\s+at\s+(\d+\.?\d*)(MiB|KiB|GiB)\/s)?(?:\s+ETA\s+([\d:]+))?/i);

          if (progressMatch) {
            const percent = parseFloat(progressMatch[1]);
            const totalSize = parseFloat(progressMatch[2]);
            const totalUnit = progressMatch[3].toLowerCase();
            const speed = progressMatch[4] ? parseFloat(progressMatch[4]) : 0;
            const speedUnit = progressMatch[5] ? progressMatch[5].toLowerCase() : "";
            const eta = progressMatch[6] || "Unknown";

            // Convert to bytes
            let totalBytes = totalSize;
            if (totalUnit === "mib") totalBytes *= 1024 * 1024;
            else if (totalUnit === "gib") totalBytes *= 1024 * 1024 * 1024;
            else if (totalUnit === "kib") totalBytes *= 1024;

            let speedBytes = speed;
            if (speedUnit === "mib") speedBytes *= 1024 * 1024;
            else if (speedUnit === "gib") speedBytes *= 1024 * 1024 * 1024;
            else if (speedUnit === "kib") speedBytes *= 1024;

            const downloadedBytes = (percent / 100) * totalBytes;

            // Format speed
            let speedFormatted = "0 B/s";
            if (speedBytes > 0) {
              if (speedBytes >= 1024 * 1024) {
                speedFormatted = `${(speedBytes / (1024 * 1024)).toFixed(2)} MB/s`;
              } else if (speedBytes >= 1024) {
                speedFormatted = `${(speedBytes / 1024).toFixed(2)} KB/s`;
              } else {
                speedFormatted = `${speedBytes.toFixed(2)} B/s`;
              }
            }

            // Only send updates if progress changed significantly (every 1%)
            if (Math.abs(percent - lastProgress) >= 1 || percent === 100) {
              lastProgress = percent;

              const progressData: DownloadProgress = {
                type: "progress",
                downloadedBytes: Math.round(downloadedBytes),
                totalBytes: Math.round(totalBytes),
                percent: Math.round(percent * 10) / 10, // 1 decimal
                speed: speedFormatted,
                eta: eta,
              };

              // Safely enqueue
              try {
                if (!isCancelled && controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));
                }
              } catch (err) {
                // Controller closed, ignore
              }
            }
          }
        });

        ytdlpProcess.stderr.on("data", (data) => {
          console.log("yt-dlp stderr:", data.toString());
        });

        ytdlpProcess.on("close", async (code) => {
          if (isCancelled) {
            console.log("Download was cancelled, skipping cleanup");
            return;
          }
          if (code !== 0) {
            const errorData: DownloadProgress = {
              type: "error",
              error: "Download failed. Please try again.",
            };
            try {
              if (!isCancelled && controller.desiredSize !== null) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                controller.close();
              }
            } catch (err) {
              // Controller closed, ignore
            }
            return;
          }

          try {
            // Find the downloaded file
            const files = fs.readdirSync(tmpDir);
            downloadedFile = files.find((f) => f.startsWith(`yt-dl-${uniqueId}.`)) || "";

            if (!downloadedFile) {
              const errorData: DownloadProgress = {
                type: "error",
                error: "Downloaded file not found.",
              };
              try {
                if (!isCancelled && controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                  controller.close();
                }
              } catch (err) {
                // Controller closed, ignore
              }
              return;
            }

            tempFilePath = path.join(tmpDir, downloadedFile);
            const stats = fs.statSync(tempFilePath);

            if (stats.size > MAX_FILE_SIZE) {
              fs.unlinkSync(tempFilePath);
              const errorData: DownloadProgress = {
                type: "error",
                error: `File too large (${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB). Maximum is 2GB.`,
              };
              try {
                if (!isCancelled && controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                  controller.close();
                }
              } catch (err) {
                // Controller closed, ignore
              }
              return;
            }

            // Read file and convert to base64
            const fileBuffer = fs.readFileSync(tempFilePath);
            const base64 = fileBuffer.toString("base64");
            const ext = path.extname(downloadedFile).replace(".", "");

            // Clean up
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;

            // Send completion with file data
            const completeData: DownloadProgress = {
              type: "complete",
              filename: `download-${format}.${ext}`,
              percent: 100,
            };

            // Send complete event first
            try {
              if (!isCancelled && controller.desiredSize !== null) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`));

                // Then send file data
                controller.enqueue(encoder.encode(`data: {"type":"file","data":"${base64}","filename":"download-${format}.${ext}","contentType":"${getContentType(ext)}"}\n\n`));

                controller.close();
              }
            } catch (err) {
              // Controller closed, ignore
            }
          } catch (err: any) {
            console.error("Error processing downloaded file:", err);
            const errorData: DownloadProgress = {
              type: "error",
              error: err.message || "Failed to process downloaded file.",
            };
            try {
              if (!isCancelled && controller.desiredSize !== null) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                controller.close();
              }
            } catch (controllerErr) {
              // Controller closed, ignore
            }
          }
        });

        ytdlpProcess.on("error", (err) => {
          if (isCancelled) return;

          console.error("yt-dlp process error:", err);
          const errorData: DownloadProgress = {
            type: "error",
            error: err.message || "Failed to start download.",
          };
          try {
            if (!isCancelled && controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
              controller.close();
            }
          } catch (controllerErr) {
            // Controller closed, ignore
          }
        });

      } catch (err: any) {
        if (isCancelled) return;

        console.error("Download stream error:", err);

        // Clean up temp file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupErr) {
            console.error("Failed to clean up temp file:", cleanupErr);
          }
        }

        // Kill process if still running
        if (ytdlpProcess && !ytdlpProcess.killed) {
          ytdlpProcess.kill("SIGTERM");
        }

        const errorData: DownloadProgress = {
          type: "error",
          error: err.message || "Download failed.",
        };

        try {
          if (!isCancelled && controller.desiredSize !== null) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
            controller.close();
          }
        } catch (controllerErr) {
          // Controller closed, ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function getContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp4":
      return "video/mp4";
    case "m4a":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}
