# YouTube Downloader (Next.js)

A professional, feature-rich YouTube downloader built with Next.js 16, TypeScript, and Tailwind CSS. Download videos and audio from YouTube in multiple formats with a beautiful, modern UI and real-time progress tracking.

> **🤖 Built entirely with Claude AI using vibe coding** - This entire project was created through AI-assisted development, showcasing the power of Claude Code for rapid prototyping and professional application development.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Claude AI](https://img.shields.io/badge/Built_with-Claude_AI-orange)

## ✨ Features

### 🎥 Core Functionality
- **Multi-format Downloads**: Support for MP4, WebM, M4A, and MP3 formats
- **Video Metadata Preview**: Automatic thumbnail and video info display (title, uploader, duration, views)
- **File Size Display**: See exact file sizes for each format before downloading
- **Format Filtering & Sorting**:
  - Filter by All/Video/Audio
  - Sort by Quality, File Size, or Format
- **Real-time Progress Tracking**:
  - Live percentage updates (0-100%)
  - Downloaded/Total bytes (e.g., "45.32 MB / 123.45 MB")
  - Download speed (MB/s, KB/s, B/s)
  - Estimated time remaining (ETA)
- **Download Control**: Cancel downloads at any time with proper cleanup

### ⚙️ Settings & Customization
- **Proxy Support**: Configure custom proxy servers for downloads
- **Format Preferences**: Select which formats to display (MP4, WebM, M4A, MP3)
- **Auto-fetch Metadata**: Toggle automatic video information retrieval
- **Persistent Settings**: All preferences saved to localStorage

### 🔒 Security & Performance
- **Command Injection Protection**: Uses `execFile()` instead of `exec()` to prevent security vulnerabilities
- **URL Validation**: Only accepts valid YouTube URLs
- **Timeout Protection**: 30s for metadata/formats, 5min for downloads
- **Size Limits**: 2GB maximum file size to prevent abuse
- **Smart Streaming**: Files >100MB are streamed for memory efficiency
- **Error Handling**: Comprehensive error messages and graceful failure handling
- **Secure File Handling**: Cryptographically random temp filenames with proper cleanup

### 🎨 User Experience
- **Modern UI**: Beautiful dark theme with smooth animations and gradients
- **Custom Scrollbars**: Styled scrollbars matching the theme
- **Responsive Design**: Works perfectly on mobile, tablet, and desktop
- **Loading States**: Clear feedback during all async operations
- **Empty States**: Helpful guidance when no content is available
- **Keyboard Shortcuts**: Press Enter to fetch formats
- **Single Download Lock**: Prevents multiple simultaneous downloads
- **Auto-reset**: Formats clear automatically when URL changes

## Prerequisites

- **Node.js** 18+
- **yt-dlp** installed and available in PATH

### Install yt-dlp

**Windows:**
```bash
winget install yt-dlp
```

**macOS:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo apt install yt-dlp
# or
pip install yt-dlp
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd yt-downloader-nextjs
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🚀 Usage

### Quick Start

1. **Paste YouTube URL**: Enter any YouTube video URL in the input field
2. **Preview (Optional)**: Click "Preview" button to see video thumbnail and details
3. **Get Formats**: Click "Get Formats" to fetch all available download options
4. **Filter & Sort**:
   - Use All/Video/Audio filters
   - Sort by Quality, File Size, or Format
5. **Download**: Click the download button for your preferred format
6. **Monitor Progress**: Watch real-time progress with speed and ETA
7. **Cancel Anytime**: Click "Cancel Download" if needed

### Settings Options

Click the ⚙️ settings icon to configure:

- **Proxy Server**: Route downloads through a custom proxy (e.g., `http://proxy.example.com:8080`)
- **Preferred Formats**: Choose which formats to display in the table
  - ✓ MP4 (Video)
  - ✓ WebM (Video)
  - ✓ M4A (Audio)
  - ✓ MP3 (Audio)
- **Auto-fetch Metadata**: Toggle automatic video information retrieval (disabled by default)

### Progress Information

During download, you'll see:
```
Downloading format 137                              45.5%
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░

45.32 MB / 123.45 MB    ↓ 2.5 MB/s      ETA: 00:31

[Cancel Download]
```

## 📁 Project Structure

```
yt-downloader-nextjs/
├── app/
│   ├── api/
│   │   ├── download-stream/route.ts # Real-time download with SSE
│   │   ├── formats/route.ts         # Format listing with file sizes
│   │   └── metadata/route.ts        # Video metadata endpoint
│   ├── globals.css                  # Global styles + custom scrollbar
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main page component
├── components/
│   ├── FormatsTable.tsx             # Format list with filtering/sorting
│   ├── ProgressBar.tsx              # Real-time progress indicator
│   ├── SettingsModal.tsx            # Settings configuration UI
│   └── VideoCard.tsx                # Video metadata display
├── hooks/
│   └── useSettings.ts               # Settings management hook
└── lib/
    └── types.ts                     # TypeScript type definitions
```

## 🔌 API Endpoints

### `GET /api/metadata`
Fetch video metadata (thumbnail, title, duration, etc.)

**Query Parameters:**
- `url`: YouTube video URL (required)

**Returns:**
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": 213,
  "uploader": "Channel Name",
  "viewCount": 1234567,
  "uploadDate": "20240101"
}
```

### `GET /api/formats`
List available download formats with file sizes

**Query Parameters:**
- `url`: YouTube video URL (required)

**Returns:**
```json
{
  "formats": [
    {
      "line": "137 mp4 1920x1080 ...",
      "id": "137",
      "ext": "mp4",
      "resolution": "1920x1080",
      "filesize": 129499136
    }
  ]
}
```

### `POST /api/download-stream`
Download video with real-time progress updates via Server-Sent Events (SSE)

**Request Body:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "format": "137",
  "proxy": "http://proxy.example.com:8080" // optional
}
```

