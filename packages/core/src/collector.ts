// Browser signal collection. Every probe is wrapped so a blocked or missing
// API yields null instead of throwing: a device that refuses canvas should
// still produce the rest of its signals.
//
// DO NOT EDIT the probe bodies below without reading SYNC.md. The canvas draw
// calls, WebGL parameter list, audio graph and font list are parity-locked
// against the WhorlID API: changing them changes every signal value, which
// breaks matching for devices already recorded by the service.

export interface CollectedSignals {
  [key: string]: unknown;
}

// Bumped whenever the collected signal shape changes, so server-side records
// can attribute signal sets to the collector build that produced them.
export const COLLECTOR_VERSION = '1';

export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// --- Canvas 2D fingerprint --------------------------------------------------
// DO NOT EDIT - parity-locked. See SYNC.md.
function canvasFingerprint(): string | null {
  return safe(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint POC \u{1F510} 9.87', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Fingerprint POC \u{1F510} 9.87', 4, 17);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.fillStyle = 'rgb(0,255,255)';
    ctx.beginPath();
    ctx.arc(100, 50, 50, 0, Math.PI * 2, true);
    ctx.fill();

    return canvas.toDataURL();
  });
}

// --- WebGL fingerprint ------------------------------------------------------
// DO NOT EDIT - parity-locked. Parameter names and their order matter.
function webglFingerprint(): Record<string, unknown> | null {
  return safe(() => {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const params: Record<string, unknown> = {};
    const paramNames = [
      'MAX_TEXTURE_SIZE',
      'MAX_VIEWPORT_DIMS',
      'MAX_VERTEX_ATTRIBS',
      'MAX_VARYING_VECTORS',
      'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
      'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
      'MAX_TEXTURE_IMAGE_UNITS',
      'MAX_FRAGMENT_UNIFORM_VECTORS',
      'MAX_VERTEX_UNIFORM_VECTORS',
      'ALIASED_LINE_WIDTH_RANGE',
      'ALIASED_POINT_SIZE_RANGE',
      'RED_BITS',
      'GREEN_BITS',
      'BLUE_BITS',
      'ALPHA_BITS',
      'DEPTH_BITS',
      'STENCIL_BITS',
    ];
    for (const name of paramNames) {
      const val = gl.getParameter((gl as any)[name]);
      params[name] = Array.isArray(val) || ArrayBuffer.isView(val)
        ? Array.from(val as ArrayLike<number>)
        : val;
    }

    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      unmaskedVendor: debugInfo
        ? gl.getParameter((debugInfo as any).UNMASKED_VENDOR_WEBGL)
        : null,
      unmaskedRenderer: debugInfo
        ? gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL)
        : null,
      extensions: (gl.getSupportedExtensions() || []).sort(),
      params,
    };
  });
}

// --- Audio fingerprint ------------------------------------------------------
// DO NOT EDIT - parity-locked. The compressor settings and the sampled window
// define the value; a different window is a different fingerprint.
async function audioFingerprint(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (!AudioCtx) return resolve(null);

      const context = new AudioCtx(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);
      context.startRendering();

      context.oncomplete = (event: any) => {
        try {
          const data = event.renderedBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
          resolve(sum.toString());
        } catch {
          resolve(null);
        }
      };

      // Safety timeout
      setTimeout(() => resolve(null), 1000);
    } catch {
      resolve(null);
    }
  });
}

// --- Font detection ---------------------------------------------------------
// DO NOT EDIT - parity-locked. The font list is part of the signal: adding a
// font changes which fonts are reported for every device.
function detectFonts(): string[] {
  return safe(() => {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const fontList = [
      'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
      'Comic Sans MS', 'Consolas', 'Courier', 'Courier New', 'Georgia',
      'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
      'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe UI', 'Tahoma',
      'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Menlo',
      'Monaco', 'Geneva', 'Optima', 'Cambria Math', 'Roboto', 'Ubuntu',
      'DejaVu Sans', 'Liberation Sans', 'Noto Sans',
    ];

    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = testSize;
    span.textContent = testString;
    document.body.appendChild(span);

    const defaults: Record<string, { w: number; h: number }> = {};
    for (const base of baseFonts) {
      span.style.fontFamily = base;
      defaults[base] = { w: span.offsetWidth, h: span.offsetHeight };
    }

    const detected: string[] = [];
    for (const font of fontList) {
      let matched = false;
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}',${base}`;
        if (
          span.offsetWidth !== defaults[base]!.w ||
          span.offsetHeight !== defaults[base]!.h
        ) {
          matched = true;
          break;
        }
      }
      if (matched) detected.push(font);
    }

    document.body.removeChild(span);
    return detected.sort();
  }, []) as string[];
}

// --- Math constants (FPU / libm quirks) -------------------------------------
// DO NOT EDIT - parity-locked.
function mathConstants(): Record<string, number> | null {
  return safe(() => ({
    tan: Math.tan(-1e300),
    sin: Math.sin(1e300),
    cos: Math.cos(1e300),
    acos: Math.acos(0.123456789),
    atan: Math.atan(0.5),
    exp: Math.exp(1),
    log: Math.log(1000),
    sqrt: Math.sqrt(2),
    powE: Math.pow(Math.PI, -100),
  }));
}

/** Called with how long each expensive probe took, in milliseconds. */
export type TimingSink = (name: string, ms: number) => void;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

async function timed<T>(name: string, fn: () => T | Promise<T>, sink?: TimingSink): Promise<T> {
  const start = now();
  try {
    return await fn();
  } finally {
    sink?.(name, Math.round((now() - start) * 100) / 100);
  }
}

export async function collectSignals(sink?: TimingSink): Promise<CollectedSignals> {
  const nav = navigator as any;
  const scr = screen;

  const signals: CollectedSignals = {
    collectorVersion: COLLECTOR_VERSION,
    userAgent: safe(() => nav.userAgent),
    platform: safe(() => nav.platform),
    // Automation hint for bot detection (not part of the identity hash).
    webdriver: safe(() => nav.webdriver ?? false),
    languages: safe(() => Array.from(nav.languages || [])),
    language: safe(() => nav.language),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    timezoneOffset: safe(() => new Date().getTimezoneOffset()),
    hardwareConcurrency: safe(() => nav.hardwareConcurrency ?? null),
    deviceMemory: safe(() => nav.deviceMemory ?? null),
    maxTouchPoints: safe(() => nav.maxTouchPoints ?? 0),
    cookieEnabled: safe(() => nav.cookieEnabled),
    vendor: safe(() => nav.vendor),
    screen: {
      width: safe(() => scr.width),
      height: safe(() => scr.height),
      availWidth: safe(() => scr.availWidth),
      availHeight: safe(() => scr.availHeight),
      colorDepth: safe(() => scr.colorDepth),
      pixelDepth: safe(() => scr.pixelDepth),
      devicePixelRatio: safe(() => window.devicePixelRatio),
    },
    colorScheme: safe(() =>
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    ),
    reducedMotion: safe(() =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ),
    touchSupport: safe(() => 'ontouchstart' in window),
    plugins: safe(() =>
      Array.from(nav.plugins || []).map((p: any) => p.name).sort()
    ),
    canvas: await timed('canvas', canvasFingerprint, sink),
    webgl: await timed('webgl', webglFingerprint, sink),
    audio: await timed('audio', audioFingerprint, sink),
    fonts: await timed('fonts', detectFonts, sink),
    math: await timed('math', mathConstants, sink),
    localStorage: safe(() => !!window.localStorage),
    sessionStorage: safe(() => !!window.sessionStorage),
    indexedDB: safe(() => !!window.indexedDB),
  };

  return signals;
}
