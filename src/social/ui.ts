import { analytics } from '../analytics';
import { lang, t } from '../i18n';
import { isNative } from '../platform/native';
import { boardEnabled, rename, sendFeedback, top, type Entry } from './board';
import { CRYPTO, DONATE_DEFAULT, DONATE_MAX, DONATE_MIN, DONATE_PRESETS, EXTRA_LINKS, GAME_URL, YOOMONEY_WALLET, yoomoneyUrl } from './config';
import { displayName, profile, setName } from './profile';
import { boardId, rankOf, rankProgress, RANKS, type BoardKind } from './score';
import { copyText, download, nativeShare, socialLinks } from './share';

/**
 * Social sheets as DOM overlays over the canvas (real inputs, links and text for screen readers):
 * donation, world ranking, feedback and the share fallback. Styled like the account sheet (BRAND_UI).
 */
const CSS = `
.ps-soc-veil{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(11,17,23,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);touch-action:auto;animation:psSocIn .18s ease-out}
@keyframes psSocIn{from{opacity:0}to{opacity:1}}
.ps-soc{position:relative;width:min(420px,100%);max-height:calc(100% - 8px);overflow:auto;box-sizing:border-box;padding:26px 22px 22px;background:#F4F7F7;color:#10171C;
  font:500 15px/1.45 'Golos Text',system-ui,sans-serif;clip-path:polygon(22px 0,calc(100% - 22px) 0,100% 22px,100% calc(100% - 22px),calc(100% - 22px) 100%,22px 100%,0 calc(100% - 22px),0 22px);
  box-shadow:inset 0 0 0 2px #F4F7F7,inset 0 0 0 4px rgba(87,216,242,.9);overscroll-behavior:contain}
.ps-soc h2{margin:0 0 4px;padding-right:36px;font:800 18px/1.2 Unbounded,'Golos Text',sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#115A80}
.ps-soc .cap{margin:0 0 14px;font:700 11px/1.2 'Golos Text',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#007E89}
.ps-soc p{margin:0 0 12px}
.ps-soc .dim{color:#5B6B75;font-size:13px;overflow-wrap:anywhere}
.ps-soc .ok{color:#007E89;font-weight:700}
.ps-soc .err{color:#E03552;font-size:13px;min-height:1em}
.ps-soc button,.ps-soc a.btn{display:flex;width:100%;min-height:48px;margin:10px 0 0;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;text-decoration:none;box-sizing:border-box;
  font:700 15px/1 'Golos Text',sans-serif;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.ps-soc .pri{background:#115A80;color:#fff}
.ps-soc .gold{background:#F2B233;color:#10171C}
.ps-soc .sec{background:#DFEEF3;color:#115A80}
.ps-soc button:disabled{opacity:.5;cursor:default}
.ps-soc .x{position:absolute;top:10px;right:12px;width:40px;min-height:40px;margin:0;background:none;color:#5B6B75;font-size:22px;clip-path:none}
.ps-soc .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.ps-soc .grid button{min-height:46px;margin:0;font-size:14px;background:#DFEEF3;color:#115A80;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.ps-soc .grid button.on{background:#115A80;color:#fff}
.ps-soc .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ps-soc .row>*{margin-top:8px}
.ps-soc label{display:block;margin:12px 0 4px;font-weight:700;font-size:13px;color:#115A80}
.ps-soc input,.ps-soc textarea{width:100%;box-sizing:border-box;padding:12px;border:2px solid #C9E2EA;background:#fff;color:#10171C;font:500 16px/1.35 'Golos Text',sans-serif;border-radius:0;outline:none}
.ps-soc input:focus,.ps-soc textarea:focus{border-color:#57D8F2}
.ps-soc .sum{display:flex;align-items:center;gap:8px}.ps-soc .sum input{flex:1}.ps-soc .sum b{font-size:18px}
.ps-soc .tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 10px}
.ps-soc .tabs button{min-height:40px;margin:0;font-size:13px;background:#DFEEF3;color:#115A80;clip-path:none}
.ps-soc .tabs button.on{background:#115A80;color:#fff}
.ps-soc .me{padding:12px 14px;margin:0 0 10px;background:#10171C;color:#F4F7F7;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.ps-soc .me b{font:800 15px/1.3 Unbounded,sans-serif}.ps-soc .me .t{color:#57D8F2;font-size:13px;font-weight:700}
.ps-soc .me .bar{height:6px;margin:8px 0 4px;background:#2A3640}.ps-soc .me .bar i{display:block;height:100%;background:#57D8F2}
.ps-soc .me small{color:#9FC3D1;font-size:12px}
.ps-soc ol{list-style:none;margin:0;padding:0}
.ps-soc li{display:grid;grid-template-columns:38px 1fr auto;gap:8px;align-items:center;padding:8px 6px;border-bottom:1px solid #DCE8EC}
.ps-soc li.mine{background:#DFF7FB}
.ps-soc li .n{font:800 15px Unbounded,sans-serif;color:#115A80;text-align:center}
.ps-soc li .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.ps-soc li .nm small{display:block;font-weight:500;color:#5B6B75;font-size:11px}
.ps-soc li .s{font:800 15px Unbounded,sans-serif}
.ps-soc .kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ps-soc .kinds button{margin:0;min-height:42px;font-size:14px;background:#DFEEF3;color:#115A80}
.ps-soc .kinds button.on{background:#115A80;color:#fff}
.ps-soc .addr{display:flex;gap:8px;align-items:center;margin-top:8px}.ps-soc .addr code{flex:1;overflow:hidden;text-overflow:ellipsis;font-size:12px;background:#fff;padding:10px;border:1px solid #C9E2EA}
.ps-soc .addr button{width:auto;padding:0 14px;margin:0;min-height:40px}
`;

