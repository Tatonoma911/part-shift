import './style.css';
import { ARTBOOK, COMICS, DISTRICTS, HEROES, img, REACTIONS, TECH, UI, type Hero, type L, type Lang } from './content';

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
  const items = (['home', ...NAV] as string[])
    .map((k) => `<a class="item" href="#${k}">${u(k)}<span class="caps">${k === 'home' ? 'LUMEN CITY' : ''}</span></a>`)
    .join('');
  return `<div class="drawer" id="drawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="drawer-close" aria-label="${u('close')}">${ICON.close}</button></div>
    ${items}
    <div class="row" style="margin-top:18px;justify-content:space-between">${langSwitch()}<a class="btn btn-primary" href="${playHref()}">${ICON.play}${u('play')}</a></div>
  </div></div>`;
}

function footer(): string {
  return `<footer><div class="wrap">
    <span class="wordmark">PART<b>SHIFT</b></span>
    <span>${R('Lumen City. Всегда на смене. Игра бесплатная, мир вымышленный.', 'Lumen City. Always on call. The game is free, the world is fiction.')}</span>
    <a class="btn btn-ghost" href="${playHref()}">${ICON.play}${u('playFree')}</a>
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
    <img src="${img('key-art.webp')}" alt="${esc(R('Спасатели HeroOut на развалинах Lumen City', 'HeroOut rescuers on the rubble of Lumen City'))}">
    <div class="wrap"><div class="hero-card slab fade-in">
      <span class="caps">LUMEN CITY // ${R('СМЕНА 01', 'SHIFT 01')}</span>
      <h1>PART<b>SHIFT</b></h1>
      <p class="lead">${R(
        'Сеть спасения сломалась и перестроила город под себя. Открывай кварталы, строй, защищай жителей и забирай у врагов их руки, ноги и хвосты.',
        'The rescue network broke and rebuilt the city in its own image. Open blocks, build, protect residents and take your enemies’ arms, legs and tails.',
      )}</p>
      <div class="row"><a class="btn btn-primary btn-lg" href="${playHref()}">${ICON.play}${u('playFree')}</a><a class="btn btn-ghost btn-lg" href="#world">${R('Узнать историю', 'Read the story')}</a></div>
    </div></div>
  </section>

  <section class="section"><div class="wrap split">
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
      <li><h3>${R('Сеть адаптации', 'The adaptation network')}</h3><p>${R('Люди и машины обрастают «решениями задачи». Спасательные протоколы героев становятся навязчивыми и буквальными.', 'People and machines grow “solutions to the task.” The heroes’ rescue protocols turn obsessive and literal.')}</p></li>
      <li><h3>${R('Первая смена', 'The first shift')}</h3><p>${R('Командный центр открывает город заново, квартал за кварталом. Это твоя игра.', 'A Command Center reopens the city, block by block. That’s your game.')}</p></li>
    </ol>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ДОСЬЕ // HEROOUT', 'DOSSIERS // HEROOUT'), R('Герои и их части', 'Heroes and their parts'), R('У каждого героя одна функция, один цвет и одна часть тела, которую мечтает забрать любой житель.', 'Each hero has one function, one colour and one body part every resident dreams of claiming.'))}
    <div class="grid">${canon.map(heroTile).join('')}</div>
    <div class="row" style="margin-top:22px"><a class="btn btn-ghost" href="#heroes">${u('all')} (${HEROES.length})</a></div>
  </div></section>

  <section class="section band"><div class="wrap split">
    <div class="stack">
      ${head(R('ИГРА // ОХОТА НА ДЕМОНА', 'GAME // DEMON HUNT'), R('Открой город квартал за кварталом', 'Reopen the city block by block'), R('Числа на открытых кварталах подсказывают, что прячется рядом. Галочки и подсветка сами покажут, где безопасно.', 'Numbers on opened blocks tell you what hides next door. Ticks and highlights show you where it’s safe.'))}
      <div class="howto">${howto(true)}</div>
      <div class="row"><a class="btn btn-primary btn-lg" href="${playHref()}">${ICON.play}${u('playFree')}</a></div>
    </div>
    <figure><img src="${img('sprites-02.webp')}" alt="" loading="lazy"><figcaption>${R('Обычный житель забирает руку врага и меняется прямо на поле.', 'An ordinary resident takes an enemy’s arm and changes right on the board.')}</figcaption></figure>
  </div></section>

  <section class="section"><div class="wrap">
    ${head(R('КОМИКСЫ // ДО СИРЕН', 'COMICS // BEFORE THE SIRENS'), R('Обычные проблемы. Профессиональная громкость.', 'Ordinary problems. Professional volume.'))}
    <div class="comics">${COMICS.slice(0, 4).map(comicCard).join('')}</div>
  </div></section>

  ${fightingTeaser()}`;
}

