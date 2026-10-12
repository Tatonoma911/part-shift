import './style.css';
import { androidSoon, supportBlock, wireSupport } from './support';
import { ADS, ARCHIVE, ARTBOOK, BARKS, COMICS, DISTRICTS, HEROES, img, REACTIONS, TECH, UI, type Hero, type L, type Lang } from './content';

/**
 * The PARTSHIFT universe site: one page, views switched by plain hash tokens
 * (#heroes, #hero-kiln, #world, #villains, #comics, #comic-pressure-test, #artbook),
 * so deep links also survive inside a claude.ai Artifact.
 */

const LANG_KEY = 'partshift.lang';

function detectLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ru' || q === 'en') return q;
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (s === 'ru' || s === 'en') return s;
  } catch {
    /* storage blocked */
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

let lang: Lang = detectLang();
const tr = (l: L) => l[lang] || l.ru;
const u = (k: string) => tr(UI[k]);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const R = (ru: string, en: string) => (lang === 'ru' ? ru : en);

/** The game lives next to the site; it reads ?lang itself. */
const playHref = () => `play/index.html?lang=${lang}`;

const NAV = ['heroes', 'world', 'villains', 'comics', 'artbook'] as const;

const ICON = {
  burger: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>',
  close: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>',
};

// ------------------------------------------------------------------ chrome

function bar(active: string): string {
  const links = NAV.map((k) => `<a href="#${k}"${active === k ? ' aria-current="page"' : ''}>${u(k)}</a>`).join('');
  return `
  <header class="bar"><div class="wrap bar-in">
    <a class="brand" href="#home" aria-label="PART SHIFT">
      <img src="${img('emblem.webp')}" alt="" width="34" height="34">
      <span class="wordmark">PART<b>SHIFT</b></span>
    </a>
    <nav class="nav" aria-label="${u('menu')}">${links}</nav>
    ${langSwitch()}
    <a class="btn btn-primary" href="${playHref()}">${ICON.play}${u('play')}</a>
    <button class="burger" id="burger" aria-label="${u('menu')}">${ICON.burger}</button>
  </div></header>`;
}

function langSwitch(): string {
  return `<div class="lang" role="group" aria-label="Language">
    <button data-lang="ru" aria-pressed="${lang === 'ru'}">RU</button><button data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
  </div>`;
}

function drawer(): string {
  const items = (['home', ...NAV, 'updates'] as string[])
    .map((k) => `<a class="item" href="#${k}">${u(k)}<span class="caps">${k === 'home' ? 'LUMEN CITY' : ''}</span></a>`)
    .join('');
  return `<div class="drawer" id="drawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="drawer-close" aria-label="${u('close')}">${ICON.close}</button></div>
    ${items}
    <span class="item soon" aria-disabled="true">Android<span class="caps">${R('В РАЗРАБОТКЕ', 'IN DEVELOPMENT')}</span></span>
    <a class="item" href="#support">${R('Донат автору', 'Tip the author')}<span class="caps">☕</span></a>
    <div class="row" style="margin-top:18px;justify-content:space-between">${langSwitch()}<a class="btn btn-primary" href="${playHref()}">${ICON.play}${u('play')}</a></div>
  </div></div>`;
}

function contactBlock(): string {
  const teaser = R(
    'Эту игру делает один человек. Хотите узнать, как так вышло? Нажмите.',
    'One person makes this game. Want to know how that happened? Click.',
  );
  const full = [
    R(
      'Эту игру делаю я один, а в сети меня чаще всего найти по логину @kazakovant. Он одинаковый в Telegram, Instagram и на YouTube. Пишите, если нашли баг, хотите сказать спасибо или поспорить про тактику.',
      "I make this game alone, and online you'll mostly find me as @kazakovant. The same handle on Telegram, Instagram and YouTube. Write if you've found a bug, want to say thanks, or want to argue about tactics.",
    ),
    R(
      'Я обучаю бизнес внедрять ИИ: автоматизировать процессы, делать игры, запускать творческие проекты. ИИ под любую задачу, от таблицы для отдела продаж до сценария мультфильма. Вместе с командой и нейросетями разработал 550 брендов и сотни тысяч макетов дизайна.',
      "I teach businesses how to bring AI in: automating processes, making games, launching creative projects. AI for any task, from a sales spreadsheet to a cartoon script. Together with my team and AI, I've developed 550 brands and hundreds of thousands of design layouts.",
    ),
    R(
      'В первую очередь это для бизнес-стратегов и креативных маркетологов. Вам нужна не инструкция на три страницы, а другой способ думать: как ставить задачу ИИ, как проверять ответ и где он врёт. Этим я и занимаюсь.',
      "Mostly for business strategists and creative marketers. You don't need a three-page manual, you need a different way of thinking: how to brief AI, how to check its answer, and where it lies. That's what I do.",
    ),
    R(
      'Если интересно, напишите мне в Telegram: @kazakovant. Мои дизайн-проекты и кейсы — на oneconception.ru. Хотите поблагодарить за игру, есть кнопка поддержки в игре и на сайте. Спасибо, что дочитали, это уже редкость.',
      "If that interests you, message me on Telegram: @kazakovant. My design projects and case studies are at oneconception.ru. Want to thank me for the game? There's a support button in the game and on the site. Thanks for reading to the end, that's rare.",
    ),
  ];
  const adLine = R(
    'Обучаю внедрять ИИ в бизнес: автоматизация, игры, творчество.',
    'I teach businesses to bring AI in: automation, games, creative work.',
  );
  const siteLabel = R('Дизайн-проекты', 'Design projects');
  const copyLabel = R('Скопировать', 'Copy');
  const copiedLabel = R('Скопировано', 'Copied');
  const hintPrefix = R('Везде одинаковый:', 'Same handle everywhere:');

  const pills = [
    { href: 'https://t.me/kazakovant', label: 'Telegram', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>' },
    { href: 'https://instagram.com/kazakovant', label: 'Instagram', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>' },
    { href: 'https://youtube.com/@kazakovant', label: 'YouTube', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>' },
    { href: 'https://oneconception.ru', label: siteLabel, icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8zm-1 3v2H8l-.002.001A5.002 5.002 0 0 0 7 12a5 5 0 0 0 5 5 5 5 0 0 0 5-5 5.002 5.002 0 0 0-.998-2.999L16 9h-3V7h-2zm1 4a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3z" fill="currentColor"/></svg>' },
  ].map(p => `<a class="contact-pill" href="${esc(p.href)}" target="_blank" rel="noopener">${p.icon}${esc(p.label)}</a>`).join('');

  return `
  <div class="contact-block" id="contact-block">
    <div class="wrap">
      <button class="contact-trigger" aria-expanded="false" aria-controls="contact-panel" id="contact-trigger">
        <span class="contact-arrow" aria-hidden="true"><svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="contact-teaser">${esc(teaser)}</span>
      </button>
      <div class="contact-panel" id="contact-panel" role="region" aria-labelledby="contact-trigger">
        <div class="contact-panel-inner">
          <div class="contact-name">Антон Казаков</div>
          <div class="contact-bio">${full.map(p => `<p>${esc(p)}</p>`).join('')}</div>
          <div class="contact-socials">${pills}</div>
          <div class="contact-hint">
            <span>${esc(hintPrefix)}</span>
            <span class="contact-handle">@kazakovant</span>
            <button class="contact-copy" data-copy="@kazakovant" data-label="${esc(copyLabel)}" data-done="${esc(copiedLabel)}">${esc(copyLabel)}</button>
          </div>
          <div class="contact-ad">${esc(adLine)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function footer(): string {
  return `<footer><div class="wrap">
    <span class="wordmark">PART<b>SHIFT</b></span>
    <span>${R('Lumen City. Всегда на смене. Игра бесплатная, мир вымышленный.', 'Lumen City. Always on call. The game is free, the world is fiction.')}</span>
    <div class="row">${androidSoon(lang)}<a class="btn btn-ghost" href="#support">☕ ${R('Донат автору', 'Tip the author')}</a><a class="btn btn-ghost" href="${playHref()}">${ICON.play}${u('playFree')}</a></div>
  </div></footer>`;
}

const head = (eyebrow: string, title: string, lead?: string) => `
  <div class="section-head"><span class="caps">${eyebrow}</span><h2>${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;

const fig = (src: string, cap: string, px = false) => `
  <figure><button class="zoom" data-src="${img(src)}" data-cap="${esc(cap)}"${px ? ' data-px="1"' : ''} aria-label="${esc(cap)}"><img src="${img(src)}" alt="${esc(cap)}" loading="lazy"${px ? ' class="px"' : ''}></button><figcaption>${cap}</figcaption></figure>`;

function heroTile(h: Hero): string {
  return `<a class="tile slab" href="#hero-${h.id}" style="--hc:${h.color}">
    <div class="stage"><span class="stripe"></span><img src="${img(h.px)}" alt="${esc(tr(h.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${tr(h.hud)}</span><h3>${tr(h.name)}</h3><p>${tr(h.role).split('. ')[0]}.</p></div>
  </a>`;
}

// ------------------------------------------------------------------- views

function home(): string {
  const canon = HEROES.filter((h) => h.group === 'canon' && h.id !== 'n73' && h.id !== 'doctor');
  return `
  <section class="hero">
    <div class="hero-body">
      <div class="hero-content fade-in">
        <div class="hero-badge">LUMEN CITY // ${R('СМЕНА 01', 'SHIFT 01')}</div>
        <div class="hero-seam"></div>
        <h1>PART<b>SHIFT</b></h1>
        <p class="lead">${R(
          'Гель Splice свёл с ума спасателей Lumen City. Открывай кварталы, побеждай заражённых героев и забирай их части тела.',
          "Splice gel drove Lumen City’s rescuers mad. Open blocks, beat infected heroes and claim their body parts.",
        )}</p>
        <div class="row">
          <a class="btn btn-primary btn-lg" href="${playHref()}">${ICON.play}${u('playFree')}</a>
          ${androidSoon(lang, 'btn-lg')}
          <a class="btn btn-ghost btn-lg" href="#story" data-scroll="story">${R('Узнать историю', 'Read the story')}</a>
        </div>
      </div>
      <div class="hero-art">
        <img src="${img('key-art.webp')}" alt="${esc(R('Спасатели HeroOut на развалинах Lumen City', 'HeroOut rescuers on the rubble of Lumen City'))}">
      </div>
    </div>
    <div class="hero-status">
      <div class="hero-status-item active"><i></i>LUMEN CITY &mdash; ${R('НА СВЯЗИ', 'ONLINE')}</div>
      <div class="hero-status-item danger"><i></i>15 ${R('ГЕРОЕВ НА СМЕНЕ', 'HEROES ON SHIFT')}</div>
      <div class="hero-status-item"><i></i>${R('ГНЁЗД ОСТАЛОСЬ', 'NESTS REMAINING')}: 7</div>
      <div class="hero-status-item" style="margin-left:auto">HEROOUT // ${R('ПРОТОКОЛ АКТИВЕН', 'PROTOCOL ACTIVE')}</div>
    </div>
  </section>

  <section class="section" id="story"><div class="wrap split">
    <div class="stack">
      ${head(R('КАНОН // ЧТО СЛУЧИЛОСЬ', 'CANON // WHAT HAPPENED'), R('Город, который любил своих героев', 'The city that loved its heroes'))}
      <div class="prose">
        <p>${R(
          'Lumen City — солнечный прибрежный город: белые башни, голубое стекло, сады на крышах и монорельс над пляжем. Его берегла HeroOut, аварийная служба и корпорация, которая выдавала спасателям сменные части тела под каждую задачу.',
          'Lumen City is a sunny coastal city of white towers, blue glass, rooftop gardens and a monorail over the beach. It was kept safe by HeroOut, an emergency service and corporation that fitted its rescuers with swappable body parts for every job.',
        )}</p>
        <p>${R(
          'Пожарному — термостойкую руку, водолазу — криогелевое лёгкое. Всё держалось на Splice Medium, среде, которая «договаривается» с чужой тканью. Пока на публичной демонстрации повреждённый контейнер не попал в реактор.',
          'A heat-proof arm for a firefighter, a cryogel lung for a diver. It all ran on Splice Medium, a carrier that “negotiates” with foreign tissue. Until, at a public demonstration, a damaged container reached the reactor.',
        )}</p>
        <p>${R(
          'Магии здесь нет. Ангел, Демон и зомби — уличные прозвища. Всё объясняется биотканью, нейроинтерфейсом и аварийной техникой.',
          'There is no magic here. Angel, Demon and zombie are street nicknames. Everything comes down to biotissue, neural interfaces and emergency hardware.',
        )}</p>
      </div>
    </div>
    <ol class="timeline">
      <li><h3>${R('До сирен', 'Before the sirens')}</h3><p>${R('Герои HeroOut снимают котов с деревьев, играют в волейбол на Sunline Beach и раздают автографы. Об этом — комиксы.', 'HeroOut heroes rescue cats, play volleyball on Sunline Beach and sign autographs. That’s what the comics are about.')}</p></li>
      <li><h3>EVERYONE IS ON CALL</h3><p>${R('Протокол «Все на смене» запускают на демонстрации. Splice Medium попадает в реактор.', 'The “Everyone Is On Call” protocol goes live at a demo. Splice Medium reaches the reactor.')}</p></li>
      <li><h3>${R('Все на смене', 'Everyone on call')}</h3><p>${R('Гель сводит с ума горожан и всех героев HeroOut. Около пятнадцати спасателей бегают по городу и «спасают» каждый по-своему. Контроль вежливо просит пройти на склад.', 'The gel drives the citizens and every HeroOut hero mad. About fifteen rescuers roam the city, each “rescuing” in their own way. Control politely asks everyone to proceed to the warehouse.')}</p></li>
      <li><h3>${R('Первая смена', 'The first shift')}</h3><p>${R('Командный центр открывает город заново, квартал за кварталом, и останавливает героев одного за другим. Это твоя игра.', 'A Command Center reopens the city, block by block, and stops the heroes one by one. That’s your game.')}</p></li>
      <li><h3>${R('42-й этаж', 'Floor 42')}</h3><p>${R('Наверху башни HeroOut сидит совет директоров: «Город платит, пока боится». Финал — добраться туда и выключить протокол.', 'At the top of the HeroOut tower sits the board: “The city pays as long as it’s afraid.” The finale: get there and switch the protocol off.')}</p></li>
    </ol>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ДОСЬЕ // HEROOUT', 'DOSSIERS // HEROOUT'), R('Герои, они же злодеи', 'Heroes, also the villains'), R('У каждого героя одна функция, один цвет, одна мания и одна часть тела, которую мечтает забрать любой наш герой.', 'Each hero has one function, one colour, one obsession and one body part every hero on our side dreams of claiming.'))}
    <div class="grid">${canon.map(heroTile).join('')}</div>
    <div class="row" style="margin-top:22px"><a class="btn btn-ghost" href="#heroes">${u('all')} (${HEROES.length})</a></div>
  </div></section>

  <section class="section band"><div class="wrap split">
    <div class="stack">
      ${head(R('ИГРА // СРОЧНЫЙ ВЫЗОВ', 'GAME // URGENT CALL'), R('Открой город квартал за кварталом', 'Reopen the city block by block'), R('Датчики на открытых кварталах показывают, что прячется рядом. Считать придётся самому: игра за тебя не решает.', 'Sensors on opened blocks show what hides next door. The counting is up to you: the game won’t solve it for you.'))}
      <div class="howto">${howto(true)}</div>
      <div class="row"><a class="btn btn-primary btn-lg" href="${playHref()}">${ICON.play}${u('playFree')}</a></div>
    </div>
    <figure><img src="${img('sprites-02.webp')}" alt="" loading="lazy"><figcaption>${R('Герой забирает руку врага и меняется прямо на поле.', 'A hero takes an enemy’s arm and changes right on the board.')}</figcaption></figure>
  </div></section>

  <section class="section"><div class="wrap">
    ${head(R('КОМИКСЫ // ДО СИРЕН', 'COMICS // BEFORE THE SIRENS'), R('Обычные проблемы. Профессиональная громкость.', 'Ordinary problems. Professional volume.'))}
    <div class="comics">${storyCard()}${COMICS.slice(0, 3).map(comicCard).join('')}</div>
  </div></section>

  <section class="section" id="support" style="padding-top:0"><div class="wrap">
    ${head(R('ТЕЛЕФОН // ПОДДЕРЖАТЬ', 'PHONE // SUPPORT'), R('Скоро на телефоне, а пока кофе автору', 'Coming to phones, and a coffee for the author'))}
    ${supportBlock(lang)}
  </div></section>

  ${fightingTeaser()}`;
}

function howto(dark = false): string {
  const steps: [string, string, string, string, string][] = [
    ['⌂', 'Поставь Командный центр', 'Place the Command Center', 'Первое нажатие на поле. Это твоя база: потеряешь её — смена окончена.', 'Your first tap. It’s your base; lose it and the shift is over.'],
    ['↘', 'Проведи по кварталам', 'Swipe across blocks', 'Твои герои пойдут копать то, что ты отметил. Открытые кварталы дают Энергию и место для стройки.', 'Your heroes dig what you mark. Opened blocks give Energy and room to build.'],
    ['▲', 'Читай датчики', 'Read the sensors', 'Красный показывает гнёзда рядом, фиолетовый показывает героя на вызове, голубой показывает находки. Где безопасно, решаешь ты.', 'Red shows nests nearby, violet shows the hero on call, blue shows finds. You decide where it’s safe.'],
    ['✚', 'Строй и забирай части', 'Build and claim parts', 'Здания печатают героев из твоего отряда. Победив врага, герой сам прикрутит себе его руку или ногу.', 'Buildings print heroes from your squad. After a win, a hero bolts on the enemy’s arm or leg.'],
  ];
  return steps
    .map(
      ([g, tRu, tEn, pRu, pEn]) =>
        `<div class="step${dark ? '' : ' slab'}"${dark ? ' style="background:#142028"' : ''}><span class="glyph" style="color:var(--seam)">${g}</span><h3>${R(tRu, tEn)}</h3><p>${R(pRu, pEn)}</p></div>`,
    )
    .join('');
}

function fightingTeaser(): string {
  return `<section class="section band"><div class="wrap split">
    <div class="stack">
      ${head(R('СЛЕДУЮЩАЯ ГЛАВА', 'NEXT CHAPTER'), 'PART SHIFT Fighting', R(
        '2D-файтинг про Семьдесят Третьего. Клинчи, апперкоты, подкаты, покадровая анимация — и главное: оторвать сопернику руку и прикрутить её себе.',
        'A 2D fighting game starring Seventy-Third. Clinches, uppercuts, slides, hand-drawn frame animation, and the main thing: tear off your rival’s arm and bolt it onto yourself.',
      ))}
      <p>${R('В разработке. Эта игра бесплатная, чтобы ты успел познакомиться с героями заранее.', 'In development. This game is free so you can meet the heroes first.')}</p>
      <div class="row"><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#hero-n73">${R('Кто такой N-73', 'Who is N-73')}</a><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#artbook-dossier">${R('Досье файтинга', 'Fighting dossiers')}</a></div>
    </div>
    <div class="stack">
      <figure><img src="${img('doctor-arm.webp')}" alt="${esc(R('Доктор с тяжёлой рукой Килна', 'The Doctor with Kiln’s heavy arm'))}" loading="lazy"><figcaption>${R('Доктор, первое тело N-73, с рукой Килна', 'The Doctor, N-73’s first body, with Kiln’s arm')}</figcaption></figure>
    </div>
  </div></section>`;
}

function heroesView(): string {
  const canon = HEROES.filter((h) => h.group === 'canon');
  const city = HEROES.filter((h) => h.group === 'city');
  return `<section class="section"><div class="wrap">
    <figure class="banner slab"><img src="${img('all-on-shift.webp')}" alt="${R('Герои HeroOut снова на смене вместе с жителями', 'HeroOut heroes back on shift with the residents')}"><figcaption class="caps">${R('Так будет, когда смена закончится. Сейчас каждого из них надо победить и вернуть.', 'This is how it ends when the shift is over. Right now every one of them has to be beaten and brought back.')}</figcaption></figure>
    ${head(R('ДОСЬЕ // HEROOUT', 'DOSSIERS // HEROOUT'), R('Герои. Они же злодеи', 'Heroes. Also the villains'), R('Гель Splice свёл с ума всех спасателей HeroOut, их пятнадцать. Каждый всё ещё «спасает», только от такой помощи надо бежать. Главного среди них нет. Победишь героя — заберёшь его часть, а победишь много раз — он вернётся в себя и станет союзником.', 'Splice gel drove every HeroOut rescuer mad, fifteen of them. Each one is still “rescuing,” and you should run from that kind of help. None of them is in charge. Beat a hero and take their part; beat them enough times and they come back to themselves as your ally.'))}
    <div class="grid">${canon.map(heroTile).join('')}</div>
  </div></section>
  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ГОРОД // ДО СИРЕН', 'CITY // BEFORE THE SIRENS'), R('Ещё спасатели Lumen City', 'More Lumen City rescuers'), R('Обычные городские службы, доведённые до героизма, а потом гелем до мании. Пока в комиксах, на поле выйдут позже.', 'Ordinary city services taken to heroism, then by the gel to obsession. In the comics for now, on the board later.'))}
    <div class="grid">${city.map(heroTile).join('')}</div>
  </div></section>`;
}

function heroView(id: string): string {
  const i = HEROES.findIndex((h) => h.id === id);
  const h = HEROES[i];
  if (!h) return heroesView();
  const prev = HEROES[(i - 1 + HEROES.length) % HEROES.length];
  const next = HEROES[(i + 1) % HEROES.length];
  const row = (label: string, body?: L) => (body && tr(body) ? `<div class="fact"><span class="caps">${label}</span><p>${tr(body)}</p></div>` : '');
  const main = h.art ? `<img src="${img(h.art)}" alt="${esc(tr(h.name))}">` : `<img class="px" src="${img(h.px)}" alt="${esc(tr(h.name))}">`;
  return `<section class="section" style="--hc:${h.color}"><div class="wrap">
    <a class="caps" href="#heroes" style="text-decoration:none">← ${u('all')}</a>
    <div class="dossier" style="margin-top:20px">
      <div class="dossier-art">
        <div class="frame slab">${main}</div>
        <div class="slab moods">${(['', '_smile', '_talk', '_mad'] as const).map((m, k) => `<figure><img src="${img(`portraits/${h.id === 's01' ? 'standard' : h.id}${m}.webp`)}" alt="" loading="lazy" onerror="this.parentElement.remove()"><figcaption class="caps">${[R('НА СМЕНЕ', 'ON SHIFT'), R('УЛЫБКА', 'SMILE'), R('ГОВОРИТ', 'TALKING'), R('ОБЕЗУМЕЛ', 'DERANGED')][k]}</figcaption></figure>`).join('')}
          <figure><img class="px" src="${img(h.px)}" alt=""><figcaption class="caps">${R('НА ПОЛЕ', 'ON THE BOARD')}</figcaption></figure></div>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:${h.color}"></i>${tr(h.hud)}</span>
        <h1>${tr(h.name)}</h1>
        <p class="lead">${tr(h.role)}</p>
        ${h.quote ? `<blockquote class="quote" style="margin:6px 0">${tr(h.quote)}<span class="caps" style="display:block;margin-top:6px">${R('ДО СИРЕН', 'BEFORE THE SIRENS')}</span></blockquote>` : ''}
        ${h.mania ? `<div class="twin">
          <div class="slab side mad"><span class="caps">${R('ОБЕЗУМЕВШИЙ // НА СМЕНЕ У HEROOUT', 'DERANGED // ON SHIFT FOR HEROOUT')}</span>
            <p>${tr(h.mania)}</p>
            ${h.line ? `<blockquote>«${tr(h.line)}»</blockquote>` : ''}
            ${h.defeat ? `<p class="dim"><b>${R('Если победить:', 'When beaten:')}</b> «${tr(h.defeat)}»</p>` : ''}
            ${h.trophy ? `<p class="dim"><b>${R('Трофей:', 'Trophy:')}</b> ${tr(h.trophy)}${h.lair ? ` · <b>${R('Убежище:', 'Lair:')}</b> ${tr(h.lair)}` : ''}</p>` : ''}
          </div>
          ${h.ally ? `<div class="slab side back"><span class="caps">${R('ВЕРНУЛСЯ // ТЕПЕРЬ НА ВАШЕЙ СМЕНЕ', 'BACK // NOW ON YOUR SHIFT')}</span>
            ${h.back ? `<blockquote>«${tr(h.back)}»</blockquote>` : ''}
            <p>${tr(h.ally)}</p>
            ${h.allyLine ? `<p class="dim">«${tr(h.allyLine)}»</p>` : ''}
            ${h.unlock ? `<p class="dim"><b>${R('Как вернуть:', 'How to bring back:')}</b> ${tr(h.unlock)}</p>` : ''}
          </div>` : ''}
        </div>` : ''}
        <div class="facts">
          ${row(R('ДО КАТАСТРОФЫ', 'BEFORE THE DISASTER'), h.group === 'city' && h.bio ? h.bio : h.before)}
          ${h.bio && h.group !== 'city' ? row(R('ЛЕГЕНДА СЛУЖБЫ', 'SERVICE RECORD'), h.bio) : ''}
          ${row(R('МОДУЛЬ', 'MODULE'), h.module)}
          ${row(R('ТЕХНОЛОГИЯ', 'TECH'), h.tech)}
          ${row(R('ОБРАЗ', 'LOOK'), h.look)}
          ${row(R('ПРИВЫЧКА', 'HABIT'), h.fact)}
          ${row(R('В ИГРЕ', 'IN GAME'), h.inGame)}
        </div>
        ${(h.extra ?? []).length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${h.extra!.map((e) => fig(e.src, tr(e.cap), e.src.endsWith('.gif'))).join('')}</div>` : ''}
        <div class="pager">
          <a class="btn btn-ghost" href="#hero-${prev.id}">← ${tr(prev.name)}</a>
          <a class="btn btn-ghost" href="#hero-${next.id}">${tr(next.name)} →</a>
        </div>
      </div>
    </div>
  </div></section>`;
}

function worldView(): string {
  const tc = (id: string) => TECH.find((t) => t.id === id)!;
  return `<section class="section" style="padding-bottom:0"><div class="wrap"><figure class="banner slab"><img src="${img('world-dome.webp')}" alt="${R('Lumen City под куполом посреди пустоши', 'Lumen City under its dome in the middle of the wasteland')}"></figure></div></section>
  <section class="section"><div class="wrap split">
    <div class="stack">
      ${head(R('МИР // LUMEN CITY', 'WORLD // LUMEN CITY'), R('История вселенной', 'The story of the universe'))}
      <div class="prose">
        <p>${R('<b>HeroOut</b> снабжала город всем, что спасает жизнь: экстренной медициной, спасателями, протезами, защитными костюмами и адаптивными тканями. Её реклама висит до сих пор: «HERO | OUT — Аварийная служба. Всегда на смене».', '<b>HeroOut</b> supplied the city with everything that saves lives: emergency medicine, rescuers, prosthetics, protective suits and adaptive fabrics. Its ads still hang everywhere: “HERO | OUT. Emergency service. Always on call.”')}</p>
        <p>${R('Компания не злая в карикатурном смысле. Её грех в другом: тело для неё — заменяемый носитель, а личность — актив.', 'The company isn’t cartoonishly evil. Its sin is quieter: to HeroOut a body is a replaceable carrier and a personality is an asset.')}</p>
        <p>${R('<b>Augvolution</b> — программа подбора временных биотехнических частей под задачу. <b>Splice Medium</b> — медицинская среда, которая переносит нервный сигнал и уговаривает чужую ткань прижиться. Поэтому в этом мире можно пересадить руку, ногу, хвост, крылья и даже голову.', '<b>Augvolution</b> is the programme that fits temporary biotech parts to a task. <b>Splice Medium</b> is the medical carrier that relays nerve signals and persuades foreign tissue to take. That’s why in this world you can transplant an arm, a leg, a tail, wings, even a head.')}</p>
        <p>${R('На демонстрации протокола <b>EVERYONE IS ON CALL</b> повреждённый контейнер Splice Medium попал в реактор. Сеть спасения стала сетью неуправляемой адаптации: у огня выросла термозащита, у воды — криогель, кабели стали нервами, а дроны — органами.', 'At the demo of the <b>EVERYONE IS ON CALL</b> protocol, a damaged Splice Medium container reached the reactor. The rescue network became a network of runaway adaptation: fire grew heat shielding, water grew cryogel, cables became nerves and drones became organs.')}</p>
        <p>${R('Герои не стали злыми. Их протоколы стали буквальными: пожарный изолирует всё подряд, медик «сохраняет» даже врагов, высотник ловит людей петлёй и тащит «в безопасность».', 'The heroes didn’t turn evil. Their protocols turned literal: the firefighter insulates everything, the medic “preserves” even enemies, the high-rise rescuer lassoes people and drags them “to safety.”')}</p>
      </div>
    </div>
    <div class="stack">
      <figure>${`<button class="zoom" data-src="${img('city-life.webp')}" data-cap="${esc(R('Жизнь Lumen City до аварии', 'Lumen City life before the accident'))}"><img src="${img('city-life.webp')}" alt="" loading="lazy"></button>`}<figcaption>${R('Фанаты героев в самодельных шлемах, уличный повар с кибер-воком, гражданский микрореактор на кобальтовой плазме.', 'Hero fans in homemade helmets, a street chef with a cyber-wok, a civil cobalt-plasma microreactor.')}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('КАРТА // РАЗРЕЗ', 'MAP // CROSS-SECTION'), R('Районы: от пляжа до Undersun', 'Districts: from the beach to Undersun'), R('Чем глубже и ближе к Campus, тем сильнее адаптация.', 'The deeper and closer to the Campus, the stronger the adaptation.'))}
    <div class="depth slab">${[DISTRICTS[2], DISTRICTS[1], DISTRICTS[0], DISTRICTS[3], DISTRICTS[4]]
      .map((d, k) => `<div class="stratum"><span class="caps">${(lang === 'ru' ? ['ПОБЕРЕЖЬЕ', 'ЦЕНТР', 'ЭПИЦЕНТР', 'ПОД ГОРОДОМ', 'ГЛУБИНА'] : ['COAST', 'DOWNTOWN', 'EPICENTRE', 'UNDERGROUND', 'DEEP'])[k]}</span><div><h3>${d.name}</h3><p>${lang === 'ru' ? d.ru : d.en}</p></div></div>`)
      .join('')}</div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${head(R('СТИХИИ // УРОН', 'ELEMENTS // DAMAGE'), R('Пять стихий и их реакции', 'Five elements and their reactions'), R('Каждый адаптант несёт одну стихию. Её и отдаёт победителю: убил ледяного — получил ледяную руку.', 'Every adaptant carries one element and hands it to whoever wins: defeat an ice one, get an ice arm.'))}
      <p class="caps">${R('МОЛНИЯ БЬЁТ ЛЁД · ЛЁД БЬЁТ ОГОНЬ · ОГОНЬ БЬЁТ ТОКСИН · ТОКСИН БЬЁТ УДАР · УДАР БЬЁТ МОЛНИЮ', 'LIGHTNING BEATS ICE · ICE BEATS FIRE · FIRE BEATS TOXIN · TOXIN BEATS IMPACT · IMPACT BEATS LIGHTNING')}</p>
      <div class="techs">${TECH.map((t) => `<div class="tech slab"><i style="--dot:${t.color}"></i><h3>${lang === 'ru' ? t.ru : t.en}${t.old ? ` <small>(${tr(t.old)})</small>` : ''}</h3><p>${tr(t.desc)}</p></div>`).join('')}</div>
    </div>
    <div class="stack">
      <div class="slab" style="padding:8px 18px"><div class="table-scroll"><table class="reactions"><tbody>
        ${REACTIONS.map((r) => {
          const a = tc(r.a);
          const b = tc(r.b);
          return `<tr><td><span class="mix"><i style="--dot:${a.color}"></i>${lang === 'ru' ? a.ru : a.en}</span></td><td>+</td><td><span class="mix"><i style="--dot:${b.color}"></i>${lang === 'ru' ? b.ru : b.en}</span></td><td>=</td><td>${lang === 'ru' ? r.ru : r.en}</td></tr>`;
        }).join('')}
      </tbody></table></div></div>
      <p class="caps">${R('ЗАЩИТА — ОТДЕЛЬНЫЙ СЛОЙ: РЕЗИНА, ТЕРМОКЕРАМИКА, КРИОКОЖУХ, БИОФИЛЬТР, ПОЛИМЕР', 'DEFENCE IS ITS OWN LAYER: RUBBER, THERMOCERAMIC, CRYO SHELL, BIOFILTER, POLYMER')}</p>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${head(R('ТЕЛО // СЛОТЫ', 'BODY // SLOTS'), R('Правило трофея', 'The trophy rule'), R('Жители рождаются обычными. Никаких карточек, инвентаря и ручной экипировки: победив врага, человек сам забирает его часть и становится сильнее.', 'Residents are born ordinary. No cards, no inventory, no manual gear: after beating an enemy, a person takes its part and gets stronger.'))}
      <div class="slots">${[R('Голова', 'Head'), R('Левая рука', 'Left arm'), R('Правая рука', 'Right arm'), R('Левая нога', 'Left leg'), R('Правая нога', 'Right leg'), R('Хвост', 'Tail'), R('Крылья', 'Wings')]
        .map((s) => `<div class="slot slab">${s}</div>`)
        .join('')}</div>
    </div>
    <div class="slab upgrade">
      <figure><img src="${img('px/s01_normal.png')}" alt=""><figcaption>${R('Житель', 'Resident')}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${img('px/s01_ice_arm.png')}" alt=""><figcaption>${R('Ледяная рука', 'Ice arm')}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${img('px/s01_mech_arm.png')}" alt=""><figcaption>${R('Тяжёлая рука', 'Heavy arm')}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ЗДАНИЯ // 12', 'BUILDINGS // 12'), R('Что строит Командный центр', 'What the Command Center builds'))}
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${[
      ['b01-medcenter', 'Медцентр', 'Medcenter'],
      ['b02-house_small', 'Жилой блок', 'Housing block'],
      ['b03-house_tower', 'Многоэтажка', 'Apartment tower'],
      ['b04-skyscraper', 'Небоскрёб', 'Skyscraper'],
      ['b05-school', 'Школа спасателей', 'Rescue school'],
      ['b06-scout_tower', 'Башня разведки', 'Scout tower'],
      ['b07-workshop', 'Мастерская модулей', 'Module workshop'],
      ['b08-microreactor', 'Микрореактор', 'Microreactor'],
      ['b09-cryo_station', 'Станция охлаждения', 'Cooling station'],
      ['b10-greenhouse', 'Оранжерея', 'Greenhouse'],
      ['b11-monorail', 'Станция монорельса', 'Monorail station'],
      ['b12-shield_spire', 'Шпиль щита', 'Shield spire'],
    ]
      .map(([f, ru, en]) => `<figure class="slab" style="padding:14px"><img src="${img(`px/${f}.webp`)}" alt="" loading="lazy" style="margin:auto;height:120px;width:auto"><figcaption style="text-align:center;font-weight:600;color:var(--ink)">${R(ru, en)}</figcaption></figure>`)
      .join('')}</div>
  </div></section>`;
}

function villainsView(): string {
  const mad = HEROES.filter((h) => h.mania);
  const madTile = (h: Hero) => `<a class="tile slab" href="#hero-${h.id}" style="--hc:${h.color}">
    <div class="stage"><span class="stripe"></span><img src="${img(h.px)}" alt="${esc(tr(h.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${tr(h.trophy!)}</span><h3>${tr(h.name)}</h3><p>«${tr(h.line!)}»</p></div>
  </a>`;
  return `<section class="section"><div class="wrap">
    ${head(R('УГРОЗЫ // ПРОТОКОЛЫ', 'THREATS // PROTOCOLS'), R('Злодеи', 'Villains'), R('Злодеев «со злом внутри» здесь нет. Есть герои, которые спасают слишком буквально, корпорация, которой выгоден страх, и её очень вежливый голос.', 'Nobody here is evil at heart. There are heroes who rescue far too literally, a corporation that profits from fear, and its very polite voice.'))}

    <div class="villain">
      <div class="art slab" style="--hc:#E03552;background:linear-gradient(180deg,#2a1416,#10171c)"><img src="${img('key-art.webp')}" alt="" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="stack">
        <span class="chip"><i style="--dot:#E03552"></i>${R('ВСЕ СРАЗУ // ГЛАВНОГО НЕТ', 'ALL AT ONCE // NONE IN CHARGE')}</span>
        <h2>${R('Обезумевшие герои', 'The deranged heroes')}</h2>
        <p class="lead">${R('Гель Splice лечил спасателей и отращивал им конечности. Потом он вышел из-под контроля и свёл с ума горожан и всех героев HeroOut.', 'Splice gel healed rescuers and regrew their limbs. Then it went out of control and drove the citizens and every HeroOut hero mad.')}</p>
        <p>${R('Пятнадцать героев бегают по городу как враги, включая тройки серийных Стандартов. Каждый всё ещё на смене и всё ещё «спасает», у каждого своя мания, стихия и убежище. Главного среди них нет: Демон, Килн, Фростлайн и Серафим равны, просто опасны по-разному. В каждой смене цель — герой, на которого пришёл вызов. Первым в игре сделан Демон. Победи героя достаточно раз, и он вернётся в себя: «Герой вернулся. Больше не на смене у HeroOut. Теперь на вашей».', 'Fifteen heroes roam the city as enemies, Standard copies in threes included. Each is still on shift and still “rescuing,” each with an obsession, an element and a lair. None of them is in charge: Demon, Kiln, Frostline and Seraph are equals, just dangerous in different ways. Each shift targets the hero the call came in for. Demon is simply the first one in the game. Beat a hero enough times and they come back to themselves: “The hero is back. No longer on shift for HeroOut. Now on yours.”')}</p>
        <div class="bark slab"><span class="caps">${R('КОНТРОЛЬ:', 'CONTROL:')}</span>${R('Если вы видите обезумевшего героя, не паникуйте. Он на смене.', 'If you see a deranged hero, do not panic. They are on shift.')}</div>
      </div>
    </div>
        <div class="grid">${mad.map(madTile).join('')}</div>

    <figure class="billboard slab" style="margin-top:56px"><img src="${img('control-billboard.webp')}" alt="${esc(R('Маска Контроля на билборде HeroOut', 'Control’s mask on a HeroOut billboard'))}" loading="lazy"><figcaption><span class="caps">HERO | OUT</span><b>${R('Всегда на смене.', 'Always on call.')}</b><span>${R('Даже когда вас об этом не просили.', 'Even when you didn’t ask.')}</span></figcaption></figure>
    <div class="villain">
      <div class="art slab">
        <svg class="control-face" viewBox="0 0 200 200" role="img" aria-label="${R('Маска Контроля', 'Control’s mask')}">
          <defs><linearGradient id="cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8eb"/></linearGradient></defs>
          <rect x="6" y="6" width="188" height="188" fill="none" stroke="#57D8F2" stroke-width="2" stroke-dasharray="6 6"/>
          <path d="M100 26c40 0 66 26 66 66v28c0 30-22 54-66 54s-66-24-66-54V92c0-40 26-66 66-66z" fill="url(#cm)" stroke="#10171C" stroke-width="3"/>
          <path d="M48 86h104v22H48z" fill="#10171C"/>
          <path d="M60 97h80" stroke="#57D8F2" stroke-width="3"/>
          <path class="smile" d="M70 140q30 16 60 0" fill="none" stroke="#57D8F2" stroke-width="5" stroke-linecap="round"/>
          <text x="100" y="60" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="13" font-weight="800" fill="#10171C">HERO | OUT</text>
        </svg>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:#57D8F2"></i>${R('ГОЛОС КОРПОРАЦИИ // ИИ HEROOUT', 'VOICE OF THE CORPORATION // HEROOUT AI')}</span>
        <h2>${R('Контроль', 'Control')}</h2>
        <p class="lead">${R('Аварийный ИИ HeroOut. До сих пор вежливо выполняет протокол EVERYONE IS ON CALL. Все жители и все герои для него имущество компании, которое надо учесть и вернуть на склад.', 'HeroOut’s emergency AI. Still politely running EVERYONE IS ON CALL. To Control, every resident and every hero is company property to be logged and returned to the warehouse.')}</p>
        <p>${R('Тела у Контроля нет: лицо — маска шлема спасателя на экранах и дронах-громкоговорителях, вместо рта голубая линия-улыбка. Он никогда не злится. Чем страшнее событие, тем спокойнее голос. Чужие модули на защитниках для него кража.', 'Control has no body: its face is a rescue-helmet mask on screens and loudspeaker drones, with a thin blue smile for a mouth. It never gets angry. The scarier the event, the calmer the voice. Trophy modules on defenders count as theft.')}</p>
        <div class="stack" style="gap:10px">${BARKS.map(([ru, en]) => `<div class="bark slab"><span class="caps">${R('КОНТРОЛЬ:', 'CONTROL:')}</span>${R(ru, en)}</div>`).join('')}</div>
      </div>
    </div>
    <figure class="banner slab" style="margin-top:40px"><img src="${img('control-warehouse.webp')}" alt="${esc(R('Очередь жителей на склад Контроля', 'Residents queueing for the Control warehouse'))}" loading="lazy"><figcaption class="caps">${R('«Вы спасены. Пройдите на склад.» Очередь на склад Контроля', '“You have been rescued. Proceed to the warehouse.” The queue at the Control warehouse')}</figcaption></figure>

    <div class="villain">
      <figure class="art slab shot"><img src="${img('floor42.webp')}" alt="${R('Совет директоров на 42-м этаже', 'The board on floor 42')}" loading="lazy"><span class="floor-no">42</span></figure>
      <div class="stack">
        <span class="chip"><i style="--dot:#E8A33A"></i>${R('КОРПОРАЦИЯ НАВЕРХУ // НАСТОЯЩИЙ ФИНАЛ', 'THE CORPORATION UPSTAIRS // THE REAL FINALE')}</span>
        <h2>${R('42-й этаж', 'Floor 42')}</h2>
        <p class="lead">${R('На улице HeroOut — честные усталые спасатели. Наверху, на 42-м этаже, совет директоров давно понял: город платит, пока у него что-то случается.', 'Down on the street, HeroOut means honest, tired rescuers. Upstairs on floor 42, the board figured out long ago that the city pays as long as something keeps happening.')}</p>
        <p>${R('Кошки на деревьях, краны, которые сходят с ума, пожар ровно за минуту до проезда патруля. Слишком много инцидентов случается слишком вовремя. И гель выпустили, не проверив. Финал кампании — не убить героя, а добраться до 42-го этажа и выключить протокол: «Смена окончена. Все свободны». Тогда герои смогут прийти в себя.', 'Cats up trees, cranes going haywire, a fire exactly one minute before the patrol drives by. Too many incidents happen right on time. And the gel shipped untested. The campaign ends not by killing a hero but by reaching floor 42 and switching the protocol off: “Shift over. Everyone is free.” Then the heroes can come back to themselves.')}</p>
      </div>
    </div>

    <div class="villain">
      <figure class="art slab shot"><img src="${img('splice-heart.webp')}" alt="${R('Ядро вспышки в реакторе Research Campus', 'The Splice Heart in the Research Campus reactor')}" loading="lazy"></figure>
      <div class="stack">
        <span class="chip"><i style="--dot:#8A4DFF"></i>${R('РАСТУЩАЯ УГРОЗА // RESEARCH CAMPUS', 'GROWING THREAT // RESEARCH CAMPUS')}</span>
        <h2>${R('Ядро вспышки', 'Splice Heart')}</h2>
        <p class="lead">${R('Не персонаж, а место: повреждённый контейнер геля в реакторе Research Campus. Треснувшая белая оболочка, пульсирующая голубая плазма, кабели-вены по асфальту.', 'Not a character but a place: a damaged gel container inside the Research Campus reactor. A cracked white shell, pulsing blue plasma, cable veins across the asphalt.')}</p>
        <p>${R('В игре это шкала «Угроза»: каждые две минуты враги становятся сильнее. Контроль не даёт Ядро заглушить, потому что оно тоже имущество компании.', 'In the game it’s the Threat ring: every two minutes the enemies get stronger. Control won’t let anyone shut it down, because it’s company property too.')}</p>
      </div>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ПОЛЕ // ВРАГИ', 'BOARD // ENEMIES'), R('Адаптанты', 'Adaptants'), R('Обычные горожане, заражённые гелем. Одна часть тела переросла под стихию. Слабые, но их много, и гнездятся они в закрытых кварталах.', 'Ordinary citizens infected by the gel. One body part overgrew for an element. Weak but numerous, nesting in closed blocks.'))}
    <figure class="adaptants slab"><img src="${img('adaptants-sheet.webp')}" alt="" loading="lazy"><figcaption>${[['ОГОНЬ', 'FIRE', 'Рука-радиатор, пар'], ['ЛЁД', 'ICE', 'Ледяная нога'], ['МОЛНИЯ', 'LIGHTNING', 'Рука из кабелей'], ['ТЯЖЁЛЫЙ', 'HEAVY', 'Поршневые ноги']].map(([ru, en, d]) => `<span><b class="caps">${R(ru, en)}</b>${R(d, ({ 'Рука-радиатор, пар': 'Radiator arm, steam', 'Ледяная нога': 'Ice leg', 'Рука из кабелей': 'Cable arm', 'Поршневые ноги': 'Piston legs' } as Record<string, string>)[d])}</span>`).join('')}</figcaption></figure>
  </div></section>

  <section class="section band"><div class="wrap">
    ${head(R('ФАСАДЫ // РЕКЛАМА HEROOUT', 'BILLBOARDS // HEROOUT ADS'), R('Всегда на смене', 'Always on call'), R('Реклама до сих пор висит по всему городу. Мелкий шрифт прилагается.', 'The ads still hang all over the city. Fine print included.'))}
    <div class="grid">${ADS.map(([ru, en]) => `<div class="step" style="background:#142028"><span class="caps" style="color:var(--seam)">HERO | OUT</span><p style="font:700 18px/1.35 var(--display);color:#fff;margin:8px 0 0">${R(ru, en)}</p></div>`).join('')}</div>
  </div></section>

  <section class="section" id="archive" style="scroll-margin-top:80px"><div class="wrap">
    ${head(R('УТЕЧКА // ЗАПИСИ КОНТРОЛЯ', 'LEAK // CONTROL RECORDS'), R('Архив HeroOut', 'HeroOut Archive'), R('Внутренние документы компании. В игре они выпадают находкой «Запись Контроля» и собираются в Досье, во вкладке «Архив».', 'Internal company documents. In the game they drop as a “Control Record” find and collect in the Dossier, under the Archive tab.'))}
    <figure class="banner slab"><img src="${img('archive-desk.webp')}" alt="" loading="lazy"></figure>
    <div class="archive">${ARCHIVE.map((a, i) => `<article class="record slab"><header><span class="caps">${R('ЗАПИСЬ', 'RECORD')} № ${String(i + 1).padStart(3, '0')}</span><span class="caps from">${tr(a.from)}</span></header><h3>${tr(a.title)}</h3><p>${tr(a.text)}</p><span class="stamp caps">${R('СЕКРЕТНО', 'CLASSIFIED')}</span></article>`).join('')}</div>
  </div></section>`;
}

function comicCard(c: (typeof COMICS)[number]): string {
  const cover = c.id === 'last-donut' ? `comics/last-donut-cover-${lang}.webp` : c.pages[lang][0];
  const playLabel = lang === 'ru' ? '► Смотреть' : '► Watch';
  return `<div class="comic-card slab">
    <a class="cover" href="#comic-${c.id}"><img src="${img(cover)}" alt="" loading="lazy"></a>
    <div class="meta"><span class="caps">${tr(c.series)} // ${tr(c.cast)}</span><h3>${tr(c.title)}</h3><p>${tr(c.blurb)}</p>
    <div class="row" style="margin-top:14px;gap:8px"><a class="btn btn-ghost" href="#comic-${c.id}">${lang === 'ru' ? 'Читать' : 'Read'}</a><button class="btn btn-primary" data-play-comic="${c.id}">${playLabel}</button></div>
    </div>
  </div>`;
}

function storyCard(): string {
  return `<button class="comic-card slab story-card" data-story="1">
    <div class="cover"><img src="${img('comics/intro-cover.webp')}" alt="" loading="lazy"><span class="play-badge">${ICON.play}</span></div>
    <div class="meta"><span class="caps">${R('ПРОЛОГ ИГРЫ // 12 СТРАНИЦ, СО ЗВУКОМ', 'GAME PROLOGUE // 12 PAGES, WITH SOUND')}</span><h3>${R('Как всё началось', 'How it all began')}</h3><p>${R('Купол, голубая Энергия, гель Splice и 42-й этаж, где решили, что пусть случается почаще. Тот самый комикс, с которого начинается игра.', 'The Dome, blue Energy, Splice gel and floor 42, where someone decided it should happen more often. The comic the game opens with.')}</p></div>
  </button>`;
}

function comicsView(): string {
  return `<section class="section"><div class="wrap">
    ${head(R('ЧИТАТЬ // КОМИКСЫ', 'READ // COMICS'), R('Комиксы', 'Comics'), R('«До сирен» — истории Lumen City до аварии: обычные городские проблемы, которые решают необычные спасатели.', '“Before the Sirens” is about Lumen City before the accident: ordinary city problems solved by extraordinary rescuers.'))}
    <div class="comics">${storyCard()}${COMICS.map(comicCard).join('')}</div>
  </div></section>`;
}

function comicView(id: string): string {
  const c = COMICS.find((x) => x.id === id);
  if (!c) return comicsView();
  const ruOnly = lang === 'en' && c.pages.en.some((p) => p.includes('-ru.'));
  const i = COMICS.indexOf(c);
  const next = COMICS[(i + 1) % COMICS.length];
  return `<section class="section"><div class="wrap">
    <div class="reader">
      <a class="caps" href="#comics" style="text-decoration:none">← ${u('comics')}</a>
      <span class="caps">${tr(c.series)} // ${tr(c.cast)}</span>
      <h1 style="font-size:clamp(30px,5vw,52px)">${tr(c.title)}</h1>
      <p class="lead">${tr(c.blurb)}${ruOnly ? ` <span class="chip">${u('ruOnly')}</span>` : ''}</p>
      <p class="caps tap-hint">${R('НАЖМИ НА СТРАНИЦУ, ЧТОБЫ ЧИТАТЬ КРУПНО', 'TAP A PAGE TO READ IT LARGE')}</p>
      <button class="btn btn-primary" data-play-comic="${c.id}" style="margin-bottom:16px">► ${R('Смотреть как кино', 'Watch cinematic')}</button>
      ${c.pages[lang].map((p, k) => `<button class="zoom page" data-src="${img(p)}" data-full="1" aria-label="${esc(tr(c.title))} ${k + 1}"><img src="${img(p)}" alt="${esc(tr(c.title))} ${k + 1}" ${k ? 'loading="lazy"' : ''}></button>`).join('')}
      <div class="pager"><a class="btn btn-ghost" href="#comics">${u('comics')}</a><a class="btn btn-primary" href="#comic-${next.id}">${tr(next.title)} →</a></div>
    </div>
  </div></section>`;
}

function artbookView(focus?: string): string {
  return `<section class="section"><div class="wrap">
    ${head(R('АРТБУК // HEROOUT ARCHIVE', 'ARTBOOK // HEROOUT ARCHIVE'), R('Артбук', 'Artbook'), R('Концепты, досье, город и пиксель-арт. Нажми на картинку, чтобы открыть её целиком.', 'Concepts, dossiers, the city and pixel art. Tap a picture to see it full size.'))}
    <nav class="book-nav">${ARTBOOK.map((s) => `<a class="chip" href="#artbook-${s.id}">${tr(s.title)}</a>`).join('')}</nav>
    ${ARTBOOK.map(
      (s) => `<div id="book-${s.id}" style="scroll-margin-top:90px;margin-bottom:56px">
        <div class="section-head" style="margin-bottom:22px"><h2 style="font-size:clamp(22px,2.6vw,30px)">${tr(s.title)}</h2><p class="lead" style="font-size:17px">${tr(s.note)}</p></div>
        <div class="masonry${s.id === 'pixel' ? ' pixels' : ''}">${s.shots.map((sh) => fig(sh.src, tr(sh.cap), sh.px)).join('')}</div>
      </div>`,
    ).join('')}
  </div></section>${focus ? '' : ''}`;
}

// ------------------------------------------------------------------ router

function route(): { view: string; active: string; anchor?: string } {
  const h = location.hash.replace(/^#/, '');
  if (h.startsWith('hero-')) return { view: heroView(h.slice(5)), active: 'heroes' };
  if (h.startsWith('comic-')) return { view: comicView(h.slice(6)), active: 'comics' };
  if (h.startsWith('artbook')) return { view: artbookView(), active: 'artbook', anchor: h.includes('-') ? `book-${h.split('-')[1]}` : undefined };
  switch (h) {
    case 'heroes':
      return { view: heroesView(), active: 'heroes' };
    case 'world':
      return { view: worldView(), active: 'world' };
    case 'villains':
      return { view: villainsView(), active: 'villains' };
    case 'comics':
      return { view: comicsView(), active: 'comics' };
    case 'support':
      return { view: home(), active: 'home', anchor: 'support' };
    case 'story':
      return { view: home(), active: 'home', anchor: 'story' };
    case 'archive':
      return { view: villainsView(), active: 'villains', anchor: 'archive' };
    case 'updates':
      return { view: updatesView(), active: 'updates' };
    default:
      return { view: home(), active: 'home' };
  }
}

/** Version list for the site: the same content as CHANGELOG.md, kept short. */
const VERSIONS = [
  {
    v: '0.8.0',
    st: R('в игре', 'in the game'),
    items: [
      R('Серия чистых кварталов: +2 % к Энергии за каждые 5 подряд', 'Clean streak: +2% Energy per 5 quarters in a row'),
      R('Звонки Контроля в кампании', 'Control calls in the campaign'),
      R('17 зданий: Ретранслятор, Медцентр, Кузница, Ротация, Архив и другие', '17 buildings: Relay, Medcenter, Forge, Rotation, Archive and more'),
      R('Мины (14 на смену), бонусные капсулы, аптечки, сундуки', 'Mines (14 per shift), bonus capsules, medkits, caches'),
      R('Аккорд, волна зачистки, ранний рейд — новые звуки', 'Chord, wave clear and early raid — new sounds'),
      R('Контакт автора и эта страница', 'Author contact and this page'),
    ],
    soon: [
      R('Курьер Splice', 'Splice courier'),
      R('Флаг сбора и аварийный купол', 'Rally flag and emergency dome'),
      R('Подсказка «последний шанс»', 'Last-chance hint'),
      R('Финальный удар и три звезды на итоге', 'Final blow and three stars on the result'),
    ],
  },
  {
    v: '0.7.0',
    st: R('текущий онлайн-релиз', 'current online release'),
    items: [
      R('Смена, гнёзда адаптантов, набеги, герои из отряда', 'Shifts, adaptant nests, raids, squad heroes'),
      R('Кампания с нарастающей сложностью', 'Campaign with rising difficulty'),
      R('Онлайн для 2–4 игроков (PeerJS)', 'Online for 2–4 players (PeerJS)'),
      R('Сайт вселенной: герои, мир, злодеи, комиксы, артбук', 'Universe site: heroes, world, villains, comics, artbook'),
    ],
  },
];

function updatesView(): string {
  const blocks = VERSIONS.map((ver) => `
    <article class="slab" style="padding:18px;margin-bottom:16px">
      <span class="caps">${ver.v} // ${ver.st}</span>
      <ul style="margin:10px 0 0;padding-left:20px;line-height:1.5">${ver.items.map((i) => `<li>${i}</li>`).join('')}</ul>
      ${'soon' in ver && ver.soon ? `<p class="caps" style="margin:14px 0 6px">${R('В работе', 'In progress')}</p><ul style="margin:0;padding-left:20px;line-height:1.5">${ver.soon.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}
    </article>`).join('');
  return `<section class="wrap" style="padding-block:40px">${head(u('updates'), R('Что нового в игре', 'What is new in the game'), R('Версии и их содержимое. Полный список в CHANGELOG.md.', 'Versions and what is in them. Full list in CHANGELOG.md.'))}${blocks}</section>`;
}

const app = document.getElementById('site')!;
let lastHash = '';

function render(): void {
  document.documentElement.lang = lang;
  const r = route();
  app.innerHTML = `${bar(r.active)}<main>${r.view}</main>${contactBlock()}${footer()}${drawer()}<div class="lightbox" id="lightbox" hidden></div>`;
  document.title = r.active === 'home' ? 'PART SHIFT — Lumen City' : `${u(r.active)} · PART SHIFT`;
  const same = location.hash === lastHash;
  lastHash = location.hash;
  wireSupport(app, lang);
  wireContact(app);
  if (r.anchor) document.getElementById(r.anchor)?.scrollIntoView();
  else if (!same) window.scrollTo(0, 0);
}

function wireContact(root: HTMLElement): void {
  const trigger = root.querySelector<HTMLButtonElement>('#contact-trigger');
  const panel = root.querySelector<HTMLElement>('#contact-panel');
  if (trigger && panel) {
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      panel.classList.toggle('open', !open);
    });
  }
  root.querySelectorAll<HTMLButtonElement>('.contact-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy ?? '';
      const done = btn.dataset.done ?? 'Copied';
      const orig = btn.dataset.label ?? btn.textContent ?? '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = done;
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        const handle = root.querySelector<HTMLElement>('.contact-handle');
        if (handle) {
          const range = document.createRange();
          range.selectNodeContents(handle);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
      });
    });
  });
}

