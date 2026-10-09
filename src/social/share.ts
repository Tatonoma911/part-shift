import { t } from '../i18n';
import { GAME_URL } from './config';

/** Link that opens the game straight on the same map with the friend's score to beat. */
export function challengeUrl(seed: number, score: number, name: string): string {
  const q = new URLSearchParams({ seed: String(seed), vs: String(score), by: name.slice(0, 18) });
  return `${GAME_URL}?${q}`;
}

/** The challenge a shared link carries (?seed=…&vs=…&by=…), or null. */
export function readChallenge(params = new URLSearchParams(location.search)): { seed: number; score: number; name: string } | null {
  const seed = Number(params.get('seed'));
  const score = Number(params.get('vs'));
  if (!seed || !Number.isFinite(score) || score <= 0) return null;
  return { seed, score: Math.floor(score), name: (params.get('by') ?? '').replace(/[<>&"']/g, '').slice(0, 18) || '?' };
}

export interface CardInfo {
  kind: 'win' | 'lose' | 'live';
  score?: number;
  time: string;
  threat: number;
  nests: number;
  name: string;
  rank: string;
  /** A small top line, e.g. "City of the day 2026-10-09". */
  tag?: string;
}

const W = 1080;
const H = 1920;

function cut(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * A vertical 1080×1920 card for stories and Shorts: brand header, the board snapshot,
 * the score and a "beat my score" line with the link.
 */
export async function resultCard(shot: HTMLImageElement | null, info: CardInfo): Promise<Blob> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0E3F5C');
  bg.addColorStop(1, '#0B1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Hazard tape at the top and the bottom.
  for (const ty of [0, H - 34]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ty, W, 34);
    ctx.clip();
    for (let x = -60; x < W + 60; x += 60) {
      ctx.fillStyle = (x / 60) % 2 ? '#F2B233' : '#10171C';
      ctx.beginPath();
      ctx.moveTo(x, ty + 34);
      ctx.lineTo(x + 30, ty);
      ctx.lineTo(x + 60, ty);
      ctx.lineTo(x + 30, ty + 34);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = "900 120px Unbounded, 'Golos Text', sans-serif";
  const pw = ctx.measureText('PART').width;
  const sw = ctx.measureText('SHIFT').width;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F4F7F7';
  ctx.fillText('PART', (W - pw - sw) / 2, 200);
  ctx.fillStyle = '#57D8F2';
  ctx.fillText('SHIFT', (W - pw - sw) / 2 + pw, 200);
  ctx.textAlign = 'center';
  ctx.font = "700 30px Unbounded, 'Golos Text', sans-serif";
  ctx.fillStyle = '#9FC3D1';
  ctx.fillText((info.tag ?? t('game.subtitle')).toUpperCase(), W / 2, 258);

  // Board snapshot in a ceramic frame.
  const fx = 70;
  const fy = 300;
  const fw = W - 140;
  const fh = 1040;
  ctx.fillStyle = '#F4F7F7';
  cut(ctx, fx - 12, fy - 12, fw + 24, fh + 24, 40);
  ctx.fill();
  ctx.save();
  cut(ctx, fx, fy, fw, fh, 32);
  ctx.clip();
  ctx.fillStyle = '#DFEEF3';
  ctx.fillRect(fx, fy, fw, fh);
  if (shot) {
    const s = Math.max(fw / shot.width, fh / shot.height);
    const dw = shot.width * s;
    const dh = shot.height * s;
    ctx.drawImage(shot, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
  }
  ctx.restore();
  ctx.strokeStyle = '#57D8F2';
  ctx.lineWidth = 4;
  cut(ctx, fx - 4, fy - 4, fw + 8, fh + 8, 36);
  ctx.stroke();

  // Result stamp.
  const label = t(`share.card.${info.kind}`).toUpperCase();
  ctx.font = "800 56px Unbounded, 'Golos Text', sans-serif";
  ctx.fillStyle = info.kind === 'lose' ? '#E03552' : info.kind === 'win' ? '#F2B233' : '#57D8F2';
  ctx.fillText(label, W / 2, 1450);
  if (info.score !== undefined) {
    ctx.font = "900 150px Unbounded, 'Golos Text', sans-serif";
    ctx.fillStyle = '#F4F7F7';
    ctx.fillText(info.score.toLocaleString('ru-RU'), W / 2, 1615);
    ctx.font = "700 32px Unbounded, 'Golos Text', sans-serif";
    ctx.fillStyle = '#9FC3D1';
    ctx.fillText(t('share.card.score').toUpperCase(), W / 2, 1662);
  }
  ctx.font = "500 36px 'Golos Text', sans-serif";
  ctx.fillStyle = '#C9E2EA';
  ctx.fillText(`${info.name} · ${info.rank}`, W / 2, info.score !== undefined ? 1725 : 1540);
  ctx.fillText(t('share.card.stats', { time: info.time, threat: info.threat, nests: info.nests }), W / 2, info.score !== undefined ? 1775 : 1600);
  // CTA and link on one line, shrunk to fit.
  const line = `${t('share.card.cta').toUpperCase()} → ${GAME_URL.replace(/^https:\/\//, '').replace(/\/$/, '')}`;
  let size = 34;
  do ctx.font = `800 ${size}px Unbounded, 'Golos Text', sans-serif`;
  while (ctx.measureText(line).width > W - 80 && --size > 16);
  ctx.fillStyle = '#57D8F2';
  ctx.fillText(line, W / 2, 1855);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
}

export type ShareOutcome = 'native' | 'sheet' | 'cancel';

/** Native share sheet when the device has one (phones), with the picture when it can carry files. */
export async function nativeShare(text: string, url: string, file?: Blob): Promise<ShareOutcome | null> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share) return null;
  const data: ShareData = { text, url };
  if (file) {
    const f = new File([file], 'part-shift.png', { type: 'image/png' });
    if (nav.canShare?.({ files: [f] })) data.files = [f];
  }
  try {
    await nav.share(data);
    return 'native';
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError' ? 'cancel' : null;
  }
}

export function socialLinks(text: string, url: string): { id: string; label: string; href: string }[] {
  const u = encodeURIComponent(url);
  const tx = encodeURIComponent(text);
  return [
    { id: 'tg', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${tx}` },
    { id: 'vk', label: 'VK', href: `https://vk.com/share.php?url=${u}&title=${tx}` },
    { id: 'wa', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${tx}&url=${u}` },
  ];
}

export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
