import"./config-BuGjUh31.js";import{H as o,A as p,i as m}from"./content-KLaPXIMx.js";import"./main-Bncl3woa.js";const t=new URLSearchParams(location.search).get("lang");let i=t==="ru"||t==="en"?t:navigator.language.toLowerCase().startsWith("ru")?"ru":"en";try{if(!t){const a=localStorage.getItem("partshift.lang");(a==="ru"||a==="en")&&(i=a)}}catch{}const e=(a,s)=>i==="ru"?a:s,n=a=>`../${m(a)}`,r=a=>`../index.html?lang=${i}#${a}`,c=[["home","Вселенная","Universe"],["heroes","Герои","Heroes"],["world","Мир и лор","World and lore"],["villains","Злодеи","Villains"],["comics","Комиксы","Comics"],["artbook","Артбук","Artbook"]],h='<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>',b='<svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>',u=["kiln","frostline","lineman","demon"].map(a=>o.find(s=>s.id===a));document.documentElement.lang=i;document.getElementById("frame").innerHTML=`
  <header class="pbar">
    <a class="brand" href="${r("home")}"><img src="${n("emblem.webp")}" alt="" width="28" height="28"><span class="wordmark">PART<b>SHIFT</b></span></a>
    <nav class="pnav">${c.slice(1).map(([a,s,d])=>`<a href="${r(a)}">${e(s,d)}</a>`).join("")}</nav>
    <span class="caps pshift">${e("СРОЧНЫЙ ВЫЗОВ // ДЕМОН","URGENT CALL // DEMON")}</span>
    <button class="pmenu" id="pmenu" aria-label="${e("Меню","Menu")}">${b}<span>${e("Меню","Menu")}</span></button>
  </header>

  <div class="pstage">
    <aside class="pside left">
      <figure class="slab poster"><img src="${n("key-art.webp")}" alt=""><figcaption><span class="caps">LUMEN CITY</span>${e("Сеть спасения сломалась и перестроила город. Ты открываешь его заново.","The rescue network broke and rebuilt the city. You are reopening it.")}</figcaption></figure>
      <div class="slab pcard">
        <span class="caps">${e("ЦЕЛЬ СМЕНЫ","SHIFT GOAL")}</span>
        <p>${e("Вызов пришёл на <b>Демона</b>, одного из обезумевших героев. Найди люк Undersun, где он спит, подготовь защитников и победи его, пока Угроза не выросла.","The call is for <b>Demon</b>, one of the deranged heroes. Find the Undersun hatch where he sleeps, train defenders and beat him before the Threat grows.")}</p>
        <img class="pxs" src="${n("px/demon.png")}" alt="">
      </div>
    </aside>

    <div class="pgame"><div id="app"></div></div>

    <aside class="pside right">
      <div class="slab pcard">
        <span class="caps">${e("КАК ЧИТАТЬ ПОЛЕ","READING THE BOARD")}</span>
        <ul class="legend">
          <li><b style="color:var(--coral)">▲</b>${e("Гнёзда врагов рядом","Enemy nests nearby")}</li>
          <li><b style="color:var(--teal)">◆</b>${e("Находки: тайники и Энергия","Finds: caches and Energy")}</li>
          <li><b style="color:var(--violet)">⬡</b>${e("Демон где-то рядом","The Demon is close")}</li>
          <li><b style="color:#3a9a3a">✓</b>${e("Точно безопасно","Safe for sure")}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${e("УПРАВЛЕНИЕ","CONTROLS")}</span>
        <ul class="keys">
          <li><kbd>${e("Провести","Drag")}</kbd>${e("копать кварталы","dig blocks")}</li>
          <li><kbd>${e("ПКМ","RMB")}</kbd>${e("метка «осторожно»","“careful” mark")}</li>
          <li><kbd>1 2 3</kbd>${e("копать, строить, в атаку","dig, build, attack")}</li>
          <li><kbd>${e("Пробел","Space")}</kbd>${e("пауза","pause")}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${e("ГЕРОИ НА СМЕНЕ","HEROES ON SHIFT")}</span>
        <div class="pheroes">${u.map(a=>`<a href="${r(`hero-${a.id}`)}" title="${a.name[i]}"><img src="${n(a.px)}" alt="${a.name[i]}"><span>${a.name[i]}</span></a>`).join("")}</div>
      </div>
    </aside>
  </div>

  <div class="drawer" id="pdrawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="pclose" aria-label="${e("Закрыть","Close")}">${h}</button></div>
    <button class="item resume" id="presume">${e("Вернуться в игру","Back to the game")}<span class="caps">▶</span></button>
    ${c.map(([a,s,d])=>`<a class="item" href="${r(a)}">${e(s,d)}<span class="caps">→</span></a>`).join("")}
    <a class="item" href="${p}" rel="noopener">${e("Скачать для Android","Download for Android")}<span class="caps">APK</span></a>
    <a class="item" href="${r("support")}">${e("Донат автору","Tip the author")}<span class="caps">☕</span></a>
    <figure class="drawer-art"><img src="${n("key-art.webp")}" alt=""></figure>
  </div></div>`;const l=document.getElementById("pdrawer");document.getElementById("pmenu").addEventListener("click",()=>l.hidden=!1);for(const a of["pclose","presume"])document.getElementById(a).addEventListener("click",()=>l.hidden=!0);l.addEventListener("click",a=>{a.target===l&&(l.hidden=!0)});
