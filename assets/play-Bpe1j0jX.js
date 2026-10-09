import"./modulepreload-polyfill-B5Qt9EMX.js";import{H as o,i as p}from"./content-C9P0gmRj.js";import"./main-Cn11z3Oi.js";const l=new URLSearchParams(location.search).get("lang");let i=l==="ru"||l==="en"?l:navigator.language.toLowerCase().startsWith("ru")?"ru":"en";try{if(!l){const e=localStorage.getItem("partshift.lang");(e==="ru"||e==="en")&&(i=e)}}catch{}const a=(e,s)=>i==="ru"?e:s,n=e=>`../${p(e)}`,t=e=>`../index.html?lang=${i}#${e}`,c=[["home","Вселенная","Universe"],["heroes","Герои","Heroes"],["world","Мир и лор","World and lore"],["villains","Злодеи","Villains"],["comics","Комиксы","Comics"],["artbook","Артбук","Artbook"]],m='<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>',b='<svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 7h20M3 13h20M3 19h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>',h=["kiln","frostline","lineman","demon"].map(e=>o.find(s=>s.id===e));document.documentElement.lang=i;document.getElementById("frame").innerHTML=`
  <header class="pbar">
    <a class="brand" href="${t("home")}"><img src="${n("emblem.webp")}" alt="" width="28" height="28"><span class="wordmark">PART<b>SHIFT</b></span></a>
    <nav class="pnav">${c.slice(1).map(([e,s,d])=>`<a href="${t(e)}">${a(s,d)}</a>`).join("")}</nav>
    <span class="caps pshift">${a("СМЕНА // ОХОТА НА ДЕМОНА","SHIFT // DEMON HUNT")}</span>
    <button class="pmenu" id="pmenu" aria-label="${a("Меню","Menu")}">${b}<span>${a("Меню","Menu")}</span></button>
  </header>

  <div class="pstage">
    <aside class="pside left">
      <figure class="slab poster"><img src="${n("key-art.webp")}" alt=""><figcaption><span class="caps">LUMEN CITY</span>${a("Сеть спасения сломалась и перестроила город. Ты открываешь его заново.","The rescue network broke and rebuilt the city. You are reopening it.")}</figcaption></figure>
      <div class="slab pcard">
        <span class="caps">${a("ЦЕЛЬ СМЕНЫ","SHIFT GOAL")}</span>
        <p>${a("Найди люк Undersun, где спит <b>Демон</b>, подготовь защитников и победи его, пока Угроза не выросла.","Find the Undersun hatch where the <b>Demon</b> sleeps, train defenders and beat him before the Threat grows.")}</p>
        <img class="pxs" src="${n("px/anim-demon.gif")}" alt="">
      </div>
    </aside>

    <div class="pgame"><div id="app"></div></div>

    <aside class="pside right">
      <div class="slab pcard">
        <span class="caps">${a("КАК ЧИТАТЬ ПОЛЕ","READING THE BOARD")}</span>
        <ul class="legend">
          <li><b style="color:var(--coral)">▲</b>${a("Гнёзда врагов рядом","Enemy nests nearby")}</li>
          <li><b style="color:var(--teal)">◆</b>${a("Находки: тайники и Энергия","Finds: caches and Energy")}</li>
          <li><b style="color:var(--violet)">⬡</b>${a("Демон где-то рядом","The Demon is close")}</li>
          <li><b style="color:#3a9a3a">✓</b>${a("Точно безопасно","Safe for sure")}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${a("УПРАВЛЕНИЕ","CONTROLS")}</span>
        <ul class="keys">
          <li><kbd>${a("Провести","Drag")}</kbd>${a("копать кварталы","dig blocks")}</li>
          <li><kbd>${a("ПКМ","RMB")}</kbd>${a("метка «осторожно»","“careful” mark")}</li>
          <li><kbd>1 2 3</kbd>${a("копать, строить, в атаку","dig, build, attack")}</li>
          <li><kbd>${a("Пробел","Space")}</kbd>${a("пауза","pause")}</li>
        </ul>
      </div>
      <div class="slab pcard">
        <span class="caps">${a("ЧЬИ ЧАСТИ ЗАБЕРЁШЬ","WHOSE PARTS YOU CLAIM")}</span>
        <div class="pheroes">${h.map(e=>`<a href="${t(`hero-${e.id}`)}" title="${e.name[i]}"><img src="${n(e.px)}" alt="${e.name[i]}"><span>${e.name[i]}</span></a>`).join("")}</div>
      </div>
    </aside>
  </div>

  <div class="drawer" id="pdrawer" hidden><div class="drawer-panel">
    <div class="drawer-head"><span class="wordmark">PART<b>SHIFT</b></span><button class="icon-btn" id="pclose" aria-label="${a("Закрыть","Close")}">${m}</button></div>
    <button class="item resume" id="presume">${a("Вернуться в игру","Back to the game")}<span class="caps">▶</span></button>
    ${c.map(([e,s,d])=>`<a class="item" href="${t(e)}">${a(s,d)}<span class="caps">→</span></a>`).join("")}
    <figure class="drawer-art"><img src="${n("key-art.webp")}" alt=""></figure>
  </div></div>`;const r=document.getElementById("pdrawer");document.getElementById("pmenu").addEventListener("click",()=>r.hidden=!1);for(const e of["pclose","presume"])document.getElementById(e).addEventListener("click",()=>r.hidden=!0);r.addEventListener("click",e=>{e.target===r&&(r.hidden=!0)});
