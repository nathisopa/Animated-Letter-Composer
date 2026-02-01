// ========================================
// FPS DETECTION
// ========================================
function detectFPS() {
  // Check all loaded clips for FPS information
  let detectedFPS = null;
  
  for (const letter in state.library) {
    const data = state.library[letter];
    
    if (data.type === 'video' && data.video && data.duration) {
      // Calculate FPS from video duration and frame count
      const calculatedFPS = Math.round(data.frameCount / data.duration);
      if (calculatedFPS > 0 && calculatedFPS <= 120) {
        detectedFPS = calculatedFPS;
        break;
      }
    } else if (data.type === 'sequence' && data.frameCount > 1) {
      // For PNG sequences, we can't detect FPS, use default or existing
      // But if we have a reasonable number of frames, assume common FPS
      if (data.frameCount >= 24) {
        detectedFPS = 24; // Common animation FPS
      } else if (data.frameCount >= 12) {
        detectedFPS = 12; // Lower FPS animation
      }
    }
  }
  
  if (detectedFPS && detectedFPS !== state.fps) {
    state.fps = detectedFPS;
    elements.fps.value = detectedFPS;
    elements.fpsSourceInfo.textContent = `Auto-detected: ${detectedFPS} FPS from clips`;
    
    // Recalculate frame counts for all videos based on new FPS
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
  exportFormat: 'webm',
  lastImportPath: localStorage.getItem('lastImportPath') || ''
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
  exportBtn: document.getElementById('export-btn'),
  exportPngBtn: document.getElementById('export-png-btn'),
  
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
  exportFormat: document.getElementById('export-format'),
  
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
  exportFormatText: document.getElementById('export-format-text'),
  desktopInfo: document.getElementById('desktop-info'),
  desktopCommand: document.getElementById('desktop-command'),
  
  // Export Progress
  exportProgress: document.getElementById('export-progress'),
  exportStatus: document.getElementById('export-status'),
  exportPercent: document.getElementById('export-percent'),
  exportProgressBar: document.getElementById('export-progress-bar')
};

// ========================================
// BROWSER SUPPORT CHECK
// ========================================
function checkBrowserSupport(format) {
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  
  if (format === 'webm') {
    const supported = MediaRecorder.isTypeSupported('video/webm;codecs=vp9');
    if (!supported) {
      alert('WebM VP9 with alpha is not supported in your browser.\n\nRecommended browsers:\n• Google Chrome\n• Microsoft Edge\n• Firefox\n\nPlease use one of these browsers for WebM export.');
      return false;
    }
  }
  
  if (format === 'hevc' || format === 'prores') {
    alert(`${format === 'hevc' ? 'HEVC' : 'ProRes 4444'} export requires a desktop application with FFmpeg.\n\nThis will export PNG frames that you can then convert using FFmpeg.\n\nFor browser-based export, please use WebM format.`);
  }
  
  return true;
}

// ========================================
// FILE UPLOAD & FONT PACKS
// ========================================
function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  // Remember the path
  if (files[0].webkitRelativePath) {
    const path = files[0].webkitRelativePath.split('/')[0];
    state.lastImportPath = path;
    localStorage.setItem('lastImportPath', path);
  }

  // Organize files into font packs
  const fontPacks = {};
  const looseFiles = [];

  files.forEach(file => {
    const parts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];
    
    if (parts.length >= 2) {
      // File is in a folder structure
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
      // Loose file
      looseFiles.push(file);
    }
  });

  // If we have font packs, display them
  if (Object.keys(fontPacks).length > 0) {
    state.fontPacks = fontPacks;
    displayFontPacks();
    
    // Auto-load first pack's first variant
    const firstPack = Object.keys(fontPacks)[0];
    const firstVariant = Object.keys(fontPacks[firstPack])[0];
    loadFontPackVariant(firstPack, firstVariant);
  } else if (looseFiles.length > 0) {
    // Load loose files directly
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
      
      // Update active state
      document.querySelectorAll('.font-pack-item').forEach(el => el.classList.remove('active'));
      packItem.classList.add('active');
    });
    
    elements.fontPacksList.appendChild(packItem);
  });
  
  // Mark first as active
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

  // Clear existing library
  state.library = {};

  files.forEach(file => {
    const fileName = file.name;
    const match = fileName.match(/^(.+?)_(\d+)\.(png|jpg|jpeg)$/i);
    
    if (match) {
      // PNG sequence
      const letter = match[1].toUpperCase();
      if (!pngGroups[letter]) pngGroups[letter] = [];
      pngGroups[letter].push({ file, idx: +match[2] });
    } else if (file.type.startsWith('video/')) {
      // Video file
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
      // Single image
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

  // Process PNG sequences
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
  
  // Auto-detect FPS from loaded clips
  detectFPS();
  
  renderFrame();
  updateUI();
}

// ========================================
// DURATION CALCULATION
// ========================================
function getMaxDuration() {
  if (state.durationMode === 'custom') {
    // Convert custom duration to frames
    if (state.durationUnit === 'seconds') {
      return Math.round(state.customDurationValue * state.fps);
    } else {
      return state.customDurationValue;
    }
  }
  
  // Auto mode - use longest clip
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
// EXPORT
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

function exportVideo() {
  if (!checkBrowserSupport(state.exportFormat)) {
    return;
  }

  if (state.exportFormat === 'hevc' || state.exportFormat === 'prores') {
    const lines = getLines();
    const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
    const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
    const maxDuration = getMaxDuration();
    const totalFrames = maxStagger + maxDuration;

    const codec = state.exportFormat === 'hevc' ? 'HEVC' : 'ProRes 4444';
    const command = state.exportFormat === 'hevc'
      ? `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v libx265 -vtag hvc1 -pix_fmt yuva420p -crf 18 output.mov`
      : `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 output.mov`;

    alert(
      `${codec} Export Instructions:\n\n` +
      `This will export ${totalFrames} PNG frames into a folder. Then use FFmpeg:\n\n` +
      `${command}\n\n` +
      `Starting PNG export...`
    );
    
    exportPNGSequence();
    return;
  }

  // WebM Export
  const canvas = elements.canvas;
  const stream = canvas.captureStream(state.fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks = [];

  const lines = getLines();
  const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
  const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
  const maxDuration = getMaxDuration();
  const duration = ((maxStagger + maxDuration) / state.fps) * 1000;

  showExportProgress(0, 'Starting export...');

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    showExportProgress(90, 'Creating file...');
    
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const baseName = sanitizeFilename(state.text);
    a.download = getUniqueFilename(baseName, 'webm');
    
    showExportProgress(100, 'Complete!');
    a.click();
    URL.revokeObjectURL(url);
    hideExportProgress();
  };

  recorder.start();
  if (!state.playing) startPlayback();

  const startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / duration) * 90, 90);
    showExportProgress(progress, 'Recording...');
    
    if (elapsed >= duration) {
      clearInterval(progressInterval);
    }
  }, 100);

  setTimeout(() => {
    clearInterval(progressInterval);
    recorder.stop();
    if (state.playing) stopPlayback();
  }, duration);
}

