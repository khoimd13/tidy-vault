// Draws synthetic sample "photos" (no real photos) for the UI preview, with sharp.
// Usage: node store/src/gen-samples.mjs preview/samples
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');

const out = process.argv[2];
mkdirSync(out, { recursive: true });

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- generators (return {svg, w, h, post?}) ----------
function landscape(v, shift = 0) {
  const w = 600,
    h = 450;
  const skies = [
    ['#6fa8dc', '#cfe8ff'],
    ['#f6a46b', '#ffd9a0'],
    ['#3d5a99', '#a7c4f2'],
    ['#89c2d9', '#e9f5f9'],
  ];
  const [s1, s2] = skies[v % skies.length];
  const hills = ['#3f6e3a', '#5b8c4a', '#2f5d50', '#6d8f3e'];
  const sunX = 120 + ((v * 97) % 360) + shift;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>
      <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a7fb0"/><stop offset="1" stop-color="#1f4466"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#s)"/>
      <circle cx="${sunX}" cy="${110 + shift}" r="38" fill="#fff6d5" opacity="0.9"/>
      <path d="M0 ${260 + shift} L${90 + shift} 170 L${190 + shift} 240 L${300 + shift} 130 L${430 + shift} 250 L${520 + shift} 190 L600 230 L600 450 L0 450Z" fill="${hills[v % 4]}"/>
      <path d="M0 300 Q150 270 300 300 T600 295 L600 450 L0 450Z" fill="${hills[(v + 1) % 4]}"/>
      <rect y="${v % 2 ? 340 : 360}" width="600" height="110" fill="url(#l)" opacity="${v % 2 ? 0.85 : 0}"/>
      <g fill="#20331c">${Array.from({ length: 6 }, (_, k) => `<path d="M${40 + k * 95 + shift} 330 l14 -60 l14 60z"/>`).join('')}</g>
    </svg>`,
  };
}

function portrait(v) {
  const w = 450,
    h = 600;
  const bgs = ['#c9b8a6', '#9fb7c9', '#d8c3cf', '#b8c9a6'];
  const shirts = ['#c0504d', '#4f81bd', '#9bbb59', '#8064a2'];
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="${bgs[v % 4]}"/>
      <rect x="0" y="420" width="450" height="180" fill="#00000018"/>
      <ellipse cx="225" cy="560" rx="150" ry="140" fill="${shirts[v % 4]}"/>
      <rect x="200" y="330" width="50" height="70" fill="#e0b48f"/>
      <ellipse cx="225" cy="270" rx="78" ry="95" fill="#ecc19c"/>
      <path d="M147 250 Q150 160 225 165 Q300 160 303 250 Q290 200 225 205 Q160 200 147 250Z" fill="#3b2a20"/>
      <circle cx="198" cy="270" r="7" fill="#2b1d16"/><circle cx="252" cy="270" r="7" fill="#2b1d16"/>
      <path d="M200 315 Q225 335 250 315" stroke="#a0524a" stroke-width="5" fill="none"/>
    </svg>`,
  };
}