function setLang(l: Lang): void {
  lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

app.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const langBtn = t.closest<HTMLButtonElement>('[data-lang]');
  if (langBtn) return setLang(langBtn.dataset.lang as Lang);
  if (t.closest('#burger')) return void (document.getElementById('drawer')!.hidden = false);
  if (t.closest('#drawer-close') || t.id === 'drawer') return void (document.getElementById('drawer')!.hidden = true);
  if (t.closest('#drawer a')) document.getElementById('drawer')!.hidden = true;
  // «Узнать историю» just scrolls the home page down to the canon block instead of opening a new page.
  if (t.closest('[data-story]')) return void import('./intro').then((m) => m.playStory(lang));
  const playBtn = t.closest<HTMLButtonElement>('[data-play-comic]');
  if (playBtn) {
    const cid = playBtn.dataset.playComic!;
    const c = COMICS.find((x) => x.id === cid);
    if (c) {
      import('./comic-player').then((m) => {
        m.playComic(c.pages[lang].map((p) => img(p)), tr(c.title), lang);
      });
    }
    return;
  }
  const jump = t.closest<HTMLAnchorElement>('a[data-scroll]');
  if (jump) {
    ev.preventDefault();
    return document.getElementById(jump.dataset.scroll!)?.scrollIntoView({ behavior: 'smooth' });
  }
  const zoom = t.closest<HTMLButtonElement>('button.zoom');
  if (zoom) {
    const lb = document.getElementById('lightbox')!;
    lb.innerHTML = `<button class="icon-btn" aria-label="${u('close')}">${ICON.close}</button><img src="${zoom.dataset.src}" alt=""${zoom.dataset.px ? ' class="px"' : ''}><p>${zoom.dataset.cap ?? ''}</p>`;
    // Comic pages open at reading size and scroll inside the viewer, so speech bubbles stay legible on phones (QA-025).
    lb.classList.toggle('full', !!zoom.dataset.full);
    lb.hidden = false;
    lb.scrollTo(0, 0);
    return;
  }
  if (t.closest('#lightbox')) document.getElementById('lightbox')!.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('lightbox');
    if (lb) lb.hidden = true;
    const d = document.getElementById('drawer');
    if (d) d.hidden = true;
  }
});
window.addEventListener('hashchange', render);
render();
