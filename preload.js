const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  selectExportDirectory: () => ipcRenderer.invoke('select-export-directory'),
  createTempDir: () => ipcRenderer.invoke('create-temp-dir'),
  cleanupTempDir: (tempDir) => ipcRenderer.invoke('cleanup-temp-dir', tempDir),
  writeFrame: (frameNumber, dataUrl, tempDir) => 
    ipcRenderer.invoke('write-frame', { frameNumber, dataUrl, tempDir }),
  
  // FFmpeg exports
  exportWebM: (tempDir, outputPath, fps) => 
    ipcRenderer.invoke('export-webm', { tempDir, outputPath, fps }),
  exportProRes: (tempDir, outputPath, fps) => 
    ipcRenderer.invoke('export-prores', { tempDir, outputPath, fps }),
  exportHEVC: (tempDir, outputPath, fps) => 
    ipcRenderer.invoke('export-hevc', { tempDir, outputPath, fps }),
  exportDXV: (tempDir, outputPath, fps) => 
    ipcRenderer.invoke('export-dxv', { tempDir, outputPath, fps }),
  
  // FFmpeg check
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  
  // Platform info
  platform: process.platform
});