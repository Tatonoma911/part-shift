import { ARTBOOK, COMICS, type L } from '../../site/content';
import { lang } from '../i18n';
import { playIntro } from '../intro';

/**
 * «Комиксы» and «Артбук» from the universe screen, opened right inside the game (Антон 10.10: the tiles
 * opened nothing). Same content as the site (site/content.ts) and the same images (public/universe/),
 * shown in a DOM overlay over the canvas: a comic shelf with a page reader, and the artbook gallery.
 */

/** public/universe sits next to play/ and mobile/ on Pages and in the Android app, and next to the page in the preview. */
function uniBase(): string {
  return /\/(play|mobile)\//.test(location.pathname) ? '../universe/' : './universe/';
}

const CSS = `
.psl{position:fixed;inset:0;z-index:60;background:#eaf3f5;color:#10171c;font:500 16px/1.45 "Golos Text",system-ui,sans-serif;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px)}
.psl *{box-sizing:border-box}
.psl-bar{display:flex;align-items:center;gap:14px;padding:12px 16px;background:#10171c;color:#fff}
.psl-bar button{all:unset;cursor:pointer;width:44px;height:44px;display:grid;place-items:center;font:900 24px/1 Unbounded,system-ui,sans-serif;background:#ffffff1a;transition:background .15s,transform .12s}
.psl-bar button:hover{background:#ffffff35;transform:scale(1.12)}
.psl-bar button:active{transform:scale(.94)}
.psl-bar h2{margin:0;font:900 clamp(18px,4.6vw,26px)/1.1 Unbounded,"Golos Text",system-ui,sans-serif;letter-spacing:-.01em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psl-bar .k{font:800 11px/1 "Golos Text",system-ui,sans-serif;letter-spacing:.14em;color:#9ff4ff;display:block;margin-bottom:4px}
.psl-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 16px calc(28px + env(safe-area-inset-bottom,0px))}
.psl-in{max-width:1080px;margin:0 auto;display:grid;gap:22px}
.psl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:16px}
.psl-card{all:unset;cursor:pointer;display:grid;background:#fff;border:3px solid #10171c;box-shadow:6px 6px 0 #10171c33;transition:transform .18s,box-shadow .18s}
.psl-card:hover{transform:translate(-2px,-3px);box-shadow:8px 9px 0 #10171c55}
.psl-card:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #10171c33}
.psl-card img{width:100%;aspect-ratio:3/4;object-fit:cover;object-position:top;display:block;border-bottom:3px solid #10171c}
.psl-card div{padding:12px 14px 14px;display:grid;gap:4px}
.psl-card b{font:900 18px/1.15 Unbounded,"Golos Text",system-ui,sans-serif}
.psl-card i{font-style:normal;font:800 11px/1.2 "Golos Text",system-ui,sans-serif;letter-spacing:.12em;color:#007e89;text-transform:uppercase}
.psl-card p{margin:0;color:#3b4a52;font-size:14px}
.psl-page{display:block;width:100%;max-width:900px;margin:0 auto;border:3px solid #10171c;background:#fff}
.psl-note{margin:0;color:#3b4a52;max-width:66ch}
.psl-pager{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;max-width:900px;width:100%;margin:0 auto}
.psl-btn{all:unset;cursor:pointer;padding:12px 18px;background:#10171c;color:#fff;font:800 15px/1 "Golos Text",system-ui,sans-serif;transition:background .15s,transform .12s}
.psl-btn:hover{background:#1f2d35;transform:translateY(-2px)}
.psl-btn:active{transform:translateY(1px)}
.psl-btn.alt{background:#fff;color:#10171c;border:3px solid #10171c;padding:9px 15px}
.psl-btn.alt:hover{background:#eaf3f5}
.psl-sec h3{margin:0 0 6px;font:900 22px/1.15 Unbounded,"Golos Text",system-ui,sans-serif}
.psl-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:14px;margin-top:12px}
.psl-shot{all:unset;cursor:zoom-in;display:grid;gap:6px;transition:transform .15s}
.psl-shot:hover{transform:scale(1.03)}
.psl-shot:active{transform:scale(.97)}
.psl-shot img{width:100%;aspect-ratio:4/3;object-fit:cover;border:3px solid #10171c;background:#fff;display:block}
.psl-shot img.px{object-fit:contain;image-rendering:pixelated;background:#dfeef3}
.psl-shot span{font-size:13px;color:#3b4a52}
.psl-zoom{position:fixed;inset:0;z-index:61;background:#0b1117f2;display:grid;place-items:center;padding:16px;cursor:zoom-out}
.psl-zoom img{max-width:100%;max-height:calc(100% - 60px);object-fit:contain;transition:transform .2s}
.psl-zoom img.px{image-rendering:pixelated;min-width:min(90vw,520px)}
.psl-zoom p{margin:10px 0 0;color:#eaf3f5;text-align:center}
.psl-ru{font-size:12px;color:#7a5b00;background:#ffe14d;padding:2px 8px;justify-self:start}
`;