function food(v) {
  const w = 500,
    h = 500;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="${v % 2 ? '#8b5e3c' : '#d9cbb5'}"/>
      <circle cx="250" cy="250" r="190" fill="#f4f1ea"/><circle cx="250" cy="250" r="150" fill="#fff"/>
      <circle cx="250" cy="250" r="110" fill="${v % 2 ? '#e9a23b' : '#c94f3d'}"/>
      ${Array.from({ length: 9 }, (_, k) => `<circle cx="${190 + (k % 3) * 60}" cy="${190 + Math.floor(k / 3) * 60}" r="16" fill="${['#5a8f3a', '#f2d16b', '#7b2d26'][k % 3]}"/>`).join('')}
    </svg>`,
  };
}

const lines = (n, x, y, gap, color, maxW) =>
  Array.from(
    { length: n },
    (_, k) =>
      `<rect x="${x}" y="${y + k * gap}" rx="4" width="${maxW * (0.45 + rnd() * 0.55)}" height="${gap * 0.45}" fill="${color}"/>`,
  ).join('');

function phoneShot(kind) {
  const w = 390,
    h = 845;
  const status = `<rect width="390" height="44" fill="#000" opacity="0.04"/><text x="24" y="30" font-family="Arial" font-size="15" font-weight="bold" fill="#111">9:41</text><rect x="330" y="18" width="36" height="14" rx="3" fill="none" stroke="#111" stroke-width="2"/><rect x="333" y="21" width="24" height="8" fill="#111"/>`;
  let body = '';
  if (kind === 'chat') {
    body =
      `<rect y="44" width="390" height="64" fill="#f4f4f6"/><circle cx="44" cy="76" r="20" fill="#9bb6e0"/><text x="76" y="83" font-family="Arial" font-size="18" fill="#111">Mia</text>` +
      Array.from({ length: 9 }, (_, k) => {
        const me = k % 3 === 1;
        const bw = 140 + rnd() * 120;
        const y = 130 + k * 72;
        return `<rect x="${me ? 390 - 16 - bw : 16}" y="${y}" width="${bw}" height="52" rx="20" fill="${me ? '#3b82f6' : '#e6e6ea'}"/><rect x="${me ? 390 - bw : 32}" y="${y + 20}" width="${bw - 40}" height="10" rx="5" fill="${me ? '#ffffffaa' : '#00000033'}"/>`;
      }).join('') +
      `<rect x="16" y="790" width="358" height="40" rx="20" fill="#f0f0f2"/>`;
    return {
      w,
      h,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>${status}${body}</svg>`,
    };
  }
  if (kind === 'shop') {
    body = `<rect x="16" y="56" width="358" height="40" rx="20" fill="#f1f1f1"/><text x="40" y="82" font-family="Arial" font-size="15" fill="#888">Search products</text>
      <rect x="16" y="112" width="358" height="330" rx="14" fill="${['#f3e3d3', '#dde8f3', '#e8f0dc'][Math.floor(rnd() * 3)]}"/>
      <path d="M110 380 Q195 180 280 380Z" fill="#00000022"/><rect x="140" y="200" width="110" height="170" rx="18" fill="#c46b3d"/>
      <text x="16" y="480" font-family="Arial" font-size="22" font-weight="bold" fill="#111">Running shoes, light</text>
      <text x="16" y="516" font-family="Arial" font-size="26" font-weight="bold" fill="#d0342c">$59.99</text>
      <text x="120" y="516" font-family="Arial" font-size="16" fill="#999" text-decoration="line-through">$89.00</text>
      <text x="16" y="548" font-family="Arial" font-size="15" fill="#e8a317">★★★★☆ 1,204 reviews</text>
      ${lines(4, 16, 575, 26, '#00000022', 340)}
      <rect x="16" y="760" width="358" height="56" rx="28" fill="#f7b500"/><text x="130" y="795" font-family="Arial" font-size="19" font-weight="bold" fill="#111">Add to cart</text>`;
    return {
      w,
      h,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>${status}${body}</svg>`,
    };
  }
  if (kind === 'settings') {
    body =
      `<text x="20" y="96" font-family="Arial" font-size="32" font-weight="bold" fill="#111">Settings</text>` +
      Array.from(
        { length: 11 },
        (_, k) =>
          `<rect x="16" y="${120 + k * 62}" width="358" height="54" rx="10" fill="#f2f2f7"/><rect x="28" y="${132 + k * 62}" width="30" height="30" rx="7" fill="${['#ff9500', '#34c759', '#007aff', '#ff3b30', '#5856d6'][k % 5]}"/><rect x="72" y="${141 + k * 62}" width="${120 + rnd() * 120}" height="12" rx="6" fill="#00000044"/>`,
      ).join('');
    return {
      w,
      h,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>${status}${body}</svg>`,
    };
  }
  // ticket / boarding pass style
  body = `<rect x="20" y="80" width="350" height="640" rx="22" fill="#1f3b73"/><text x="44" y="140" font-family="Arial" font-size="20" fill="#fff">Boarding pass</text>
    <text x="44" y="220" font-family="Arial" font-size="54" font-weight="bold" fill="#fff">SGN</text><text x="230" y="220" font-family="Arial" font-size="54" font-weight="bold" fill="#fff">BKK</text>
    <rect x="60" y="440" width="270" height="200" fill="#fff"/>${Array.from({ length: 30 }, (_, k) => `<rect x="${70 + k * 8.5}" y="460" width="${k % 3 ? 4 : 2}" height="160" fill="#111"/>`).join('')}`;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#eef1f6"/>${status}${body}</svg>`,
  };
}

