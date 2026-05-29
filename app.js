const REPO = 'casmedlin/image-converter';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

// Ordered list of matchers per platform.
// Each entry tries `find` first (exact), then `fallback` (loose).
const assetMatchers = {
  'mac-arm64':     { find: /mac-arm64\.dmg$/i,                  fallback: /\.dmg$/i,                 exclude: /blockmap/i },
  'mac-x64':       { find: /mac-x64\.dmg$/i,                   fallback: null,                      exclude: /blockmap/i },
  'win-x64':       { find: /win-x64\.exe$/i,                   fallback: /setup.*\.exe$/i,          exclude: /blockmap|arm64/i },
  'win-arm64':     { find: /win-arm64\.exe$/i,                 fallback: /setup.*\.exe$/i,          exclude: /blockmap/i },
  'linux-x86_64':  { find: /(?:linux-x86_64|linux-x64|x86_64)\.AppImage$/i, fallback: /\.AppImage$/i, exclude: /arm64/i },
  'linux-arm64':   { find: /(?:linux-arm64|arm64)\.AppImage$/i, fallback: null,                      exclude: null },
};

function detectOS() {
  const ua = navigator.userAgent;
  const arch = navigator.platform.toLowerCase();
  if (/mac/i.test(ua)) return 'mac-arm64';
  if (/win/i.test(ua)) return ua.includes('arm64') || ua.includes('aarch64') ? 'win-arm64' : 'win-x64';
  if (/linux/i.test(ua)) return arch.includes('aarch64') || arch.includes('arm64') ? 'linux-arm64' : 'linux-x86_64';
  return null;
}

async function fetchRelease() {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch release');
  return res.json();
}

function pickAsset(assets, matcher, used) {
  const exclude = (a) => !used.has(a.name) && (!matcher.exclude || !matcher.exclude.test(a.name));
  let a = assets.find(a => matcher.find.test(a.name) && exclude(a));
  if (!a && matcher.fallback) a = assets.find(a => matcher.fallback.test(a.name) && exclude(a));
  return a;
}

function mapAssets(release) {
  const used = new Set();
  const assets = {};
  // Try exact matches first (don't consume fallback candidates yet)
  for (const [key, matcher] of Object.entries(assetMatchers)) {
    const a = pickAsset(release.assets, matcher, used);
    if (a) { assets[key] = a.browser_download_url; used.add(a.name); }
  }
  return assets;
}

async function init() {
  const detectedPrompt = document.getElementById('detected-prompt');
  const detectedText = document.getElementById('detected-text');
  const detectedLink = document.getElementById('detected-link');
  const showAllBtn = document.getElementById('show-all-btn');
  const allDownloads = document.getElementById('all-downloads');
  const detectedAlt = document.getElementById('detected-alt');
  const altLink = document.getElementById('alt-link');
  const versionInfo = document.getElementById('version-info');

  try {
    const release = await fetchRelease();
    const assets = mapAssets(release);

    versionInfo.textContent = release.tag_name;

    for (const btn of document.querySelectorAll('.download-btn')) {
      const key = btn.dataset.asset;
      if (assets[key]) {
        btn.href = assets[key];
      } else {
        btn.textContent = 'N/A';
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      }
    }

    const detected = detectOS();
    if (detected && assets[detected]) {
      const labels = {
        'mac-arm64': 'macOS (Apple Silicon)',
        'mac-x64': 'macOS (Intel)',
        'win-x64': 'Windows (x64)',
        'win-arm64': 'Windows (ARM64)',
        'linux-x86_64': 'Linux (x86_64)',
        'linux-arm64': 'Linux (ARM64)',
      };
      detectedText.textContent = `Detected ${labels[detected]} — ready to download:`;
      detectedLink.href = assets[detected];
      if (detected === 'mac-arm64' && assets['mac-x64']) {
        detectedAlt.classList.remove('hidden');
        altLink.href = assets['mac-x64'];
      }
      detectedPrompt.classList.remove('hidden');
    } else {
      allDownloads.classList.remove('hidden');
    }

    showAllBtn.addEventListener('click', () => {
      detectedPrompt.classList.add('hidden');
      allDownloads.classList.remove('hidden');
    });

  } catch (e) {
    versionInfo.textContent = 'v1.2.0';
    allDownloads.classList.remove('hidden');
  }
}

// ─── Overlay controls ─────────────────────────────────────────
function setupOverlay(overlay, closeBtns) {
  const closers = closeBtns.map(id => document.getElementById(id));
  closers.forEach(el => {
    if (el) el.addEventListener('click', () => overlay.classList.add('hidden'));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  const privacyOverlay = document.getElementById('privacy-overlay');
  const termsOverlay = document.getElementById('terms-overlay');
  setupOverlay(privacyOverlay, ['close-privacy', 'privacy-ok']);
  setupOverlay(termsOverlay, ['close-terms', 'terms-ok']);

  document.getElementById('privacy-link').addEventListener('click', (e) => {
    e.preventDefault();
    privacyOverlay.classList.remove('hidden');
  });

  document.getElementById('terms-link').addEventListener('click', (e) => {
    e.preventDefault();
    termsOverlay.classList.remove('hidden');
  });
});
