// ========================================
// STATE
// ========================================
const state = {
  library: {},
  fontPacks: {},
  activeFontPack: null,
  text: 'AniType',
  spacing: 12,
  lineSpacing: 24,
  charSpacing: 0,
  fps: 30,
  alignment: 'center',
  timingMode: 'simultaneous',
  staggerFrames: 6,
  durationMode: 'auto',
  customDurationValue: 1,
  durationUnit: 'seconds',
  letterDuration: 24,
  holdLastFrame: true,
  playing: false,
  globalFrame: 0,
  lastImportPath: localStorage.getItem('lastImportPath') || '',
  exportDirectory: localStorage.getItem('exportDirectory') || null
};

const kerning = { "AV": -20, "WA": -15, "To": -10, "Ty": -8, "Yo": -8 };

let rafId = null;

// ========================================
// DOM ELEMENTS
// ========================================
const elements = {
  fileInput: document.getElementById('file-input'),
  textInput: document.getElementById('text-input'),
  canvas: document.getElementById('canvas'),
  playBtn: document.getElementById('play-btn'),
  resetBtn: document.getElementById('reset-btn'),
  exportWebMBtn: document.getElementById('export-webm-btn'),
  exportProResBtn: document.getElementById('export-prores-btn'),
  exportHEVCBtn: document.getElementById('export-hevc-btn'),
  exportDXVBtn: document.getElementById('export-dxv-btn'),
  
  // Settings
  timingMode: document.getElementById('timing-mode'),
  staggerFrames: document.getElementById('stagger-frames'),
  durationMode: document.getElementById('duration-mode'),
  customDurationValue: document.getElementById('custom-duration-value'),
  durationUnit: document.getElementById('duration-unit'),
  letterDuration: document.getElementById('letter-duration'),
  customDurationGroup: document.getElementById('custom-duration-group'),
  fps: document.getElementById('fps'),
  fpsSourceInfo: document.getElementById('fps-source-info'),
  holdLastFrame: document.getElementById('hold-last-frame'),
  alignment: document.getElementById('alignment'),
  spacing: document.getElementById('spacing'),
  charSpacing: document.getElementById('char-spacing'),
  lineSpacing: document.getElementById('line-spacing'),
  
  // UI Elements
  uploadProgress: document.getElementById('upload-progress'),
  progressCurrent: document.getElementById('progress-current'),
  progressTotal: document.getElementById('progress-total'),
  progressBar: document.getElementById('progress-bar'),
  fontPacksDisplay: document.getElementById('font-packs-display'),
  fontPacksList: document.getElementById('font-packs-list'),
  libraryDisplay: document.getElementById('library-display'),
  libraryCount: document.getElementById('library-count'),
  libraryLetters: document.getElementById('library-letters'),
  canvasContainer: document.getElementById('canvas-container'),
  emptyState: document.getElementById('empty-state'),
  statusText: document.getElementById('status-text'),
  playingIndicator: document.getElementById('playing-indicator'),
  playIcon: document.getElementById('play-icon'),
  playText: document.getElementById('play-text'),
  ffmpegStatusText: document.getElementById('ffmpeg-status-text'),
  
  // Export Progress
  exportProgress: document.getElementById('export-progress'),
  exportStatus: document.getElementById('export-status'),
  exportPercent: document.getElementById('export-percent'),
  exportProgressBar: document.getElementById('export-progress-bar')
};

// ========================================
// FFMPEG CHECK
// ========================================
async function checkFFmpegStatus() {
  if (!window.electronAPI) {
    elements.ffmpegStatusText.textContent = '⚠️ Running in browser mode - FFmpeg not available';
    elements.ffmpegStatusText.style.color = '#f59e0b';
    return;
  }
  
  try {
    const result = await window.electronAPI.checkFFmpeg();
    
    if (result.available) {
      elements.ffmpegStatusText.textContent = `✅ FFmpeg ${result.version} ready`;
      elements.ffmpegStatusText.style.color = '#10b981';
    } else {
      elements.ffmpegStatusText.textContent = `❌ FFmpeg not found: ${result.error}`;
      elements.ffmpegStatusText.style.color = '#ef4444';
    }
  } catch (error) {
    elements.ffmpegStatusText.textContent = `❌ Error checking FFmpeg: ${error.message}`;
    elements.ffmpegStatusText.style.color = '#ef4444';
  }
}