function desktopShot() {
  const w = 800,
    h = 450;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f7f7f9"/>
      <rect width="800" height="34" fill="#dfe1e5"/><circle cx="18" cy="17" r="6" fill="#ff5f57"/><circle cx="38" cy="17" r="6" fill="#febc2e"/><circle cx="58" cy="17" r="6" fill="#28c840"/>
      <rect x="90" y="8" width="420" height="20" rx="10" fill="#fff"/>
      <rect x="0" y="34" width="170" height="416" fill="#eceef2"/>${lines(10, 16, 60, 34, '#00000026', 130)}
      <text x="200" y="80" font-family="Arial" font-size="24" font-weight="bold" fill="#222">Quarterly report</text>
      ${lines(5, 200, 100, 26, '#00000030', 560)}
      ${Array.from({ length: 6 }, (_, k) => `<rect x="${210 + k * 90}" y="${420 - (60 + k * 25)}" width="50" height="${60 + k * 25}" fill="#4f7fd9"/>`).join('')}
    </svg>`,
  };
}

function receipt(v) {
  const w = 360,
    h = 720;
  const items = [
    'Coffee beans',
    'Oat milk',
    'Bananas',
    'Bread',
    'Pasta',
    'Tomatoes',
    'Cheese',
    'Eggs x12',
  ];
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${v % 2 ? '#7a6a58' : '#5b5f66'}"/>
      <g transform="rotate(${v % 2 ? -4 : 3} 180 360)"><rect x="50" y="30" width="260" height="660" fill="#fbfaf5"/>
      <text x="180" y="80" text-anchor="middle" font-family="Courier New" font-size="20" font-weight="bold" fill="#222">CORNER MARKET</text>
      <text x="180" y="104" text-anchor="middle" font-family="Courier New" font-size="12" fill="#444">12 Main St · Tel 555-0142</text>
      ${items.map((it, k) => `<text x="66" y="${150 + k * 30}" font-family="Courier New" font-size="14" fill="#333">${it}</text><text x="294" y="${150 + k * 30}" text-anchor="end" font-family="Courier New" font-size="14" fill="#333">${(2 + ((k * 37 + v * 11) % 70) / 10).toFixed(2)}</text>`).join('')}
      <line x1="66" y1="410" x2="294" y2="410" stroke="#333" stroke-dasharray="4 3"/>
      <text x="66" y="440" font-family="Courier New" font-size="18" font-weight="bold" fill="#111">TOTAL</text><text x="294" y="440" text-anchor="end" font-family="Courier New" font-size="18" font-weight="bold" fill="#111">38.60</text>
      <text x="66" y="470" font-family="Courier New" font-size="13" fill="#333">VISA ****  CHANGE 0.00</text>
      <text x="180" y="530" text-anchor="middle" font-family="Courier New" font-size="13" fill="#333">THANK YOU</text>
      ${Array.from({ length: 34 }, (_, k) => `<rect x="${80 + k * 6}" y="570" width="${k % 4 ? 3 : 1.5}" height="60" fill="#111"/>`).join('')}</g></svg>`,
  };
}

function documentPage() {
  const w = 480,
    h = 640;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#6b5b4b"/>
      <g transform="rotate(-2 240 320)"><rect x="40" y="30" width="400" height="580" fill="#fdfdfb"/>
      <text x="70" y="90" font-family="Times New Roman" font-size="24" font-weight="bold" fill="#111">RENTAL AGREEMENT</text>
      ${lines(16, 70, 120, 26, '#00000040', 330)}
      <path d="M90 560 q20 -30 40 0 t40 0 t40 -10" stroke="#1a3d8f" stroke-width="3" fill="none"/></g></svg>`,
  };
}

function whiteboard() {
  const w = 600,
    h = 450;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#8a8f96"/>
      <rect x="30" y="30" width="540" height="390" fill="#f4f6f5"/>
      <text x="60" y="90" font-family="Comic Sans MS" font-size="30" fill="#1b4fa0">Sprint plan</text>
      <path d="M60 110 H260" stroke="#1b4fa0" stroke-width="3"/>
      <rect x="70" y="150" width="120" height="70" fill="none" stroke="#c0392b" stroke-width="4"/><rect x="330" y="150" width="140" height="70" fill="none" stroke="#c0392b" stroke-width="4"/>
      <path d="M190 185 H330" stroke="#222" stroke-width="3"/><path d="M318 177 L330 185 L318 193" stroke="#222" stroke-width="3" fill="none"/>
      <text x="80" y="290" font-family="Comic Sans MS" font-size="22" fill="#222">- fix login</text><text x="80" y="325" font-family="Comic Sans MS" font-size="22" fill="#222">- ship v2</text><text x="80" y="360" font-family="Comic Sans MS" font-size="22" fill="#2e7d32">- demo Fri!</text></svg>`,
  };
}

