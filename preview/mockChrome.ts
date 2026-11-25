/**
 * Dev-only fake of the extension APIs the side panel uses, so the UI can be reviewed in a normal
 * browser tab with fake photos. Never bundled into the extension.
 */
import type { ContentToPanel, PanelToContent } from '../src/shared/messages';
import type { PhotoItem, ScanState } from '../src/shared/types';

type Listener = (msg: unknown, sender: { tab?: { id?: number } }) => void;

const COLORS = ['#dfe7f5', '#f5e6d8', '#e3f1ea', '#efe3f3', '#f3efd9', '#e6e6e6'];

function fakeThumb(i: number, aspect: number): string {
  const w = 224;
  const h = Math.round(w / aspect);
  const bg = COLORS[i % COLORS.length] ?? '#eee';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="16" y="20" width="${w - 32}" height="14" rx="4" fill="#0002"/>
    <rect x="16" y="48" width="${w - 80}" height="10" rx="4" fill="#0001"/>
    <rect x="16" y="${h * 0.45}" width="${w - 32}" height="${h * 0.3}" rx="8" fill="#0001"/>
    <text x="16" y="${h - 20}" font-family="sans-serif" font-size="14" fill="#0006">#${i}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Optional real images for testing the AI: put .jpg/.png files and an index.json (a list of file
 * names) in preview/samples/ (git-ignored), then open the preview with ?samples.
 */
interface Sample {
  file: string;
  aspect: number;
}

async function loadSamples(): Promise<Sample[]> {
  if (!new URLSearchParams(location.search).has('samples')) return [];
  try {
    const files = (await (await fetch('/samples/index.json')).json()) as string[];
    return await Promise.all(
      files.map(
        (file) =>
          new Promise<Sample>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ file, aspect: img.naturalWidth / img.naturalHeight });
            img.onerror = () => resolve({ file, aspect: 1 });
            img.src = `/samples/${file}`;
          }),
      ),
    );
  } catch {
    return [];
  }
}

const samples = await loadSamples();

function fakeItem(i: number): PhotoItem {
  const sample = samples[i];
  if (sample) {
    return {
      id: `sample-${sample.file}`,
      url: `https://photos.google.com/photo/sample${i}`,
      thumbUrl: `/samples/${sample.file}`,
      takenAt: `${2019 + (i % 6)}-0${(i % 9) + 1}-15`,
      aspect: sample.aspect,
      // Every 7th sample poses as a video (2 s or 4 min) so video groups can be checked.
      ...(i % 7 === 3
        ? { kind: 'video' as const, durationSec: i % 14 === 3 ? 2 : 240 }
        : { kind: 'photo' as const }),
      label: sample.file,
    };
  }
  // Roughly: half screenshots (phone shape), some desktop screenshots, the rest camera photos.
  const shapes = [9 / 19.5, 3 / 4, 9 / 20, 4 / 3, 16 / 9, 9 / 16, 3 / 4];
  const aspect = shapes[i % shapes.length] ?? 1;
  const year = 2019 + (i % 7);
  const month = String((i % 12) + 1).padStart(2, '0');
  return {
    id: `fake${i}`,
    url: `https://photos.google.com/photo/fake${i}`,
    thumbUrl: fakeThumb(i, aspect),
    takenAt: `${year}-${month}-15`,
    aspect,
    kind: i % 13 === 0 ? 'video' : 'photo',
    label: `Photo - ${year}`,
  };
}

const listeners = new Set<Listener>();
const storage = new Map<string, unknown>();
const TOTAL = samples.length || 240;
const PER_STEP = 6;

let state: ScanState = 'idle';
let seen = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function emit(msg: ContentToPanel) {
  for (const l of listeners) l(msg, { tab: { id: 1 } });
}

function step() {
  if (state !== 'running') return;
  const next = Array.from({ length: Math.min(PER_STEP, TOTAL - seen) }, (_, k) =>
    fakeItem(seen + k),
  );
  seen += next.length;
  if (next.length) emit({ type: 'scan/items', items: next });
  emit({ type: 'scan/progress', seen, state });
  if (seen >= TOTAL) {
    state = 'done';
    clearInterval(timer);
    emit({ type: 'scan/done', seen, reason: 'end' });
  }
}

