// PARTSHIFT — intro comic "Пролог: Lumen City" (v1, 2026-10-09).
// Self-contained ES module, no dependencies. Draws a DOM overlay above the game canvas.
//
//   import { playIntroComic, introSeen } from './intro-comic.js';
//   if (!introSeen()) await playIntroComic({ lang: 'ru', assetBase: 'comic/' });
//
// Options: lang 'ru'|'en'; assetBase (folder that holds panels/, sprites/, audio/);
// assets (optional map key -> URL, overrides assetBase, keys like 'panels/tower.jpg');
// music true|false; parent (element, default document.body); onDone({skipped}).
// Returns a Promise<{skipped:boolean}>; marks the intro as seen in localStorage.

const SEEN_KEY = 'partshift.introSeen.v1';

export function introSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
export function resetIntroSeen() {
  try { localStorage.removeItem(SEEN_KEY); } catch {}
}

// ---------------------------------------------------------------- script
// Panel: {img|art, area, kb:[fromScale,toScale,dx,dy], fx, beats:[bubble...]}
// Bubble: {k:'cap'|'say'|'ctrl', at:[x%,y%], w:maxWidth%, tail:'l'|'r'|'b'|'t', who, ru, en, fx, sfx}
export const SCRIPT = [
  { // 1
    tag: { ru: 'ПРОЛОГ // LUMEN CITY', en: 'PROLOGUE // LUMEN CITY' },
    wide: { cols: '1.25fr 1fr', rows: '1.15fr 1fr', areas: '"a a" "b c"' },
    tall: { cols: '1fr 1fr', rows: '1fr 1.2fr', areas: '"a a" "b c"' },
    panels: [
      { img: 'city_rescue', area: 'a', kb: [1.12, 1.0, -2, 1], fx: 'embers', beats: [
        { k: 'cap', at: [3, 4], w: 46, ru: 'Lumen City. Солнечный город у моря: белые башни, монорельс, сады на крышах.', en: 'Lumen City. A sunny city by the sea: white towers, a monorail, gardens on the roofs.' },
        { k: 'cap', at: [52, 78], w: 45, ru: 'Если где-то беда, через минуту там спасатели HeroOut.', en: 'Wherever trouble starts, HeroOut rescuers arrive within a minute.' },
      ] },
      { img: 'kiln_carry', area: 'b', pos: '50% 18%', kb: [1.0, 1.1, 0, -2], fx: 'embers', beats: [
        { k: 'say', who: 'kiln', at: [8, 6], w: 80, tail: 'b', ru: 'Держитесь. Вынесу.', en: 'Hold on. I’ve got you.' },
      ] },
      { img: 'seraph', area: 'c', kb: [1.1, 1.0, 2, 0], beats: [
        { k: 'say', who: 'seraph', at: [6, 70], w: 84, tail: 't', ru: 'Пострадавших нет! Все целы.', en: 'No casualties! Everyone’s safe.' },
      ] },
    ],
  },
  { // 2
    tag: { ru: 'ВСЕГДА НА СМЕНЕ', en: 'ALWAYS ON SHIFT' },
    wide: { cols: '1fr 1fr', rows: '1.2fr 1fr', areas: '"a a" "b c"' },
    tall: { cols: '1fr 1fr', rows: '0.8fr 1fr', areas: '"a a" "b c"' },
    panels: [
      { img: 'roof_wide', area: 'a', kb: [1.0, 1.1, 2, 0], beats: [
        { k: 'cap', at: [3, 5], w: 50, ru: 'Город их обожает. Дети рисуют их на каждом заборе.', en: 'The city adores them. Kids draw them on every wall.' },
      ] },
      { img: 'kid_face', area: 'b', kb: [1.08, 1.0, 0, 2], beats: [
        { k: 'say', who: 'kid', at: [6, 6], w: 86, tail: 'b', ru: 'Вы правда всегда приходите?', en: 'Do you really always come?' },
      ] },
      { img: 'lineman_smile', area: 'c', kb: [1.0, 1.08, 0, -1], beats: [
        { k: 'say', who: 'lineman', at: [8, 6], w: 84, tail: 'b', ru: 'Всегда. Мы на смене.', en: 'Always. We’re on shift.' },
      ] },
    ],
  },
  { // 3
    tag: { ru: 'HEROOUT // ЧАСТИ ТЕЛА', en: 'HEROOUT // BODY PARTS' },
    wide: { cols: '1fr 1fr', rows: '1fr 1fr', areas: '"a a" "b c"' },
    tall: { cols: '1fr', rows: '0.8fr 1fr 1fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'tower', area: 'a', kb: [1.0, 1.12, 0, -1], beats: [
        { k: 'cap', at: [3, 6], w: 52, ru: 'Секрет героев — корпорация HeroOut. Она подбирает спасателям новые части тела под задачу.', en: 'The heroes’ secret is HeroOut. The corporation fits its rescuers with new body parts for every job.' },
      ] },
      { img: 'modules', area: 'b', kb: [1.1, 1.0, -2, 0], beats: [
        { k: 'cap', at: [4, 64], w: 92, ru: 'Руку, которая не горит. Ногу, которая не мёрзнет. Крылья, хвост, что угодно.', en: 'An arm that won’t burn. A leg that won’t freeze. Wings, a tail, anything.' },
      ] },
      { img: 'prosthetic', area: 'c', kb: [1.0, 1.1, 1, 0], fx: 'glow', beats: [
        { k: 'cap', at: [4, 64], w: 92, ru: 'Любую часть приживляет голубая среда Splice Medium. Без магии: биоткань и нейроинтерфейс.', en: 'Any part takes hold thanks to a blue medium, Splice Medium. No magic: bio-tissue and a neural interface.' },
      ] },
    ],
  },
  { // 4
    tag: { ru: 'УРОВЕНЬ 42 // РУКОВОДСТВО', en: 'LEVEL 42 // EXECUTIVE' },
    wide: { cols: '1.6fr 1fr', rows: '1fr 1fr', areas: '"a c" "b c"' },
    tall: { cols: '1fr 1fr', rows: '0.7fr 1fr', areas: '"a a" "b c"' },
    panels: [
      { img: 'boardroom', area: 'a', kb: [1.0, 1.1, 0, 0], beats: [
        { k: 'say', who: 'exec', at: [4, 8], w: 46, tail: 'r', ru: 'Город платит, пока боится. А если страх закончится?', en: 'The city pays while it’s afraid. What if the fear runs out?' },
        { k: 'say', who: 'boss', at: [52, 52], w: 44, tail: 'l', ru: 'Всегда найдётся, кто его добавит.', en: 'Someone can always add more.' },
      ] },
      { img: 'button', area: 'b', kb: [1.0, 1.15, 2, 2], fx: 'redpulse', beats: [
        { k: 'cap', at: [4, 70], w: 70, ru: 'Кто нажал кнопку, так и не узнали.', en: 'No one ever found out who pressed the button.', sfx: 'ui_tap' },
      ] },
      { img: 'shaft', area: 'c', kb: [1.0, 1.0, 0, -18], kbMs: 9000, beats: [
        { k: 'cap', at: [6, 70], w: 88, ru: 'Под белыми башнями HeroOut прятала нижние уровни.', en: 'Under its white towers, HeroOut hid the lower levels.' },
      ] },
    ],
  },
  { // 5
    tag: { ru: 'ПРОТОКОЛ // EVERYONE IS ON CALL', en: 'PROTOCOL // EVERYONE IS ON CALL' },
    wide: { cols: '1fr 1.3fr', rows: '1fr 1fr', areas: '"a b" "c b"' },
    tall: { cols: '1fr', rows: '0.9fr 1.1fr 0.9fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'capsule_crack', area: 'a', kb: [1.0, 1.15, 2, 0], beats: [
        { k: 'cap', at: [4, 6], w: 60, ru: 'Однажды контейнер со средой треснул.', en: 'One day, a container of the medium cracked.', fx: 'crack', sfx: 'nest_open' },
      ] },
      { art: 'billboard', area: 'b', beats: [
        { k: 'ctrl', at: [6, 6], w: 88, ru: 'Запущен протокол EVERYONE IS ON CALL. Сохраняйте спокойствие.', en: 'Protocol EVERYONE IS ON CALL is now active. Please remain calm.', fx: 'split', sfx: 'threat_level_up' },
        { k: 'cap', at: [6, 74], w: 88, ru: 'Среда ушла в реактор и в сеть спасения. Каждый спасатель начал выполнять свою задачу слишком буквально.', en: 'The medium reached the reactor and the rescue network. Every rescuer began doing their job far too literally.' },
      ] },
      { img: 'heroes_team', area: 'c', kb: [1.05, 1.0, 0, 0], fx: 'alarm', beats: [
        { k: 'cap', at: [4, 66], w: 92, ru: 'Они всё ещё спасают. Только теперь от их помощи приходится бежать.', en: 'They still rescue people. Only now, people run from their help.' },
      ] },
    ],
  },
  { // 6
    tag: { ru: 'НИЖНИЕ УРОВНИ // UNDERSUN', en: 'LOWER LEVELS // UNDERSUN' },
    wide: { cols: '1.3fr 1fr', rows: '1fr 1fr', areas: '"a b" "c b"' },
    tall: { cols: '1fr 1fr', rows: '0.8fr 1.2fr', areas: '"a a" "b c"' },
    panels: [
      { img: 'factory', area: 'a', kb: [1.0, 1.12, -2, 0], beats: [
        { k: 'cap', at: [3, 6], w: 60, ru: 'Люди, звери и машины обросли чужими частями. Их зовут адаптантами. Они гнездятся в закрытых кварталах.', en: 'People, animals and machines grew parts that weren’t theirs. They’re called adaptants. They nest in the sealed blocks.' },
      ] },
      { img: 'demon_tank', area: 'b', kb: [1.0, 1.1, 0, 3], beats: [
        { k: 'cap', at: [5, 5], w: 90, ru: 'А глубоко под землёй проснулся Демон.', en: 'And deep underground, the Demon woke up.' },
      ] },
      { img: 'demon_face', area: 'c', kb: [1.0, 1.18, 0, 0], fx: 'eyes', beats: [
        { k: 'cap', at: [4, 70], w: 92, ru: 'Он уводит людей вниз, «в безопасность». И никого не отпускает.', en: 'He drags people down below, “to safety”. And never lets them go.', sfx: 'demon_awake' },
      ] },
    ],
  },
  { // 7
    tag: { ru: 'КАРАНТИН // ГОЛОС КОНТРОЛЯ', en: 'QUARANTINE // THE VOICE OF CONTROL' },
    wide: { cols: '1fr 1.3fr', rows: '1fr', areas: '"a b"' },
    tall: { cols: '1fr', rows: '1fr 1fr', areas: '"a" "b"' },
    panels: [
      { art: 'control', area: 'a', beats: [
        { k: 'ctrl', at: [6, 62], w: 88, ru: 'Уважаемые жители! Вы являетесь имуществом HeroOut.', en: 'Dear residents! You are the property of HeroOut.' },
        { k: 'ctrl', at: [6, 62], w: 88, ru: 'Пожалуйста, вернитесь на склад. Спасибо, что вы с нами.', en: 'Please return to storage. Thank you for staying with us.', replace: true },
      ] },
      { img: 'tower', area: 'b', kb: [1.15, 1.0, 0, 0], fx: 'hex', beats: [
        { k: 'cap', at: [4, 6], w: 64, ru: 'Город закрыли карантином. Кварталы исчезли под голубой плёнкой.', en: 'The city was sealed off. Whole blocks vanished under a blue film.' },
        { k: 'cap', at: [34, 72], w: 62, ru: 'А Ядро вспышки с каждой минутой делает угрозу сильнее.', en: 'And every minute, the Outbreak Core makes the threat stronger.' },
      ] },
    ],
  },
  { // 8
    tag: { ru: 'СМЕНА 01 // ТВОЙ ХОД', en: 'SHIFT 01 // YOUR MOVE' },
    wide: { cols: '1.3fr 1fr', rows: '1fr', areas: '"a b"' },
    tall: { cols: '1fr', rows: '1.1fr 1fr', areas: '"a" "b"' },
    panels: [
      { art: 'swap', area: 'a', beats: [
        { k: 'cap', at: [4, 5], w: 92, ru: 'Но обычные люди не сдались.', en: 'But ordinary people didn’t give up.' },
        { k: 'cap', at: [4, 74], w: 92, ru: 'Житель побеждает адаптанта, сам забирает его часть и становится сильнее.', en: 'A resident beats an adaptant, takes its part and grows stronger.', fx: 'swap', sfx: 'part_attached' },
      ] },
      { art: 'command', area: 'b', beats: [
        { k: 'cap', at: [5, 5], w: 90, ru: 'Ты — командир последнего Командного центра.', en: 'You command the last Command Center.' },
        { k: 'cap', at: [5, 72], w: 90, ru: 'Открывай кварталы. Строй дома. Верни город людям.', en: 'Open the blocks. Build homes. Give the city back to its people.' },
      ] },
    ],
  },
];