function meme(v) {
  const w = 500,
    h = 500;
  const tops = ['WHEN THE CODE', 'ME ON MONDAY', 'NOBODY:'];
  const bots = ['WORKS FIRST TRY', 'BEFORE COFFEE', 'MY CAT AT 3AM'];
  const base = v === 1 ? '#e8c07a' : v === 2 ? '#7aa6c9' : '#b5a3cf';
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${base}"/>
      <ellipse cx="250" cy="300" rx="130" ry="120" fill="#f2d9b8"/><path d="M140 220 L120 120 L200 190Z M360 220 L380 120 L300 190Z" fill="#f2d9b8"/>
      <circle cx="205" cy="280" r="22" fill="#222"/><circle cx="295" cy="280" r="22" fill="#222"/><circle cx="212" cy="272" r="7" fill="#fff"/><circle cx="302" cy="272" r="7" fill="#fff"/>
      <path d="M235 330 Q250 345 265 330" stroke="#222" stroke-width="5" fill="none"/>
      <text x="250" y="70" text-anchor="middle" font-family="Impact, Arial Black" font-size="54" fill="#fff" stroke="#000" stroke-width="3">${tops[v % 3]}</text>
      <text x="250" y="470" text-anchor="middle" font-family="Impact, Arial Black" font-size="54" fill="#fff" stroke="#000" stroke-width="3">${bots[v % 3]}</text></svg>`,
  };
}

function quote() {
  const w = 500,
    h = 500;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff9a8b"/><stop offset="1" stop-color="#a18cd1"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="250" y="210" text-anchor="middle" font-family="Georgia" font-size="34" font-style="italic" fill="#fff">"Good morning!</text>
      <text x="250" y="260" text-anchor="middle" font-family="Georgia" font-size="34" font-style="italic" fill="#fff">Have a blessed</text>
      <text x="250" y="310" text-anchor="middle" font-family="Georgia" font-size="34" font-style="italic" fill="#fff">day ahead"</text>
      <text x="250" y="420" text-anchor="middle" font-family="Arial" font-size="40" fill="#ffe680">✿ ❀ ✿</text></svg>`,
  };
}

function pocket() {
  // accidental shot: dark, tilted, fabric
  const w = 450,
    h = 600;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1a1714"/>
      <ellipse cx="160" cy="420" rx="300" ry="200" fill="#2b241f"/><ellipse cx="380" cy="120" rx="140" ry="90" fill="#3a2f27" opacity="0.6"/>
      <rect x="-40" y="230" width="600" height="40" fill="#2a2420" transform="rotate(-18 225 250)"/></svg>`,
    post: (s) => s.blur(14).modulate({ brightness: 0.7 }),
  };
}

function floor() {
  const w = 600,
    h = 450;
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#9b8466"/>
      ${Array.from({ length: 8 }, (_, k) => `<rect x="0" y="${k * 60}" width="600" height="3" fill="#7d6950"/>`).join('')}
      <ellipse cx="520" cy="80" rx="90" ry="60" fill="#2d2d2d"/></svg>`,
    post: (s) => s.blur(6),
  };
}

const items = [];
const add = async (name, g, post) => {
  let s = sharp(Buffer.from(g.svg));
  if (post) s = post(s);
  if (g.post) s = g.post(s);
  await s.jpeg({ quality: 86 }).toFile(join(out, `${name}.jpg`));
  items.push(`${name}.jpg`);
};

