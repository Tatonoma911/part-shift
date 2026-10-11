/**
 * Online screen over the menu: name, mode, quick match, a private room by
 * code, and the room's waiting list. A DOM sheet (the code needs a real text
 * field) in the brand style of design/INTERFACE_SYSTEM.md: 48 px touch targets,
 * 56 px for the main actions, colour never the only signal, 10 px caps minimum.
 */
import type { AssistMode, MatchMode } from '../core/state';
import { t } from '../i18n';
import { PeerSession as OnlineSession } from './peer';
import type { LobbyInfo } from './protocol';

const NAME_KEY = 'partshift.online.name';
const MODE_KEY = 'partshift.online.mode';

const CUT8 = 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)';
const CUT12 = 'polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)';

const CSS = `
.pso{position:fixed;inset:0;z-index:60;display:flex;justify-content:center;background:rgba(11,17,23,.55);
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:"Golos Text",system-ui,sans-serif;color:#10171C;
  -webkit-tap-highlight-color:transparent;animation:pso-fade .2s ease-out}
.pso *{box-sizing:border-box}
@keyframes pso-fade{from{opacity:0}to{opacity:1}}
@keyframes pso-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pso,.pso *{animation:none!important;transition:none!important}}
.pso-sheet{width:100%;max-width:480px;height:100%;display:flex;flex-direction:column;overflow-y:auto;
  background:linear-gradient(180deg,#DFEEF3 0%,#EDF4F5 38%,#F4F7F7 100%);animation:pso-rise .28s cubic-bezier(.2,.8,.2,1);
  padding:calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))}
@media (min-width:720px){
  .pso{align-items:center;padding:24px}
  .pso-sheet{height:auto;max-height:100%;max-width:560px;padding:24px;background:#F4F7F7;clip-path:${CUT12};
    box-shadow:0 24px 60px rgba(11,17,23,.35)}
}
.pso-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.pso-head>div{flex:1}
.pso-caps{font-family:Unbounded,"Golos Text",sans-serif;font-weight:700;font-size:10px;line-height:1.3;letter-spacing:.14em;color:#115A80;text-transform:uppercase}
.pso-title{font-family:Unbounded,"Golos Text",sans-serif;font-weight:800;font-size:22px;line-height:1.2;margin:3px 0 0}
.pso-x{flex:none;width:48px;height:48px;border:0;cursor:pointer;background:#10171C;color:#F4F7F7;font-size:20px;clip-path:${CUT8}}
.pso-label{display:block;margin:16px 0 8px}
.pso-input{width:100%;height:56px;border:0;padding:0 14px;font:600 18px "Golos Text",sans-serif;color:#10171C;background:#fff;outline:none;
  clip-path:${CUT8};box-shadow:inset 0 -3px 0 rgba(17,90,128,.15)}
.pso-input:focus{box-shadow:inset 0 -3px 0 #57D8F2}
.pso-input:focus-visible{box-shadow:inset 0 0 0 3px #E8A33A}
.pso-code{text-transform:uppercase;letter-spacing:.3em;font-family:Unbounded,sans-serif;font-weight:800}
.pso-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pso-mode{border:0;cursor:pointer;text-align:left;padding:12px;background:#fff;color:#10171C;font:inherit;min-height:84px;
  clip-path:${CUT8};box-shadow:inset 0 -3px 0 rgba(17,90,128,.12)}
.pso-mode b{display:block;font-family:Unbounded,sans-serif;font-size:13px;line-height:1.2}
.pso-mode span{display:block;font-size:13px;line-height:1.3;color:#5D7079;margin-top:4px}
.pso-mode[aria-pressed=true]{background:#10171C;color:#fff;box-shadow:inset 0 -3px 0 #57D8F2}
.pso-mode[aria-pressed=true] span{color:#9FF4FF}
.pso-mode:disabled{cursor:default}
.pso-btn{width:100%;min-height:56px;border:0;cursor:pointer;margin-top:10px;padding:12px 16px;text-align:center;font:inherit;color:#10171C;background:rgba(16,23,28,.08);
  clip-path:${CUT8};display:flex;flex-direction:column;align-items:center;justify-content:center}
.pso-btn b{display:block;font-weight:700;font-size:17px;line-height:1.25}
.pso-btn span{display:block;font-size:13px;line-height:1.3;opacity:.85;margin-top:2px}
.pso-btn.primary{background:#007E89;color:#fff;box-shadow:inset 0 -4px 0 #00535B}
.pso-btn:disabled{opacity:.5;cursor:default}
.pso-btn:not(:disabled):active,.pso-mode:not(:disabled):active{transform:scale(.98)}
.pso-btn:focus-visible,.pso-mode:focus-visible,.pso-x:focus-visible,.pso-copy:focus-visible{outline:none;box-shadow:inset 0 0 0 3px #E8A33A}
.pso-row{display:flex;gap:8px;align-items:stretch}
.pso-row .pso-input{flex:1;min-width:0}
.pso-row .pso-btn{width:auto;margin-top:0;flex:none;padding:0 20px}
.pso-err{margin-top:12px;padding:12px 14px;background:#EF5C73;color:#10171C;font-weight:700;font-size:15px;line-height:1.35;
  clip-path:${CUT8}}
.pso-note{margin-top:12px;text-align:center;color:#5D7079;font-size:15px;line-height:1.35}
.pso-chip{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;margin-top:4px;padding:6px 10px;font-weight:700;font-size:13px;color:#006A74;background:#D4EFEC;
  clip-path:${CUT8}}
.pso-plate{position:relative;background:#fff;padding:16px;margin-top:4px;text-align:center;clip-path:${CUT12}}
.pso-plate::after{content:"";position:absolute;inset:4px;pointer-events:none;border:1.5px solid rgba(87,216,242,.85);
  clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px)}
.pso-bigcode{font-family:Unbounded,sans-serif;font-weight:900;font-size:40px;line-height:1.2;letter-spacing:.18em;color:#006A74;margin:6px 0}
.pso-copy{position:relative;z-index:1;min-height:48px;padding:0 12px;border:0;background:none;color:#115A80;font:700 15px "Golos Text",sans-serif;cursor:pointer;text-decoration:underline}
.pso-seats{display:flex;flex-direction:column;gap:8px;margin-top:8px;padding:0;list-style:none}
.pso-seat{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 12px;background:#fff;
  clip-path:${CUT8}}
.pso-seat.empty{background:rgba(255,255,255,.55);color:#5D7079}
.pso-num{flex:none;width:32px;height:32px;display:grid;place-items:center;font-family:Unbounded,sans-serif;font-weight:800;font-size:13px;color:#fff;background:#115A80;
  clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.pso-seat.empty .pso-num{background:#DCE4E6;color:#4B5A62}
.pso-seat-name{flex:1;min-width:0;font-weight:700;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pso-tag{font-family:Unbounded,sans-serif;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 6px;background:#EDF4F5;color:#115A80;clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)}
.pso-tag.off{background:#EF5C73;color:#10171C}
`;