let root: HTMLDivElement | null = null;
let onCloseCb: (() => void) | null = null;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const fmt = (n: number) => Math.round(n).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');

function open(html: string, onClose?: () => void): HTMLDivElement {
  close();
  if (!document.getElementById('ps-soc-css')) {
    const style = document.createElement('style');
    style.id = 'ps-soc-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  root = document.createElement('div');
  root.className = 'ps-soc-veil';
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'wheel'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  });
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
    if ((e.target as HTMLElement).closest('[data-a="close"]')) close();
  });
  root.innerHTML = `<div class="ps-soc" role="dialog" aria-modal="true"><button class="x" data-a="close" aria-label="${esc(t('social.close'))}">✕</button>${html}</div>`;
  document.body.appendChild(root);
  onCloseCb = onClose ?? null;
  return root;
}

/** True while a social sheet is open (Android back closes it first). */
export function socialOpen(): boolean {
  return root !== null;
}

export function close(): void {
  if (!root) return;
  root.remove();
  root = null;
  const cb = onCloseCb;
  onCloseCb = null;
  cb?.();
}

const $ = <T extends HTMLElement>(sel: string) => root?.querySelector<T>(sel) ?? null;

// ------------------------------------------------------------------ donation

/** "Buy the author a coffee": ruble presets, any amount, card payment through ЮMoney. */
export function openDonate(from: string): void {
  analytics.track('donate_open', { from });
  let sum = DONATE_DEFAULT;
  const extra = EXTRA_LINKS.map((l) => `<a class="btn sec" href="${esc(l.url)}" target="_blank" rel="noopener" data-l="${l.id}">${esc(t(`donate.${l.id}`))}</a>`).join('');
  const crypto = CRYPTO.map((c, i) => `<div class="addr"><code title="${esc(c.address)}">${esc(c.label)}: ${esc(c.address)}</code><button class="sec" data-c="${i}">${esc(t('donate.copy'))}</button></div>`).join('');
  const form = YOOMONEY_WALLET
    ? `<div class="grid">${DONATE_PRESETS.map((v) => `<button data-v="${v}" class="${v === sum ? 'on' : ''}">${v}</button>`).join('')}</div>
      <label for="ps-sum">${esc(t('donate.custom'))}</label>
      <div class="sum"><input id="ps-sum" type="number" inputmode="numeric" min="${DONATE_MIN}" max="${DONATE_MAX}" step="1" value="${sum}"><b>₽</b></div>
      <p class="err" id="ps-err"></p>
      <button class="gold" data-a="pay">${esc(t('donate.pay', { sum: fmt(sum) }))}</button>
      <p class="dim" style="margin-top:12px">${esc(t('donate.via'))}</p>`
    : `<p class="dim">${esc(t('donate.soon'))}</p>`;
  const r = open(`<h2>☕ ${esc(t('donate.title'))}</h2><div class="cap">${esc(t('donate.caption'))}</div>
    <p>${esc(t('donate.text'))}</p>${form}
    ${extra || crypto ? `<label>${esc(t('donate.other'))}</label>${extra}${crypto}` : ''}`);
  const input = $<HTMLInputElement>('#ps-sum');
  const pay = $<HTMLButtonElement>('[data-a="pay"]');
  const err = $<HTMLElement>('#ps-err');
  const set = (v: number, fromInput = false) => {
    sum = Math.floor(v);
    r.querySelectorAll<HTMLButtonElement>('.grid button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === sum));
    if (input && !fromInput) input.value = String(sum);
    const ok = sum >= DONATE_MIN && sum <= DONATE_MAX;
    if (pay) {
      pay.disabled = !ok;
      pay.textContent = t('donate.pay', { sum: ok ? fmt(sum) : '…' });
    }
    if (err) err.textContent = ok ? '' : t('donate.bad_sum', { min: DONATE_MIN, max: fmt(DONATE_MAX) });
  };
  input?.addEventListener('input', () => set(Number(input.value) || 0, true));
  r.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const v = el.closest<HTMLElement>('[data-v]')?.dataset.v;
    if (v) set(Number(v));
    if (el.closest('[data-a="pay"]') && sum >= DONATE_MIN && sum <= DONATE_MAX) {
      analytics.track('donate_click', { from, method: 'yoomoney', sum });
      window.open(yoomoneyUrl(sum, t('donate.title')), '_blank', 'noopener');
      if (err) {
        err.className = 'ok';
        err.textContent = t('donate.thanks');
      }
    }
    const l = el.closest<HTMLElement>('[data-l]')?.dataset.l;
    if (l) analytics.track('donate_click', { from, method: l });
    const c = el.closest<HTMLElement>('[data-c]')?.dataset.c;
    if (c !== undefined) {
      const item = CRYPTO[Number(c)];
      void copyText(item.address).then(() => {
        el.textContent = t('donate.copied');
        analytics.track('donate_click', { from, method: `crypto_${item.id}` });
      });
    }
  });
}

