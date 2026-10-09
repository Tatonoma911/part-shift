import './style.css';
import './play.css';
import { HEROES, img, type Lang } from './content';

/**
 * Frame around the game on /play. The game itself (src/main.ts) mounts into #app;
 * this file only builds the page around it. Wide screens get art and a short field guide
 * on both sides; phones get the game full screen with a slim bar and a menu into the universe.
 * The page never scrolls, so the mouse wheel stays with the game.
 */

const q = new URLSearchParams(location.search).get('lang');
let lang: Lang = q === 'ru' || q === 'en' ? q : navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
try {
  if (!q) {
    const s = localStorage.getItem('partshift.lang');
    if (s === 'ru' || s === 'en') lang = s;
  }
} catch {
  /* storage blocked */
}
const R = (ru: string, en: string) => (lang === 'ru' ? ru : en);
const A = (p: string) => `../${img(p)}`;
const site = (hash: string) => `../index.html?lang=${lang}#${hash}`;

const links: [string, string, string][] = [
  ['home', 'Вселенная', 'Universe'],
  ['heroes', 'Герои', 'Heroes'],
  ['world', 'Мир и лор', 'World and lore'],
  ['villains', 'Злодеи', 'Villains'],
  ['comics', 'Комиксы', 'Comics'],
  ['artbook', 'Артбук', 'Artbook'],
];

const close = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>';
const burger = '<svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>';

const sideHeroes = ['kiln', 'frostline', 'lineman', 'demon'].map((id) => HEROES.find((h) => h.id === id)!);

document.documentElement.lang = lang;
document.getElementById('frame')!.innerHTML = `
  <header class="pbar">
    <a class="brand" href="${site('home')}"><img src="${A('emblem.webp')}" alt="" width="28" height="28"><span class="wordmark">PART<b>SHIFT</b></span></a>
    <nav class="pnav">${links.slice(1).map(([h, ru, en]) => `<a href="${site(h)}">${R(ru, en)}</a>`).join('')}</nav>
    <span class="caps pshift">${R('СРОЧНЫЙ ВЫЗОВ // ДЕМОН', 'URGENT CALL // DEMON')}</span>
    <button class="pmenu" id="pmenu" aria-label="${R('Меню', 'Menu')}">${burger}<span>${R('Меню', 'Menu')}</span></button>
  </header>

  <div class="pstage">
    <aside class="pside left">
      <figure class="slab poster"><img src="${A('key-art.webp')}" alt=""><figcaption><span class="caps">LUMEN CITY</span>${R('Сеть спасения сломалась и перестроила город. Ты открываешь его заново.', 'The rescue network broke and rebuilt the city. You are reopening it.')}</figcaption></figure>
      <div class="slab pcard">
        <span class="caps">${R('ЦЕЛЬ СМЕНЫ', 'SHIFT GOAL')}</span>
        <p>${R('Вызов пришёл на <b>Демона</b>, одного из обезумевших героев. Найди люк Undersun, где он спит, подготовь защитников и победи его, пока Угроза не выросла.', 'The call is for <b>Demon</b>, one of the deranged heroes. Find the Undersun hatch where he sleeps, train defenders and beat him before the Threat grows.')}</p>
        <img class="pxs" src="${A('px/demon.png')}" alt="">
      </div>
    </aside>

    <div class="pgame"><div id="app"></div></div>

    <aside class="pside right">
      <div class="slab pcard">
        <span class="caps">${R('КАК ЧИТАТЬ ПОЛЕ', 'READING THE BOARD')}</span>
        <ul class="legend">
          <li><b style="color:var(--coral)">▲</b>${R('Гнёзда врагов рядом', 'Enemy nests nearby')}</li>
          <li><b style="color:var(--teal)">◆</b>${R('Находки: тайники и Энергия', 'Finds: caches and Energy')}</li>
          <li><b style="color:var(--violet)">⬡</b>${R('Демон где-то рядом', 'The Demon is close')}</li>
          <li><b style="color:#3a9a3a">✓</b>${R('Точно безопасно', 'Safe for sure')}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${R('УПРАВЛЕНИЕ', 'CONTROLS')}</span>
        <ul class="keys">
          <li><kbd>${R('Провести', 'Drag')}</kbd>${R('копать кварталы', 'dig blocks')}</li>
          <li><kbd>${R('ПКМ', 'RMB')}</kbd>${R('метка «осторожно»', '“careful” mark')}</li>
          <li><kbd>1 2 3</kbd>${R('копать, строить, в атаку', 'dig, build, attack')}</li>
          <li><kbd>${R('Пробел', 'Space')}</kbd>${R('пауза', 'pause')}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${R('ГЕРОИ НА СМЕНЕ', 'HEROES ON SHIFT')}</span>
        <div class="pheroes">${sideHeroes.map((h) => `<a href="${site(`hero-${h.id}`)}" title="${h.name[lang]}"><img src="${A(h.px)}" alt="${h.name[lang]}"><span>${h.name[lang]}</span></a>`).join('')}</div>
      </div>
    </aside>
  </div>

  <div class="drawer" id="pdrawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="pclose" aria-label="${R('Закрыть', 'Close')}">${close}</button></div>
    <button class="item resume" id="presume">${R('Вернуться в игру', 'Back to the game')}<span class="caps">▶</span></button>
    ${links.map(([h, ru, en]) => `<a class="item" href="${site(h)}">${R(ru, en)}<span class="caps">→</span></a>`).join('')}
    <figure class="drawer-art"><img src="${A('key-art.webp')}" alt=""></figure>
  </div></div>`;

const drawer = document.getElementById('pdrawer')!;
document.getElementById('pmenu')!.addEventListener('click', () => (drawer.hidden = false));
for (const id of ['pclose', 'presume']) document.getElementById(id)!.addEventListener('click', () => (drawer.hidden = true));
drawer.addEventListener('click', (e) => {
  if (e.target === drawer) drawer.hidden = true;
});