// ========================================
// FPS DETECTION
// ========================================
function detectFPS() {
  let detectedFPS = null;
  
  for (const letter in state.library) {
    const data = state.library[letter];
    
    if (data.type === 'video' && data.video && data.duration) {
      const calculatedFPS = Math.round(data.frameCount / data.duration);
      if (calculatedFPS > 0 && calculatedFPS <= 120) {
        detectedFPS = calculatedFPS;
        break;
      }
    } else if (data.type === 'sequence' && data.frameCount > 1) {
      if (data.frameCount >= 24) {
        detectedFPS = 24;
      } else if (data.frameCount >= 12) {
        detectedFPS = 12;
      }
    }
  }
  
  if (detectedFPS && detectedFPS !== state.fps) {
    state.fps = detectedFPS;
    elements.fps.value = detectedFPS;
    elements.fpsSourceInfo.textContent = `Auto-detected: ${detectedFPS} FPS from clips`;
    
    for (const letter in state.library) {
      const data = state.library[letter];
      if (data.type === 'video' && data.duration) {
        data.frameCount = Math.floor(data.duration * state.fps);
      }
    }
  } else if (!detectedFPS) {
    elements.fpsSourceInfo.textContent = `Default: ${state.fps} FPS`;
  }
}

// ========================================
// FILE UPLOAD & FONT PACKS
// ========================================
function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  if (files[0].webkitRelativePath) {
    const path = files[0].webkitRelativePath.split('/')[0];
    state.lastImportPath = path;
    localStorage.setItem('lastImportPath', path);
  }

  const fontPacks = {};
  const looseFiles = [];

  files.forEach(file => {
    const parts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];
    
    if (parts.length >= 2) {
      const packName = parts[0];
      const variant = parts.length > 2 ? parts[1] : 'default';
      
      if (!fontPacks[packName]) {
        fontPacks[packName] = {};
      }
      if (!fontPacks[packName][variant]) {
        fontPacks[packName][variant] = [];
      }
      fontPacks[packName][variant].push(file);
    } else {
      looseFiles.push(file);
    }
  });

  if (Object.keys(fontPacks).length > 0) {
    state.fontPacks = fontPacks;
    displayFontPacks();
    
    const firstPack = Object.keys(fontPacks)[0];
    const firstVariant = Object.keys(fontPacks[firstPack])[0];
    loadFontPackVariant(firstPack, firstVariant);
  } else if (looseFiles.length > 0) {
    loadFiles(looseFiles);
  }
}

function displayFontPacks() {
  elements.fontPacksDisplay.classList.remove('hidden');
  elements.fontPacksList.innerHTML = '';
  
  Object.entries(state.fontPacks).forEach(([packName, variants]) => {
    const packItem = document.createElement('div');
    packItem.className = 'font-pack-item';
    
    const variantNames = Object.keys(variants).join(', ');
    packItem.innerHTML = `
      <div class="font-pack-name">${packName}</div>
      <div class="font-pack-variants">${Object.keys(variants).length} variant(s): ${variantNames}</div>
    `;
    
    packItem.addEventListener('click', () => {
      const firstVariant = Object.keys(variants)[0];
      loadFontPackVariant(packName, firstVariant);
      
      document.querySelectorAll('.font-pack-item').forEach(el => el.classList.remove('active'));
      packItem.classList.add('active');
    });
    
    elements.fontPacksList.appendChild(packItem);
  });
  
  elements.fontPacksList.firstChild?.classList.add('active');
}

function loadFontPackVariant(packName, variant) {
  const files = state.fontPacks[packName][variant];
  state.activeFontPack = { pack: packName, variant };
  loadFiles(files);
}