// ------------------------------------------------------------------- ranking

export interface BoardOptions {
  tab?: BoardKind;
  /** Starts the city of the day (the menu passes it; in a match the button is hidden). */
  playDaily?: () => void;
}

function meCard(): string {
  const p = profile();
  const r = rankOf(p.total);
  const prog = rankProgress(p.total);
  const bar = prog ? `<div class="bar"><i style="width:${Math.round((prog[0] / prog[1]) * 100)}%"></i></div><small>${esc(t('board.next', { rank: t(`social.rank.${r + 1}`), left: fmt(prog[1] - prog[0]) }))}</small>` : '';
  return `<div class="me"><b>${esc(displayName(t('social.default_name')))}</b> · <span class="t">${esc(t(`social.rank.${r}`))}</span>
    <div><small>${esc(t('board.total', { score: fmt(p.total) }))} · ${esc(t('board.best', { score: fmt(p.best), runs: p.runs, wins: p.wins }))}</small></div>${bar}</div>`;
}

export function openBoard(o: BoardOptions = {}): void {
  analytics.track('board_open', { tab: o.tab ?? 'week' });
  let tab: BoardKind = o.tab ?? 'week';
  const r = open(`<h2>🏆 ${esc(t('board.title'))}</h2><div class="cap">${esc(t('board.caption'))}</div>
    <div id="ps-me"></div>
    <button class="sec" data-a="rename" style="margin:0 0 12px">${esc(t('board.rename'))}</button>
    <div id="ps-name" hidden><label for="ps-nick">${esc(t('board.name_label'))}</label><input id="ps-nick" maxlength="18" autocomplete="nickname"><p class="err" id="ps-nerr"></p><button class="pri" data-a="save">${esc(t('board.save'))}</button></div>
    <div class="tabs">${(['week', 'day', 'all'] as const).map((k) => `<button data-t="${k}">${esc(t(`board.tab.${k}`))}</button>`).join('')}</div>
    <p class="dim" id="ps-note"></p>
    ${o.playDaily ? `<button class="gold" data-a="daily" id="ps-daily">${esc(t('board.play_day'))}</button>` : ''}
    <div id="ps-list" style="margin-top:10px"></div>`);
  const meBox = $<HTMLElement>('#ps-me')!;
  const list = $<HTMLElement>('#ps-list')!;
  const drawMe = () => (meBox.innerHTML = meCard());
  drawMe();
  const load = async () => {
    r.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    $<HTMLElement>('#ps-note')!.textContent = t(`board.${tab}_note`);
    const daily = $<HTMLElement>('#ps-daily');
    if (daily) daily.hidden = tab !== 'day';
    if (!boardEnabled()) {
      list.innerHTML = `<p class="dim">${esc(t('board.off'))}</p>`;
      return;
    }
    list.innerHTML = `<p class="dim">${esc(t('board.loading'))}</p>`;
    const want = tab;
    try {
      const { rows, me } = await top(want);
      if (want !== tab || !root) return;
      list.innerHTML = rows.length ? `<ol>${rows.map((e, i) => row(e, i, e.uid === me)).join('')}</ol>` : `<p class="dim">${esc(t('board.empty'))}</p>`;
    } catch {
      if (want === tab && root) list.innerHTML = `<p class="err">${esc(t('board.error'))}</p>`;
    }
  };
  r.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const k = el.closest<HTMLElement>('[data-t]')?.dataset.t as BoardKind | undefined;
    if (k && k !== tab) {
      tab = k;
      void load();
    }
    if (el.closest('[data-a="daily"]')) {
      close();
      o.playDaily?.();
    }
    if (el.closest('[data-a="rename"]')) {
      const box = $<HTMLElement>('#ps-name')!;
      box.hidden = !box.hidden;
      const nick = $<HTMLInputElement>('#ps-nick')!;
      nick.value = profile().named ? profile().name : '';
      nick.placeholder = displayName(t('social.default_name'));
      nick.focus();
    }
    if (el.closest('[data-a="save"]')) {
      const nick = $<HTMLInputElement>('#ps-nick')!;
      if (!setName(nick.value)) {
        $<HTMLElement>('#ps-nerr')!.textContent = t('board.name_bad');
        return;
      }
      $<HTMLElement>('#ps-name')!.hidden = true;
      drawMe();
      if (boardEnabled()) void rename(Object.keys(profile().sent).filter((b) => b === 'all' || b === boardId('week') || b === boardId('day')), profile().name).then(load, () => undefined);
    }
  });
  void load();
}