function exportPNGSequence() {
  const lines = getLines();
  const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
  const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
  const maxDuration = getMaxDuration();
  const totalFrames = maxStagger + maxDuration;

  const folderName = sanitizeFilename(state.text);
  
  showExportProgress(0, 'Exporting frames...');

  let currentFrame = 0;
  
  function exportNextFrame() {
    if (currentFrame < totalFrames) {
      renderFrame(currentFrame);
      const a = document.createElement('a');
      const frameName = `frame_${String(currentFrame).padStart(4, '0')}.png`;
      a.download = `${folderName}/${frameName}`;
      a.href = elements.canvas.toDataURL('image/png');
      a.click();
      
      currentFrame++;
      const progress = (currentFrame / totalFrames) * 100;
      showExportProgress(progress, `Exporting frame ${currentFrame}/${totalFrames}...`);
      
      setTimeout(exportNextFrame, 10);
    } else {
      showExportProgress(100, 'Complete!');
      alert(`Frames exported! Note: Browser downloads don't support folders.\n\nAll frames are prefixed with "${folderName}/"\n\nOrganize them into a folder manually or use the desktop version.`);
      hideExportProgress();
    }
  }
  
  exportNextFrame();
}

// ========================================
// UI UPDATES
// ========================================
function updateUI() {
  const hasContent = getLines().some(line => line.length > 0);
  
  elements.playBtn.disabled = !hasContent;
  elements.resetBtn.disabled = !hasContent;
  elements.exportBtn.disabled = !hasContent;
  elements.exportPngBtn.disabled = !hasContent;
  
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

function updateExportFormatUI() {
  const formatNames = {
    'webm': 'WebM',
    'hevc': 'HEVC',
    'prores': 'ProRes'
  };
  
  elements.exportFormatText.textContent = formatNames[state.exportFormat] || 'WebM';
  
  if (state.exportFormat === 'hevc' || state.exportFormat === 'prores') {
    elements.desktopInfo.classList.remove('hidden');
    
    const command = state.exportFormat === 'hevc'
      ? `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v libx265 -vtag hvc1 -pix_fmt yuva420p -crf 18 output.mov`
      : `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le output.mov`;
    
    elements.desktopCommand.textContent = command;
  } else {
    elements.desktopInfo.classList.add('hidden');
  }
}

function updateDurationModeUI() {
  if (state.durationMode === 'custom') {
    elements.customDurationGroup.style.display = 'block';
  } else {
    elements.customDurationGroup.style.display = 'none';
  }
  
  // Update info text
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
  elements.exportBtn.addEventListener('click', exportVideo);
  elements.exportPngBtn.addEventListener('click', exportPNGSequence);
  
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
  
  elements.letterDuration.addEventListener('input', (e) => {
    state.letterDuration = Number(e.target.value);
    renderFrame();
  });
  
  // Note: FPS input is now readonly and auto-detected
  
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
  
  elements.exportFormat.addEventListener('change', (e) => {
    state.exportFormat = e.target.value;
    updateExportFormatUI();
  });
}

// ========================================
// INITIALIZATION
// ========================================
function init() {
  setupEventListeners();
  setupSectionToggles();
  updateUI();
  updateExportFormatUI();
  updateDurationModeUI();
}

init();