// Order matters: the preview gives item i the date year 2019+(i%6), month (i%9)+1, and makes item
// i a video when i%7===3 (2 s when i%14===3, else 4 min). Items i and i+18 share a date, which is
// how near-duplicates are placed.
const plan = [];
const slots = new Array(54).fill(null);
const put = (i, name, gen, post) => (slots[i] = { name, gen, post });
// near-duplicate bursts: (0,18,36) and (1,19,37)
put(0, 'trip-lake-a', () => landscape(1));
put(18, 'trip-lake-b', () => landscape(1, 3));
put(36, 'trip-lake-c', () => landscape(1, 6));
put(1, 'portrait-a', () => portrait(0));
put(
  19,
  'portrait-b',
  () => portrait(0),
  (s) => s.modulate({ brightness: 1.03 }),
);
put(
  37,
  'portrait-c',
  () => portrait(0),
  (s) => s.blur(1.2),
);
// videos at i%7===3: 3 (2 s), 10 (4 min), 17 (2 s), 24 (4 min), 31 (2 s), 38 (4 min), 45 (2 s), 52 (4 min)
put(3, 'video-floor', floor);
put(10, 'video-kids', () => landscape(2));
put(17, 'video-pocket', pocket);
put(24, 'video-chat', () => phoneShot('chat'));
put(
  31,
  'video-blur',
  () => landscape(3),
  (s) => s.blur(10),
);
const fill = [
  ['shot-chat-1', () => phoneShot('chat')],
  ['shot-shop-1', () => phoneShot('shop')],
  ['shot-settings', () => phoneShot('settings')],
  ['shot-ticket', () => phoneShot('ticket')],
  ['shot-shop-2', () => phoneShot('shop')],
  ['shot-chat-2', () => phoneShot('chat')],
  ['shot-desktop', desktopShot],
  ['shot-chat-3', () => phoneShot('chat')],
  ['shot-shop-3', () => phoneShot('shop')],
  ['receipt-1', () => receipt(0)],
  ['receipt-2', () => receipt(1)],
  ['document', documentPage],
  ['whiteboard', whiteboard],
  ['meme-1', () => meme(0)],
  ['meme-2', () => meme(1)],
  ['meme-3', () => meme(2)],
  ['quote-card', quote],
  ['blurry-1', () => landscape(0), (s) => s.blur(9)],
  ['blurry-2', () => portrait(2), (s) => s.blur(12)],
  ['dark-1', () => landscape(2), (s) => s.modulate({ brightness: 0.12 })],
  ['pocket', pocket],
  ['floor', floor],
  ['keep-food-1', () => food(0)],
  ['keep-food-2', () => food(1)],
  ['keep-land-1', () => landscape(0)],
  ['keep-land-2', () => landscape(2)],
  ['keep-land-3', () => landscape(3)],
  ['keep-portrait-1', () => portrait(1)],
  ['keep-portrait-2', () => portrait(3)],
  ['shot-settings-2', () => phoneShot('settings')],
  ['receipt-3', () => receipt(2)],
  ['blurry-3', () => food(0), (s) => s.blur(10)],
  ['keep-land-4', () => landscape(1)],
  ['shot-ticket-2', () => phoneShot('ticket')],
  ['meme-4', () => meme(1)],
  ['keep-portrait-3', () => portrait(2)],
  ['dark-2', () => portrait(1), (s) => s.modulate({ brightness: 0.1 })],
  ['shot-desktop-2', desktopShot],
  ['keep-food-3', () => food(1)],
  ['keep-land-5', () => landscape(2)],
  ['shot-chat-4', () => phoneShot('chat')],
  ['receipt-4', () => receipt(3)],
  ['keep-land-6', () => landscape(0)],
  ['keep-portrait-4', () => portrait(3)],
  ['shot-shop-4', () => phoneShot('shop')],
  ['keep-food-4', () => food(0)],
];
let f = 0;
for (let i = 0; i < slots.length && f < fill.length; i++) {
  if (slots[i] || i % 7 === 3) {
    if (!slots[i])
      slots[i] = {
        name: `video-${i}`,
        gen: () => landscape(i % 4),
        post: i % 14 === 3 ? (s) => s.blur(8) : undefined,
      };
    continue;
  }
  const [name, gen, post] = fill[f++];
  slots[i] = { name, gen, post };
}
for (const s of slots) if (s) await add(s.name, s.gen(), s.post);
writeFileSync(join(out, 'index.json'), JSON.stringify(items, null, 2));
console.log(items.length, 'samples');
