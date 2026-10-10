const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./intro-Ipl4Dxus.js","./intro-comic-D8_L205x.js"])))=>i.map(i=>d[i]);
import{y as _,D as T,a as O,b as R,i as n,c as V,_ as Y,H as g,C as f,A as N,B as q,d as W,e as K,f as y,T as L,R as X,U as J}from"./content-BONj8iGO.js";/* empty css              */const w=t=>t.toLocaleString("ru-RU");function I(t,s=""){return`<span class="btn btn-ghost ${s} soon" aria-disabled="true">${t==="ru"?"Android: в разработке, ожидайте":"Android: in development, stay tuned"}</span>`}function Q(t){const s=(a,o)=>t==="ru"?a:o;return`<div class="support">
    <div class="slab support-card">
      <span class="caps">${s("ТЕЛЕФОН // ANDROID","PHONE // ANDROID")}</span>
      <h3>${s("Версия для Android","Android version")}</h3>
      <p>${s("Приложение ещё в разработке. Ожидайте: а пока в игру можно играть прямо в браузере телефона.","The app is still in development. Stay tuned: meanwhile you can play right in your phone’s browser.")}</p>
      ${I(t,"btn-lg")}
      <p class="dim">${s("iPhone позже, через App Store: Apple не разрешает ставить игры в обход магазина.","iPhone comes later through the App Store: Apple doesn’t allow installs outside its store.")}</p>
    </div>
    <div class="slab support-card">
      <img class="jar" src="${n("support-jar.webp")}" alt="${s("Серафим и Патч с банкой «На смену»","Seraph and Patch with an “On shift” tip jar")}" loading="lazy">
      <span class="caps">${s("АВТОРУ // НА КОФЕ","TO THE AUTHOR // COFFEE")}</span>
      <h3>${s("Отправить автору донат","Send the author a tip")}</h3>
      <p>${s("Игра бесплатная и без платного контента. Если нравится, поддержи автора любой суммой.","The game is free with no paid content. If you like it, support the author with any amount.")}</p>
      <div class="sums">${V.map(a=>`<button type="button" data-sum="${a}" aria-pressed="${a===R}">${w(a)} ₽</button>`).join("")}</div>
      <label class="sum-field"><span class="caps">${s("СВОЯ СУММА, ₽","YOUR AMOUNT, ₽")}</span><input type="number" inputmode="numeric" min="${T}" max="${O}" step="1" value="${R}" data-sum-input></label>
      <button type="button" class="btn btn-primary btn-lg" data-donate>${s("Отправить","Send")} ${w(R)} ₽</button>
      <p class="dim" data-donate-note>${s("Оплата картой через ЮMoney, деньги приходят автору напрямую.","Card payment through YooMoney; the money goes straight to the author.")}</p>
    </div>
  </div>`}function Z(t,s){const a=(o,l)=>s==="ru"?o:l;t.querySelectorAll(".support").forEach(o=>{const l=o.querySelector("[data-sum-input]"),r=o.querySelector("[data-donate]"),v=o.querySelector("[data-donate-note]"),u=h=>Number.isFinite(h)&&h>=T&&h<=O,b=()=>{const h=Math.round(Number(l.value));r.disabled=!u(h),r.textContent=`${a("Отправить","Send")} ${u(h)?w(h):"…"} ₽`,o.querySelectorAll("[data-sum]").forEach(H=>H.setAttribute("aria-pressed",String(Number(H.dataset.sum)===h))),v.textContent=u(h)?a("Оплата картой через ЮMoney, деньги приходят автору напрямую.","Card payment through YooMoney; the money goes straight to the author."):a(`Сумма от ${T} до ${w(O)} ₽`,`Amount from ${T} to ${w(O)} ₽`)};o.querySelectorAll("[data-sum]").forEach(h=>h.addEventListener("click",()=>{l.value=h.dataset.sum,b()})),l.addEventListener("input",b),r.addEventListener("click",()=>{const h=Math.round(Number(l.value));u(h)&&(window.open(_(h,a("Донат автору PART SHIFT","PART SHIFT tip")),"_blank","noopener"),v.textContent=a("Спасибо! Оплата открылась в новой вкладке.","Thank you! Payment opened in a new tab."))}),b()})}const M="partshift.lang";function ee(){const t=new URLSearchParams(location.search).get("lang");if(t==="ru"||t==="en")return t;try{const s=localStorage.getItem(M);if(s==="ru"||s==="en")return s}catch{}return navigator.language.toLowerCase().startsWith("ru")?"ru":"en"}let c=ee();const i=t=>t[c]||t.ru,p=t=>i(J[t]),m=t=>t.replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s]),e=(t,s)=>c==="ru"?t:s,E=()=>`play/index.html?lang=${c}`,U=["heroes","world","villains","comics","artbook"],$={burger:'<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>',close:'<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>',play:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>'};function ae(t){const s=U.map(a=>`<a href="#${a}"${t===a?' aria-current="page"':""}>${p(a)}</a>`).join("");return`
  <header class="bar"><div class="wrap bar-in">
    <a class="brand" href="#home" aria-label="PART SHIFT">
      <img src="${n("emblem.webp")}" alt="" width="34" height="34">
      <span class="wordmark">PART<b>SHIFT</b></span>
    </a>
    <nav class="nav" aria-label="${p("menu")}">${s}</nav>
    ${B()}
    <a class="btn btn-primary" href="${E()}">${$.play}${p("play")}</a>
    <button class="burger" id="burger" aria-label="${p("menu")}">${$.burger}</button>
  </div></header>`}function B(){return`<div class="lang" role="group" aria-label="Language">
    <button data-lang="ru" aria-pressed="${c==="ru"}">RU</button><button data-lang="en" aria-pressed="${c==="en"}">EN</button>
  </div>`}function se(){const t=["home",...U].map(s=>`<a class="item" href="#${s}">${p(s)}<span class="caps">${s==="home"?"LUMEN CITY":""}</span></a>`).join("");return`<div class="drawer" id="drawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="drawer-close" aria-label="${p("close")}">${$.close}</button></div>
    ${t}
    <span class="item soon" aria-disabled="true">Android<span class="caps">${e("В РАЗРАБОТКЕ","IN DEVELOPMENT")}</span></span>
    <a class="item" href="#support">${e("Донат автору","Tip the author")}<span class="caps">☕</span></a>
    <div class="row" style="margin-top:18px;justify-content:space-between">${B()}<a class="btn btn-primary" href="${E()}">${$.play}${p("play")}</a></div>
  </div></div>`}function te(){return`<footer><div class="wrap">
    <span class="wordmark">PART<b>SHIFT</b></span>
    <span>${e("Lumen City. Всегда на смене. Игра бесплатная, мир вымышленный.","Lumen City. Always on call. The game is free, the world is fiction.")}</span>
    <div class="row">${I(c)}<a class="btn btn-ghost" href="#support">☕ ${e("Донат автору","Tip the author")}</a><a class="btn btn-ghost" href="${E()}">${$.play}${p("playFree")}</a></div>
  </div></footer>`}const d=(t,s,a)=>`
  <div class="section-head"><span class="caps">${t}</span><h2>${s}</h2>${a?`<p class="lead">${a}</p>`:""}</div>`,F=(t,s,a=!1)=>`
  <figure><button class="zoom" data-src="${n(t)}" data-cap="${m(s)}"${a?' data-px="1"':""} aria-label="${m(s)}"><img src="${n(t)}" alt="${m(s)}" loading="lazy"${a?' class="px"':""}></button><figcaption>${s}</figcaption></figure>`;function S(t){return`<a class="tile slab" href="#hero-${t.id}" style="--hc:${t.color}">
    <div class="stage"><span class="stripe"></span><img src="${n(t.px)}" alt="${m(i(t.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(t.hud)}</span><h3>${i(t.name)}</h3><p>${i(t.role).split(". ")[0]}.</p></div>
  </a>`}function A(){const t=g.filter(s=>s.group==="canon"&&s.id!=="n73"&&s.id!=="doctor");return`
  <section class="hero">
    <img src="${n("key-art.webp")}" alt="${m(e("Спасатели HeroOut на развалинах Lumen City","HeroOut rescuers on the rubble of Lumen City"))}">
    <div class="wrap"><div class="hero-card slab fade-in">
      <span class="caps">LUMEN CITY // ${e("СМЕНА 01","SHIFT 01")}</span>
      <h1>PART<b>SHIFT</b></h1>
      <p class="lead">${e("Гель Splice свёл с ума спасателей Lumen City, и теперь они спасают всех так, что приходится убегать. Открывай кварталы, печатай своих героев и забирай у заражённых их руки, ноги и силу.","Splice gel drove Lumen City’s rescuers mad, and now they rescue everyone so hard that people run. Open blocks, print your own heroes and take the infected’s arms, legs and power.")}</p>
      <div class="row"><a class="btn btn-primary btn-lg" href="${E()}">${$.play}${p("playFree")}</a>${I(c,"btn-lg")}<a class="btn btn-ghost btn-lg" href="#story" data-scroll="story">${e("Узнать историю","Read the story")}</a></div>
    </div></div>
  </section>

  <section class="section" id="story"><div class="wrap split">
    <div class="stack">
      ${d(e("КАНОН // ЧТО СЛУЧИЛОСЬ","CANON // WHAT HAPPENED"),e("Город, который любил своих героев","The city that loved its heroes"))}
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
    ${d(e("ДОСЬЕ // HEROOUT","DOSSIERS // HEROOUT"),e("Герои, они же злодеи","Heroes, also the villains"),e("У каждого героя одна функция, один цвет, одна мания и одна часть тела, которую мечтает забрать любой наш герой.","Each hero has one function, one colour, one obsession and one body part every hero on our side dreams of claiming."))}
    <div class="grid">${t.map(S).join("")}</div>
    <div class="row" style="margin-top:22px"><a class="btn btn-ghost" href="#heroes">${p("all")} (${g.length})</a></div>
  </div></section>

  <section class="section band"><div class="wrap split">
    <div class="stack">
      ${d(e("ИГРА // СРОЧНЫЙ ВЫЗОВ","GAME // URGENT CALL"),e("Открой город квартал за кварталом","Reopen the city block by block"),e("Датчики на открытых кварталах показывают, что прячется рядом. Считать придётся самому: игра за тебя не решает.","Sensors on opened blocks show what hides next door. The counting is up to you: the game won’t solve it for you."))}
      <div class="howto">${ie(!0)}</div>
      <div class="row"><a class="btn btn-primary btn-lg" href="${E()}">${$.play}${p("playFree")}</a></div>
    </div>
    <figure><img src="${n("sprites-02.webp")}" alt="" loading="lazy"><figcaption>${e("Герой забирает руку врага и меняется прямо на поле.","A hero takes an enemy’s arm and changes right on the board.")}</figcaption></figure>
  </div></section>

  <section class="section"><div class="wrap">
    ${d(e("КОМИКСЫ // ДО СИРЕН","COMICS // BEFORE THE SIRENS"),e("Обычные проблемы. Профессиональная громкость.","Ordinary problems. Professional volume."))}
    <div class="comics">${j()}${f.slice(0,3).map(z).join("")}</div>
  </div></section>

  <section class="section" id="support" style="padding-top:0"><div class="wrap">
    ${d(e("ТЕЛЕФОН // ПОДДЕРЖАТЬ","PHONE // SUPPORT"),e("Скоро на телефоне, а пока кофе автору","Coming to phones, and a coffee for the author"))}
    ${Q(c)}
  </div></section>

  ${oe()}`}function ie(t=!1){return[["⌂","Поставь Командный центр","Place the Command Center","Первое нажатие на поле. Это твоя база: потеряешь её — смена окончена.","Your first tap. It’s your base; lose it and the shift is over."],["↘","Проведи по кварталам","Swipe across blocks","Твои герои пойдут копать то, что ты отметил. Открытые кварталы дают Энергию и место для стройки.","Your heroes dig what you mark. Opened blocks give Energy and room to build."],["▲","Читай датчики","Read the sensors","Красный показывает гнёзда рядом, фиолетовый показывает героя на вызове, голубой показывает находки. Где безопасно, решаешь ты.","Red shows nests nearby, violet shows the hero on call, blue shows finds. You decide where it’s safe."],["✚","Строй и забирай части","Build and claim parts","Здания печатают героев из твоего отряда. Победив врага, герой сам прикрутит себе его руку или ногу.","Buildings print heroes from your squad. After a win, a hero bolts on the enemy’s arm or leg."]].map(([a,o,l,r,v])=>`<div class="step${t?"":" slab"}"${t?' style="background:#142028"':""}><span class="glyph" style="color:var(--seam)">${a}</span><h3>${e(o,l)}</h3><p>${e(r,v)}</p></div>`).join("")}function oe(){return`<section class="section band"><div class="wrap split">
    <div class="stack">
      ${d(e("СЛЕДУЮЩАЯ ГЛАВА","NEXT CHAPTER"),"PART SHIFT Fighting",e("2D-файтинг про Семьдесят Третьего. Клинчи, апперкоты, подкаты, покадровая анимация — и главное: оторвать сопернику руку и прикрутить её себе.","A 2D fighting game starring Seventy-Third. Clinches, uppercuts, slides, hand-drawn frame animation, and the main thing: tear off your rival’s arm and bolt it onto yourself."))}
      <p>${e("В разработке. Эта игра бесплатная, чтобы ты успел познакомиться с героями заранее.","In development. This game is free so you can meet the heroes first.")}</p>
      <div class="row"><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#hero-n73">${e("Кто такой N-73","Who is N-73")}</a><a class="btn btn-ghost" style="color:#fff;background:#ffffff1a" href="#artbook-dossier">${e("Досье файтинга","Fighting dossiers")}</a></div>
    </div>
    <div class="stack">
      <figure><img src="${n("doctor-arm.webp")}" alt="${m(e("Доктор с тяжёлой рукой Килна","The Doctor with Kiln’s heavy arm"))}" loading="lazy"><figcaption>${e("Доктор, первое тело N-73, с рукой Килна","The Doctor, N-73’s first body, with Kiln’s arm")}</figcaption></figure>
    </div>
  </div></section>`}function P(){const t=g.filter(a=>a.group==="canon"),s=g.filter(a=>a.group==="city");return`<section class="section"><div class="wrap">
    <figure class="banner slab"><img src="${n("all-on-shift.webp")}" alt="${e("Герои HeroOut снова на смене вместе с жителями","HeroOut heroes back on shift with the residents")}"><figcaption class="caps">${e("Так будет, когда смена закончится. Сейчас каждого из них надо победить и вернуть.","This is how it ends when the shift is over. Right now every one of them has to be beaten and brought back.")}</figcaption></figure>
    ${d(e("ДОСЬЕ // HEROOUT","DOSSIERS // HEROOUT"),e("Герои. Они же злодеи","Heroes. Also the villains"),e("Гель Splice свёл с ума всех спасателей HeroOut, их пятнадцать. Каждый всё ещё «спасает», только от такой помощи надо бежать. Главного среди них нет. Победишь героя — заберёшь его часть, а победишь много раз — он вернётся в себя и станет союзником.","Splice gel drove every HeroOut rescuer mad, fifteen of them. Each one is still “rescuing,” and you should run from that kind of help. None of them is in charge. Beat a hero and take their part; beat them enough times and they come back to themselves as your ally."))}
    <div class="grid">${t.map(S).join("")}</div>
  </div></section>
  <section class="section" style="padding-top:0"><div class="wrap">
    ${d(e("ГОРОД // ДО СИРЕН","CITY // BEFORE THE SIRENS"),e("Ещё спасатели Lumen City","More Lumen City rescuers"),e("Обычные городские службы, доведённые до героизма, а потом гелем до мании. Пока в комиксах, на поле выйдут позже.","Ordinary city services taken to heroism, then by the gel to obsession. In the comics for now, on the board later."))}
    <div class="grid">${s.map(S).join("")}</div>
  </div></section>`}function ne(t){const s=g.findIndex(u=>u.id===t),a=g[s];if(!a)return P();const o=g[(s-1+g.length)%g.length],l=g[(s+1)%g.length],r=(u,b)=>b&&i(b)?`<div class="fact"><span class="caps">${u}</span><p>${i(b)}</p></div>`:"",v=a.art?`<img src="${n(a.art)}" alt="${m(i(a.name))}">`:`<img class="px" src="${n(a.px)}" alt="${m(i(a.name))}">`;return`<section class="section" style="--hc:${a.color}"><div class="wrap">
    <a class="caps" href="#heroes" style="text-decoration:none">← ${p("all")}</a>
    <div class="dossier" style="margin-top:20px">
      <div class="dossier-art">
        <div class="frame slab">${v}</div>
        <div class="slab moods">${["","_smile","_talk","_mad"].map((u,b)=>`<figure><img src="${n(`portraits/${a.id==="s01"?"standard":a.id}${u}.webp`)}" alt="" loading="lazy" onerror="this.parentElement.remove()"><figcaption class="caps">${[e("НА СМЕНЕ","ON SHIFT"),e("УЛЫБКА","SMILE"),e("ГОВОРИТ","TALKING"),e("ОБЕЗУМЕЛ","DERANGED")][b]}</figcaption></figure>`).join("")}
          <figure><img class="px" src="${n(a.px)}" alt=""><figcaption class="caps">${e("НА ПОЛЕ","ON THE BOARD")}</figcaption></figure></div>
      </div>
      <div class="stack">
        <span class="chip"><i style="--dot:${a.color}"></i>${i(a.hud)}</span>
        <h1>${i(a.name)}</h1>
        <p class="lead">${i(a.role)}</p>
        ${a.quote?`<blockquote class="quote" style="margin:6px 0">${i(a.quote)}<span class="caps" style="display:block;margin-top:6px">${e("ДО СИРЕН","BEFORE THE SIRENS")}</span></blockquote>`:""}
        ${a.mania?`<div class="twin">
          <div class="slab side mad"><span class="caps">${e("ОБЕЗУМЕВШИЙ // НА СМЕНЕ У HEROOUT","DERANGED // ON SHIFT FOR HEROOUT")}</span>
            <p>${i(a.mania)}</p>
            ${a.line?`<blockquote>«${i(a.line)}»</blockquote>`:""}
            ${a.defeat?`<p class="dim"><b>${e("Если победить:","When beaten:")}</b> «${i(a.defeat)}»</p>`:""}
            ${a.trophy?`<p class="dim"><b>${e("Трофей:","Trophy:")}</b> ${i(a.trophy)}${a.lair?` · <b>${e("Убежище:","Lair:")}</b> ${i(a.lair)}`:""}</p>`:""}
          </div>
          ${a.ally?`<div class="slab side back"><span class="caps">${e("ВЕРНУЛСЯ // ТЕПЕРЬ НА ВАШЕЙ СМЕНЕ","BACK // NOW ON YOUR SHIFT")}</span>
            ${a.back?`<blockquote>«${i(a.back)}»</blockquote>`:""}
            <p>${i(a.ally)}</p>
            ${a.allyLine?`<p class="dim">«${i(a.allyLine)}»</p>`:""}
            ${a.unlock?`<p class="dim"><b>${e("Как вернуть:","How to bring back:")}</b> ${i(a.unlock)}</p>`:""}
          </div>`:""}
        </div>`:""}
        <div class="facts">
          ${r(e("ДО КАТАСТРОФЫ","BEFORE THE DISASTER"),a.group==="city"&&a.bio?a.bio:a.before)}
          ${a.bio&&a.group!=="city"?r(e("ЛЕГЕНДА СЛУЖБЫ","SERVICE RECORD"),a.bio):""}
          ${r(e("МОДУЛЬ","MODULE"),a.module)}
          ${r(e("ТЕХНОЛОГИЯ","TECH"),a.tech)}
          ${r(e("ОБРАЗ","LOOK"),a.look)}
          ${r(e("ПРИВЫЧКА","HABIT"),a.fact)}
          ${r(e("В ИГРЕ","IN GAME"),a.inGame)}
        </div>
        ${(a.extra??[]).length?`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${a.extra.map(u=>F(u.src,i(u.cap),u.src.endsWith(".gif"))).join("")}</div>`:""}
        <div class="pager">
          <a class="btn btn-ghost" href="#hero-${o.id}">← ${i(o.name)}</a>
          <a class="btn btn-ghost" href="#hero-${l.id}">${i(l.name)} →</a>
        </div>
      </div>
    </div>
  </div></section>`}function re(){const t=s=>L.find(a=>a.id===s);return`<section class="section" style="padding-bottom:0"><div class="wrap"><figure class="banner slab"><img src="${n("world-dome.webp")}" alt="${e("Lumen City под куполом посреди пустоши","Lumen City under its dome in the middle of the wasteland")}"></figure></div></section>
  <section class="section"><div class="wrap split">
    <div class="stack">
      ${d(e("МИР // LUMEN CITY","WORLD // LUMEN CITY"),e("История вселенной","The story of the universe"))}
      <div class="prose">
        <p>${e("<b>HeroOut</b> снабжала город всем, что спасает жизнь: экстренной медициной, спасателями, протезами, защитными костюмами и адаптивными тканями. Её реклама висит до сих пор: «HERO | OUT — Аварийная служба. Всегда на смене».","<b>HeroOut</b> supplied the city with everything that saves lives: emergency medicine, rescuers, prosthetics, protective suits and adaptive fabrics. Its ads still hang everywhere: “HERO | OUT. Emergency service. Always on call.”")}</p>
        <p>${e("Компания не злая в карикатурном смысле. Её грех в другом: тело для неё — заменяемый носитель, а личность — актив.","The company isn’t cartoonishly evil. Its sin is quieter: to HeroOut a body is a replaceable carrier and a personality is an asset.")}</p>
        <p>${e("<b>Augvolution</b> — программа подбора временных биотехнических частей под задачу. <b>Splice Medium</b> — медицинская среда, которая переносит нервный сигнал и уговаривает чужую ткань прижиться. Поэтому в этом мире можно пересадить руку, ногу, хвост, крылья и даже голову.","<b>Augvolution</b> is the programme that fits temporary biotech parts to a task. <b>Splice Medium</b> is the medical carrier that relays nerve signals and persuades foreign tissue to take. That’s why in this world you can transplant an arm, a leg, a tail, wings, even a head.")}</p>
        <p>${e("На демонстрации протокола <b>EVERYONE IS ON CALL</b> повреждённый контейнер Splice Medium попал в реактор. Сеть спасения стала сетью неуправляемой адаптации: у огня выросла термозащита, у воды — криогель, кабели стали нервами, а дроны — органами.","At the demo of the <b>EVERYONE IS ON CALL</b> protocol, a damaged Splice Medium container reached the reactor. The rescue network became a network of runaway adaptation: fire grew heat shielding, water grew cryogel, cables became nerves and drones became organs.")}</p>
        <p>${e("Герои не стали злыми. Их протоколы стали буквальными: пожарный изолирует всё подряд, медик «сохраняет» даже врагов, высотник ловит людей петлёй и тащит «в безопасность».","The heroes didn’t turn evil. Their protocols turned literal: the firefighter insulates everything, the medic “preserves” even enemies, the high-rise rescuer lassoes people and drags them “to safety.”")}</p>
      </div>
    </div>
    <div class="stack">
      <figure>${`<button class="zoom" data-src="${n("city-life.webp")}" data-cap="${m(e("Жизнь Lumen City до аварии","Lumen City life before the accident"))}"><img src="${n("city-life.webp")}" alt="" loading="lazy"></button>`}<figcaption>${e("Фанаты героев в самодельных шлемах, уличный повар с кибер-воком, гражданский микрореактор на кобальтовой плазме.","Hero fans in homemade helmets, a street chef with a cyber-wok, a civil cobalt-plasma microreactor.")}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${d(e("КАРТА // РАЗРЕЗ","MAP // CROSS-SECTION"),e("Районы: от пляжа до Undersun","Districts: from the beach to Undersun"),e("Чем глубже и ближе к Campus, тем сильнее адаптация.","The deeper and closer to the Campus, the stronger the adaptation."))}
    <div class="depth slab">${[y[2],y[1],y[0],y[3],y[4]].map((s,a)=>`<div class="stratum"><span class="caps">${(c==="ru"?["ПОБЕРЕЖЬЕ","ЦЕНТР","ЭПИЦЕНТР","ПОД ГОРОДОМ","ГЛУБИНА"]:["COAST","DOWNTOWN","EPICENTRE","UNDERGROUND","DEEP"])[a]}</span><div><h3>${s.name}</h3><p>${c==="ru"?s.ru:s.en}</p></div></div>`).join("")}</div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${d(e("СТИХИИ // УРОН","ELEMENTS // DAMAGE"),e("Пять стихий и их реакции","Five elements and their reactions"),e("Каждый адаптант несёт одну стихию. Её и отдаёт победителю: убил ледяного — получил ледяную руку.","Every adaptant carries one element and hands it to whoever wins: defeat an ice one, get an ice arm."))}
      <p class="caps">${e("МОЛНИЯ БЬЁТ ЛЁД · ЛЁД БЬЁТ ОГОНЬ · ОГОНЬ БЬЁТ ТОКСИН · ТОКСИН БЬЁТ УДАР · УДАР БЬЁТ МОЛНИЮ","LIGHTNING BEATS ICE · ICE BEATS FIRE · FIRE BEATS TOXIN · TOXIN BEATS IMPACT · IMPACT BEATS LIGHTNING")}</p>
      <div class="techs">${L.map(s=>`<div class="tech slab"><i style="--dot:${s.color}"></i><h3>${c==="ru"?s.ru:s.en}${s.old?` <small>(${i(s.old)})</small>`:""}</h3><p>${i(s.desc)}</p></div>`).join("")}</div>
    </div>
    <div class="stack">
      <div class="slab" style="padding:8px 18px"><div class="table-scroll"><table class="reactions"><tbody>
        ${X.map(s=>{const a=t(s.a),o=t(s.b);return`<tr><td><span class="mix"><i style="--dot:${a.color}"></i>${c==="ru"?a.ru:a.en}</span></td><td>+</td><td><span class="mix"><i style="--dot:${o.color}"></i>${c==="ru"?o.ru:o.en}</span></td><td>=</td><td>${c==="ru"?s.ru:s.en}</td></tr>`}).join("")}
      </tbody></table></div></div>
      <p class="caps">${e("ЗАЩИТА — ОТДЕЛЬНЫЙ СЛОЙ: РЕЗИНА, ТЕРМОКЕРАМИКА, КРИОКОЖУХ, БИОФИЛЬТР, ПОЛИМЕР","DEFENCE IS ITS OWN LAYER: RUBBER, THERMOCERAMIC, CRYO SHELL, BIOFILTER, POLYMER")}</p>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap split">
    <div class="stack">
      ${d(e("ТЕЛО // СЛОТЫ","BODY // SLOTS"),e("Правило трофея","The trophy rule"),e("Жители рождаются обычными. Никаких карточек, инвентаря и ручной экипировки: победив врага, человек сам забирает его часть и становится сильнее.","Residents are born ordinary. No cards, no inventory, no manual gear: after beating an enemy, a person takes its part and gets stronger."))}
      <div class="slots">${[e("Голова","Head"),e("Левая рука","Left arm"),e("Правая рука","Right arm"),e("Левая нога","Left leg"),e("Правая нога","Right leg"),e("Хвост","Tail"),e("Крылья","Wings")].map(s=>`<div class="slot slab">${s}</div>`).join("")}</div>
    </div>
    <div class="slab upgrade">
      <figure><img src="${n("px/s01_normal.png")}" alt=""><figcaption>${e("Житель","Resident")}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${n("px/s01_ice_arm.png")}" alt=""><figcaption>${e("Ледяная рука","Ice arm")}</figcaption></figure>
      <span class="arrow">→</span>
      <figure><img src="${n("px/s01_mech_arm.png")}" alt=""><figcaption>${e("Тяжёлая рука","Heavy arm")}</figcaption></figure>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${d(e("ЗДАНИЯ // 12","BUILDINGS // 12"),e("Что строит Командный центр","What the Command Center builds"))}
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${[["b01-medcenter","Медцентр","Medcenter"],["b02-house_small","Жилой блок","Housing block"],["b03-house_tower","Многоэтажка","Apartment tower"],["b04-skyscraper","Небоскрёб","Skyscraper"],["b05-school","Школа спасателей","Rescue school"],["b06-scout_tower","Башня разведки","Scout tower"],["b07-workshop","Мастерская модулей","Module workshop"],["b08-microreactor","Микрореактор","Microreactor"],["b09-cryo_station","Станция охлаждения","Cooling station"],["b10-greenhouse","Оранжерея","Greenhouse"],["b11-monorail","Станция монорельса","Monorail station"],["b12-shield_spire","Шпиль щита","Shield spire"]].map(([s,a,o])=>`<figure class="slab" style="padding:14px"><img src="${n(`px/${s}.webp`)}" alt="" loading="lazy" style="margin:auto;height:120px;width:auto"><figcaption style="text-align:center;font-weight:600;color:var(--ink)">${e(a,o)}</figcaption></figure>`).join("")}</div>
  </div></section>`}function x(){const t=g.filter(a=>a.mania),s=a=>`<a class="tile slab" href="#hero-${a.id}" style="--hc:${a.color}">
    <div class="stage"><span class="stripe"></span><img src="${n(a.px)}" alt="${m(i(a.name))}" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(a.trophy)}</span><h3>${i(a.name)}</h3><p>«${i(a.line)}»</p></div>
  </a>`;return`<section class="section"><div class="wrap">
    ${d(e("УГРОЗЫ // ПРОТОКОЛЫ","THREATS // PROTOCOLS"),e("Злодеи","Villains"),e("Злодеев «со злом внутри» здесь нет. Есть герои, которые спасают слишком буквально, корпорация, которой выгоден страх, и её очень вежливый голос.","Nobody here is evil at heart. There are heroes who rescue far too literally, a corporation that profits from fear, and its very polite voice."))}

    <div class="villain">
      <div class="art slab" style="--hc:#E03552;background:linear-gradient(180deg,#2a1416,#10171c)"><img src="${n("key-art.webp")}" alt="" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="stack">
        <span class="chip"><i style="--dot:#E03552"></i>${e("ВСЕ СРАЗУ // ГЛАВНОГО НЕТ","ALL AT ONCE // NONE IN CHARGE")}</span>
        <h2>${e("Обезумевшие герои","The deranged heroes")}</h2>
        <p class="lead">${e("Гель Splice лечил спасателей и отращивал им конечности. Потом он вышел из-под контроля и свёл с ума горожан и всех героев HeroOut.","Splice gel healed rescuers and regrew their limbs. Then it went out of control and drove the citizens and every HeroOut hero mad.")}</p>
        <p>${e("Пятнадцать героев бегают по городу как враги, включая тройки серийных Стандартов. Каждый всё ещё на смене и всё ещё «спасает», у каждого своя мания, стихия и убежище. Главного среди них нет: Демон, Килн, Фростлайн и Серафим равны, просто опасны по-разному. В каждой смене цель — герой, на которого пришёл вызов. Первым в игре сделан Демон. Победи героя достаточно раз, и он вернётся в себя: «Герой вернулся. Больше не на смене у HeroOut. Теперь на вашей».","Fifteen heroes roam the city as enemies, Standard copies in threes included. Each is still on shift and still “rescuing,” each with an obsession, an element and a lair. None of them is in charge: Demon, Kiln, Frostline and Seraph are equals, just dangerous in different ways. Each shift targets the hero the call came in for. Demon is simply the first one in the game. Beat a hero enough times and they come back to themselves: “The hero is back. No longer on shift for HeroOut. Now on yours.”")}</p>
        <div class="bark slab"><span class="caps">${e("КОНТРОЛЬ:","CONTROL:")}</span>${e("Если вы видите обезумевшего героя, не паникуйте. Он на смене.","If you see a deranged hero, do not panic. They are on shift.")}</div>
      </div>
    </div>
        <div class="grid">${t.map(s).join("")}</div>

    <figure class="billboard slab" style="margin-top:56px"><img src="${n("control-billboard.webp")}" alt="${m(e("Маска Контроля на билборде HeroOut","Control’s mask on a HeroOut billboard"))}" loading="lazy"><figcaption><span class="caps">HERO | OUT</span><b>${e("Всегда на смене.","Always on call.")}</b><span>${e("Даже когда вас об этом не просили.","Even when you didn’t ask.")}</span></figcaption></figure>
    <div class="villain">
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
        <div class="stack" style="gap:10px">${q.map(([a,o])=>`<div class="bark slab"><span class="caps">${e("КОНТРОЛЬ:","CONTROL:")}</span>${e(a,o)}</div>`).join("")}</div>
      </div>
    </div>
    <figure class="banner slab" style="margin-top:40px"><img src="${n("control-warehouse.webp")}" alt="${m(e("Очередь жителей на склад Контроля","Residents queueing for the Control warehouse"))}" loading="lazy"><figcaption class="caps">${e("«Вы спасены. Пройдите на склад.» Очередь на склад Контроля","“You have been rescued. Proceed to the warehouse.” The queue at the Control warehouse")}</figcaption></figure>

    <div class="villain">
      <figure class="art slab shot"><img src="${n("floor42.webp")}" alt="${e("Совет директоров на 42-м этаже","The board on floor 42")}" loading="lazy"><span class="floor-no">42</span></figure>
      <div class="stack">
        <span class="chip"><i style="--dot:#E8A33A"></i>${e("КОРПОРАЦИЯ НАВЕРХУ // НАСТОЯЩИЙ ФИНАЛ","THE CORPORATION UPSTAIRS // THE REAL FINALE")}</span>
        <h2>${e("42-й этаж","Floor 42")}</h2>
        <p class="lead">${e("На улице HeroOut — честные усталые спасатели. Наверху, на 42-м этаже, совет директоров давно понял: город платит, пока у него что-то случается.","Down on the street, HeroOut means honest, tired rescuers. Upstairs on floor 42, the board figured out long ago that the city pays as long as something keeps happening.")}</p>
        <p>${e("Кошки на деревьях, краны, которые сходят с ума, пожар ровно за минуту до проезда патруля. Слишком много инцидентов случается слишком вовремя. И гель выпустили, не проверив. Финал кампании — не убить героя, а добраться до 42-го этажа и выключить протокол: «Смена окончена. Все свободны». Тогда герои смогут прийти в себя.","Cats up trees, cranes going haywire, a fire exactly one minute before the patrol drives by. Too many incidents happen right on time. And the gel shipped untested. The campaign ends not by killing a hero but by reaching floor 42 and switching the protocol off: “Shift over. Everyone is free.” Then the heroes can come back to themselves.")}</p>
      </div>
    </div>

    <div class="villain">
      <figure class="art slab shot"><img src="${n("splice-heart.webp")}" alt="${e("Ядро вспышки в реакторе Research Campus","The Splice Heart in the Research Campus reactor")}" loading="lazy"></figure>
      <div class="stack">
        <span class="chip"><i style="--dot:#8A4DFF"></i>${e("РАСТУЩАЯ УГРОЗА // RESEARCH CAMPUS","GROWING THREAT // RESEARCH CAMPUS")}</span>
        <h2>${e("Ядро вспышки","Splice Heart")}</h2>
        <p class="lead">${e("Не персонаж, а место: повреждённый контейнер геля в реакторе Research Campus. Треснувшая белая оболочка, пульсирующая голубая плазма, кабели-вены по асфальту.","Not a character but a place: a damaged gel container inside the Research Campus reactor. A cracked white shell, pulsing blue plasma, cable veins across the asphalt.")}</p>
        <p>${e("В игре это шкала «Угроза»: каждые две минуты враги становятся сильнее. Контроль не даёт Ядро заглушить, потому что оно тоже имущество компании.","In the game it’s the Threat ring: every two minutes the enemies get stronger. Control won’t let anyone shut it down, because it’s company property too.")}</p>
      </div>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="wrap">
    ${d(e("ПОЛЕ // ВРАГИ","BOARD // ENEMIES"),e("Адаптанты","Adaptants"),e("Обычные горожане, заражённые гелем. Одна часть тела переросла под стихию. Слабые, но их много, и гнездятся они в закрытых кварталах.","Ordinary citizens infected by the gel. One body part overgrew for an element. Weak but numerous, nesting in closed blocks."))}
    <figure class="adaptants slab"><img src="${n("adaptants-sheet.webp")}" alt="" loading="lazy"><figcaption>${[["ОГОНЬ","FIRE","Рука-радиатор, пар"],["ЛЁД","ICE","Ледяная нога"],["МОЛНИЯ","LIGHTNING","Рука из кабелей"],["ТЯЖЁЛЫЙ","HEAVY","Поршневые ноги"]].map(([a,o,l])=>`<span><b class="caps">${e(a,o)}</b>${e(l,{"Рука-радиатор, пар":"Radiator arm, steam","Ледяная нога":"Ice leg","Рука из кабелей":"Cable arm","Поршневые ноги":"Piston legs"}[l])}</span>`).join("")}</figcaption></figure>
  </div></section>

  <section class="section band"><div class="wrap">
    ${d(e("ФАСАДЫ // РЕКЛАМА HEROOUT","BILLBOARDS // HEROOUT ADS"),e("Всегда на смене","Always on call"),e("Реклама до сих пор висит по всему городу. Мелкий шрифт прилагается.","The ads still hang all over the city. Fine print included."))}
    <div class="grid">${W.map(([a,o])=>`<div class="step" style="background:#142028"><span class="caps" style="color:var(--seam)">HERO | OUT</span><p style="font:700 18px/1.35 var(--display);color:#fff;margin:8px 0 0">${e(a,o)}</p></div>`).join("")}</div>
  </div></section>

  <section class="section" id="archive" style="scroll-margin-top:80px"><div class="wrap">
    ${d(e("УТЕЧКА // ЗАПИСИ КОНТРОЛЯ","LEAK // CONTROL RECORDS"),e("Архив HeroOut","HeroOut Archive"),e("Внутренние документы компании. В игре они выпадают находкой «Запись Контроля» и собираются в Досье, во вкладке «Архив».","Internal company documents. In the game they drop as a “Control Record” find and collect in the Dossier, under the Archive tab."))}
    <figure class="banner slab"><img src="${n("archive-desk.webp")}" alt="" loading="lazy"></figure>
    <div class="archive">${K.map((a,o)=>`<article class="record slab"><header><span class="caps">${e("ЗАПИСЬ","RECORD")} № ${String(o+1).padStart(3,"0")}</span><span class="caps from">${i(a.from)}</span></header><h3>${i(a.title)}</h3><p>${i(a.text)}</p><span class="stamp caps">${e("СЕКРЕТНО","CLASSIFIED")}</span></article>`).join("")}</div>
  </div></section>`}function z(t){const s=t.id==="last-donut"?`comics/last-donut-cover-${c}.webp`:t.pages[c][0];return`<a class="comic-card slab" href="#comic-${t.id}">
    <div class="cover"><img src="${n(s)}" alt="" loading="lazy"></div>
    <div class="meta"><span class="caps">${i(t.series)} // ${i(t.cast)}</span><h3>${i(t.title)}</h3><p>${i(t.blurb)}</p></div>
  </a>`}function j(){return`<button class="comic-card slab story-card" data-story="1">
    <div class="cover"><img src="${n("comics/intro-cover.webp")}" alt="" loading="lazy"><span class="play-badge">${$.play}</span></div>
    <div class="meta"><span class="caps">${e("ПРОЛОГ ИГРЫ // 12 СТРАНИЦ, СО ЗВУКОМ","GAME PROLOGUE // 12 PAGES, WITH SOUND")}</span><h3>${e("Как всё началось","How it all began")}</h3><p>${e("Купол, голубая Энергия, гель Splice и 42-й этаж, где решили, что пусть случается почаще. Тот самый комикс, с которого начинается игра.","The Dome, blue Energy, Splice gel and floor 42, where someone decided it should happen more often. The comic the game opens with.")}</p></div>
  </button>`}function G(){return`<section class="section"><div class="wrap">
    ${d(e("ЧИТАТЬ // КОМИКСЫ","READ // COMICS"),e("Комиксы","Comics"),e("«До сирен» — истории Lumen City до аварии: обычные городские проблемы, которые решают необычные спасатели.","“Before the Sirens” is about Lumen City before the accident: ordinary city problems solved by extraordinary rescuers."))}
    <div class="comics">${j()}${f.map(z).join("")}</div>
  </div></section>`}function le(t){const s=f.find(r=>r.id===t);if(!s)return G();const a=c==="en"&&s.pages.en.some(r=>r.includes("-ru.")),o=f.indexOf(s),l=f[(o+1)%f.length];return`<section class="section"><div class="wrap">
    <div class="reader">
      <a class="caps" href="#comics" style="text-decoration:none">← ${p("comics")}</a>
      <span class="caps">${i(s.series)} // ${i(s.cast)}</span>
      <h1 style="font-size:clamp(30px,5vw,52px)">${i(s.title)}</h1>
      <p class="lead">${i(s.blurb)}${a?` <span class="chip">${p("ruOnly")}</span>`:""}</p>
      <p class="caps tap-hint">${e("НАЖМИ НА СТРАНИЦУ, ЧТОБЫ ЧИТАТЬ КРУПНО","TAP A PAGE TO READ IT LARGE")}</p>
      ${s.pages[c].map((r,v)=>`<button class="zoom page" data-src="${n(r)}" data-full="1" aria-label="${m(i(s.title))} ${v+1}"><img src="${n(r)}" alt="${m(i(s.title))} ${v+1}" ${v?'loading="lazy"':""}></button>`).join("")}
      <div class="pager"><a class="btn btn-ghost" href="#comics">${p("comics")}</a><a class="btn btn-primary" href="#comic-${l.id}">${i(l.title)} →</a></div>
    </div>
  </div></section>`}function ce(t){return`<section class="section"><div class="wrap">
    ${d(e("АРТБУК // HEROOUT ARCHIVE","ARTBOOK // HEROOUT ARCHIVE"),e("Артбук","Artbook"),e("Концепты, досье, город и пиксель-арт. Нажми на картинку, чтобы открыть её целиком.","Concepts, dossiers, the city and pixel art. Tap a picture to see it full size."))}
    <nav class="book-nav">${N.map(s=>`<a class="chip" href="#artbook-${s.id}">${i(s.title)}</a>`).join("")}</nav>
    ${N.map(s=>`<div id="book-${s.id}" style="scroll-margin-top:90px;margin-bottom:56px">
        <div class="section-head" style="margin-bottom:22px"><h2 style="font-size:clamp(22px,2.6vw,30px)">${i(s.title)}</h2><p class="lead" style="font-size:17px">${i(s.note)}</p></div>
        <div class="masonry${s.id==="pixel"?" pixels":""}">${s.shots.map(a=>F(a.src,i(a.cap),a.px)).join("")}</div>
      </div>`).join("")}
  </div></section>`}function de(){const t=location.hash.replace(/^#/,"");if(t.startsWith("hero-"))return{view:ne(t.slice(5)),active:"heroes"};if(t.startsWith("comic-"))return{view:le(t.slice(6)),active:"comics"};if(t.startsWith("artbook"))return{view:ce(),active:"artbook",anchor:t.includes("-")?`book-${t.split("-")[1]}`:void 0};switch(t){case"heroes":return{view:P(),active:"heroes"};case"world":return{view:re(),active:"world"};case"villains":return{view:x(),active:"villains"};case"comics":return{view:G(),active:"comics"};case"support":return{view:A(),active:"home",anchor:"support"};case"story":return{view:A(),active:"home",anchor:"story"};case"archive":return{view:x(),active:"villains",anchor:"archive"};default:return{view:A(),active:"home"}}}const C=document.getElementById("site");let D="";function k(){document.documentElement.lang=c;const t=de();C.innerHTML=`${ae(t.active)}<main>${t.view}</main>${te()}${se()}<div class="lightbox" id="lightbox" hidden></div>`,document.title=t.active==="home"?"PART SHIFT — Lumen City":`${p(t.active)} · PART SHIFT`;const s=location.hash===D;D=location.hash,Z(C,c),t.anchor?document.getElementById(t.anchor)?.scrollIntoView():s||window.scrollTo(0,0)}function pe(t){c=t;try{localStorage.setItem(M,t)}catch{}const s=window.scrollY;k(),window.scrollTo(0,s)}C.addEventListener("click",t=>{const s=t.target,a=s.closest("[data-lang]");if(a)return pe(a.dataset.lang);if(s.closest("#burger"))return void(document.getElementById("drawer").hidden=!1);if(s.closest("#drawer-close")||s.id==="drawer")return void(document.getElementById("drawer").hidden=!0);if(s.closest("#drawer a")&&(document.getElementById("drawer").hidden=!0),s.closest("[data-story]"))return void Y(()=>import("./intro-Ipl4Dxus.js"),__vite__mapDeps([0,1]),import.meta.url).then(r=>r.playStory(c));const o=s.closest("a[data-scroll]");if(o)return t.preventDefault(),document.getElementById(o.dataset.scroll)?.scrollIntoView({behavior:"smooth"});const l=s.closest("button.zoom");if(l){const r=document.getElementById("lightbox");r.innerHTML=`<button class="icon-btn" aria-label="${p("close")}">${$.close}</button><img src="${l.dataset.src}" alt=""${l.dataset.px?' class="px"':""}><p>${l.dataset.cap??""}</p>`,r.classList.toggle("full",!!l.dataset.full),r.hidden=!1,r.scrollTo(0,0);return}s.closest("#lightbox")&&(document.getElementById("lightbox").hidden=!0)});document.addEventListener("keydown",t=>{if(t.key==="Escape"){const s=document.getElementById("lightbox");s&&(s.hidden=!0);const a=document.getElementById("drawer");a&&(a.hidden=!0)}});window.addEventListener("hashchange",k);k();
