/**
 * Aldar Sanitaryware Rate Benchmark Dashboard
 * File upload handling and UI state management
 */

// ── In-memory file store ──────────────────────────────────────────────────
const appState = {
  benchmarkFile: null,   // { name, size, arrayBuffer }
  quotationFile: null,   // { name, size, arrayBuffer }
  analysisRun: false,
};

// ── DOM references ────────────────────────────────────────────────────────
const refs = {
  benchmarkInput:      document.getElementById('benchmarkInput'),
  quotationInput:      document.getElementById('quotationInput'),
  benchmarkCard:       document.getElementById('benchmarkCard'),
  quotationCard:       document.getElementById('quotationCard'),
  benchmarkIndicator:  document.getElementById('benchmarkIndicator'),
  quotationIndicator:  document.getElementById('quotationIndicator'),
  benchmarkStatusText: document.getElementById('benchmarkStatusText'),
  quotationStatusText: document.getElementById('quotationStatusText'),
  benchmarkFileName:   document.getElementById('benchmarkFileName'),
  quotationFileName:   document.getElementById('quotationFileName'),
  benchmarkProgress:   document.getElementById('benchmarkProgress'),
  quotationProgress:   document.getElementById('quotationProgress'),
  benchmarkPct:        document.getElementById('benchmarkPct'),
  quotationPct:        document.getElementById('quotationPct'),
  analyzeBtn:          document.getElementById('analyzeBtn'),
  analyzeHint:         document.getElementById('analyzeHint'),
  systemStatus:        document.getElementById('systemStatus'),

  // Summary tab
  welcomeBox:   document.getElementById('welcomeBox'),
  kpiGrid:      document.getElementById('kpiGrid'),
  step1:        document.getElementById('step1'),
  step2:        document.getElementById('step2'),
  step3:        document.getElementById('step3'),
  step1Check:   document.getElementById('step1Check'),
  step2Check:   document.getElementById('step2Check'),
  step3Check:   document.getElementById('step3Check'),
};

// ── File upload handlers ──────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Animate the progress bar from 0 → 100% then resolve.
 * Simulates read progress since FileReader doesn't report incremental progress
 * for small in-memory reads.
 */
function animateProgress(fillEl, pctEl, durationMs = 700) {
  return new Promise(resolve => {
    const steps = 30;
    const interval = durationMs / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += 100 / steps;
      const pct = Math.min(Math.round(current), 100);
      fillEl.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      if (pct >= 100) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
}

async function handleFileUpload(file, type) {
  const isBenchmark = type === 'benchmark';
  const indicatorEl  = isBenchmark ? refs.benchmarkIndicator  : refs.quotationIndicator;
  const statusTextEl = isBenchmark ? refs.benchmarkStatusText : refs.quotationStatusText;
  const fileNameEl   = isBenchmark ? refs.benchmarkFileName   : refs.quotationFileName;
  const progressFill = isBenchmark ? refs.benchmarkProgress   : refs.quotationProgress;
  const progressPct  = isBenchmark ? refs.benchmarkPct        : refs.quotationPct;
  const cardEl       = isBenchmark ? refs.benchmarkCard       : refs.quotationCard;

  // Validate extension
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    indicatorEl.className  = 'status-indicator error';
    statusTextEl.textContent = 'Error: Only .xlsx files are accepted';
    console.warn(`[Upload] Rejected "${file.name}" — not an .xlsx file`);
    return;
  }

  // Loading state
  indicatorEl.className  = 'status-indicator loading';
  statusTextEl.textContent = 'Reading file…';
  fileNameEl.textContent   = '';

  // Read file into ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Animate progress bar
  await animateProgress(progressFill, progressPct, 600);

  // Store in memory
  const payload = { name: file.name, size: file.size, arrayBuffer };
  if (isBenchmark) {
    appState.benchmarkFile = payload;
    console.log(`[Upload] Benchmark file loaded: "${file.name}" (${formatBytes(file.size)})`);
    statusTextEl.textContent = 'Benchmark data loaded successfully';
    markStepDone(refs.step1);
  } else {
    appState.quotationFile = payload;
    console.log(`[Upload] Project quotation loaded: "${file.name}" (${formatBytes(file.size)})`);
    statusTextEl.textContent = 'Project BOQ loaded — Ready to analyze';
    markStepDone(refs.step2);
  }

  // Success UI
  indicatorEl.className = 'status-indicator success';
  fileNameEl.textContent = `${file.name} (${formatBytes(file.size)})`;
  cardEl.classList.add('loaded');

  checkAnalyzeReady();
}

// ── Event listeners ───────────────────────────────────────────────────────

refs.benchmarkInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleFileUpload(file, 'benchmark');
  e.target.value = ''; // reset so same file can be re-uploaded
});

refs.quotationInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleFileUpload(file, 'quotation');
  e.target.value = '';
});

refs.analyzeBtn.addEventListener('click', runAnalysis);

// ── Analyze readiness ─────────────────────────────────────────────────────

function checkAnalyzeReady() {
  const ready = appState.benchmarkFile !== null && appState.quotationFile !== null;
  refs.analyzeBtn.disabled = !ready;
  refs.analyzeHint.textContent = ready
    ? 'Both files loaded — click to run analysis'
    : 'Upload both files to enable analysis';

  if (ready) {
    refs.systemStatus.textContent = 'Ready to Analyze';
    refs.systemStatus.style.background = '#C8972A';
  }
}

// ── Analysis stub ─────────────────────────────────────────────────────────

function runAnalysis() {
  if (!appState.benchmarkFile || !appState.quotationFile) return;

  console.log('[Analysis] Starting benchmark analysis…');
  console.log(`  Benchmark : ${appState.benchmarkFile.name}`);
  console.log(`  Quotation : ${appState.quotationFile.name}`);

  refs.analyzeBtn.textContent = '⏳ Analyzing…';
  refs.analyzeBtn.disabled = true;
  refs.systemStatus.textContent = 'Analyzing…';
  refs.systemStatus.style.background = '#F39C12';

  // Simulate processing delay
  setTimeout(() => {
    appState.analysisRun = true;
    markStepDone(refs.step3);

    refs.analyzeBtn.innerHTML = '<span class="btn-icon">&#9654;</span> Analyze &amp; Benchmark';
    refs.analyzeBtn.disabled = false;
    refs.systemStatus.textContent = 'Analysis Complete';
    refs.systemStatus.style.background = '#27AE60';
    refs.analyzeHint.textContent = 'Analysis complete — view results in tabs';

    showKpiPlaceholders();
    console.log('[Analysis] Complete — results ready');
  }, 1200);
}

function showKpiPlaceholders() {
  refs.kpiGrid.classList.remove('hidden');
  // Placeholder values until real parsing is wired in
  document.getElementById('kpiItems').textContent    = '—';
  document.getElementById('kpiWithin').textContent   = '—';
  document.getElementById('kpiExceeding').textContent = '—';
  document.getElementById('kpiVariance').textContent  = '—';
}

// ── Step helpers ──────────────────────────────────────────────────────────

function markStepDone(stepEl) {
  stepEl.classList.add('done');
}

// ── Tab navigation ────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

// ── Init ──────────────────────────────────────────────────────────────────
console.log('[Dashboard] Aldar Sanitaryware Benchmark Dashboard initialised');
