import"./config-BuGjUh31.js";import{w as F,i as r,A as T,H as p,C as f,a as k,s as B,B as D,b as U,D as b,T as C,R as P,U as j}from"./content-DNzcLaez.js";const S="partshift.lang";function z(){const t=new URLSearchParams(location.search).get("lang");if(t==="ru"||t==="en")return t;try{const s=localStorage.getItem(S);if(s==="ru"||s==="en")return s}catch{}return navigator.language.toLowerCase().startsWith("ru")?"ru":"en"}let n=z();const i=t=>t[n]||t.ru,d=t=>i(j[t]),h=t=>t.replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s]),e=(t,s)=>n==="ru"?t:s,$=()=>`play/index.html?lang=${n}`,H=["heroes","world","villains","comics","artbook"],g={burger:'<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>',close:'<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>',play:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>'};function V(t){const s=H.map(a=>`<a href="#${a}"${t===a?' aria-current="page"':""}>${d(a)}</a>`).join("");return`
  <header class="bar"><div class="wrap bar-in">
    <a class="brand" href="#home" aria-label="PART SHIFT">
      <img src="${r("emblem.webp")}" alt="" width="34" height="34">
      <span class="wordmark">PART<b>SHIFT</b></span>
    </a>
    <nav class="nav" aria-label="${d("menu")}">${s}</nav>
    ${I()}
    <a class="btn btn-primary" href="${$()}">${g.play}${d("play")}</a>
    <button class="burger" id="burger" aria-label="${d("menu")}">${g.burger}</button>
  </div></header>`}function I(){return`<div class="lang" role="group" aria-label="Language">
    <button data-lang="ru" aria-pressed="${n==="ru"}">RU</button><button data-lang="en" aria-pressed="${n==="en"}">EN</button>
  </div>`}function Y(){const t=["home",...H].map(s=>`<a class="item" href="#${s}">${d(s)}<span class="caps">${s==="home"?"LUMEN CITY":""}</span></a>`).join("");return`<div class="drawer" id="drawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="drawer-close" aria-label="${d("close")}">${g.close}</button></div>
    ${t}
    <a class="item" href="${T}" rel="noopener">${e("Скачать для Android","Download for Android")}<span class="caps">APK</span></a>
    <a class="item" href="#support">${e("Донат автору","Tip the author")}<span class="caps">☕</span></a>
    <div class="row" style="margin-top:18px;justify-content:space-between">${I()}<a class="btn btn-primary" href="${$()}">${g.play}${d("play")}</a></div>
  </div></div>`}function G(){return`<footer><div class="wrap">
    <span class="wordmark">PART<b>SHIFT</b></span>
    <span>${e("Lumen City. Всегда на смене. Игра бесплатная, мир вымышленный.","Lumen City. Always on call. The game is free, the world is fiction.")}</span>
    <div class="row"><a class="btn btn-ghost" href="${T}" rel="noopener">${e("Скачать для Android","Download for Android")}</a><a class="btn btn-ghost" href="#support">☕ ${e("Донат автору","Tip the author")}</a><a class="btn btn-ghost" href="${$()}">${g.play}${d("playFree")}</a></div>
  </div></footer>`}const c=(t,s,a)=>`
  <div class="section-head"><span class="caps">${t}</span><h2>${s}</h2>${a?`<p class="lead">${a}</p>`:""}</div>`,x=(t,s,a=!1)=>`
  <figure><button class="zoom" data-src="${r(t)}" data-cap="${h(s)}"${a?' data-px="1"':""} aria-label="${h(s)}"><img src="${r(t)}" alt="${h(s)}" loading="lazy"${a?' class="px"':""}></button><figcaption>${s}</figcaption></figure>`;function w(t){return`<a class="tile slab" href="#hero-${t.id}" style="--hc:${t.color}">
    <div class="stage"><span class="stripe"></span><img src="${r(t.px)}" alt="${h(i(t.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(t.hud)}</span><h3>${i(t.name)}</h3><p>${i(t.role).split(". ")[0]}.</p></div>
  </a>`}function R(){const t=p.filter(s=>s.group==="canon"&&s.id!=="n73"&&s.id!=="doctor");return`
  <section class="hero">
    <img src="${r("key-art.webp")}" alt="${h(e("Спасатели HeroOut на развалинах Lumen City","HeroOut rescuers on the rubble of Lumen City"))}">
    <div class="wrap"><div class="hero-card slab fade-in">
      <span class="caps">LUMEN CITY // ${e("СМЕНА 01","SHIFT 01")}</span>
      <h1>PART<b>SHIFT</b></h1>
      <p class="lead">${e("Сеть спасения сломалась и перестроила город под себя. Открывай кварталы, строй, защищай жителей и забирай у врагов их руки, ноги и хвосты.","The rescue network broke and rebuilt the city in its own image. Open blocks, build, protect residents and take your enemies’ arms, legs and tails.")}</p>
      <div class="row"><a class="btn btn-primary btn-lg" href="${$()}">${g.play}${d("playFree")}</a><a class="btn btn-ghost btn-lg" href="${T}" rel="noopener">${e("Скачать для Android","Download for Android")}</a><a class="btn btn-ghost btn-lg" href="#world">${e("Узнать историю","Read the story")}</a></div>
    </div></div>
  </section>

  <section class="section"><div class="wrap split">
    <div class="stack">
      ${c(e("КАНОН // ЧТО СЛУЧИЛОСЬ","CANON // WHAT HAPPENED"),e("Город, который любил своих героев","The city that loved its heroes"))}
      <div class="prose">
        <p>${e("Lumen City — солнечный прибрежный город: белые башни, голубое стекло, сады на крышах и монорельс над пляжем. Его берегла HeroOut, аварийная служба и корпорация, которая выдавала спасателям сменные части тела под каждую задачу.","Lumen City is a sunny coastal city of white towers, blue glass, rooftop gardens and a monorail over the beach. It was kept safe by HeroOut, an emergency service and corporation that fitted its rescuers with swappable body parts for every job.")}</p>
        <p>${e("Пожарному — термостойкую руку, водолазу — криогелевое лёгкое. Всё держалось на Splice Medium, среде, которая «договаривается» с чужой тканью. Пока на публичной демонстрации повреждённый контейнер не попал в реактор.","A heat-proof arm for a firefighter, a cryogel lung for a diver. It all ran on Splice Medium, a carrier that “negotiates” with foreign tissue. Until, at a public demonstration, a damaged container reached the reactor.")}</p>
        <p>${e("Магии здесь нет. Ангел, Демон и зомби — уличные прозвища. Всё объясняется биотканью, нейроинтерфейсом и аварийной техникой.","There is no magic here. Angel, Demon and zombie are street nicknames. Everything comes down to biotissue, neural interfaces and emergency hardware.")}</p>
      </div>
    </div>
    <ol class="timeline">
      <li><h3>${e("До сирен","Before the sirens")}</h3><p>${e("Герои HeroOut снимают котов с деревьев, играют в волейбол на Sunline Beach и раздают автографы. Об этом — комиксы.","HeroOut heroes rescue cats, play volleyball on Sunline Beach and sign autographs. That’s what the comics are about.")}</p></li>
      <li><h3>EVERYONE IS ON CALL</h3><p>${e("Протокол «Все на смене» запускают на демонстрации. Splice Medium попадает в реактор.","The “Everyone Is On Call” protocol goes live at a demo. Splice Medium reaches the reactor.")}</p></li>
      <li><h3>${e("Все на смене","Everyone on call")}</h3><p>${e("Гель сводит с ума горожан и всех героев HeroOut. Около пятнадцати спасателей бегают по городу и «спасают» каждый по-своему. Контроль вежливо просит пройти на склад.","The gel drives the citizens and every HeroOut hero mad. About fifteen rescuers roam the city, each “rescuing” in their own way. Control politely asks everyone to proceed to the warehouse.")}</p></li>
      <li><h3>${e("Первая смена","The first shift")}</h3><p>${e("Командный центр открывает город заново, квартал за кварталом, и останавливает героев одного за другим. Это твоя игра.","A Command Center reopens the city, block by block, and stops the heroes one by one. That’s your game.")}</p></li>
      <li><h3>${e("42-й этаж","Floor 42")}</h3><p>${e("Наверху башни HeroOut сидит совет директоров: «Город платит, пока боится». Финал — добраться туда и выключить протокол.","At the top of the HeroOut tower sits the board: “The city pays as long as it’s afraid.” The finale: get there and switch the protocol off.")}</p></li>
    </ol>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${c(e("ДОСЬЕ // HEROOUT","DOSSIERS // HEROOUT"),e("Герои, они же злодеи","Heroes, also the villains"),e("У каждого героя одна функция, один цвет, одна мания и одна часть тела, которую мечтает забрать любой житель.","Each hero has one function, one colour, one obsession and one body part every resident dreams of claiming."))}
    <div class="grid">${t.map(w).join("")}</div>
    <div class="row" style="margin-top:22px"><a class="btn btn-ghost" href="#heroes">${d("all")} (${p.length})</a></div>
  </div></section>

  <section class="section band"><div class="wrap split">
    <div class="stack">
      ${c(e("ИГРА // СРОЧНЫЙ ВЫЗОВ","GAME // URGENT CALL"),e("Открой город квартал за кварталом","Reopen the city block by block"),e("Числа на открытых кварталах подсказывают, что прячется рядом. Галочки и подсветка сами покажут, где безопасно.","Numbers on opened blocks tell you what hides next door. Ticks and highlights show you where it’s safe."))}
      <div class="howto">${W(!0)}</div>
      <div class="row"><a class="btn btn-primary btn-lg" href="${$()}">${g.play}${d("playFree")}</a></div>
    </div>
    <figure><img src="${r("sprites-02.webp")}" alt="" loading="lazy"><figcaption>${e("Обычный житель забирает руку врага и меняется прямо на поле.","An ordinary resident takes an enemy’s arm and changes right on the board.")}</figcaption></figure>
  </div></section>

  <section class="section"><div class="wrap">
    ${c(e("КОМИКСЫ // ДО СИРЕН","COMICS // BEFORE THE SIRENS"),e("Обычные проблемы. Профессиональная громкость.","Ordinary problems. Professional volume."))}
    <div class="comics">${f.slice(0,4).map(N).join("")}</div>
  </div></section>

  <section class="section" id="support" style="padding-top:0"><div class="wrap">
    ${c(e("СКАЧАТЬ // ПОДДЕРЖАТЬ","DOWNLOAD // SUPPORT"),e("Игра на телефоне и кофе автору","The game on your phone, and a coffee for the author"))}
    ${B(n)}
  </div></section>

  ${K()}`}function W(t=!1){return[["⌂","Поставь Командный центр","Place the Command Center","Первое нажатие на поле. Это твоя база: потеряешь её — смена окончена.","Your first tap. It’s your base; lose it and the shift is over."],["↘","Проведи по кварталам","Swipe across blocks","Жители сами пойдут копать. Открытые клетки дают Энергию и место для стройки.","Residents go and dig. Opened cells give Energy and room to build."],["▲","Читай числа","Read the numbers","▲ гнёзда врагов рядом, ◆ находки, ⬡ герой на вызове. Зелёная галочка — точно безопасно.","▲ nests nearby, ◆ finds, ⬡ the hero on call. A green tick means safe for sure."],["✚","Расти и забирай части","Grow and claim parts","Школа делает защитников. Победив врага, защитник сам прикрутит его руку или ногу.","The school trains defenders. After a win, a defender bolts on the enemy’s arm or leg."]].map(([a,o,u,l,m])=>`<div class="step${t?"":" slab"}"${t?' style="background:#142028"':""}><span class="glyph" style="color:var(--seam)">${a}</span><h3>${e(o,u)}</h3><p>${e(l,m)}</p></div>`).join("")}function K(){return`<section class="section band"><div class="wrap split">
    <div class="stack">
      ${c(e("СЛЕДУЮЩАЯ ГЛАВА","NEXT CHAPTER"),"PART SHIFT Fighting",e("2D-файтинг про Семьдесят Третьего. Клинчи, апперкоты, подкаты, покадровая анимация — и главное: оторвать сопернику руку и прикрутить её себе.","A 2D fighting game starring Seventy-Third. Clinches, uppercuts, slides, hand-drawn frame animation, and the main thing: tear off your rival’s arm and bolt it onto yourself."))}
      <p>${e("В разработке. Эта игра бесплатная, чтобы ты успел познакомиться с героями заранее.","In development. This game is free so you can meet the heroes first.")}</p>
      <div class="row"><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#hero-n73">${e("Кто такой N-73","Who is N-73")}</a><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#artbook-dossier">${e("Досье файтинга","Fighting dossiers")}</a></div>
    </div>
    <div class="stack">
      <figure><img src="${r("doctor-arm.webp")}" alt="${h(e("Доктор с тяжёлой рукой Килна","The Doctor with Kiln’s heavy arm"))}" loading="lazy"><figcaption>${e("Доктор, первое тело N-73, с рукой Килна","The Doctor, N-73’s first body, with Kiln’s arm")}</figcaption></figure>
    </div>
  </div></section>`}function L(){const t=p.filter(a=>a.group==="canon"),s=p.filter(a=>a.group==="city");return`<section class="section"><div class="wrap">
    ${c(e("ДОСЬЕ // HEROOUT","DOSSIERS // HEROOUT"),e("Герои. Они же злодеи","Heroes. Also the villains"),e("Гель Splice свёл с ума всех спасателей HeroOut, их пятнадцать. Каждый всё ещё «спасает», только от такой помощи надо бежать. Главного среди них нет. Победишь героя — заберёшь его часть, а победишь много раз — он вернётся в себя и станет союзником.","Splice gel drove every HeroOut rescuer mad, fifteen of them. Each one is still “rescuing,” and you should run from that kind of help. None of them is in charge. Beat a hero and take their part; beat them enough times and they come back to themselves as your ally."))}
    <div class="grid">${t.map(w).join("")}</div>
  </div></section>
  <section class="section" style="padding-top:0"><div class="wrap">
    ${c(e("ГОРОД // ДО СИРЕН","CITY // BEFORE THE SIRENS"),e("Ещё спасатели Lumen City","More Lumen City rescuers"),e("Обычные городские службы, доведённые до героизма, а потом гелем до мании. Пока в комиксах, на поле выйдут позже.","Ordinary city services taken to heroism, then by the gel to obsession. In the comics for now, on the board later."))}
    <div class="grid">${s.map(w).join("")}</div>
  </div></section>`}function _(t){const s=p.findIndex(v=>v.id===t),a=p[s];if(!a)return L();const o=p[(s-1+p.length)%p.length],u=p[(s+1)%p.length],l=(v,y)=>y&&i(y)?`<div class="fact"><span class="caps">${v}</span><p>${i(y)}</p></div>`:"",m=a.art?`<img src="${r(a.art)}" alt="${h(i(a.name))}">`:`<img class="px" src="${r(a.px)}" alt="${h(i(a.name))}">`;return`<section class="section" style="--hc:${a.color}"><div class="wrap">
    <a class="caps" href="#heroes" style="text-decoration:none">← ${d("all")}</a>
    <div class="dossier" style="margin-top:20px">
      <div class="dossier-art">
        <div class="frame slab">${m}</div>
        ${a.art?`<div class="slab" style="padding:14px;display:flex;gap:14px;align-items:center"><img src="${r(a.px)}" alt="" style="height:96px;width:auto;image-rendering:pixelated"><span class="caps">${e("ПИКСЕЛЬ-СПРАЙТ","PIXEL SPRITE")}</span></div>`:""}
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:${a.color}"></i>${i(a.hud)}</span>
        <h1>${i(a.name)}</h1>
        <p class="lead">${i(a.role)}</p>
        ${a.quote?`<blockquote class="quote" style="margin:6px 0">${i(a.quote)}<span class="caps" style="display:block;margin-top:6px">${e("ДО СИРЕН","BEFORE THE SIRENS")}</span></blockquote>`:""}
        ${a.line?`<div class="bark slab"><span class="caps">${e("СЕЙЧАС, НА СМЕНЕ:","NOW, ON SHIFT:")}</span>«${i(a.line)}»</div>`:""}
        <div class="facts">
          ${l(e("ДО АВАРИИ","BEFORE"),a.before)}
          ${l(e("ПОСЛЕ ГЕЛЯ","AFTER THE GEL"),a.mania??a.after)}
          ${l(e("ТРОФЕЙ","TROPHY"),a.trophy)}
          ${l(e("УБЕЖИЩЕ","LAIR"),a.lair)}
          ${l(e("ВЕРНЁТСЯ СОЮЗНИКОМ","COMES BACK AS AN ALLY"),a.ally)}
          ${l(e("КАК ВЕРНУТЬ","HOW TO BRING BACK"),a.unlock)}
          ${l(e("МОДУЛЬ","MODULE"),a.module)}
          ${l(e("ТЕХНОЛОГИЯ","TECH"),a.tech)}
          ${l(e("ОБРАЗ","LOOK"),a.look)}
          ${l(e("ПРИВЫЧКА","HABIT"),a.fact)}
          ${l(e("В ИГРЕ","IN GAME"),a.inGame)}
        </div>
        ${(a.extra??[]).length?`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${a.extra.map(v=>x(v.src,i(v.cap),v.src.endsWith(".gif"))).join("")}</div>`:""}
        <div class="pager">
          <a class="btn btn-ghost" href="#hero-${o.id}">← ${i(o.name)}</a>
          <a class="btn btn-ghost" href="#hero-${u.id}">${i(u.name)} →</a>
        </div>
      </div>
    </div>
  </div></section>`}function q(){const t=s=>C.find(a=>a.id===s);return`<section class="section"><div class="wrap split">
    <div class="stack">
      ${c(e("МИР // LUMEN CITY","WORLD // LUMEN CITY"),e("История вселенной","The story of the universe"))}
      <div class="prose">
        <p>${e("<b>HeroOut</b> снабжала город всем, что спасает жизнь: экстренной медициной, спасателями, протезами, защитными костюмами и адаптивными тканями. Её реклама висит до сих пор: «HERO | OUT — Аварийная служба. Всегда на смене».","<b>HeroOut</b> supplied the city with everything that saves lives: emergency medicine, rescuers, prosthetics, protective suits and adaptive fabrics. Its ads still hang everywhere: “HERO | OUT. Emergency service. Always on call.”")}</p>
        <p>${e("Компания не злая в карикатурном смысле. Её грех в другом: тело для неё — заменяемый носитель, а личность — актив.","The company isn’t cartoonishly evil. Its sin is quieter: to HeroOut a body is a replaceable carrier and a personality is an asset.")}</p>
        <p>${e("<b>Augvolution</b> — программа подбора временных биотехнических частей под задачу. <b>Splice Medium</b> — медицинская среда, которая переносит нервный сигнал и уговаривает чужую ткань прижиться. Поэтому в этом мире можно пересадить руку, ногу, хвост, крылья и даже голову.","<b>Augvolution</b> is the programme that fits temporary biotech parts to a task. <b>Splice Medium</b> is the medical carrier that relays nerve signals and persuades foreign tissue to take. That’s why in this world you can transplant an arm, a leg, a tail, wings, even a head.")}</p>
        <p>${e("На демонстрации протокола <b>EVERYONE IS ON CALL</b> повреждённый контейнер Splice Medium попал в реактор. Сеть спасения стала сетью неуправляемой адаптации: у огня выросла термозащита, у воды — криогель, кабели стали нервами, а дроны — органами.","At the demo of the <b>EVERYONE IS ON CALL</b> protocol, a damaged Splice Medium container reached the reactor. The rescue network became a network of runaway adaptation: fire grew heat shielding, water grew cryogel, cables became nerves and drones became organs.")}</p>
        <p>${e("Герои не стали злыми. Их протоколы стали буквальными: пожарный изолирует всё подряд, медик «сохраняет» даже врагов, высотник ловит людей петлёй и тащит «в безопасность».","The heroes didn’t turn evil. Their protocols turned literal: the firefighter insulates everything, the medic “preserves” even enemies, the high-rise rescuer lassoes people and drags them “to safety.”")}</p>
      </div>
    </div>
    <div class="stack">
      <figure>${`<button class="zoom" data-src="${r("city-life.webp")}" data-cap="${h(e("Жизнь Lumen City до аварии","Lumen City life before the accident"))}"><img src="${r("city-life.webp")}" alt="" loading="lazy"></button>`}<figcaption>${e("Фанаты героев в самодельных шлемах, уличный повар с кибер-воком, гражданский микрореактор на кобальтовой плазме.","Hero fans in homemade helmets, a street chef with a cyber-wok, a civil cobalt-plasma microreactor.")}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${c(e("КАРТА // РАЗРЕЗ","MAP // CROSS-SECTION"),e("Районы: от пляжа до Undersun","Districts: from the beach to Undersun"),e("Чем глубже и ближе к Campus, тем сильнее адаптация.","The deeper and closer to the Campus, the stronger the adaptation."))}
    <div class="depth slab">${[b[2],b[1],b[0],b[3],b[4]].map((s,a)=>`<div class="stratum"><span class="caps">${(n==="ru"?["ПОБЕРЕЖЬЕ","ЦЕНТР","ЭПИЦЕНТР","ПОД ГОРОДОМ","ГЛУБИНА"]:["COAST","DOWNTOWN","EPICENTRE","UNDERGROUND","DEEP"])[a]}</span><div><h3>${s.name}</h3><p>${n==="ru"?s.ru:s.en}</p></div></div>`).join("")}</div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${c(e("ТЕХНОЛОГИИ // УРОН","TECH // DAMAGE"),e("Пять технологий и их реакции","Five technologies and their reactions"),e("Каждый адаптант несёт одну технологию. Её и отдаёт победителю: убил ледяного — получил ледяную руку.","Every adaptant carries one technology and hands it to whoever wins: defeat an ice one, get an ice arm."))}
      <div class="techs">${C.map(s=>`<div class="tech slab"><i style="--dot:${s.color}"></i><h3>${n==="ru"?s.ru:s.en}</h3></div>`).join("")}</div>
    </div>
    <div class="stack">
      <div class="slab" style="padding:8px 18px"><div class="table-scroll"><table class="reactions"><tbody>
        ${P.map(s=>{const a=t(s.a),o=t(s.b);return`<tr><td><span class="mix"><i style="--dot:${a.color}"></i>${n==="ru"?a.ru:a.en}</span></td><td>+</td><td><span class="mix"><i style="--dot:${o.color}"></i>${n==="ru"?o.ru:o.en}</span></td><td>=</td><td>${n==="ru"?s.ru:s.en}</td></tr>`}).join("")}
      </tbody></table></div></div>
      <p class="caps">${e("ЗАЩИТА — ОТДЕЛЬНЫЙ СЛОЙ: РЕЗИНА, ТЕРМОКЕРАМИКА, КРИОКОЖУХ, БИОФИЛЬТР, ПОЛИМЕР","DEFENCE IS ITS OWN LAYER: RUBBER, THERMOCERAMIC, CRYO SHELL, BIOFILTER, POLYMER")}</p>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${c(e("ТЕЛО // СЛОТЫ","BODY // SLOTS"),e("Правило трофея","The trophy rule"),e("Жители рождаются обычными. Никаких карточек, инвентаря и ручной экипировки: победив врага, человек сам забирает его часть и становится сильнее.","Residents are born ordinary. No cards, no inventory, no manual gear: after beating an enemy, a person takes its part and gets stronger."))}
      <div class="slots">${[e("Голова","Head"),e("Левая рука","Left arm"),e("Правая рука","Right arm"),e("Левая нога","Left leg"),e("Правая нога","Right leg"),e("Хвост","Tail"),e("Крылья","Wings")].map(s=>`<div class="slot slab">${s}</div>`).join("")}</div>
    </div>
    <div class="slab upgrade">
      <figure><img src="${r("px/s01_normal.png")}" alt=""><figcaption>${e("Житель","Resident")}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${r("px/s01_ice_arm.png")}" alt=""><figcaption>${e("Ледяная рука","Ice arm")}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${r("px/s01_mech_arm.png")}" alt=""><figcaption>${e("Тяжёлая рука","Heavy arm")}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${c(e("ЗДАНИЯ // 12","BUILDINGS // 12"),e("Что строит Командный центр","What the Command Center builds"))}
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${[["b01-medcenter","Медцентр","Medcenter"],["b02-house_small","Жилой блок","Housing block"],["b03-house_tower","Многоэтажка","Apartment tower"],["b04-skyscraper","Небоскрёб","Skyscraper"],["b05-school","Школа спасателей","Rescue school"],["b06-scout_tower","Башня разведки","Scout tower"],["b07-workshop","Мастерская модулей","Module workshop"],["b08-microreactor","Микрореактор","Microreactor"],["b09-cryo_station","Станция охлаждения","Cooling station"],["b10-greenhouse","Оранжерея","Greenhouse"],["b11-monorail","Станция монорельса","Monorail station"],["b12-shield_spire","Шпиль щита","Shield spire"]].map(([s,a,o])=>`<figure class="slab" style="padding:14px"><img src="${r(`px/${s}.webp`)}" alt="" loading="lazy" style="margin:auto;height:120px;width:auto"><figcaption style="text-align:center;font-weight:600;color:var(--ink)">${e(a,o)}</figcaption></figure>`).join("")}</div>
  </div></section>`}function X(){const t=p.filter(a=>a.mania),s=a=>`<a class="tile slab" href="#hero-${a.id}" style="--hc:${a.color}">
    <div class="stage"><span class="stripe"></span><img src="${r(a.px)}" alt="${h(i(a.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(a.trophy)}</span><h3>${i(a.name)}</h3><p>«${i(a.line)}»</p></div>
  </a>`;return`<section class="section"><div class="wrap">
    ${c(e("УГРОЗЫ // ПРОТОКОЛЫ","THREATS // PROTOCOLS"),e("Злодеи","Villains"),e("Злодеев «со злом внутри» здесь нет. Есть герои, которые спасают слишком буквально, корпорация, которой выгоден страх, и её очень вежливый голос.","Nobody here is evil at heart. There are heroes who rescue far too literally, a corporation that profits from fear, and its very polite voice."))}

    <div class="villain">
      <div class="art slab" style="--hc:#E03552;background:linear-gradient(180deg,#2a1416,#10171c)"><img src="${r("key-art.webp")}" alt="" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="stack">
        <span class="chip"><i style="--dot:#E03552"></i>${e("ВСЕ СРАЗУ // ГЛАВНОГО НЕТ","ALL AT ONCE // NONE IN CHARGE")}</span>
        <h2>${e("Обезумевшие герои","The deranged heroes")}</h2>
        <p class="lead">${e("Гель Splice лечил спасателей и отращивал им конечности. Потом он вышел из-под контроля и свёл с ума горожан и всех героев HeroOut.","Splice gel healed rescuers and regrew their limbs. Then it went out of control and drove the citizens and every HeroOut hero mad.")}</p>
        <p>${e("Пятнадцать героев бегают по городу как враги, включая тройки серийных Стандартов. Каждый всё ещё на смене и всё ещё «спасает», у каждого своя мания, стихия и убежище. Главного среди них нет: Демон, Килн, Фростлайн и Серафим равны, просто опасны по-разному. В каждой смене цель — герой, на которого пришёл вызов. Первым в игре сделан Демон. Победи героя достаточно раз, и он вернётся в себя: «Герой вернулся. Больше не на смене у HeroOut. Теперь на вашей».","Fifteen heroes roam the city as enemies, Standard copies in threes included. Each is still on shift and still “rescuing,” each with an obsession, an element and a lair. None of them is in charge: Demon, Kiln, Frostline and Seraph are equals, just dangerous in different ways. Each shift targets the hero the call came in for. Demon is simply the first one in the game. Beat a hero enough times and they come back to themselves: “The hero is back. No longer on shift for HeroOut. Now on yours.”")}</p>
        <div class="bark slab"><span class="caps">${e("КОНТРОЛЬ:","CONTROL:")}</span>${e("Если вы видите обезумевшего героя, не паникуйте. Он на смене.","If you see a deranged hero, do not panic. They are on shift.")}</div>
      </div>
    </div>
    <div class="grid">${t.map(s).join("")}</div>

    <div class="villain" style="margin-top:56px">
      <div class="art slab">
        <svg class="control-face" viewBox="0 0 200 200" role="img" aria-label="${e("Маска Контроля","Control’s mask")}">
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
        <span class="chip"><i style="--dot:#57D8F2"></i>${e("ГОЛОС КОРПОРАЦИИ // ИИ HEROOUT","VOICE OF THE CORPORATION // HEROOUT AI")}</span>
        <h2>${e("Контроль","Control")}</h2>
        <p class="lead">${e("Аварийный ИИ HeroOut. До сих пор вежливо выполняет протокол EVERYONE IS ON CALL. Все жители и все герои для него имущество компании, которое надо учесть и вернуть на склад.","HeroOut’s emergency AI. Still politely running EVERYONE IS ON CALL. To Control, every resident and every hero is company property to be logged and returned to the warehouse.")}</p>
        <p>${e("Тела у Контроля нет: лицо — маска шлема спасателя на экранах и дронах-громкоговорителях, вместо рта голубая линия-улыбка. Он никогда не злится. Чем страшнее событие, тем спокойнее голос. Чужие модули на защитниках для него кража.","Control has no body: its face is a rescue-helmet mask on screens and loudspeaker drones, with a thin blue smile for a mouth. It never gets angry. The scarier the event, the calmer the voice. Trophy modules on defenders count as theft.")}</p>
        <div class="stack" style="gap:10px">${D.map(([a,o])=>`<div class="bark slab"><span class="caps">${e("КОНТРОЛЬ:","CONTROL:")}</span>${e(a,o)}</div>`).join("")}</div>
      </div>
    </div>

    <div class="villain">
      <div class="art slab" style="background:linear-gradient(180deg,#10171c,#0b1117);display:grid;place-items:center">
        <div style="font:900 clamp(96px,16vw,180px)/1 var(--display);color:#EDF4F5;letter-spacing:-0.04em">42</div>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:#E8A33A"></i>${e("КОРПОРАЦИЯ НАВЕРХУ // НАСТОЯЩИЙ ФИНАЛ","THE CORPORATION UPSTAIRS // THE REAL FINALE")}</span>
        <h2>${e("42-й этаж","Floor 42")}</h2>
        <p class="lead">${e("На улице HeroOut — честные усталые спасатели. Наверху, на 42-м этаже, совет директоров давно понял: город платит, пока у него что-то случается.","Down on the street, HeroOut means honest, tired rescuers. Upstairs on floor 42, the board figured out long ago that the city pays as long as something keeps happening.")}</p>
        <p>${e("Кошки на деревьях, краны, которые сходят с ума, пожар ровно за минуту до проезда патруля. Слишком много инцидентов случается слишком вовремя. И гель выпустили, не проверив. Финал кампании — не убить героя, а добраться до 42-го этажа и выключить протокол: «Смена окончена. Все свободны». Тогда герои смогут прийти в себя.","Cats up trees, cranes going haywire, a fire exactly one minute before the patrol drives by. Too many incidents happen right on time. And the gel shipped untested. The campaign ends not by killing a hero but by reaching floor 42 and switching the protocol off: “Shift over. Everyone is free.” Then the heroes can come back to themselves.")}</p>
      </div>
    </div>

    <div class="villain">
      <div class="art slab" style="background:linear-gradient(180deg,#0f1a22,#0b1117)">
        <svg class="core" viewBox="0 0 200 200" role="img" aria-label="${e("Ядро вспышки","Splice Heart")}">
          <g stroke="#2E55C8" stroke-width="3" fill="none" opacity=".8"><path d="M100 150 C 80 170, 40 172, 12 190"/><path d="M100 150 C 120 172, 160 168, 192 186"/><path d="M60 100 C 40 90, 22 70, 8 40"/><path d="M140 100 C 162 88, 176 66, 194 36"/></g>
          <circle cx="100" cy="100" r="58" fill="#EDF4F5" stroke="#10171C" stroke-width="3"/>
          <path d="M70 62 L92 96 L80 120 M132 70 L112 100 L126 134" stroke="#10171C" stroke-width="3" fill="none"/>
          <circle class="pulse" cx="100" cy="100" r="34" fill="#2E55C8"/>
          <circle class="pulse" cx="100" cy="100" r="18" fill="#9FF4FF"/>
        </svg>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:#8A4DFF"></i>${e("РАСТУЩАЯ УГРОЗА // RESEARCH CAMPUS","GROWING THREAT // RESEARCH CAMPUS")}</span>
        <h2>${e("Ядро вспышки","Splice Heart")}</h2>
        <p class="lead">${e("Не персонаж, а место: повреждённый контейнер геля в реакторе Research Campus. Треснувшая белая оболочка, пульсирующая голубая плазма, кабели-вены по асфальту.","Not a character but a place: a damaged gel container inside the Research Campus reactor. A cracked white shell, pulsing blue plasma, cable veins across the asphalt.")}</p>
        <p>${e("В игре это шкала «Угроза»: каждые две минуты враги становятся сильнее. Контроль не даёт Ядро заглушить, потому что оно тоже имущество компании.","In the game it’s the Threat ring: every two minutes the enemies get stronger. Control won’t let anyone shut it down, because it’s company property too.")}</p>
      </div>
    </div>
  </div></section>

  <section class="section band"><div class="wrap">
    ${c(e("ФАСАДЫ // РЕКЛАМА HEROOUT","BILLBOARDS // HEROOUT ADS"),e("Всегда на смене","Always on call"),e("Реклама до сих пор висит по всему городу. Мелкий шрифт прилагается.","The ads still hang all over the city. Fine print included."))}
    <div class="grid">${U.map(([a,o])=>`<div class="step" style="background:#142028"><span class="caps" style="color:var(--seam)">HERO | OUT</span><p style="font:700 18px/1.35 var(--display);color:#fff;margin:8px 0 0">${e(a,o)}</p></div>`).join("")}</div>
  </div></section>`}function N(t){const s=t.id==="last-donut"?"comics/last-donut-cover.webp":t.pages[n][0];return`<a class="comic-card slab" href="#comic-${t.id}">
    <div class="cover"><img src="${r(s)}" alt="" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(t.series)} // ${i(t.cast)}</span><h3>${i(t.title)}</h3><p>${i(t.blurb)}</p></div>
  </a>`}function M(){return`<section class="section"><div class="wrap">
    ${c(e("ЧИТАТЬ // КОМИКСЫ","READ // COMICS"),e("Комиксы","Comics"),e("«До сирен» — истории Lumen City до аварии: обычные городские проблемы, которые решают необычные спасатели.","“Before the Sirens” is about Lumen City before the accident: ordinary city problems solved by extraordinary rescuers."))}
    <div class="comics">${f.map(N).join("")}</div>
  </div></section>`}function J(t){const s=f.find(l=>l.id===t);if(!s)return M();const a=s.pages.en[0]===s.pages.ru[0]&&n==="en",o=f.indexOf(s),u=f[(o+1)%f.length];return`<section class="section"><div class="wrap">
    <div class="reader">
      <a class="caps" href="#comics" style="text-decoration:none">← ${d("comics")}</a>
      <span class="caps">${i(s.series)} // ${i(s.cast)}</span>
      <h1 style="font-size:clamp(30px,5vw,52px)">${i(s.title)}</h1>
      <p class="lead">${i(s.blurb)}${a?` <span class="chip">${d("ruOnly")}</span>`:""}</p>
      ${s.pages[n].map((l,m)=>`<img src="${r(l)}" alt="${h(i(s.title))} ${m+1}" ${m?'loading="lazy"':""}>`).join("")}
      <div class="pager"><a class="btn btn-ghost" href="#comics">${d("comics")}</a><a class="btn btn-primary" href="#comic-${u.id}">${i(u.title)} →</a></div>
    </div>
  </div></section>`}function Q(t){return`<section class="section"><div class="wrap">
    ${c(e("АРТБУК // HEROOUT ARCHIVE","ARTBOOK // HEROOUT ARCHIVE"),e("Артбук","Artbook"),e("Концепты, досье, город и пиксель-арт. Нажми на картинку, чтобы открыть её целиком.","Concepts, dossiers, the city and pixel art. Tap a picture to see it full size."))}
    <nav class="book-nav">${k.map(s=>`<a class="chip" href="#artbook-${s.id}">${i(s.title)}</a>`).join("")}</nav>
    ${k.map(s=>`<div id="book-${s.id}" style="scroll-margin-top:90px;margin-bottom:56px">
        <div class="section-head" style="margin-bottom:22px"><h2 style="font-size:clamp(22px,2.6vw,30px)">${i(s.title)}</h2><p class="lead" style="font-size:17px">${i(s.note)}</p></div>
        <div class="masonry${s.id==="pixel"?" pixels":""}">${s.shots.map(a=>x(a.src,i(a.cap),a.px)).join("")}</div>
      </div>`).join("")}
  </div></section>`}function Z(){const t=location.hash.replace(/^#/,"");if(t.startsWith("hero-"))return{view:_(t.slice(5)),active:"heroes"};if(t.startsWith("comic-"))return{view:J(t.slice(6)),active:"comics"};if(t.startsWith("artbook"))return{view:Q(),active:"artbook",anchor:t.includes("-")?`book-${t.split("-")[1]}`:void 0};switch(t){case"heroes":return{view:L(),active:"heroes"};case"world":return{view:q(),active:"world"};case"villains":return{view:X(),active:"villains"};case"comics":return{view:M(),active:"comics"};case"support":return{view:R(),active:"home",anchor:"support"};default:return{view:R(),active:"home"}}}const E=document.getElementById("site");let A="";function O(){document.documentElement.lang=n;const t=Z();E.innerHTML=`${V(t.active)}<main>${t.view}</main>${G()}${Y()}<div class="lightbox" id="lightbox" hidden></div>`,document.title=t.active==="home"?"PART SHIFT — Lumen City":`${d(t.active)} · PART SHIFT`;const s=location.hash===A;A=location.hash,F(E,n),t.anchor?document.getElementById(t.anchor)?.scrollIntoView():s||window.scrollTo(0,0)}function ee(t){n=t;try{localStorage.setItem(S,t)}catch{}const s=window.scrollY;O(),window.scrollTo(0,s)}E.addEventListener("click",t=>{const s=t.target,a=s.closest("[data-lang]");if(a)return ee(a.dataset.lang);if(s.closest("#burger"))return void(document.getElementById("drawer").hidden=!1);if(s.closest("#drawer-close")||s.id==="drawer")return void(document.getElementById("drawer").hidden=!0);s.closest("#drawer a")&&(document.getElementById("drawer").hidden=!0);const o=s.closest("button.zoom");if(o){const u=document.getElementById("lightbox");u.innerHTML=`<button class="icon-btn" aria-label="${d("close")}">${g.close}</button><img src="${o.dataset.src}" alt=""${o.dataset.px?' class="px"':""}><p>${o.dataset.cap??""}</p>`,u.hidden=!1;return}s.closest("#lightbox")&&(document.getElementById("lightbox").hidden=!0)});document.addEventListener("keydown",t=>{if(t.key==="Escape"){const s=document.getElementById("lightbox");s&&(s.hidden=!0);const a=document.getElementById("drawer");a&&(a.hidden=!0)}});window.addEventListener("hashchange",O);O();