function handle(msg: PanelToContent) {
  switch (msg.type) {
    case 'scan/start':
      if (state === 'running' || state === 'paused') break;
      state = 'running';
      seen = 0;
      clearInterval(timer);
      timer = setInterval(step, 500);
      break;
    case 'scan/pause':
      if (state === 'running') state = 'paused';
      break;
    case 'scan/resume':
      if (state === 'paused') state = 'running';
      break;
    case 'scan/cancel':
      if (state === 'running' || state === 'paused') {
        state = 'cancelled';
        clearInterval(timer);
        emit({ type: 'scan/done', seen, reason: 'cancelled' });
      }
      break;
    case 'ping':
    case 'thumbs/fetch':
    case 'video/fetch':
    case 'video/open':
    case 'video/range':
    case 'album/add':
    case 'sizes/fetch':
      break;
  }
  return { ok: true, state, seen };
}

/** Like the content script: download each image and hand it back as a data: URL. */
async function fetchAsDataUrls(urls: string[]): Promise<(string | null)[]> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const blob = await (await fetch(url)).blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }),
  );
}

/**
 * Stands in for Google's video stream: records a short canvas animation once (the preview never
 * talks to Google) and hands it back as a data: URL, with a few progress updates like the page.
 */
let fakeVideo: Promise<string | null> | null = null;
function makeFakeVideo(): Promise<string | null> {
  fakeVideo ??= new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof MediaRecorder === 'undefined') return resolve(null);
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      };
      const started = performance.now();
      const draw = () => {
        const t = (performance.now() - started) / 1000;
        ctx.fillStyle = '#1e1c27';
        ctx.fillRect(0, 0, 360, 640);
        ctx.fillStyle = '#b9a4ff';
        ctx.beginPath();
        ctx.arc(180 + Math.sin(t * 3) * 120, 320, 40, 0, Math.PI * 2);
        ctx.fill();
        // Timers (not animation frames) so it also finishes when the page is in the background.
        if (t < 2) setTimeout(draw, 33);
        else recorder.stop();
      };
      recorder.start();
      draw();
    } catch {
      resolve(null);
    }
  });
  return fakeVideo;
}

async function respond(msg: PanelToContent) {
  const base = handle(msg);
  // No background worker in the preview: say there's no stream, so the panel downloads instead.
  if (msg.type === 'video/open') return { ...base, stream: null };
  if (msg.type === 'video/fetch') {
    for (const loaded of [1, 2, 3]) {
      await new Promise((r) => setTimeout(r, 300));
      emit({ type: 'video/progress', id: msg.id, loaded, total: 4 });
    }
    const dataUrl = await makeFakeVideo();
    return {
      ...base,
      video: dataUrl ? { ok: true, dataUrl } : { ok: false, reason: 'unavailable' },
    };
  }
  if (msg.type === 'thumbs/fetch') return { ...base, thumbs: await fetchAsDataUrls(msg.urls) };
  if (msg.type === 'sizes/fetch') {
    // Pretend Google knows the size of every other photo (to show partly-exact totals).
    const sizes: Record<string, { size: number; spaceTaken: number }> = {};
    msg.mediaKeys.forEach((id, i) => {
      if (i % 2 === 0) sizes[id] = { size: 1_800_000 + i * 1000, spaceTaken: 1_800_000 + i * 1000 };
    });
    return { ...base, sizes };
  }
  if (msg.type === 'album/add') {
    // Pretend Google created the album (the preview never talks to Google).
    await new Promise((r) => setTimeout(r, 1200));
    const n = msg.mediaKeys.length;
    return { ...base, album: { ok: true, name: msg.name, added: n, verifiedCount: n } };
  }
  return base;
}

const params = new URLSearchParams(location.search);
const onPhotos = params.get('photos') !== 'no';
if (params.get('welcome') === 'no') storage.set('welcomed', true);

const noop = () => undefined;
const event = { addListener: noop, removeListener: noop };

(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    query: () =>
      Promise.resolve([{ id: 1, url: onPhotos ? 'https://photos.google.com/' : 'https://x.y/' }]),
    sendMessage: (_id: number, msg: PanelToContent) => respond(msg),
    create: ({ url }: { url: string }) => {
      window.open(url, '_blank');
      return Promise.resolve({});
    },
    onActivated: event,
    onUpdated: event,
  },
  runtime: {
    onMessage: {
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
    },
  },
  storage: {
    local: {
      get: (key: string) => Promise.resolve({ [key]: storage.get(key) }),
      set: (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) storage.set(k, v);
        return Promise.resolve();
      },
    },
  },
};