const UI = {
  ru: { skip: 'Пропустить', start: 'Начать смену', tap: 'Коснись, чтобы начать', next: 'Дальше', title: 'Пролог', sound: 'Звук', subtitle: 'Спасатели больше не придут. Теперь твоя смена.' },
  en: { skip: 'Skip', start: 'Start the shift', tap: 'Tap to begin', next: 'Next', title: 'Prologue', sound: 'Sound', subtitle: 'The rescuers aren’t coming. Now it’s your shift.' },
};
const WHO = {
  ru: { kiln: 'КИЛН', seraph: 'СЕРАФИМ', kid: '', lineman: 'ЛИНЕЙЩИК', exec: '', boss: '', ctrl: 'КОНТРОЛЬ' },
  en: { kiln: 'KILN', seraph: 'SERAPH', kid: '', lineman: 'LINEMAN', exec: '', boss: '', ctrl: 'CONTROL' },
};

// ---------------------------------------------------------------- styles
const CSS = `
.psc{--night:#0B1117;--graph:#10171C;--paper:#F4F7F7;--paper2:#EDF4F5;--seam:#57D8F2;--glow:#9FF4FF;--deep:#115A80;--teal:#007E89;--coral:#EF5C73;--amber:#E8A33A;
 position:fixed;inset:0;z-index:9999;background:radial-gradient(120% 90% at 50% 0%,#16232d 0%,var(--night) 70%);color:var(--graph);
 font-family:'Golos Text',system-ui,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.psc *{box-sizing:border-box}
.psc-top{position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;gap:12px;padding:0 max(16px,env(safe-area-inset-left));z-index:5}
.psc-tag{font:700 10px/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--seam);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.psc-prog{display:flex;gap:4px;flex:0 0 auto}
.psc-prog i{display:block;width:16px;height:3px;background:#ffffff26;clip-path:polygon(2px 0,100% 0,calc(100% - 2px) 100%,0 100%)}
.psc-prog i.on{background:var(--seam)}
.psc-btn{white-space:nowrap;font:700 11px/1 Unbounded,sans-serif;letter-spacing:.08em;color:#fff;background:#ffffff14;border:1px solid #ffffff2e;padding:10px 14px;cursor:pointer;
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);min-height:36px}
.psc-btn:hover{background:#ffffff26}
.psc-btn.icon{width:40px;padding:0;display:grid;place-items:center}
.psc-stage{position:absolute;left:0;right:0;top:52px;bottom:0;display:grid;place-items:center;padding:6px 12px max(14px,env(safe-area-inset-bottom))}
.psc-page{position:relative;display:grid;gap:8px;padding:8px;background:var(--paper);box-shadow:0 30px 80px #0009;
 clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .5s}
.psc-page::after{content:'';position:absolute;inset:3px;border:1px solid var(--seam);pointer-events:none;
 clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psc-page.out{transform:translateX(-40px) scale(.97);opacity:0}
.psc-page.in{transform:translateX(40px) scale(.97);opacity:0}
.psc-panel{position:relative;overflow:hidden;background:var(--graph);border:3px solid var(--graph);opacity:0;transform:scale(.94);
 transition:opacity .45s ease,transform .6s cubic-bezier(.2,.9,.25,1.15),clip-path .6s ease;clip-path:inset(0 100% 0 0)}
.psc-panel.show{opacity:1;transform:none;clip-path:inset(0 0 0 0)}
.psc-panel>img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%;will-change:transform}
.psc-b{position:absolute;z-index:3;max-width:var(--w);font-size:clamp(12.5px,1.85vmin,19px);line-height:1.3;opacity:0;transform:translateY(6px) scale(.92);
 transition:opacity .25s,transform .35s cubic-bezier(.2,.9,.3,1.4)}
.psc-b.show{opacity:1;transform:none}
.psc-b.gone{opacity:0;transform:scale(.96)}
.psc-b.cap{background:var(--paper);color:var(--graph);padding:8px 11px 9px;border-left:3px solid var(--seam);box-shadow:0 2px 0 var(--graph),0 6px 18px #0005;
 clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%);font-weight:500}
.psc-b.say{background:#fff;color:#111;padding:10px 16px;border:2.5px solid var(--graph);border-radius:999px/60%;font-weight:700;text-align:center;box-shadow:0 4px 14px #0004}
.psc-b.say::after{content:'';position:absolute;width:16px;height:16px;background:#fff;border:2.5px solid var(--graph);border-top:0;border-left:0}
.psc-b.say.t-b::after{left:28%;bottom:-9px;transform:rotate(45deg) skew(12deg,12deg)}
.psc-b.say.t-t::after{left:30%;top:-9px;transform:rotate(-135deg) skew(12deg,12deg)}
.psc-b.say.t-r::after{right:18%;bottom:-9px;transform:rotate(45deg) skew(12deg,12deg)}
.psc-b.say.t-l::after{left:14%;bottom:-9px;transform:rotate(45deg) skew(12deg,12deg)}
.psc-who{display:block;font:800 9px/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--deep);margin-bottom:4px}
.psc-b.ctrl{background:var(--paper);color:var(--graph);padding:9px 12px 10px;border:2px solid var(--coral);box-shadow:0 6px 18px #0006;font-weight:600;
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.psc-ctrlhead{display:flex;gap:8px;align-items:center;margin-bottom:5px;font:800 9px/1 Unbounded,sans-serif;letter-spacing:.14em}
.psc-ctrlhead b{background:var(--graph);color:#fff;padding:3px 5px}
.psc-ctrlhead span{color:var(--coral)}
.psc-caret{display:inline-block;width:.5em}
/* fx */
.psc-fx{position:absolute;inset:0;pointer-events:none;z-index:2}
.psc-ember{position:absolute;bottom:-10px;width:5px;height:5px;border-radius:50%;background:radial-gradient(#fff3b0,#ff8a1f 60%,#ff8a1f00 70%);animation:psc-rise linear infinite}
@keyframes psc-rise{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(var(--dx),-120%);opacity:0}}
.psc-alarm{position:absolute;inset:0;background:linear-gradient(0deg,#EF5C7355,#EF5C7300 60%);mix-blend-mode:multiply;animation:psc-blink 1.1s steps(2) infinite}
.psc-stripe{position:absolute;left:0;right:0;bottom:0;height:10px;background:repeating-linear-gradient(-45deg,var(--coral) 0 12px,var(--graph) 12px 24px);background-size:34px 10px;animation:psc-stripe .8s linear infinite}
@keyframes psc-stripe{to{background-position:34px 0}}
@keyframes psc-blink{50%{opacity:.35}}
.psc-red{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#ff2a2a55,transparent 45%);animation:psc-blink .9s ease-in-out infinite}
.psc-glow{position:absolute;inset:0;background:radial-gradient(circle at 40% 55%,#57D8F244,transparent 55%);animation:psc-blink 2.4s ease-in-out infinite}
.psc-eye{position:absolute;width:14%;height:6%;border-radius:50%;background:radial-gradient(#fff2c0,#ff9a2a 45%,#ff6a0000 70%);filter:blur(2px);opacity:0;animation:psc-eye 2.8s ease-in 1.2s forwards}
@keyframes psc-eye{0%{opacity:0}30%{opacity:1}45%{opacity:.6}100%{opacity:1}}
.psc-flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:4;pointer-events:none}
.psc-flash.go{animation:psc-flash .7s ease-out}
@keyframes psc-flash{0%{opacity:.95}100%{opacity:0}}
.psc-shake{animation:psc-shake .45s}
@keyframes psc-shake{20%{transform:translate(-6px,3px)}40%{transform:translate(5px,-4px)}60%{transform:translate(-4px,-2px)}80%{transform:translate(3px,3px)}}
.psc-crack path{fill:none;stroke:#e9fdff;stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 0 4px #57D8F2);stroke-dasharray:400;stroke-dashoffset:400;animation:psc-draw .9s ease-out forwards}
@keyframes psc-draw{to{stroke-dashoffset:0}}
.psc-hex{position:absolute;inset:0;opacity:0;transition:opacity 1.6s;mix-blend-mode:screen}
.psc-hex.on{opacity:1}
.psc-hex svg{width:100%;height:100%;animation:psc-shimmer 4s ease-in-out infinite}
@keyframes psc-shimmer{50%{opacity:.6}}
/* drawn panels */
.psc-art{position:absolute;inset:0}
.psc-bill{background:linear-gradient(#bfe6f6,#e9f6fb 55%,#9cb7c4 56%,#70889a)}
.psc-bill .city{position:absolute;inset:0;background-size:cover;background-position:50% 30%;filter:saturate(.7) brightness(.85);opacity:.55}
.psc-board{position:absolute;left:12%;right:12%;top:31%;height:26%;display:flex;filter:drop-shadow(0 10px 14px #0006)}
.psc-board>div{flex:1;background:var(--paper);border:4px solid var(--graph);display:grid;place-items:center;font:900 clamp(18px,5.4vmin,58px)/1 Unbounded,sans-serif;color:var(--graph);
 transition:transform 1.1s cubic-bezier(.3,1.6,.4,1)}
.psc-board>div:first-child{border-right:0;transform-origin:100% 100%}
.psc-board>div:last-child{border-left:0;transform-origin:0 100%;color:var(--teal)}
.psc-board .bar{flex:0 0 6px;background:var(--seam);border:0}
.psc-board.split>div:first-child{transform:rotate(-9deg) translate(-6%,8%)}
.psc-board.split>div:last-child{transform:rotate(11deg) translate(6%,12%)}
.psc-board.split .bar{opacity:0;transition:opacity .2s}
.psc-board .post{position:absolute;bottom:-60%;width:4%;height:60%;background:var(--graph)}
.psc-spark{position:absolute;width:4px;height:4px;background:var(--glow);border-radius:50%;box-shadow:0 0 6px var(--seam);animation:psc-spark .9s ease-out forwards}
@keyframes psc-spark{to{transform:translate(var(--dx),var(--dy));opacity:0}}
.psc-ctrlart{background:radial-gradient(circle at 50% 38%,#173041,#0B1117 70%);display:grid;place-items:center}
.psc-screen{position:absolute;left:10%;right:10%;top:10%;height:50%;background:linear-gradient(#11202a,#0d1820);border:3px solid #24333d;border-radius:6px;display:grid;place-items:center;overflow:hidden;
 box-shadow:0 0 0 2px #0B1117,0 0 40px #57D8F233}
.psc-screen svg{height:86%}
.psc-screen .lbl{position:absolute;left:8px;top:6px;font:800 9px/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--seam)}
.psc-smile{transition:d .3s}
.psc-swap{background:linear-gradient(#1b2a35,#0B1117)}
.psc-floor{position:absolute;left:0;right:0;bottom:0;height:34%;background:linear-gradient(#EFE8D8,#E2D8C2);border-top:3px solid var(--graph)}
.psc-floor::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,#0000 0 46px,#0000000f 46px 48px)}
.psc-spr{position:absolute;bottom:20%;image-rendering:pixelated;transition:transform .5s,opacity .5s,filter .4s}
.psc-adapt{left:10%;height:42%;aspect-ratio:96/112;background-repeat:no-repeat;background-size:400% 100%;animation:psc-idle .6s steps(4) infinite;image-rendering:pixelated}
@keyframes psc-idle{to{background-position:133.33% 0}}
.psc-adapt.dead{opacity:0;transform:translateY(10%) scale(.8);filter:brightness(3)}
.psc-res{right:14%;height:58%}
.psc-res img{image-rendering:pixelated;height:100%;position:absolute;right:0;bottom:0;transition:opacity .25s}
.psc-orb{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(#fff,#9FF4FF 40%,#57D8F200 70%);left:22%;bottom:40%;opacity:0}
.psc-orb.fly{animation:psc-orb .8s cubic-bezier(.4,0,.2,1) forwards}
@keyframes psc-orb{0%{opacity:1;transform:none}100%{opacity:1;transform:translate(var(--tx),var(--ty)) scale(1.6)}}
.psc-badge{position:absolute;right:6%;top:24%;font:800 10px/1 Unbounded,sans-serif;letter-spacing:.12em;background:var(--teal);color:#fff;padding:6px 8px;opacity:0;transform:translateY(8px);transition:.4s;
 clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.psc-badge.on{opacity:1;transform:none}
.psc-cmd{background:linear-gradient(#cfeefa,#f4f7f7 60%)}
.psc-cmd .ring{position:absolute;left:50%;bottom:16%;width:70%;aspect-ratio:3/1;transform:translateX(-50%);border-radius:50%;border:2px solid var(--seam);box-shadow:0 0 20px var(--seam),inset 0 0 20px #57D8F288;animation:psc-blink 2.4s ease-in-out infinite}
.psc-cmd img{position:absolute;left:50%;bottom:18%;height:62%;transform:translateX(-50%);image-rendering:pixelated;filter:drop-shadow(0 8px 10px #0003)}
.psc-cmd .lbl{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);font:800 10px/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--deep);white-space:nowrap}
/* title + gate */
.psc-title{position:absolute;inset:0;display:grid;place-items:center;z-index:6;background:radial-gradient(120% 90% at 50% 20%,#16232dee,#0B1117f5 70%);opacity:0;transition:opacity .6s;pointer-events:none}
.psc-title.on{opacity:1;pointer-events:auto}
.psc-plate{background:var(--paper);padding:28px 30px 24px;text-align:center;max-width:min(92vw,520px);position:relative;
 clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.psc-plate::after{content:'';position:absolute;inset:3px;border:1px solid var(--seam);pointer-events:none;clip-path:inherit}
.psc-logo{font:900 clamp(34px,9vmin,64px)/1 Unbounded,sans-serif;letter-spacing:.01em}
.psc-logo b{color:var(--teal);font-weight:900}
.psc-sub{margin:12px 0 20px;font-size:15px;color:#3b4a53}
.psc-kicker{font:700 9px/1 Unbounded,sans-serif;letter-spacing:.16em;color:var(--deep);margin-bottom:12px}
.psc-main{font:800 14px/1 Unbounded,sans-serif;letter-spacing:.06em;color:#fff;background:var(--teal);border:0;padding:16px 26px;cursor:pointer;box-shadow:inset 0 -4px 0 #00000040;
 clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psc-main:hover{filter:brightness(1.1)}
.psc-hint{position:absolute;right:16px;bottom:max(10px,env(safe-area-inset-bottom));font:700 9px/1 Unbounded,sans-serif;letter-spacing:.14em;color:#ffffff66;z-index:5;pointer-events:none}
@media (max-width:520px){.psc-prog{display:none}.psc-tag{font-size:9px}}
@media (prefers-reduced-motion:reduce){.psc *{animation:none!important;transition:opacity .2s!important}}
`;