function loadFiles(files) {
  showUploadProgress(0, files.length);

  const pngGroups = {};
  let done = 0;

  const tick = () => {
    done++;
    showUploadProgress(done, files.length);
    if (done === files.length) {
      setTimeout(hideUploadProgress, 500);
    }
  };

  state.library = {};

  files.forEach(file => {
    const fileName = file.name;
    const match = fileName.match(/^(.+?)_(\d+)\.(png|jpg|jpeg)$/i);
    
    if (match) {
      const letter = match[1].toUpperCase();
      if (!pngGroups[letter]) pngGroups[letter] = [];
      pngGroups[letter].push({ file, idx: +match[2] });
    } else if (file.type.startsWith('video/')) {
      const letter = fileName[0].toUpperCase();
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        state.library[letter] = {
          type: 'video',
          video: video,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          baseline: Math.floor(video.videoHeight * 0.8),
          frameCount: Math.floor(video.duration * state.fps),
          url: url
        };
        updateLibraryDisplay();
        tick();
      };
      
      video.onerror = () => tick();
      video.src = url;
      video.load();
    } else {
      const letter = fileName[0].toUpperCase();
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        state.library[letter] = {
          type: 'sequence',
          frames: [img],
          frameCount: 1,
          width: img.width,
          height: img.height,
          baseline: Math.floor(img.height * 0.8)
        };
        updateLibraryDisplay();
        tick();
      };
      
      img.onerror = () => tick();
      img.src = url;
    }
  });

  Object.entries(pngGroups).forEach(([letter, frames]) => {
    frames.sort((a, b) => a.idx - b.idx);
    const imgs = [];
    let loaded = 0;

    frames.forEach((frame, i) => {
      const url = URL.createObjectURL(frame.file);
      const img = new Image();
      
      img.onload = () => {
        imgs[i] = img;
        loaded++;
        
        if (i === 0) tick();
        
        if (loaded === frames.length) {
          state.library[letter] = {
            type: 'sequence',
            frames: imgs,
            frameCount: imgs.length,
            width: img.width,
            height: img.height,
            baseline: Math.floor(img.height * 0.8)
          };
          updateLibraryDisplay();
        }
      };
      
      img.src = url;
    });
  });
}

function showUploadProgress(current, total) {
  elements.uploadProgress.classList.remove('hidden');
  elements.progressCurrent.textContent = current;
  elements.progressTotal.textContent = total;
  elements.progressBar.style.width = `${(current / total) * 100}%`;
}

function hideUploadProgress() {
  elements.uploadProgress.classList.add('hidden');
}

function updateLibraryDisplay() {
  const count = Object.keys(state.library).length;
  elements.libraryCount.textContent = count;
  
  if (count > 0) {
    elements.libraryDisplay.classList.remove('hidden');
    elements.libraryLetters.innerHTML = '';
    
    Object.keys(state.library).sort().forEach(letter => {
      const badge = document.createElement('div');
      badge.className = 'letter-badge';
      badge.textContent = letter;
      elements.libraryLetters.appendChild(badge);
    });
  }
  
  detectFPS();
  renderFrame();
  updateUI();
}

// ========================================
// DURATION CALCULATION
// ========================================
function getMaxDuration() {
  if (state.durationMode === 'custom') {
    if (state.durationUnit === 'seconds') {
      return Math.round(state.customDurationValue * state.fps);
    } else {
      return state.customDurationValue;
    }
  }
  
  const lines = getLines();
  let maxFrames = 0;
  
  lines.forEach(line => {
    line.forEach(letter => {
      const data = state.library[letter];
      if (data) {
        maxFrames = Math.max(maxFrames, data.frameCount);
      }
    });
  });
  
  return maxFrames || 24;
}

// ========================================
// RENDERING
// ========================================
function getLines() {
  return state.text
    .toUpperCase()
    .split('\n')
    .map(line => line.split('').filter(char => state.library[char]));
}