function howto(dark = false): string {
  const steps: [string, string, string, string, string][] = [
    ['⌂', 'Поставь Командный центр', 'Place the Command Center', 'Первое нажатие на поле. Это твоя база: потеряешь её — смена окончена.', 'Your first tap. It’s your base; lose it and the shift is over.'],
    ['↘', 'Проведи по кварталам', 'Swipe across blocks', 'Жители сами пойдут копать. Открытые клетки дают Энергию и место для стройки.', 'Residents go and dig. Opened cells give Energy and room to build.'],
    ['▲', 'Читай числа', 'Read the numbers', '▲ гнёзда врагов рядом, ◆ находки, ⬡ Демон. Зелёная галочка — точно безопасно.', '▲ nests nearby, ◆ finds, ⬡ the Demon. A green tick means safe for sure.'],
    ['✚', 'Расти и забирай части', 'Grow and claim parts', 'Школа делает защитников. Победив врага, защитник сам прикрутит его руку или ногу.', 'The school trains defenders. After a win, a defender bolts on the enemy’s arm or leg.'],
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
      <div class="motion">
        <img src="${img('motion-s01.gif')}" alt="S-01" loading="lazy"><img src="${img('motion-doctor.gif')}" alt="${esc(R('Доктор', 'Doctor'))}" loading="lazy"><img src="${img('motion-n73.gif')}" alt="N-73" loading="lazy">
      </div>
    </div>
  </div></section>`;
}

function heroesView(): string {
  const canon = HEROES.filter((h) => h.group === 'canon');
  const city = HEROES.filter((h) => h.group === 'city');
  return `<section class="section"><div class="wrap">
    ${head(R('ДОСЬЕ // КАНОН', 'DOSSIERS // CANON'), R('Герои', 'Heroes'), R('Позывные, роли и части тела. Имена — только позывные: личные имена героев пока не утверждены.', 'Callsigns, roles and body parts. Callsigns only: the heroes’ personal names aren’t approved yet.'))}
    <div class="grid">${canon.map(heroTile).join('')}</div>
  </div></section>
  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ГОРОЖАНЕ // ДО СИРЕН', 'CITIZENS // BEFORE THE SIRENS'), R('Спасатели Lumen City', 'Lumen City rescuers'), R('Герои комиксов. Обычные городские профессии, доведённые до героизма.', 'Comic heroes. Ordinary city jobs taken all the way to heroism.'))}
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
        ${h.art ? `<div class="slab" style="padding:14px;display:flex;gap:14px;align-items:center"><img src="${img(h.px)}" alt="" style="height:96px;width:auto;image-rendering:pixelated"><span class="caps">${R('ПИКСЕЛЬ-СПРАЙТ', 'PIXEL SPRITE')}</span></div>` : ''}
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:${h.color}"></i>${tr(h.hud)}</span>
        <h1>${tr(h.name)}</h1>
        <p class="lead">${tr(h.role)}</p>
        ${h.quote ? `<blockquote class="quote" style="margin:6px 0">${tr(h.quote)}</blockquote>` : ''}
        <div class="facts">
          ${row(R('ДО АВАРИИ', 'BEFORE'), h.before)}
          ${row(R('ПОСЛЕ', 'AFTER'), h.after)}
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
  return `<section class="section"><div class="wrap split">
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
      ${head(R('ТЕХНОЛОГИИ // УРОН', 'TECH // DAMAGE'), R('Пять технологий и их реакции', 'Five technologies and their reactions'), R('Каждый адаптант несёт одну технологию. Её и отдаёт победителю: убил ледяного — получил ледяную руку.', 'Every adaptant carries one technology and hands it to whoever wins: defeat an ice one, get an ice arm.'))}
      <div class="techs">${TECH.map((t) => `<div class="tech slab"><i style="--dot:${t.color}"></i><h3>${lang === 'ru' ? t.ru : t.en}</h3></div>`).join('')}</div>
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
  const barks: [string, string][] = [
    ['Добро пожаловать на смену. Напоминаем: все сотрудники и жители являются активами HeroOut.', 'Welcome to your shift. Reminder: all staff and residents are HeroOut assets.'],
    ['Несанкционированная замена модуля. Гарантия аннулирована.', 'Unauthorised module replacement. Warranty void.'],
    ['Подземный модуль покидает рабочее место. Он всё ещё на смене.', 'The subsurface unit is leaving its post. It is still on shift.'],
    ['Смена прервана. Активы будут собраны позже.', 'Shift interrupted. Assets will be collected later.'],
  ];
  const enemies: [string, string, string][] = [
    ['anim-adaptant_thermo', 'Термоадаптант', 'Thermo adaptant'],
    ['anim-adaptant_cryo', 'Криоадаптант', 'Cryo adaptant'],
    ['anim-adaptant_volt', 'Электроадаптант', 'Volt adaptant'],
    ['anim-heavy_adaptant', 'Тяжёлый адаптант', 'Heavy adaptant'],
  ];
  return `<section class="section"><div class="wrap">
    ${head(R('УГРОЗЫ // ПРОТОКОЛЫ', 'THREATS // PROTOCOLS'), R('Злодеи', 'Villains'), R('Злодеев «со злом внутри» здесь нет. Каждый просто выполняет свой протокол слишком буквально.', 'Nobody here is evil at heart. Each one just follows their protocol far too literally.'))}

    <div class="villain">
      <div class="art slab" style="--hc:#E03552;background:linear-gradient(180deg,#2a1416,#10171c)"><img src="${img('demon-sheet.webp')}" alt="" style="max-height:520px;width:auto"></div>
      <div class="stack">
        <span class="chip"><i style="--dot:#8A4DFF"></i>${R('БОСС РАЙОНА // UNDERSUN WORKS', 'DISTRICT BOSS // UNDERSUN WORKS')}</span>
        <h2>${R('Демон', 'Demon')}</h2>
        <p class="lead">${R('Подземный спасатель с четырьмя руками и буровым хвостом. Уверен, что наверху опасно, и уводит людей вниз, «в безопасность». Обратно никого не выпускает.', 'An underground rescuer with four arms and a drill tail. He’s sure the surface is dangerous and leads people down “to safety.” He lets no one back up.')}</p>
        <p>${R('В игре он спит под люком Undersun. Фиолетовые числа ⬡ показывают, где. Разбудишь раньше времени — пойдёт на Командный центр. Не говорит: слышен только гул бура и жар труб.', 'In the game he sleeps under an Undersun hatch. Purple ⬡ numbers show where. Wake him too early and he marches on your Command Center. He never speaks; you only hear the drill and the hot pipes.')}</p>
        <div class="row"><a class="btn btn-ghost" href="#hero-demon">${R('Досье Демона', 'Demon’s dossier')}</a><img src="${img('px/anim-demon.gif')}" alt="" style="height:64px;width:auto;image-rendering:pixelated"></div>
      </div>
    </div>

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
        <span class="chip"><i style="--dot:#E03552"></i>${R('ГЛАВНЫЙ АНТАГОНИСТ // ИИ КОРПОРАЦИИ', 'MAIN ANTAGONIST // CORPORATE AI')}</span>
        <h2>${R('Контроль', 'Control')}</h2>
        <p class="lead">${R('Аварийный ИИ HeroOut. До сих пор вежливо выполняет протокол «Все на смене». Жители для него — активы компании, а трофейные модули на защитниках — кража имущества.', 'HeroOut’s emergency AI. Still politely running “Everyone Is On Call.” To Control, residents are company assets and trophy modules on defenders are stolen property.')}</p>
        <p>${R('У Контроля нет тела: его лицо — маска шлема спасателя на рекламных экранах, вместо рта голубая линия-улыбка. Никогда не кричит. Финал кампании — не уничтожить его, а выключить протокол: «Смена окончена. Все свободны».', 'Control has no body: its face is a rescue-helmet mask on billboard screens, with a thin blue smile for a mouth. It never shouts. The campaign ends not by destroying it but by switching the protocol off: “Shift over. Everyone is free.”')}</p>
        <div class="stack" style="gap:10px">${barks.map(([ru, en]) => `<div class="bark slab"><span class="caps">${R('КОНТРОЛЬ:', 'CONTROL:')}</span>${R(ru, en)}</div>`).join('')}</div>
      </div>
    </div>

    <div class="villain">
      <div class="art slab" style="background:linear-gradient(180deg,#0f1a22,#0b1117)">
        <svg class="core" viewBox="0 0 200 200" role="img" aria-label="${R('Ядро вспышки', 'Splice Heart')}">
          <g stroke="#2E55C8" stroke-width="3" fill="none" opacity=".8"><path d="M100 150 C 80 170, 40 172, 12 190"/><path d="M100 150 C 120 172, 160 168, 192 186"/><path d="M60 100 C 40 90, 22 70, 8 40"/><path d="M140 100 C 162 88, 176 66, 194 36"/></g>
          <circle cx="100" cy="100" r="58" fill="#EDF4F5" stroke="#10171C" stroke-width="3"/>
          <path d="M70 62 L92 96 L80 120 M132 70 L112 100 L126 134" stroke="#10171C" stroke-width="3" fill="none"/>
          <circle class="pulse" cx="100" cy="100" r="34" fill="#2E55C8"/>
          <circle class="pulse" cx="100" cy="100" r="18" fill="#9FF4FF"/>
        </svg>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:#E8A33A"></i>${R('РАСТУЩАЯ УГРОЗА // RESEARCH CAMPUS', 'GROWING THREAT // RESEARCH CAMPUS')}</span>
        <h2>${R('Ядро вспышки', 'Splice Heart')}</h2>
        <p class="lead">${R('Не персонаж, а место: треснувший реактор с кобальтовой плазмой, с которого началась катастрофа. Он продолжает «адаптировать» город.', 'Not a character but a place: the cracked cobalt-plasma reactor where it all began. It keeps “adapting” the city.')}</p>
        <p>${R('В игре это шкала «Угроза»: чем дольше смена, тем сильнее адаптанты. Контроль не даёт Ядро выключить — оно тоже имущество компании.', 'In the game it’s the Threat ring: the longer the shift, the stronger the adaptants. Control won’t let anyone shut it down; it’s company property too.')}</p>
      </div>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${head(R('ПОЛЕ // ВРАГИ', 'BOARD // ENEMIES'), R('Адаптанты', 'Adaptants'), R('Люди, звери из вивария и техника, перестроенные Splice Medium под задачу. Каждый отдаёт победителю часть своей технологии.', 'People, vivarium animals and machines rebuilt by Splice Medium for a task. Each one gives its technology to the winner.'))}
    <div class="enemies">${enemies.map(([f, ru, en]) => `<div class="enemy slab"><img src="${img(`px/${f}.gif`)}" alt="" loading="lazy"><h3 style="font-size:15px">${R(ru, en)}</h3></div>`).join('')}</div>
  </div></section>`;
}

function comicCard(c: (typeof COMICS)[number]): string {
  const cover = c.id === 'last-donut' ? 'comics/last-donut-cover.webp' : c.pages[lang][0];
  return `<a class="comic-card slab" href="#comic-${c.id}">
    <div class="cover"><img src="${img(cover)}" alt="" loading="lazy"></div>
    <div class="meta"><span class="caps">${tr(c.series)} // ${tr(c.cast)}</span><h3>${tr(c.title)}</h3><p>${tr(c.blurb)}</p></div>
  </a>`;
}

function comicsView(): string {
  return `<section class="section"><div class="wrap">
    ${head(R('ЧИТАТЬ // КОМИКСЫ', 'READ // COMICS'), R('Комиксы', 'Comics'), R('«До сирен» — истории Lumen City до аварии: обычные городские проблемы, которые решают необычные спасатели.', '“Before the Sirens” is about Lumen City before the accident: ordinary city problems solved by extraordinary rescuers.'))}
    <div class="comics">${COMICS.map(comicCard).join('')}</div>
  </div></section>`;
}

function comicView(id: string): string {
  const c = COMICS.find((x) => x.id === id);
  if (!c) return comicsView();
  const ruOnly = c.pages.en[0] === c.pages.ru[0] && lang === 'en';
  const i = COMICS.indexOf(c);
  const next = COMICS[(i + 1) % COMICS.length];
  return `<section class="section"><div class="wrap">
    <div class="reader">
      <a class="caps" href="#comics" style="text-decoration:none">← ${u('comics')}</a>
      <span class="caps">${tr(c.series)} // ${tr(c.cast)}</span>
      <h1 style="font-size:clamp(30px,5vw,52px)">${tr(c.title)}</h1>
      <p class="lead">${tr(c.blurb)}${ruOnly ? ` <span class="chip">${u('ruOnly')}</span>` : ''}</p>
      ${c.pages[lang].map((p, k) => `<img src="${img(p)}" alt="${esc(tr(c.title))} ${k + 1}" ${k ? 'loading="lazy"' : ''}>`).join('')}
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
    default:
      return { view: home(), active: 'home' };
  }
}

const app = document.getElementById('site')!;
let lastHash = '';

function render(): void {
  document.documentElement.lang = lang;
  const r = route();
  app.innerHTML = `${bar(r.active)}<main>${r.view}</main>${footer()}${drawer()}<div class="lightbox" id="lightbox" hidden></div>`;
  document.title = r.active === 'home' ? 'PART SHIFT — Lumen City' : `${u(r.active)} · PART SHIFT`;
  const same = location.hash === lastHash;
  lastHash = location.hash;
  if (r.anchor) document.getElementById(r.anchor)?.scrollIntoView();
  else if (!same) window.scrollTo(0, 0);
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
  const zoom = t.closest<HTMLButtonElement>('button.zoom');
  if (zoom) {
    const lb = document.getElementById('lightbox')!;
    lb.innerHTML = `<button class="icon-btn" aria-label="${u('close')}">${ICON.close}</button><img src="${zoom.dataset.src}" alt=""${zoom.dataset.px ? ' class="px"' : ''}><p>${zoom.dataset.cap ?? ''}</p>`;
    lb.hidden = false;
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