function row(e: Entry, i: number, mine: boolean): string {
  const medal = ['🥇', '🥈', '🥉'][i] ?? String(i + 1);
  const rank = Math.min(Math.max(0, Number(e.rank) || 0), RANKS.length - 1);
  return `<li class="${mine ? 'mine' : ''}"><span class="n">${medal}</span><span class="nm">${esc(String(e.name))}${mine ? ` · ${esc(t('board.you'))}` : ''}<small>${esc(t(`social.rank.${rank}`))}</small></span><span class="s">${fmt(Number(e.score) || 0)}</span></li>`;
}

// ------------------------------------------------------------------ feedback

const QUEUE_KEY = 'partshift-feedback.queue';
const BUILD = `${isNative ? 'android' : 'web'} ${location.pathname}`;

function queued(): Parameters<typeof sendFeedback>[0][] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Sends messages written while the game had no backend or no network. */
export async function flushFeedback(): Promise<void> {
  if (!boardEnabled()) return;
  const q = queued();
  if (!q.length) return;
  const left: typeof q = [];
  for (const f of q) await sendFeedback(f).catch(() => left.push(f));
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(left));
  } catch {
    /* ignore */
  }
}

export function openFeedback(from: string): void {
  analytics.track('feedback_open', { from });
  let kind = 'idea';
  const r = open(`<h2>✉ ${esc(t('feedback.title'))}</h2><div class="cap">${esc(t('feedback.caption'))}</div>
    <div class="kinds">${['bug', 'idea', 'love'].map((k) => `<button data-k="${k}" class="${k === kind ? 'on' : ''}">${esc(t(`feedback.kind.${k}`))}</button>`).join('')}</div>
    <label for="ps-fb">&nbsp;</label><textarea id="ps-fb" rows="5" maxlength="1500" placeholder="${esc(t('feedback.placeholder'))}"></textarea>
    <label for="ps-ct">${esc(t('feedback.contact'))}</label><input id="ps-ct" maxlength="120" autocomplete="email">
    <p class="err" id="ps-ferr"></p>
    <button class="pri" data-a="send">${esc(t('feedback.send'))}</button>`);
  r.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const k = el.closest<HTMLElement>('[data-k]')?.dataset.k;
    if (k) {
      kind = k;
      r.querySelectorAll<HTMLButtonElement>('.kinds button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    }
    if (!el.closest('[data-a="send"]')) return;
    const text = $<HTMLTextAreaElement>('#ps-fb')!.value.trim();
    const msg = $<HTMLElement>('#ps-ferr')!;
    if (text.length < 3) {
      msg.textContent = t('feedback.short');
      return;
    }
    const f = { kind, text: text.slice(0, 1500), contact: $<HTMLInputElement>('#ps-ct')!.value.trim().slice(0, 120), lang, build: BUILD };
    const btn = el.closest<HTMLButtonElement>('button')!;
    btn.disabled = true;
    const done = (sent: boolean) => {
      analytics.track('feedback_sent', { kind, queued: sent ? 0 : 1 });
      const box = r.querySelector('.ps-soc')!;
      box.innerHTML = `<button class="x" data-a="close" aria-label="${esc(t('social.close'))}">✕</button><h2>✉ ${esc(t('feedback.title'))}</h2><p class="ok" style="margin-top:14px">${esc(t(sent ? 'feedback.sent' : 'feedback.queued'))}</p><button class="sec" data-a="close">${esc(t('social.close'))}</button>`;
    };
    const queue = () => {
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify([...queued(), f].slice(-20)));
      } catch {
        /* ignore */
      }
      done(false);
    };
    if (!boardEnabled()) return queue();
    sendFeedback(f).then(() => done(true), queue);
  });
}

