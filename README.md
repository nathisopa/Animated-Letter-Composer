# AniType - Animated Letter Composer

Professional text animation tool with embedded FFmpeg. Create stunning animated text sequences with ProRes 4444, WebM, HEVC, and DXV export.

## Features

✅ **Multi-line text support** with automatic alignment
✅ **Font pack system** - Organize letters in folders with variations  
✅ **Stagger timing** - Letters animate in sequence  
✅ **Auto FPS detection** from source clips  
✅ **Professional codecs**:
  - WebM (VP9 with alpha)
  - ProRes 4444 (max quality)
  - HEVC (H.265 with alpha)
  - DXV (optimized for Resolume)
✅ **Embedded FFmpeg** - No system installation required  
✅ **Cross-platform** - Windows, macOS, Linux

---

## Installation

### 1. Clone/Download this repository

```bash
git clone https://github.com/yourusername/anitype.git
cd anitype
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download FFmpeg binaries

You need to download FFmpeg static builds for each platform you want to support:

#### 🪟 Windows
- Download: [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
- Get: **ffmpeg-release-essentials.zip**
- Extract `bin/ffmpeg.exe`
- Place at: `ffmpeg/win/ffmpeg.exe`

#### 🍎 macOS
- Download: [https://evermeet.cx/ffmpeg/](https://evermeet.cx/ffmpeg/)
- Get: **Universal build** (Intel + Apple Silicon)
- Place at: `ffmpeg/mac/ffmpeg`
- Make executable: `chmod +x ffmpeg/mac/ffmpeg`

#### 🐧 Linux
- Download: [https://johnvansickle.com/ffmpeg/](https://johnvansickle.com/ffmpeg/)
- Get: **Static build**
- Place at: `ffmpeg/linux/ffmpeg`
- Make executable: `chmod +x ffmpeg/linux/ffmpeg`

### 4. Verify FFmpeg structure

Your project should look like this:

```
anitype/
├── ffmpeg/
│   ├── win/
│   │   └── ffmpeg.exe
│   ├── mac/
│   │   └── ffmpeg
│   └── linux/
│       └── ffmpeg
├── renderer/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── main.js
├── preload.js
└── package.json
```

---

## Running the App

### Development mode

```bash
npm start
```

Or with DevTools:

```bash
npm run dev
```

### Build for production

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Built apps will be in the `dist/` folder.

---

## Usage

### 1. Load Letter Assets

Click **"Drop files or folders here"** and select:

- **PNG sequences** - Name like `A_001.png`, `A_002.png`, `A_003.png`
- **WebM videos** - Name like `A.webm`, `B.webm` (with alpha channel)
- **Font packs** - Organize in folders:
  ```
  MyFont/
    Regular/
      A_001.png, B_001.png, ...
    Bold/
      A_001.png, B_001.png, ...
  ```

### 2. Type Your Text

Enter text in the **Text Content** field. Use Enter for multiple lines.

### 3. Adjust Settings

**Animation Timing:**
- **Simultaneous** - All letters start together
- **Stagger** - Letters animate in sequence

**Duration Mode:**
- **Auto (Longest)** - Uses longest clip duration
- **Custom** - Set specific duration in seconds or frames

**Layout & Spacing:**
- Adjust letter spacing, line spacing, and alignment

### 4. Preview

Click **▶ Play** to preview the animation.

### 5. Export

Click one of the export buttons:
- **💾 Export WebM** - VP9 with alpha, good compression
- **💾 Export ProRes** - ProRes 4444, professional quality
- **💾 Export HEVC** - H.265 with alpha, modern codec
- **💾 Export DXV** - Optimized for Resolume playback

Progress bar shows:
1. Rendering frames (0-30%)
2. Writing to disk (30-55%)
3. FFmpeg encoding (55-90%)
4. Cleanup (90-100%)

---

## File Naming Conventions

### PNG Sequences
- Format: `LETTER_FRAMENUMBER.png`
- Examples: `A_001.png`, `A_002.png`, `A_010.png`
- Numbers can start at any value, will be sorted automatically

### Videos
- Format: `LETTER.webm`
- Examples: `A.webm`, `B.webm`, `Z.webm`

### Font Packs
```
FontName/
  ├── Variant1/
  │   ├── A_001.png
  │   └── B_001.png
  └── Variant2/
      ├── A_001.png
      └── B_001.png
```

---

## Export Formats

### WebM (VP9)
- **Alpha channel**: ✅ Yes
- **Compression**: Good (visually lossless)
- **Browser support**: Chrome, Firefox, Edge
- **Use for**: Web playback, social media

### ProRes 4444
- **Alpha channel**: ✅ Yes
- **Compression**: Visually lossless
- **File size**: Large
- **Use for**: Professional editing (Premiere, Final Cut, DaVinci)

### HEVC (H.265)
- **Alpha channel**: ✅ Yes
- **Compression**: Excellent
- **File size**: Small
- **Use for**: Modern devices, efficient storage

### DXV
- **Alpha channel**: ✅ Yes (BGRA)
- **Compression**: Hardware accelerated
- **Use for**: Resolume, live VJ performance

---

## Keyboard Shortcuts

- `Cmd/Ctrl + O` - Open files
- `Space` - Play/Stop preview
- `Cmd/Ctrl + E` - Export (prompts for format)

---

## Troubleshooting

### FFmpeg not found
- Verify FFmpeg binaries are in the correct location
- Check permissions: `chmod +x ffmpeg/mac/ffmpeg` (macOS/Linux)
- Run `npm start` and check console for errors

### Export fails
- Ensure you have write permissions to the export directory
- Check FFmpeg status in Export Info section
- Try a different export format

### Video files won't load
- Only WebM format is supported for video input
- MOV files should be converted to WebM first
- Use PNG sequences as an alternative

### macOS security warning
- Right-click the app → Open (first time only)
- Or: System Preferences → Security → Allow

---

## License

MIT License - see LICENSE file

**FFmpeg Licensing**: This app ships with FFmpeg binaries under the LGPL license. See [FFmpeg.org](https://ffmpeg.org/legal.html) for details.

---

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [FFmpeg](https://ffmpeg.org/)

---

## Support

For issues or questions:
- Open an issue on GitHub
- Check console logs (`Cmd/Ctrl + Shift + I`)
- Verify FFmpeg status in Export Info

---

## Roadmap

- [ ] GPU encoder detection
- [ ] Real-time FFmpeg progress parsing
- [ ] Encoder preset profiles
- [ ] Batch export multiple texts
- [ ] macOS notarization
- [ ] Auto-updater