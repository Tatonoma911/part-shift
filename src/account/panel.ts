import { t } from '../i18n';
import { account } from './cloud';

/**
 * The account sheet: a DOM overlay over the canvas (real text, a real Google button, works with screen readers).
 * Open it from any menu with openAccountPanel(). Styled after BRAND_UI: ceramic plate with cut corners, cyan seam.
 */
const CSS = `
.ps-acc-veil{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(11,17,23,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);touch-action:auto;animation:psAccIn .18s ease-out}
@keyframes psAccIn{from{opacity:0}to{opacity:1}}
.ps-acc{position:relative;width:min(380px,100%);box-sizing:border-box;padding:26px 24px 22px;background:#F4F7F7;color:#10171C;
  font:500 15px/1.45 'Golos Text',system-ui,sans-serif;clip-path:polygon(22px 0,calc(100% - 22px) 0,100% 22px,100% calc(100% - 22px),calc(100% - 22px) 100%,22px 100%,0 calc(100% - 22px),0 22px);
  box-shadow:inset 0 0 0 2px #F4F7F7,inset 0 0 0 4px rgba(87,216,242,.9)}
.ps-acc h2{margin:0 0 4px;font:800 18px/1.2 Unbounded,'Golos Text',sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#115A80}
.ps-acc .cap{margin:0 0 16px;font:700 11px/1 'Golos Text',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#007E89}
.ps-acc p{margin:0 0 14px}
.ps-acc .dim{color:#5B6B75;font-size:13px}
.ps-acc .err{color:#E03552;font-size:13px}
.ps-acc .who{display:flex;gap:12px;align-items:center;margin:0 0 14px}
.ps-acc .who img,.ps-acc .who .ava{width:44px;height:44px;border-radius:50%;background:#115A80;color:#fff;display:grid;place-items:center;font:800 18px Unbounded,sans-serif;object-fit:cover}
.ps-acc .who b{display:block;font-weight:700}
.ps-acc button{display:flex;width:100%;min-height:48px;margin:10px 0 0;align-items:center;justify-content:center;gap:10px;border:0;cursor:pointer;
  font:700 15px/1 'Golos Text',sans-serif;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.ps-acc button.pri{background:#115A80;color:#fff}
.ps-acc button.sec{background:#DFEEF3;color:#115A80}
.ps-acc button.g{background:#fff;color:#10171C;box-shadow:inset 0 0 0 2px #C9E2EA}
.ps-acc button:disabled{opacity:.55;cursor:default}
.ps-acc .x{position:absolute;top:10px;right:12px;width:40px;min-height:40px;margin:0;background:none;color:#5B6B75;font-size:22px;clip-path:none}
`;

const G_LOGO = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;

let root: HTMLDivElement | null = null;
let unlisten: (() => void) | null = null;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function clock(ms: number): string {
  const d = new Date(ms);
  const same = d.toDateString() === new Date().toDateString();
  return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function errorText(code: string): string {
  const known = ['auth/network-request-failed', 'auth/unauthorized-domain', 'auth/operation-not-supported-in-this-environment', 'auth/popup-blocked'];
  return t(known.includes(code) ? `account.error.${code.slice(5)}` : 'account.error.generic');
}

function render(): void {
  if (!root) return;
  const v = account.view;
  const busy = v.status === 'connecting';
  let body = '';
  if (v.conflict) {
    body = `<p>${t('account.conflict.text', { time: clock(v.conflict.changedAt) })}</p>
      <button class="pri" data-a="cloud">${t('account.conflict.cloud')}</button>
      <button class="sec" data-a="local">${t('account.conflict.local')}</button>`;
  } else if (v.status === 'disabled') {
    body = `<p>${t('account.disabled')}</p>`;
  } else if (v.status === 'signed') {
    const ava = v.photo ? `<img src="${esc(v.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="ava">${esc((v.name || v.email || '?')[0].toUpperCase())}</span>`;
    body = `<div class="who">${ava}<div><b>${esc(v.name || t('account.player'))}</b><span class="dim">${esc(v.email)}</span></div></div>
      <p class="dim">${v.syncedAt ? t('account.synced', { time: clock(v.syncedAt) }) : t('account.syncing')}</p>
      <button class="pri" data-a="sync">${t('account.sync_now')}</button>
      <button class="sec" data-a="out">${t('account.sign_out')}</button>`;
  } else {
    body = `<p>${t('account.guest.text')}</p>
      <button class="g" data-a="in" ${busy ? 'disabled' : ''}>${G_LOGO}${t(busy ? 'account.connecting' : 'account.google')}</button>
      <p class="dim" style="margin-top:12px">${t('account.guest.note')}</p>`;
  }
  const err = v.error ? `<p class="err">${errorText(v.error)}</p>` : '';
  root.innerHTML = `<div class="ps-acc" role="dialog" aria-modal="true" aria-labelledby="ps-acc-h">
    ${v.conflict ? '' : `<button class="x" data-a="close" aria-label="${t('account.close')}">✕</button>`}
    <h2 id="ps-acc-h">${t(v.conflict ? 'account.conflict.title' : 'account.title')}</h2>
    <div class="cap">${t('account.caption')}</div>${err}${body}</div>`;
}

function onClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (target === root && !account.view.conflict) return closeAccountPanel();
  const a = target.closest<HTMLElement>('[data-a]')?.dataset.a;
  if (a === 'close') closeAccountPanel();
  else if (a === 'in') void account.signIn();
  else if (a === 'out') void account.signOut();
  else if (a === 'sync') void account.syncNow();
  else if (a === 'cloud') account.acceptCloud();
  else if (a === 'local') {
    account.keepLocal();
    closeAccountPanel();
  }
}

export function openAccountPanel(): void {
  if (root) return render();
  if (!document.getElementById('ps-acc-css')) {
    const style = document.createElement('style');
    style.id = 'ps-acc-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  root = document.createElement('div');
  root.className = 'ps-acc-veil';
  // Keep taps and keys away from the game underneath.
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'wheel'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => e.stopPropagation());
  root.addEventListener('click', onClick);
  document.body.appendChild(root);
  unlisten = account.onChange(render);
  render();
}

export function closeAccountPanel(): void {
  unlisten?.();
  unlisten = null;
  root?.remove();
  root = null;
}

/** Shows the panel by itself when a newer run from another device needs the player's choice. */
export function watchAccountConflicts(): void {
  account.onChange(() => {
    if (account.view.conflict && !root) openAccountPanel();
  });
}
