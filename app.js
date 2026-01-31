// ========================================
// STATE
// ========================================
const state = {
  library: {},
  text: 'HELLO\nWORLD',
  spacing: 12,
  lineSpacing: 24,
  charSpacing: 0,
  fps: 30,
  alignment: 'center',
  timingMode: 'stagger',
  staggerFrames: 6,
  letterDuration: 24,
  holdLastFrame: true,
  playing: false,
  globalFrame: 0,
  exportFormat: 'webm'
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
  letterDuration: document.getElementById('letter-duration'),
  fps: document.getElementById('fps'),
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
  proresInfo: document.getElementById('prores-info'),
  ffmpegCommand: document.getElementById('ffmpeg-command')
};

// ========================================
// FILE UPLOAD
// ========================================
function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

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

  files.forEach(file => {
    const match = file.name.match(/^(.+?)_(\d+)\.(png|jpg|jpeg)$/i);
    
    if (match) {
      // PNG sequence
      const letter = match[1].toUpperCase();
      if (!pngGroups[letter]) pngGroups[letter] = [];
      pngGroups[letter].push({ file, idx: +match[2] });
    } else if (file.type.startsWith('video/')) {
      // Video file
      const letter = file.name[0].toUpperCase();
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
      const letter = file.name[0].toUpperCase();
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
  
  renderFrame();
  updateUI();
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
  
  // Calculate canvas dimensions
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

      // Calculate stagger
      const globalIndex = lineIndex * 100 + letterIndex;
      const stagger = state.timingMode === 'stagger' ? globalIndex * state.staggerFrames : 0;
      const localFrame = frameNum - stagger;

      let frameIndex;
      if (localFrame < 0) {
        frameIndex = 0;
      } else if (localFrame >= state.letterDuration && state.holdLastFrame) {
        frameIndex = data.frameCount - 1;
      } else if (localFrame >= 0) {
        frameIndex = localFrame % data.frameCount;
      } else {
        frameIndex = 0;
      }

      // Draw letter
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
  // Start videos
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
function exportVideo() {
  if (state.exportFormat === 'prores') {
    const lines = getLines();
    const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
    const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
    const totalFrames = maxStagger + state.letterDuration;

    alert(
      `ProRes 4444 Export Instructions:\n\n` +
      `This will export ${totalFrames} PNG frames. Then use FFmpeg to create ProRes 4444:\n\n` +
      `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 output.mov\n\n` +
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

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animated_text.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  recorder.start();
  if (!state.playing) startPlayback();

  const lines = getLines();
  const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
  const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
  const duration = ((maxStagger + state.letterDuration) / state.fps) * 1000;

  setTimeout(() => {
    recorder.stop();
    if (state.playing) stopPlayback();
  }, duration);
}

function exportPNGSequence() {
  const lines = getLines();
  const totalLetters = lines.reduce((sum, line) => sum + line.length, 0);
  const maxStagger = state.timingMode === 'stagger' ? totalLetters * state.staggerFrames : 0;
  const totalFrames = maxStagger + state.letterDuration;

  for (let i = 0; i < totalFrames; i++) {
    renderFrame(i);
    const a = document.createElement('a');
    a.download = `frame_${String(i).padStart(4, '0')}.png`;
    a.href = elements.canvas.toDataURL('image/png');
    a.click();
  }
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
  elements.exportFormatText.textContent = state.exportFormat === 'webm' ? 'WebM' : 'ProRes';
  
  if (state.exportFormat === 'prores') {
    elements.proresInfo.classList.remove('hidden');
    elements.ffmpegCommand.textContent = 
      `ffmpeg -framerate ${state.fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le output.mov`;
  } else {
    elements.proresInfo.classList.add('hidden');
  }
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
  // File upload
  elements.fileInput.addEventListener('change', handleFileUpload);
  
  // Text input
  elements.textInput.addEventListener('input', (e) => {
    state.text = e.target.value;
    renderFrame();
    updateUI();
  });
  
  // Playback controls
  elements.playBtn.addEventListener('click', togglePlay);
  elements.resetBtn.addEventListener('click', resetPlayback);
  elements.exportBtn.addEventListener('click', exportVideo);
  elements.exportPngBtn.addEventListener('click', exportPNGSequence);
  
  // Settings
  elements.timingMode.addEventListener('change', (e) => {
    state.timingMode = e.target.value;
    elements.staggerFrames.disabled = e.target.value === 'simultaneous';
    renderFrame();
  });
  
  elements.staggerFrames.addEventListener('input', (e) => {
    state.staggerFrames = Number(e.target.value);
    renderFrame();
  });
  
  elements.letterDuration.addEventListener('input', (e) => {
    state.letterDuration = Number(e.target.value);
    renderFrame();
  });
  
  elements.fps.addEventListener('input', (e) => {
    state.fps = Number(e.target.value);
    updateExportFormatUI();
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
}

// Start the app
init();