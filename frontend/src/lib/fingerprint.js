/**
 * Device Fingerprinting for anti-cheat lockout.
 * Uses hardware-level signals that persist across incognito/different browsers.
 */

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('AWS Exam 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('AWS Exam 🔒', 4, 17);
    return canvas.toDataURL();
  } catch {
    return 'canvas-blocked';
  }
}

function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'no-ext';
    return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) + '|' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  } catch {
    return 'webgl-blocked';
  }
}

async function sha256(str) {
  // crypto.subtle is only available in secure contexts (HTTPS / localhost).
  // Fall back to a simple hash so login still works over plain HTTP.
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0') + '-fallback';
  }
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getDeviceFingerprint() {
  // Check cache
  const cached = sessionStorage.getItem('deviceFingerprint');
  if (cached) return cached;

  try {
    const components = [
      navigator.userAgent,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(navigator.hardwareConcurrency || ''),
      String(navigator.deviceMemory || ''),
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      getCanvasFingerprint(),
      getWebGLFingerprint(),
      navigator.platform || '',
      String(window.devicePixelRatio || ''),
    ];

    const hash = await sha256(components.join('|||'));
    sessionStorage.setItem('deviceFingerprint', hash);
    return hash;
  } catch {
    // Non-fatal — fingerprinting unavailable in this environment.
    // Return a placeholder so login can continue without crashing.
    return 'fp-unavailable';
  }
}