function renderFrame(frameNum = state.globalFrame) {
  const canvas = elements.canvas;
  const lines = getLines();
  
  if (!lines.some(line => line.length > 0)) {
    elements.canvasContainer.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.canvasContainer.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  
  let maxWidth = 0;
  let totalHeight = 0;

  lines.forEach((line, lineIndex) => {
    if (!line.length) return;
    
    const lineHeight = Math.max(...line.map(l => state.library[l].height));
    let lineWidth = 0;
    
    line.forEach((l, i) => {
      const kerningAdjust = (kerning[l + line[i + 1]] || 0);
      lineWidth += state.library[l].width + (i < line.length - 1 ? state.spacing + state.charSpacing + kerningAdjust : 0);
    });
    
    maxWidth = Math.max(maxWidth, lineWidth);
    totalHeight += lineHeight + (lineIndex < lines.length - 1 ? state.lineSpacing : 0);
  });

  canvas.width = Math.max(maxWidth + 100, 800);
  canvas.height = Math.max(totalHeight + 100, 400);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let yCursor = 50;
  const maxDuration = getMaxDuration();

  lines.forEach((line, lineIndex) => {
    if (!line.length) return;

    const lineHeight = Math.max(...line.map(l => state.library[l].height));
    
    let lineWidth = 0;
    line.forEach((l, i) => {
      const kerningAdjust = (kerning[l + line[i + 1]] || 0);
      lineWidth += state.library[l].width + (i < line.length - 1 ? state.spacing + state.charSpacing + kerningAdjust : 0);
    });

    let x = state.alignment === 'center' ? (canvas.width - lineWidth) / 2 : 50;

    line.forEach((letter, letterIndex) => {
      const data = state.library[letter];
      if (!data) return;

      const globalIndex = lineIndex * 100 + letterIndex;
      const stagger = state.timingMode === 'stagger' ? globalIndex * state.staggerFrames : 0;
      const localFrame = frameNum - stagger;

      let frameIndex;
      if (localFrame < 0) {
        frameIndex = 0;
      } else if (localFrame >= maxDuration && state.holdLastFrame) {
        frameIndex = data.frameCount - 1;
      } else if (localFrame >= 0) {
        frameIndex = localFrame % data.frameCount;
      } else {
        frameIndex = 0;
      }

      if (data.type === 'video') {
        const videoTime = (frameIndex / state.fps);
        if (data.video.currentTime !== videoTime) {
          data.video.currentTime = videoTime % data.duration;
        }
        
        const y = state.alignment === 'baseline' 
          ? yCursor + lineHeight - data.height
          : yCursor + (lineHeight - data.height) / 2;
        
        ctx.drawImage(data.video, x, y);
      } else {
        const img = data.frames[frameIndex];
        if (!img) return;
        
        const y = state.alignment === 'baseline'
          ? yCursor + lineHeight - data.height
          : yCursor + (lineHeight - data.height) / 2;
        
        ctx.drawImage(img, x, y);
      }

      const kerningAdjust = (kerning[letter + line[letterIndex + 1]] || 0);
      x += data.width + state.spacing + state.charSpacing + kerningAdjust;
    });

    yCursor += lineHeight + state.lineSpacing;
  });
}

// ========================================
// PLAYBACK
// ========================================
function togglePlay() {
  if (state.playing) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  Object.values(state.library).forEach(data => {
    if (data.type === 'video' && data.video) {
      data.video.currentTime = 0;
      data.video.play().catch(() => {});
    }
  });

  state.playing = true;
  state.globalFrame = 0;
  
  elements.playIcon.textContent = '⏹';
  elements.playText.textContent = 'Stop';
  elements.playingIndicator.classList.remove('hidden');

  function loop() {
    state.globalFrame++;
    renderFrame(state.globalFrame);
    updateStatusBar();
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
}

function stopPlayback() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  Object.values(state.library).forEach(data => {
    if (data.type === 'video' && data.video) {
      data.video.pause();
    }
  });

  state.playing = false;
  elements.playIcon.textContent = '▶';
  elements.playText.textContent = 'Play';
  elements.playingIndicator.classList.add('hidden');
}

function resetPlayback() {
  stopPlayback();
  state.globalFrame = 0;
  renderFrame(0);
  updateStatusBar();
}

// ========================================
// EXPORT - UNIFIED PIPELINE
// ========================================
const usedFilenames = new Set();

function sanitizeFilename(text) {
  return text
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\n/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 100) || 'animated_text';
}