const tr = (l: L) => l[lang] || l.ru;
const R = (ru: string, en: string) => (lang === 'ru' ? ru : en);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Opens the shelf or the artbook; resolves when the player closes it (✕, Escape or the Android back button). */
export function openLibrary(kind: 'comics' | 'artbook'): Promise<void> {
  const base = uniBase();
  const src = (p: string) => base + p;
  const root = document.createElement('div');
  root.className = 'psl';
  root.innerHTML = `<style>${CSS}</style><div class="psl-bar"><button data-act="back" aria-label="${R('Назад', 'Back')}">←</button><div style="min-width:0;flex:1"><span class="k"></span><h2></h2></div></div><div class="psl-body"><div class="psl-in"></div></div>`;
  const kicker = root.querySelector<HTMLElement>('.k')!;
  const title = root.querySelector<HTMLElement>('h2')!;
  const body = root.querySelector<HTMLElement>('.psl-body')!;
  const inner = root.querySelector<HTMLElement>('.psl-in')!;
  document.body.appendChild(root);

  let reading = -1;
  const show = (html: string, k: string, h: string) => {
    kicker.textContent = k;
    title.textContent = h;
    inner.innerHTML = html;
    body.scrollTo(0, 0);
  };

  const shelf = () => {
    reading = -1;
    show(
      `<p class="psl-note">${R('Истории Lumen City до сирен и после. Нажми на обложку, чтобы читать.', 'Lumen City stories from before the sirens and after. Tap a cover to read.')}</p>
      <div class="psl-grid"><button class="psl-card" data-act="intro"><img src="${src('comics/intro-cover.webp')}" alt=""><div><i>${R('Пролог игры', 'Game prologue')}</i><b>${R('Как всё началось', 'How it all began')}</b><p>${R('Тот самый комикс, с которого начинается игра: 12 страниц со звуком.', 'The comic the game opens with: 12 pages with sound.')}</p></div></button>${COMICS.map(
        (c, k) => `<button class="psl-card" data-comic="${k}"><img src="${src(c.pages[lang][0])}" alt="" loading="lazy"><div><i>${esc(tr(c.series))}</i><b>${esc(tr(c.title))}</b><p>${esc(tr(c.blurb))}</p></div></button>`,
      ).join('')}</div>`,
      R('ВСЕЛЕННАЯ // КОМИКСЫ', 'UNIVERSE // COMICS'),
      R('Комиксы', 'Comics'),
    );
  };

  const read = (k: number) => {
    reading = k;
    const c = COMICS[k];
    const ruOnly = lang === 'en' && c.pages.en.some((p) => p.includes('-ru.'));
    const next = COMICS[(k + 1) % COMICS.length];
    show(
      `<p class="psl-note">${esc(tr(c.cast))}</p>${ruOnly ? '<span class="psl-ru">Russian lettering for now</span>' : ''}
      ${c.pages[lang].map((p) => `<img class="psl-page" src="${src(p)}" alt="">`).join('')}
      <div class="psl-pager"><button class="psl-btn alt" data-act="shelf">← ${R('Все комиксы', 'All comics')}</button><button class="psl-btn" data-comic="${(k + 1) % COMICS.length}">${esc(tr(next.title))} →</button></div>`,
      tr(c.series).toUpperCase(),
      tr(c.title),
    );
  };

  const artbook = () =>
    show(
      ARTBOOK.map(
        (s) => `<section class="psl-sec"><h3>${esc(tr(s.title))}</h3><p class="psl-note">${esc(tr(s.note))}</p><div class="psl-shots">${s.shots
          .map((sh) => `<button class="psl-shot" data-zoom="${src(sh.src)}" data-cap="${esc(tr(sh.cap))}"${sh.px ? ' data-px="1"' : ''}><img src="${src(sh.src)}" alt="" loading="lazy"${sh.px ? ' class="px"' : ''}><span>${esc(tr(sh.cap))}</span></button>`)
          .join('')}</div></section>`,
      ).join(''),
      R('ВСЕЛЕННАЯ // АРТБУК', 'UNIVERSE // ARTBOOK'),
      R('Артбук', 'Artbook'),
    );

  return new Promise((resolve) => {
    let zoom: HTMLElement | null = null;
    const close = () => {
      document.removeEventListener('keydown', onKey);
      root.remove();
      resolve();
    };
    /** One step back: the zoomed picture, then the comic, then the whole overlay. */
    const back = () => {
      if (zoom) {
        zoom.remove();
        zoom = null;
      } else if (reading >= 0) shelf();
      else close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back();
    };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (zoom && zoom.contains(t)) return back();
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'back') return back();
      if (act === 'shelf') return shelf();
      if (act === 'intro') return void playIntro({ skipGate: true });
      const comic = t.closest<HTMLElement>('[data-comic]');
      if (comic) return read(Number(comic.dataset.comic));
      const shot = t.closest<HTMLElement>('[data-zoom]');
      if (shot) {
        zoom = document.createElement('div');
        zoom.className = 'psl-zoom';
        zoom.innerHTML = `<div><img src="${shot.dataset.zoom}" alt=""${shot.dataset.px ? ' class="px"' : ''}><p>${shot.dataset.cap ?? ''}</p></div>`;
        root.appendChild(zoom);
      }
    });
    if (kind === 'comics') shelf();
    else artbook();
  });
}