let styled = false;
function style(): void {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function store(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export interface OnlineScreen {
  close(): void;
}

let open: OnlineScreen | null = null;
export const onlineScreenOpen = () => open !== null;
export const closeOnlineScreen = () => open?.close();

/** Shows the online screen; `onStart` gets the session once the match begins. */
export function openOnlineScreen(opts: { assist: AssistMode; initialCode?: string; onStart: (s: OnlineSession) => void; onClose?: () => void }): OnlineScreen {
  style();
  open?.close();
  const layer = h('div', 'pso');
  const sheet = h('div', 'pso-sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'pso-title');
  layer.appendChild(sheet);
  document.body.appendChild(layer);

  let session: OnlineSession | null = null;
  let busy = false;
  let mode: MatchMode = stored(MODE_KEY) === 'ffa' ? 'ffa' : 'coop';
  let error = '';

  const screen: OnlineScreen = {
    close() {
      if (open !== screen) return;
      open = null;
      session?.leave();
      layer.remove();
      opts.onClose?.();
    },
  };
  open = screen;

  const head = (title: string) => {
    const el = h('div', 'pso-head');
    el.innerHTML = `<div><div class="pso-caps">${esc(t('online.caps'))}</div><div class="pso-title" id="pso-title">${esc(title)}</div></div>`;
    const x = h('button', 'pso-x', '✕');
    x.setAttribute('aria-label', t('online.close'));
    x.onclick = () => screen.close();
    el.appendChild(x);
    return el;
  };

  const modeButtons = (enabled: boolean, onPick: (m: MatchMode) => void) => {
    const wrap = h('div', 'pso-modes');
    for (const m of ['coop', 'ffa'] as const) {
      const b = h('button', 'pso-mode', `<b>${esc(t(`online.mode.${m}`))}</b><span>${esc(t(`online.mode.${m}.sub`))}</span>`);
      b.setAttribute('aria-pressed', String(mode === m));
      b.disabled = !enabled;
      b.onclick = () => onPick(m);
      wrap.appendChild(b);
    }
    return wrap;
  };

  const profile = () => ({ name: stored(NAME_KEY) || t('online.name_default'), assist: opts.assist });

  /** A PeerJS "peer-unavailable" means no room answers to that code; anything else is the network. */
  const failText = (e: unknown, failKey: string) => t((e as { type?: string } | null)?.type === 'peer-unavailable' ? 'online.error.no_room' : failKey);

  const connect = async (how: () => Promise<OnlineSession>, failKey: string) => {
    if (busy) return;
    busy = true;
    error = '';
    renderHome(t('online.connecting'));
    let failed = false;
    try {
      session = await how();
      if (open !== screen) return session.leave();
      session.on({
        lobby: () => renderRoom(),
        start: () => {
          const s = session!;
          session = null;
          open = null;
          layer.remove();
          opts.onStart(s);
        },
        closed: () => {
          session = null;
          error = t('online.error.closed');
          renderHome();
        },
      });
      renderRoom();
    } catch (e) {
      failed = true;
      error = failText(e, failKey);
    } finally {
      busy = false;
    }
    // Redraw after `busy` clears, or the buttons stay disabled behind the error.
    if (failed) renderHome();
  };

  function renderHome(note = ''): void {
    sheet.replaceChildren(head(t('online.title')));

    const nameLabel = h('label', 'pso-caps pso-label', esc(t('online.name')));
    nameLabel.htmlFor = 'pso-name';
    const name = h('input', 'pso-input');
    name.id = 'pso-name';
    name.maxLength = 16;
    name.autocomplete = 'off';
    name.placeholder = t('online.name_default');
    name.value = stored(NAME_KEY);
    name.oninput = () => store(NAME_KEY, name.value.trim());
    sheet.append(nameLabel, name);

    sheet.appendChild(h('div', 'pso-caps pso-label', esc(t('online.mode'))));
    sheet.appendChild(
      modeButtons(!busy, (m) => {
        mode = m;
        store(MODE_KEY, m);
        renderHome();
      }),
    );

    const quick = h('button', 'pso-btn primary', `<b>${esc(t('online.quick'))}</b><span>${esc(t('online.quick_sub'))}</span>`);
    quick.disabled = busy;
    quick.onclick = () => connect(() => OnlineSession.quick(profile(), mode), 'online.error.connect');
    const create = h('button', 'pso-btn', `<b>${esc(t('online.create'))}</b><span>${esc(t('online.create_sub'))}</span>`);
    create.disabled = busy;
    create.onclick = () => connect(() => OnlineSession.create(profile(), mode), 'online.error.connect');
    sheet.append(quick, create);

    const codeLabel = h('label', 'pso-caps pso-label', esc(t('online.code')));
    codeLabel.htmlFor = 'pso-code';
    sheet.appendChild(codeLabel);
    const row = h('div', 'pso-row');
    const code = h('input', 'pso-input pso-code');
    code.id = 'pso-code';
    code.maxLength = 5;
    code.autocapitalize = 'characters';
    code.spellcheck = false;
    code.placeholder = 'ABCDE';
    const join = h('button', 'pso-btn', `<b>${esc(t('online.join'))}</b>`);
    const canJoin = () => !busy && code.value.trim().length === 5;
    join.disabled = !canJoin();
    code.oninput = () => (join.disabled = !canJoin());
    const go = () => canJoin() && connect(() => OnlineSession.join(profile(), code.value), 'online.error.no_room');
    join.onclick = go;
    code.onkeydown = (e) => e.key === 'Enter' && go();
    row.append(code, join);
    sheet.appendChild(row);

    if (note) {
      const line = h('div', 'pso-note', esc(note));
      line.setAttribute('role', 'status');
      sheet.appendChild(line);
    }
    if (error) {
      const err = h('div', 'pso-err', esc(error));
      err.setAttribute('role', 'alert');
      sheet.appendChild(err);
    }
  }

  function renderRoom(): void {
    const s = session;
    const info: LobbyInfo | null = s?.lobby ?? null;
    if (!s || !info) return renderHome(t('online.connecting'));
    sheet.replaceChildren(head(t(info.quick ? 'online.quick' : 'online.room')));
    const you = info.seats.find((x) => x.you);
    const host = info.seats.find((x) => x.host);
    const amHost = !!you?.host;

    // The link is up as long as this screen gets lobby updates; a drop goes to the home view with the reason.
    sheet.appendChild(h('div', 'pso-chip', `✓ ${esc(t('online.link_ok'))}`)).setAttribute('role', 'status');

    if (!info.quick) {
      const plate = h('div', 'pso-plate');
      plate.innerHTML = `<div class="pso-caps">${esc(t('online.share'))}</div><div class="pso-bigcode">${esc(info.code)}</div>`;
      const shareUrl = typeof location !== 'undefined' ? `${location.origin}${location.pathname}?room=${info.code}` : info.code;
      const copy = h('button', 'pso-copy', esc(t('online.copy_link')));
      copy.onclick = () => {
        navigator.clipboard?.writeText(shareUrl).then(() => (copy.textContent = t('online.copied')), () => undefined);
      };
      plate.appendChild(copy);
      sheet.appendChild(plate);
    }

    sheet.appendChild(h('div', 'pso-caps pso-label', esc(t('online.mode'))));
    mode = info.mode;
    sheet.appendChild(modeButtons(amHost && !info.quick, (m) => s.setMode(m)));

    sheet.appendChild(h('div', 'pso-caps pso-label', esc(t('online.waiting', { count: info.seats.length, max: info.max }))));
    const seats = h('ul', 'pso-seats');
    for (let i = 0; i < info.max; i++) {
      const seat = info.seats[i];
      const row = h('li', `pso-seat${seat ? '' : ' empty'}`);
      row.appendChild(h('div', 'pso-num', String(i + 1)));
      row.appendChild(h('div', 'pso-seat-name', esc(seat?.name ?? t('online.empty_seat'))));
      if (seat?.you) row.appendChild(h('span', 'pso-tag', esc(t('online.you'))));
      if (seat?.host && !info.quick) row.appendChild(h('span', 'pso-tag', esc(t('online.host'))));
      if (seat && !seat.connected) row.appendChild(h('span', 'pso-tag off', `! ${esc(t('online.offline'))}`));
      seats.appendChild(row);
    }
    sheet.appendChild(seats);

    if (info.quick) {
      sheet.appendChild(h('div', 'pso-note', esc(info.countdown !== null ? t('online.countdown', { seconds: info.countdown }) : t('online.searching'))));
    } else if (amHost) {
      const enough = info.seats.length >= info.min;
      const start = h('button', 'pso-btn primary', `<b>${esc(t('online.start'))}</b>${enough ? '' : `<span>${esc(t('online.start_need', { min: Math.max(2, info.min) }))}</span>`}`);
      start.disabled = !enough;
      start.onclick = () => s.start();
      sheet.appendChild(start);
    } else {
      sheet.appendChild(h('div', 'pso-note', esc(t('online.wait_host', { name: host?.name ?? '' }))));
    }
    const leave = h('button', 'pso-btn', `<b>${esc(t('online.leave'))}</b>`);
    leave.onclick = () => {
      session?.leave();
      session = null;
      renderHome();
    };
    sheet.appendChild(leave);
  }

  renderHome();
  // Deep-link: ?room=CODE — auto-fill code and join immediately.
  if (opts.initialCode && opts.initialCode.length === 5) {
    void connect(() => OnlineSession.join(profile(), opts.initialCode!), 'online.error.no_room');
  }
  return screen;
}
