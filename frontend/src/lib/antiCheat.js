/**
 * CertPath — Comprehensive anti-cheat system for Exam mode.
 * Monitors tab switches, window blur, fullscreen exits, DevTools,
 * clipboard, print, mouse leaving viewport, and keyboard shortcuts.
 * Records all suspicious events in an activity log for instructor review.
 */
import api from './api';
import { getDeviceFingerprint } from './fingerprint';

let sessionId = null;
let onStrike = null;
let onCancel = null;
let active = false;
let lastStrikeTime = 0;
let devToolsTimer = null;
let fullscreenRetryTimer = null;

// References to patched browser APIs — restored on stop()
let _origGetDisplayMedia = null;
let _origWindowOpen = null;

// Activity log — each entry: { type, details, occurredAt, durationMs? }
let activityLog = [];
let blurStart = null;
let tabHiddenStart = null;

const STRIKE_COOLDOWN_MS = 3000;

const BLOCKED_KEYS = new Set(['F12', 'F11', 'F10', 'F5', 'F1', 'F6']);
const BLOCKED_COMBOS = [
  (e) => e.ctrlKey && ['c', 'v', 'u', 'a', 's', 'p', 'f', 'h', 'j', 'l'].includes(e.key.toLowerCase()),
  (e) => e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K', 'M'].includes(e.key),
  (e) => e.metaKey && ['c', 'v', 'u', 'f', 's'].includes(e.key.toLowerCase()),
  (e) => e.altKey && e.key === 'Tab',
  (e) => e.altKey && e.key === 'F4',
  (e) => e.key === 'Meta' || e.key === 'OS',
  (e) => e.ctrlKey && e.key === 'Tab',
];

const STRIKE_REASONS = {
  tab_switch:        'Tab switch detected',
  window_blur:       'Window focus lost',
  fullscreen_exit:   'Fullscreen exited',
  mouse_left_window: 'Mouse left exam window',
  devtools_open:     'Developer tools detected',
  devtools_shortcut: 'DevTools keyboard shortcut',
  alt_tab_attempt:   'Alt+Tab detected',
  print_attempt:     'Print attempt blocked',
  screen_recording:  'Screen recording/capture detected',
  url_open_attempt:  'Attempted to open external URL',
};

function addActivityEntry(type, details, durationMs) {
  activityLog.push({
    type,
    details: details || STRIKE_REASONS[type] || type,
    occurredAt: new Date().toISOString(),
    durationMs: durationMs || null,
  });
}

async function reportStrike(reason) {
  if (!active) return;
  const now = Date.now();
  if (now - lastStrikeTime < STRIKE_COOLDOWN_MS) return;
  lastStrikeTime = now;

  addActivityEntry(reason);

  try {
    const fingerprint = await getDeviceFingerprint();
    const { data } = await api.post(`/exams/${sessionId}/strike`, {
      fingerprint,
      reason: STRIKE_REASONS[reason] || reason,
    });
    if (data.cancelled) {
      onCancel?.(data.message);
      stop();
    } else {
      onStrike?.(data.strikes, data.message);
    }
  } catch (err) {
    console.error('Strike report failed:', err);
  }
}

// ── Event handlers ────────────────────────────────────────────

function onVisibilityChange() {
  if (document.hidden) {
    tabHiddenStart = Date.now();
    reportStrike('tab_switch');
  } else {
    if (tabHiddenStart) {
      const duration = Date.now() - tabHiddenStart;
      addActivityEntry('tab_switch_return', `Returned after ${Math.round(duration / 1000)}s away from tab`, duration);
      tabHiddenStart = null;
    }
    // Re-request fullscreen when returning
    if (active && !document.fullscreenElement) {
      clearTimeout(fullscreenRetryTimer);
      fullscreenRetryTimer = setTimeout(() => {
        if (active) requestFullscreen().catch(() => {});
      }, 600);
    }
  }
}

function onWindowBlur() {
  blurStart = Date.now();
  reportStrike('window_blur');
}

function onWindowFocus() {
  if (blurStart) {
    const duration = Date.now() - blurStart;
    addActivityEntry('window_blur_return', `Returned after ${Math.round(duration / 1000)}s away from window`, duration);
    blurStart = null;
  }
  // Re-enter fullscreen when user comes back
  if (active && !document.fullscreenElement) {
    clearTimeout(fullscreenRetryTimer);
    fullscreenRetryTimer = setTimeout(() => {
      if (active) requestFullscreen().catch(() => {});
    }, 600);
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && active) {
    reportStrike('fullscreen_exit');
    clearTimeout(fullscreenRetryTimer);
    fullscreenRetryTimer = setTimeout(() => {
      if (active) requestFullscreen().catch(() => {});
    }, 1500);
  }
}

function onContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onKeyDown(e) {
  const blocked = BLOCKED_KEYS.has(e.key);
  const combo = BLOCKED_COMBOS.some((fn) => fn(e));

  if (blocked || combo) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey)) {
      reportStrike('devtools_shortcut');
    } else if ((e.altKey && e.key === 'Tab') || e.key === 'Meta' || e.key === 'OS') {
      reportStrike('alt_tab_attempt');
    } else {
      addActivityEntry('key_block', `Blocked key: ${e.key}`);
    }
  }
}

function onCopy(e) {
  e.preventDefault();
  addActivityEntry('clipboard_block', 'Copy attempt blocked');
}
function onCut(e) {
  e.preventDefault();
  addActivityEntry('clipboard_block', 'Cut attempt blocked');
}
function onPaste(e) {
  e.preventDefault();
  addActivityEntry('clipboard_block', 'Paste attempt blocked');
}

function onBeforePrint() {
  reportStrike('print_attempt');
}

function onBeforeUnload(e) {
  if (!active) return;
  e.preventDefault();
  e.returnValue = 'Leaving will end your exam session. Are you sure?';
  return e.returnValue;
}

function onMouseLeave(e) {
  if (!active) return;
  if (
    e.clientY <= 0 ||
    e.clientX <= 0 ||
    e.clientX >= window.innerWidth ||
    e.clientY >= window.innerHeight
  ) {
    reportStrike('mouse_left_window');
  }
}

function startDevToolsDetection() {
  const THRESHOLD = 200;
  devToolsTimer = setInterval(() => {
    if (!active) return;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > THRESHOLD || heightDiff > THRESHOLD) {
      reportStrike('devtools_open');
    }
  }, 3000);
}

// ── Public API ────────────────────────────────────────────────

export function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return Promise.resolve(el.webkitRequestFullscreen());
  if (el.mozRequestFullScreen) return Promise.resolve(el.mozRequestFullScreen());
  return Promise.resolve();
}

export function exitFullscreen() {
  try {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {}
}

/**
 * Reset the strike cooldown and force fullscreen back on.
 * Call this after the user dismisses a StrikeWarning dialog so
 * the NEXT violation is caught immediately regardless of timing.
 */
export function reinforce() {
  if (!active) return;
  lastStrikeTime = 0; // reset cooldown so next event is counted
  // Re-enter fullscreen if not currently in it
  if (!document.fullscreenElement) {
    clearTimeout(fullscreenRetryTimer);
    requestFullscreen().catch(() => {});
  }
}

/**
 * Get a copy of the activity log collected so far.
 */
export function getActivityLog() {
  return [...activityLog];
}

export function clearActivityLog() {
  activityLog = [];
  blurStart = null;
  tabHiddenStart = null;
}

export function start(sid, strikeCallback, cancelCallback) {
  if (active) stop();
  sessionId = sid;
  onStrike = strikeCallback;
  onCancel = cancelCallback;
  active = true;
  lastStrikeTime = 0;
  activityLog = [];
  blurStart = null;
  tabHiddenStart = null;

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('focus', onWindowFocus);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('copy', onCopy, true);
  document.addEventListener('cut', onCut, true);
  document.addEventListener('paste', onPaste, true);
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('mouseleave', onMouseLeave);

  startDevToolsDetection();

  // ── Browser screen-capture interception ─────────────────────
  // Block getDisplayMedia (screen share / browser-level recording) and log the attempt.
  try {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      _origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async (...args) => {
        addActivityEntry('screen_recording', 'Browser screen capture/recording attempted and blocked');
        reportStrike('screen_recording');
        throw new DOMException('Screen recording is not permitted during the exam.', 'NotAllowedError');
      };
    }
  } catch {}

  // ── window.open interception — capture attempted URL ────────
  // Block new windows/tabs and record the target URL.
  try {
    _origWindowOpen = window.open.bind(window);
    window.open = (...args) => {
      const url = args[0] ? String(args[0]).slice(0, 300) : '(blank)';
      addActivityEntry('url_open_attempt', `Attempted to open: ${url}`);
      reportStrike('window_blur');
      return null; // block the navigation
    };
  } catch {}

  addActivityEntry('exam_started', 'Anti-cheat monitoring activated');
}

export function stop() {
  active = false;
  sessionId = null;
  clearInterval(devToolsTimer);
  clearTimeout(fullscreenRetryTimer);
  devToolsTimer = null;
  fullscreenRetryTimer = null;

  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('blur', onWindowBlur);
  window.removeEventListener('focus', onWindowFocus);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
  document.removeEventListener('contextmenu', onContextMenu);
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('copy', onCopy, true);
  document.removeEventListener('cut', onCut, true);
  document.removeEventListener('paste', onPaste, true);
  window.removeEventListener('beforeprint', onBeforePrint);
  window.removeEventListener('beforeunload', onBeforeUnload);
  document.removeEventListener('mouseleave', onMouseLeave);

  // Restore patched browser APIs
  try {
    if (_origGetDisplayMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = _origGetDisplayMedia;
      _origGetDisplayMedia = null;
    }
  } catch {}
  try {
    if (_origWindowOpen) {
      window.open = _origWindowOpen;
      _origWindowOpen = null;
    }
  } catch {}
}