**Response:** SSE Stream with events:

**Progress Event:**
```json
{
  "type": "progress",
  "percent": 45.5,
  "downloadedBytes": 47532032,
  "totalBytes": 129499136,
  "speed": "2.5 MB/s",
  "eta": "00:31"
}
```

**Complete Event:**
```json
{
  "type": "complete",
  "percent": 100,
  "filename": "download-137.mp4"
}
```

**File Data Event:**
```json
{
  "type": "file",
  "data": "base64-encoded-file-data",
  "filename": "download-137.mp4",
  "contentType": "video/mp4"
}
```

**Error Event:**
```json
{
  "type": "error",
  "error": "Error message"
}
```

**Limits:**
- Max file size: 2GB
- Timeout: 5 minutes
- Files >100MB: Streamed for memory efficiency

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| **Command Injection Prevention** | Uses `execFile()` with array arguments instead of shell commands |
| **URL Validation** | Only accepts valid YouTube URLs (youtube.com, youtu.be) |
| **Timeout Protection** | 30s for metadata/formats, 5min for downloads |
| **Secure File Handling** | Cryptographically random temp filenames with immediate cleanup |
| **Size Limits** | 2GB maximum to prevent abuse and resource exhaustion |
| **Process Management** | Proper cleanup of yt-dlp processes on cancel/error |
| **Input Sanitization** | URL encoding and validation throughout |
| **Error Boundaries** | Graceful handling of all failure cases |

## ⚡ Performance Optimizations

| Optimization | Description |
|--------------|-------------|
| **Smart Streaming** | Files >100MB streamed chunk-by-chunk (no memory limits) |
| **Buffer Mode** | Files <100MB loaded into buffer (faster) |
| **Memoized Components** | Efficient re-rendering with `useMemo` |
| **Debounced Metadata** | Prevents excessive API calls (500ms delay) |
| **Client-side Filtering** | Fast format filtering and sorting |
| **Optimized Parsing** | Efficient format string parsing with regex |
| **SSE Throttling** | Progress updates sent only on 1% changes |
| **Auto Cleanup** | Immediate temp file deletion after download |

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router and Server Components |
| **TypeScript 5** | Type-safe development with full IDE support |
| **Tailwind CSS 4** | Modern utility-first CSS framework |
| **yt-dlp** | Powerful YouTube download backend |
| **Server-Sent Events** | Real-time progress updates from server to client |
| **React Hooks** | Modern React patterns (useState, useEffect, useRef) |
| **LocalStorage** | Persistent settings storage |

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Network Connection Error (WinError 10061)

If you see "No connection could be made because the target machine actively refused it":

**Common Causes:**
- Firewall blocking yt-dlp
- Antivirus software blocking connections
- VPN/Proxy interfering with connections
- Corporate network restrictions

**Solutions:**

1. **Check Firewall:**
   - Windows: Allow yt-dlp through Windows Firewall
   - Add exception for yt-dlp.exe

2. **Antivirus:**
   - Temporarily disable antivirus to test
   - Add yt-dlp to antivirus whitelist

3. **Use Proxy:**
   - Click the settings icon (gear)
   - Enter your proxy URL (e.g., `http://proxy.example.com:8080`)
   - Save settings and try again

4. **Update yt-dlp:**
   ```bash
   yt-dlp -U
   # or
   pip install --upgrade yt-dlp
   ```

5. **Test yt-dlp directly:**
   ```bash
   yt-dlp --dump-json --no-playlist https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```
   If this fails, it's a yt-dlp/network issue, not the app.

### Metadata Not Loading

The video preview feature is optional. If it doesn't work:
- The app will still function normally for downloads
- You can disable auto-fetch in Settings
- Use the "Preview" button manually when needed

## Contributing

Contributions are welcome! Please ensure all changes maintain security best practices and include proper error handling.