// ---------------------------------------------------------------- helpers
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureFonts() {
  if (document.querySelector('link[data-psc-fonts]') || [...document.fonts || []].some(f => /Unbounded/.test(f.family))) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.dataset.pscFonts = '1';
  l.href = 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Unbounded:wght@700;800;900&display=swap';
  document.head.appendChild(l);
}

// ---------------------------------------------------------------- player
export function playIntroComic(opts = {}) {
  const lang = opts.lang === 'en' ? 'en' : 'ru';
  const T = UI[lang];
  const base = opts.assetBase ?? 'comic/assets/';
  const url = (k) => (opts.assets && opts.assets[k]) || base + k;
  const parent = opts.parent || document.body;
  const RM = reduced();
  ensureFonts();

  if (!document.getElementById('psc-style')) { const s = el('style'); s.id = 'psc-style'; s.textContent = CSS; document.head.appendChild(s); }

  const root = el('div', 'psc');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', T.title);
  const top = el('div', 'psc-top');
  const tag = el('div', 'psc-tag');
  const prog = el('div', 'psc-prog', SCRIPT.map(() => '<i></i>').join(''));
  const sndBtn = el('button', 'psc-btn icon', '♪'); sndBtn.title = T.sound; sndBtn.setAttribute('aria-label', T.sound);
  const skipBtn = el('button', 'psc-btn', T.skip + ' ›');
  top.append(tag, prog, sndBtn, skipBtn);
  const stage = el('div', 'psc-stage');
  const hint = el('div', 'psc-hint', (lang === 'ru' ? 'ТАП — ДАЛЬШЕ' : 'TAP — NEXT'));
  const title = el('div', 'psc-title');
  root.append(top, stage, hint, title);
  parent.appendChild(root);

  // ---- audio
  let soundOn = opts.music !== false;
  const audio = {};
  const mk = (name) => {
    if (audio[name]) return audio[name];
    const a = new Audio();
    const ogg = a.canPlayType('audio/ogg; codecs="vorbis"');
    a.src = url('audio/' + name + (ogg ? '.ogg' : '.mp3'));
    a.preload = 'auto';
    return (audio[name] = a);
  };
  const music = mk('theme_lumen'); music.loop = true; music.volume = 0;
  let fadeT = 0;
  const fadeMusic = (to, ms = 1200) => {
    clearInterval(fadeT);
    const from = music.volume, t0 = performance.now();
    fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); music.volume = from + (to - from) * k; if (k >= 1) clearInterval(fadeT); }, 40);
  };
  const sfx = (name, vol = 0.7) => { if (!soundOn || !name) return; const a = mk(name).cloneNode(); a.volume = vol; a.play().catch(() => {}); };
  const setSound = (on) => { soundOn = on; sndBtn.style.opacity = on ? 1 : .45; if (on) { music.play().catch(() => {}); fadeMusic(.4); } else { fadeMusic(0, 300); } };
  sndBtn.onclick = (e) => { e.stopPropagation(); setSound(!soundOn); };
  sndBtn.style.opacity = soundOn ? 1 : .45;

  // ---- flow control
  let finished = false, resolveDone;
  let wake = null;            // resolves the current wait
  let typing = null;          // finishes the current typing
  const wait = (ms) => new Promise(r => { const t = setTimeout(() => { wake = null; r(); }, ms); wake = () => { clearTimeout(t); wake = null; r(); }; });
  const advance = () => { if (typing) typing(); else if (wake) wake(); };

  const done = (skipped) => {
    if (finished) return; finished = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    fadeMusic(0, 600);
    root.style.transition = 'opacity .5s'; root.style.opacity = '0';
    setTimeout(() => { music.pause(); root.remove(); document.removeEventListener('keydown', onKey); }, 520);
    const res = { skipped };
    opts.onDone && opts.onDone(res);
    resolveDone(res);
  };
  skipBtn.onclick = (e) => { e.stopPropagation(); sfx('ui_tap', .5); done(true); };
  stage.addEventListener('pointerup', advance);
  const onKey = (e) => {
    if (e.key === 'Escape') done(true);
    else if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); advance(); }
  };
  document.addEventListener('keydown', onKey);

  // ---- layout
  const isWide = () => stage.clientWidth / Math.max(1, stage.clientHeight) > 0.95;
  const fitPage = (page) => {
    // fill the screen, but keep the page between 4:3 and 16:9 on wide screens and at least 9:20 on tall ones
    const W = stage.clientWidth - 24, H = stage.clientHeight - 20;
    const [lo, hi] = isWide() ? [4 / 3, 16 / 9] : [9 / 20, 3 / 4];
    const ratio = Math.min(hi, Math.max(lo, W / H));
    let w = W, h = W / ratio; if (h > H) { h = H; w = H * ratio; }
    page.style.width = w + 'px'; page.style.height = h + 'px';
  };
  const applyGrid = (page, def) => {
    const g = isWide() ? def.wide : def.tall;
    page.style.gridTemplateColumns = g.cols; page.style.gridTemplateRows = g.rows; page.style.gridTemplateAreas = g.areas;
  };
  let current = null;
  const onResize = () => { if (current) { applyGrid(current.el, current.def); fitPage(current.el); } };
  window.addEventListener('resize', onResize);

  // ---- drawn panels
  const ART = {
    billboard(p) {
      const a = el('div', 'psc-art psc-bill');
      const c = el('div', 'city'); c.style.backgroundImage = `url(${url('panels/city_rescue.jpg')})`;
      const b = el('div', 'psc-board', '<div>HERO</div><div class="bar"></div><div>OUT</div>');
      a.append(c, b);
      p.fxSplit = () => {
        b.classList.add('split');
        for (let i = 0; i < 26; i++) {
          const s = el('div', 'psc-spark');
          s.style.left = '50%'; s.style.top = (36 + Math.random() * 20) + '%';
          s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); s.style.setProperty('--dy', (Math.random() * 120 - 30) + 'px');
          a.appendChild(s); setTimeout(() => s.remove(), 1000);
        }
        const st = el('div', 'psc-stripe'); a.appendChild(st);
      };
      return a;
    },
    control() {
      const a = el('div', 'psc-art psc-ctrlart');
      const scr = el('div', 'psc-screen', `<div class="lbl">HERO | OUT</div>
        <svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="pscm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9e4e8"/></linearGradient></defs>
        <path d="M20 58 C20 28 38 12 60 12 C82 12 100 28 100 58 L100 74 C100 96 84 108 60 108 C36 108 20 96 20 74 Z" fill="url(#pscm)" stroke="#10171C" stroke-width="3"/>
        <path d="M30 50 C30 38 44 32 60 32 C76 32 90 38 90 50 L90 58 C90 64 86 66 80 66 L40 66 C34 66 30 64 30 58 Z" fill="#10171C"/>
        <circle cx="46" cy="49" r="3" fill="#57D8F2"/><circle cx="74" cy="49" r="3" fill="#57D8F2"/>
        <path class="psc-smile" d="M42 84 Q60 96 78 84" fill="none" stroke="#57D8F2" stroke-width="4" stroke-linecap="round"/></svg>`);
      a.append(scr, el('div', 'psc-stripe'));
      const smile = scr.querySelector('.psc-smile');
      const shapes = ['M42 84 Q60 96 78 84', 'M42 86 Q60 90 78 86', 'M42 84 Q60 100 78 84', 'M44 86 L76 86'];
      let i = 0; const t = setInterval(() => { if (!a.isConnected) return clearInterval(t); smile.setAttribute('d', shapes[(i++) % 3]); }, 180);
      return a;
    },
    swap(p) {
      const a = el('div', 'psc-art psc-swap');
      a.append(el('div', 'psc-floor'));
      const ad = el('div', 'psc-spr psc-adapt'); ad.style.backgroundImage = `url(${url('sprites/adaptant_idle.png')})`;
      const res = el('div', 'psc-spr psc-res');
      res.style.aspectRatio = '100/175';
      const i1 = el('img'); i1.src = url('sprites/s01_normal.png'); i1.alt = '';
      const i2 = el('img'); i2.src = url('sprites/s01_ice_arm.png'); i2.alt = ''; i2.style.opacity = 0;
      res.append(i1, i2);
      const orb = el('div', 'psc-orb');
      const badge = el('div', 'psc-badge', lang === 'ru' ? '+ КРИОРУКА' : '+ CRYO ARM');
      const flash = el('div', 'psc-flash');
      a.append(ad, res, orb, badge, flash);
      p.fxSwap = async () => {
        res.style.transform = 'translateX(-30%)';
        await new Promise(r => setTimeout(r, 380));
        flash.classList.add('go'); a.classList.add('psc-shake');
        ad.classList.add('dead');
        res.style.transform = '';
        const ar = a.getBoundingClientRect(), rr = res.getBoundingClientRect(), orr = orb.getBoundingClientRect();
        orb.style.setProperty('--tx', (rr.left + rr.width * 0.3 - orr.left) + 'px');
        orb.style.setProperty('--ty', (rr.top + rr.height * 0.45 - orr.top) + 'px');
        orb.classList.add('fly');
        await new Promise(r => setTimeout(r, 800));
        orb.style.opacity = 0; orb.classList.remove('fly');
        i1.style.opacity = 0; i2.style.opacity = 1; badge.classList.add('on');
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        void ar;
      };
      return a;
    },
    command() {
      const a = el('div', 'psc-art psc-cmd');
      const img = el('img'); img.src = url('sprites/command.png'); img.alt = '';
      a.append(el('div', 'ring'), img, el('div', 'lbl', lang === 'ru' ? 'КОМАНДНЫЙ ЦЕНТР' : 'COMMAND CENTER'));
      return a;
    },
  };

  // ---- panel fx
  const FX = {
    embers(fx) { if (RM) return; for (let i = 0; i < 14; i++) { const e = el('i', 'psc-ember'); e.style.left = (40 + Math.random() * 60) + '%'; e.style.animationDuration = (2.5 + Math.random() * 3) + 's'; e.style.animationDelay = (-Math.random() * 4) + 's'; e.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); fx.appendChild(e); } },
    alarm(fx) { fx.append(el('div', 'psc-alarm'), el('div', 'psc-stripe')); },
    redpulse(fx) { fx.append(el('div', 'psc-red')); },
    glow(fx) { fx.append(el('div', 'psc-glow')); },
    eyes(fx) { const l = el('div', 'psc-eye'); l.style.left = '24%'; l.style.top = '37%'; const r = el('div', 'psc-eye'); r.style.left = '58%'; r.style.top = '35%'; fx.append(l, r); },
    hex(fx) {
      const h = el('div', 'psc-hex', `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice"><defs><pattern id="psch" width="17.32" height="30" patternUnits="userSpaceOnUse" patternTransform="scale(.7)">
        <path d="M8.66 0 L17.32 5 L17.32 15 L8.66 20 L0 15 L0 5 Z M8.66 20 L8.66 30" fill="#57D8F214" stroke="#9FF4FF" stroke-width=".6"/></pattern>
        <linearGradient id="pschg" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff"/></linearGradient>
        <mask id="pschm"><rect width="200" height="120" fill="url(#pschg)"/></mask></defs>
        <rect width="200" height="120" fill="url(#psch)" mask="url(#pschm)"/></svg>`);
      fx.appendChild(h); setTimeout(() => h.classList.add('on'), 300);
    },
  };

  // ---- bubbles
  const makeBubble = (b) => {
    const node = el('div', 'psc-b ' + b.k + (b.tail ? ' t-' + b.tail : ''));
    node.style.left = b.at[0] + '%';
    node.style.top = b.at[1] + '%';
    node.style.setProperty('--w', (b.w || 60) + '%');
    const who = b.k === 'ctrl' ? WHO[lang].ctrl : (b.who && WHO[lang][b.who]);
    let head = '';
    if (b.k === 'ctrl') head = `<div class="psc-ctrlhead"><b>HERO | OUT</b><span>${who}</span></div>`;
    else if (who) head = `<span class="psc-who">${who}</span>`;
    const txt = el('span');
    node.innerHTML = head; node.appendChild(txt);
    return { node, txt, text: b[lang] };
  };
  const typeText = (span, text) => new Promise(res => {
    if (RM) { span.textContent = text; return res(); }
    // reserve final size first so the bubble doesn't grow while typing
    span.textContent = text; const h = span.parentElement.offsetHeight; span.parentElement.style.minHeight = h + 'px';
    let i = 0; span.textContent = '';
    const step = Math.max(14, Math.min(28, 1400 / text.length));
    const t = setInterval(() => { i += 1; span.textContent = text.slice(0, i); if (i >= text.length) finish(); }, step);
    const finish = () => { clearInterval(t); span.textContent = text; typing = null; res(); };
    typing = finish;
  });
  const readMs = (text) => 1500 + text.length * 48;

  // ---- page builder
  const buildPage = (def, idx) => {
    const page = el('div', 'psc-page in');
    applyGrid(page, def);
    const panels = def.panels.map((p) => {
      const n = el('div', 'psc-panel');
      n.style.gridArea = p.area;
      const ctx = { def: p, node: n };
      if (p.img) {
        const img = el('img', 'bg'); img.src = url('panels/' + p.img + '.jpg'); img.alt = ''; img.draggable = false;
        const [s0, s1, dx, dy] = p.kb || [1.06, 1, 0, 0];
        img.style.transform = `scale(${s0})`;
        if (p.pos) img.style.objectPosition = p.pos;
        ctx.kb = () => { if (RM) return; img.animate([{ transform: `scale(${s0}) translate(0,0)` }, { transform: `scale(${s1}) translate(${dx}%,${dy}%)` }], { duration: p.kbMs || 12000, fill: 'forwards', easing: 'ease-out' }); };
        n.appendChild(img);
      } else if (p.art) {
        n.appendChild(ART[p.art](ctx));
      }
      const fx = el('div', 'psc-fx'); n.appendChild(fx); ctx.fx = fx;
      const flash = el('div', 'psc-flash'); n.appendChild(flash); ctx.flash = flash;
      page.appendChild(n);
      return ctx;
    });
    prog.querySelectorAll('i').forEach((e, i) => e.classList.toggle('on', i <= idx));
    tag.textContent = def.tag[lang] + `  ·  ${String(idx + 1).padStart(2, '0')}/${String(SCRIPT.length).padStart(2, '0')}`;
    return { el: page, def, panels };
  };

  const runFx = (ctx, name) => {
    if (!name) return;
    if (name === 'crack') {
      const svg = `<svg class="psc-crack" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
        <path d="M70 20 L64 38 L72 50 L62 66 L68 84"/><path d="M64 38 L54 42 L50 52"/><path d="M72 50 L84 56 L88 70"/><path d="M62 66 L52 72"/></svg>`;
      ctx.fx.insertAdjacentHTML('beforeend', svg);
      ctx.flash.classList.add('go'); ctx.node.classList.add('psc-shake');
    } else if (name === 'split') { ctx.fxSplit && ctx.fxSplit(); ctx.flash.classList.add('go'); ctx.node.classList.add('psc-shake'); fadeMusic(soundOn ? .18 : 0, 400); }
    else if (name === 'swap') { ctx.fxSwap && ctx.fxSwap(); }
    else if (FX[name]) FX[name](ctx.fx);
  };

  // ---- main sequence
  const run = async () => {
    for (let pi = 0; pi < SCRIPT.length && !finished; pi++) {
      const def = SCRIPT[pi];
      const page = buildPage(def, pi);
      const prev = current; current = page;
      if (prev) { prev.el.classList.add('out'); await wait(380); prev.el.remove(); }
      stage.appendChild(page.el); fitPage(page.el);
      void page.el.offsetWidth; page.el.classList.remove('in');
      if (pi === 4) fadeMusic(soundOn ? .25 : 0, 1500);
      if (pi === 7) fadeMusic(soundOn ? .45 : 0, 2000);
      await wait(350);
      for (const ctx of page.panels) {
        if (finished) return;
        ctx.node.classList.add('show'); ctx.kb && ctx.kb(); runFx(ctx, ctx.def.fx);
        await wait(650);
        let last = null;
        for (const b of ctx.def.beats) {
          if (finished) return;
          if (b.replace && last) { last.node.classList.add('gone'); await wait(200); last.node.remove(); }
          const bub = makeBubble(b); ctx.node.appendChild(bub.node);
          void bub.node.offsetWidth; bub.node.classList.add('show');
          runFx(ctx, b.fx); sfx(b.sfx);
          await typeText(bub.txt, bub.text);
          await wait(readMs(bub.text));
          last = bub;
        }
      }
      await wait(400);
    }
    if (finished) return;
    // title card
    hint.remove();
    title.innerHTML = `<div class="psc-plate"><div class="psc-kicker">${lang === 'ru' ? 'СМЕНА 01 // LUMEN CITY' : 'SHIFT 01 // LUMEN CITY'}</div>
      <div class="psc-logo">PART<b>SHIFT</b></div><div class="psc-sub">${T.subtitle}</div>
      <button class="psc-main">${T.start}</button></div>`;
    title.classList.add('on');
    const btn = title.querySelector('.psc-main');
    btn.onclick = (e) => { e.stopPropagation(); sfx('ui_tap', .6); done(false); };
    setTimeout(() => btn.focus(), 100);
  };

  // ---- start gate (browsers only allow sound after a tap)
  const gate = () => {
    title.innerHTML = `<div class="psc-plate"><div class="psc-kicker">${T.title.toUpperCase()}</div>
      <div class="psc-logo">PART<b>SHIFT</b></div><div class="psc-sub">HERO | OUT // LUMEN CITY</div>
      <button class="psc-main">${T.tap}</button></div>`;
    title.classList.add('on');
    const go = (e) => { e && e.stopPropagation(); title.classList.remove('on'); if (soundOn) setSound(true); setTimeout(run, 400); };
    title.querySelector('.psc-main').onclick = go;
  };

  return new Promise((res) => {
    resolveDone = (r) => { window.removeEventListener('resize', onResize); res(r); };
    if (opts.skipGate) { if (soundOn) setSound(true); run(); } else gate();
  });
}