// --------------------------------------------------------------------- share

/** Share a text + link (and a picture): the phone's own share sheet, else our sheet with networks, copy and save. */
export async function share(o: { from: string; text: string; url?: string; image?: Blob }): Promise<void> {
  const url = o.url ?? GAME_URL;
  const native = await nativeShare(o.text, url, o.image);
  analytics.track('share', { from: o.from, via: native ?? 'sheet', image: o.image ? 1 : 0 });
  if (native) return;
  const links = socialLinks(o.text, url)
    .map((l) => `<a class="btn sec" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
    .join('');
  const img = o.image ? URL.createObjectURL(o.image) : '';
  const r = open(
    `<h2>📣 ${esc(t('share.title'))}</h2><div class="cap">${esc(t('share.caption'))}</div>
    ${img ? `<img src="${img}" alt="" style="display:block;width:46%;margin:0 auto 6px;box-shadow:0 0 0 3px #57D8F2">` : ''}
    <p class="dim">${esc(o.text)}<br>${esc(decodeURI(url))}</p>
    ${o.image ? `<button class="gold" data-a="save">${esc(t('share.save'))}</button>` : ''}
    <button class="pri" data-a="copy">${esc(t('share.copy'))}</button>
    <div class="row">${links}</div>`,
    () => img && URL.revokeObjectURL(img),
  );
  r.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-a="copy"]')) void copyText(`${o.text} ${url}`).then(() => (el.textContent = t('share.copied')));
    if (el.closest('[data-a="save"]') && o.image) download(o.image, 'part-shift.png');
  });
}

/** "Invite a friend": the game link with a short pitch. */
export function invite(from: string): void {
  void share({ from, text: t('share.invite_text') });
}
