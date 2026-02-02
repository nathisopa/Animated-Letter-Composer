const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

let mainWindow;

// ========================================
// FFMPEG PATH RESOLVER
// ========================================
function getFFmpegPath() {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg')
    : path.join(__dirname, 'ffmpeg');

  const platform = os.platform();

  if (platform === 'win32') return path.join(base, 'win', 'ffmpeg.exe');
  if (platform === 'darwin') return path.join(base, 'mac', 'ffmpeg');
  return path.join(base, 'linux', 'ffmpeg');
}

// ========================================
// CREATE WINDOW
// ========================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ========================================
// APP LIFECYCLE
// ========================================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ========================================
// IPC HANDLERS - FILE OPERATIONS
// ========================================

// Select export directory
ipcMain.handle('select-export-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Write frame to disk
ipcMain.handle('write-frame', async (event, { frameNumber, dataUrl, tempDir }) => {
  try {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const framePath = path.join(tempDir, `frame_${String(frameNumber).padStart(5, '0')}.png`);
    
    await fs.writeFile(framePath, buffer);
    return { success: true, path: framePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create temp directory
ipcMain.handle('create-temp-dir', async () => {
  const tempDir = path.join(app.getPath('temp'), `anitype_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
});

// Cleanup temp directory
ipcMain.handle('cleanup-temp-dir', async (event, tempDir) => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========================================
// IPC HANDLERS - FFMPEG EXPORTS
// ========================================

// Export WebM (VP9 with alpha)
ipcMain.handle('export-webm', async (event, { tempDir, outputPath, fps }) => {
  const ffmpegPath = getFFmpegPath();
  
  try {
    // Verify FFmpeg exists
    await fs.access(ffmpegPath);
  } catch (error) {
    return { 
      success: false, 
      error: `FFmpeg not found at ${ffmpegPath}. Please ensure FFmpeg binaries are installed.` 
    };
  }
  
  const inputPattern = path.join(tempDir, 'frame_%05d.png');
  
  const command = `"${ffmpegPath}" -y -framerate ${fps} -i "${inputPattern}" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 \
    -progress pipe:1 \
    "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: outputPath };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
});

// Export ProRes 4444
ipcMain.handle('export-prores', async (event, { tempDir, outputPath, fps }) => {
  const ffmpegPath = getFFmpegPath();
  
  try {
    await fs.access(ffmpegPath);
  } catch (error) {
    return { 
      success: false, 
      error: `FFmpeg not found at ${ffmpegPath}. Please ensure FFmpeg binaries are installed.` 
    };
  }
  
  const inputPattern = path.join(tempDir, 'frame_%05d.png');
  
  const command = `"${ffmpegPath}" -y -framerate ${fps} -i "${inputPattern}" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 \
    -progress pipe:1 \
    "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: outputPath };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
});

// Export HEVC with alpha
ipcMain.handle('export-hevc', async (event, { tempDir, outputPath, fps }) => {
  const ffmpegPath = getFFmpegPath();
  
  try {
    await fs.access(ffmpegPath);
  } catch (error) {
    return { 
      success: false, 
      error: `FFmpeg not found at ${ffmpegPath}. Please ensure FFmpeg binaries are installed.` 
    };
  }
  
  const inputPattern = path.join(tempDir, 'frame_%05d.png');
  
  const command = `"${ffmpegPath}" -y -framerate ${fps} -i "${inputPattern}" \
    -c:v libx265 -vtag hvc1 -pix_fmt yuva420p -crf 18 \
    -progress pipe:1 \
    "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: outputPath };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
});

// Export DXV (for Resolume)
ipcMain.handle('export-dxv', async (event, { tempDir, outputPath, fps }) => {
  const ffmpegPath = getFFmpegPath();
  
  try {
    await fs.access(ffmpegPath);
  } catch (error) {
    return { 
      success: false, 
      error: `FFmpeg not found at ${ffmpegPath}. Please ensure FFmpeg binaries are installed.` 
    };
  }
  
  const inputPattern = path.join(tempDir, 'frame_%05d.png');
  
  // DXV3 is the alpha-supporting variant
  const command = `"${ffmpegPath}" -y -framerate ${fps} -i "${inputPattern}" \
    -c:v dxv -pix_fmt bgra \
    -progress pipe:1 \
    "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: outputPath };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
});

// Check FFmpeg availability
ipcMain.handle('check-ffmpeg', async () => {
  const ffmpegPath = getFFmpegPath();
  
  try {
    await fs.access(ffmpegPath);
    
    // Try to get version
    const { stdout } = await execAsync(`"${ffmpegPath}" -version`);
    const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    return { 
      available: true, 
      path: ffmpegPath,
      version: version
    };
  } catch (error) {
    return { 
      available: false, 
      path: ffmpegPath,
      error: error.message 
    };
  }
});

// ========================================
// ERROR HANDLING
// ========================================
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});