function getUniqueFilename(baseName, extension) {
  let filename = `${baseName}.${extension}`;
  let counter = 1;
  
  while (usedFilenames.has(filename)) {
    filename = `${baseName}_${counter}.${extension}`;
    counter++;
  }
  
  usedFilenames.add(filename);
  return filename;
}

function showExportProgress(percent, status = 'Exporting...') {
  elements.exportProgress.classList.remove('hidden');
  elements.exportStatus.textContent = status;
  elements.exportPercent.textContent = `${Math.round(percent)}%`;
  elements.exportProgressBar.style.width = `${percent}%`;
}

function hideExportProgress() {
  setTimeout(() => {
    elements.exportProgress.classList.add('hidden');
  }, 1000);
}

// Render all frames to data URLs
async function renderAllFrames() {
  const lines = getLines();
  const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
  const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
  const maxDuration = getMaxDuration();
  const totalFrames = maxStagger + maxDuration;

  const frames = [];
  
  for (let i = 0; i < totalFrames; i++) {
    renderFrame(i);
    const dataUrl = elements.canvas.toDataURL('image/png');
    frames.push(dataUrl);
    
    const progress = ((i + 1) / totalFrames) * 30; // 0-30% for rendering
    showExportProgress(progress, `Rendering frame ${i + 1}/${totalFrames}...`);
    
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return frames;
}

// Select export location
async function selectExportLocation(defaultName, extension) {
  if (!window.electronAPI) {
    alert('Export requires Electron app. Please run as desktop application.');
    return null;
  }
  
  const directory = await window.electronAPI.selectExportDirectory();
  if (!directory) return null;
  
  state.exportDirectory = directory;
  localStorage.setItem('exportDirectory', directory);
  
  const baseName = sanitizeFilename(state.text);
  const filename = getUniqueFilename(baseName, extension);
  
  return `${directory}/${filename}`;
}

// Generic export function
async function exportWithFormat(format, extension, exportFunction) {
  if (!window.electronAPI) {
    alert('Export requires Electron app. Please run as desktop application.');
    return;
  }
  
  try {
    showExportProgress(0, 'Preparing export...');
    
    // Select output location
    const outputPath = await selectExportLocation(state.text, extension);
    if (!outputPath) {
      hideExportProgress();
      return;
    }
    
    // Render frames
    const frames = await renderAllFrames();
    
    showExportProgress(30, 'Creating temp directory...');
    
    // Create temp directory
    const tempDir = await window.electronAPI.createTempDir();
    
    showExportProgress(35, 'Writing frames to disk...');
    
    // Write frames to temp directory
    for (let i = 0; i < frames.length; i++) {
      await window.electronAPI.writeFrame(i, frames[i], tempDir);
      
      if (i % 10 === 0) {
        const progress = 35 + ((i / frames.length) * 20); // 35-55% for writing
        showExportProgress(progress, `Writing frame ${i + 1}/${frames.length}...`);
      }
    }
    
    showExportProgress(55, `Encoding ${format}...`);
    
    // Call FFmpeg export
    const result = await exportFunction(tempDir, outputPath, state.fps);
    
    if (result.success) {
      showExportProgress(90, 'Cleaning up...');
      await window.electronAPI.cleanupTempDir(tempDir);
      
      showExportProgress(100, 'Complete!');
      hideExportProgress();
      
      alert(`${format} export complete!\n\nSaved to: ${result.output}`);
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error(`${format} export failed:`, error);
    alert(`${format} export failed: ${error.message}`);
    hideExportProgress();
  }
}

// Export functions
async function exportWebM() {
  await exportWithFormat('WebM', 'webm', window.electronAPI.exportWebM);
}

async function exportProRes() {
  await exportWithFormat('ProRes 4444', 'mov', window.electronAPI.exportProRes);
}

async function exportHEVC() {
  await exportWithFormat('HEVC', 'mov', window.electronAPI.exportHEVC);
}

async function exportDXV() {
  await exportWithFormat('DXV', 'mov', window.electronAPI.exportDXV);
}

// ========================================
// UI UPDATES
// ========================================
function updateUI() {
  const hasContent = getLines().some(line => line.length > 0);
  
  elements.playBtn.disabled = !hasContent;
  elements.resetBtn.disabled = !hasContent;
  elements.exportWebMBtn.disabled = !hasContent;
  elements.exportProResBtn.disabled = !hasContent;
  elements.exportHEVCBtn.disabled = !hasContent;
  elements.exportDXVBtn.disabled = !hasContent;
  
  updateStatusBar();
}

function updateStatusBar() {
  const hasContent = getLines().some(line => line.length > 0);
  const libraryCount = Object.keys(state.library).length;
  
  if (hasContent) {
    elements.statusText.innerHTML = `
      <span class="status-ready">● Ready</span>
      <span style="margin-left: 1rem">Frame: ${state.globalFrame}</span>
      <span style="margin-left: 1rem">Letters: ${libraryCount}</span>
    `;
  } else {
    elements.statusText.textContent = 'No content - Load letters and enter text';
  }
}

function updateDurationModeUI() {
  if (state.durationMode === 'custom') {
    elements.customDurationGroup.style.display = 'block';
  } else {
    elements.customDurationGroup.style.display = 'none';
  }
  
  const maxDuration = getMaxDuration();
  const seconds = (maxDuration / state.fps).toFixed(2);
  
  if (state.durationMode === 'auto') {
    elements.fpsSourceInfo.textContent = `Auto-detected: ${state.fps} FPS | Duration: ${maxDuration}f (${seconds}s)`;
  }
  
  renderFrame();
}

// ========================================
// SECTION TOGGLE
// ========================================
function setupSectionToggles() {
  const toggleButtons = document.querySelectorAll('.section-toggle');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      const content = document.getElementById(`${section}-section`);
      const icon = button.querySelector('.toggle-icon');
      
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.textContent = '▼';
      } else {
        content.classList.add('hidden');
        icon.textContent = '▶';
      }
    });
  });
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  elements.fileInput.addEventListener('change', handleFileUpload);
  
  elements.textInput.addEventListener('input', (e) => {
    state.text = e.target.value;
    renderFrame();
    updateUI();
  });
  
  elements.playBtn.addEventListener('click', togglePlay);
  elements.resetBtn.addEventListener('click', resetPlayback);
  elements.exportWebMBtn.addEventListener('click', exportWebM);
  elements.exportProResBtn.addEventListener('click', exportProRes);
  elements.exportHEVCBtn.addEventListener('click', exportHEVC);
  elements.exportDXVBtn.addEventListener('click', exportDXV);
  
  elements.timingMode.addEventListener('change', (e) => {
    state.timingMode = e.target.value;
    elements.staggerFrames.disabled = e.target.value === 'simultaneous';
    renderFrame();
  });
  
  elements.staggerFrames.addEventListener('input', (e) => {
    state.staggerFrames = Number(e.target.value);
    renderFrame();
  });
  
  elements.durationMode.addEventListener('change', (e) => {
    state.durationMode = e.target.value;
    updateDurationModeUI();
  });
  
  elements.customDurationValue.addEventListener('input', (e) => {
    state.customDurationValue = Number(e.target.value);
    renderFrame();
  });
  
  elements.durationUnit.addEventListener('change', (e) => {
    state.durationUnit = e.target.value;
    renderFrame();
  });
  
  elements.holdLastFrame.addEventListener('change', (e) => {
    state.holdLastFrame = e.target.checked;
    renderFrame();
  });
  
  elements.alignment.addEventListener('change', (e) => {
    state.alignment = e.target.value;
    renderFrame();
  });
  
  elements.spacing.addEventListener('input', (e) => {
    state.spacing = Number(e.target.value);
    renderFrame();
  });
  
  elements.charSpacing.addEventListener('input', (e) => {
    state.charSpacing = Number(e.target.value);
    renderFrame();
  });
  
  elements.lineSpacing.addEventListener('input', (e) => {
    state.lineSpacing = Number(e.target.value);
    renderFrame();
  });
}

// ========================================
// INITIALIZATION
// ========================================
function init() {
  setupEventListeners();
  setupSectionToggles();
  updateUI();
  updateDurationModeUI();
  checkFFmpegStatus();
}

init();