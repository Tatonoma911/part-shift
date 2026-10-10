// PARTSHIFT — intro comic "Пролог: Lumen City" (v3, 2026-10-09).
// Self-contained ES module, no dependencies. Draws a DOM overlay above the game canvas.
//
//   import { playIntroComic, introSeen } from './intro-comic.js';
//   if (!introSeen()) await playIntroComic({ lang: 'ru', assetBase: 'comic/' });
//
// Options: lang 'ru'|'en'; assetBase (folder that holds panels/, sprites/, audio/);
// assets (optional map key -> URL, overrides assetBase, keys like 'panels/tower.jpg');
// music true|false; musicVolume / sfxVolume 0..1 (from the game's volume sliders, default 1);
// parent (element, default document.body); onDone({skipped}).
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
    wide: { cols: '1.55fr 1fr', rows: '1.3fr 0.62fr', areas: '"a c" "b c"' },
    tall: { cols: '1fr', rows: '1fr 0.42fr 1fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'city_sunset', area: 'a', kb: [1.0, 1.05, 1, 0], beats: [
        { k: 'cap', at: [3, 5], w: 50, ru: 'Это Lumen City. Город будущего у самого моря, как и обещали в рекламе.', en: 'This is Lumen City. A city of the future right by the sea, just like the ads promised.' },
      ] },
      { img: 'dome_city', area: 'b', kb: [1.0, 1.04, -1, 0], beats: [
        { k: 'cap', at: [3, 8], w: 74, ru: 'Здесь всё работает на голубой Энергии. Даже небо: над городом построили Купол, чтобы погода не мешала жить.', en: 'Everything here runs on blue Energy. Even the sky: they built a Dome over the city so the weather wouldn’t get in the way.' },
      ] },
      { img: 'summer', area: 'c', kb: [1.03, 1.0, 0, 0], beats: [
        { k: 'ad', at: [5, 4], w: 90, ru: 'Купол Lumen. Небо, которое не протекает.', en: 'Lumen Dome. The sky that never leaks.' },
        { k: 'ad', at: [5, 72], w: 90, ru: 'Энергия HeroOut. Голубой свет в каждом доме. И в каждом счёте.', en: 'HeroOut Energy. Blue light in every home. And on every bill.' },
      ] },
    ],
  },
  { // 2
    tag: { ru: 'БОЛЬШОЙ ГОРОД // ВЫЗОВЫ', en: 'BIG CITY // CALLS' },
    wide: { cols: '0.5fr 1fr 1fr', rows: '1.15fr 1fr', areas: '"a d d" "a b c"' },
    tall: { cols: '1fr 1fr', rows: '0.7fr 0.8fr 1fr', areas: '"a a" "d d" "b c"' },
    panels: [
      { art: 'log', area: 'a', beats: [
        { k: 'cap', at: [4, 80], w: 92, ru: 'В большом городе каждый день что-нибудь случается.', en: 'In a big city, something happens every single day.' },
      ] },
      { img: 'crane_kiln', area: 'd', fit: 'contain', kb: [1.0, 1.03, 0, 0], beats: [
        { k: 'cap', at: [3, 4], w: 60, ru: 'Сегодня, например, строительный кран решил, что он карусель. Килну пришлось с ним серьёзно поговорить.', en: 'Today, for example, a construction crane decided it was a merry-go-round. Kiln had to have a serious talk with it.' },
        { k: 'say', who: 'lineman', at: [58, 58], w: 40, tail: 'l', ru: 'Без паники, хот-доги я спас!', en: 'Don’t panic, I saved the hot dogs!' },
      ] },
      { img: 'geyser', area: 'b', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [4, 4], w: 92, ru: 'Потом на Солнечной улице прорвало люк, и он минут десять изображал фонтан.', en: 'Then a manhole burst on Sunny Street and spent ten minutes pretending to be a fountain.' },
      ] },
      { img: 'frost_ice', area: 'c', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [4, 4], w: 92, ru: 'Фростлайн его просто заморозила.', en: 'Frostline simply froze it.' },
        { k: 'cap', at: [30, 80], w: 66, ru: 'Получилась ледяная скульптура. Мэр потом сказал, что это современное искусство.', en: 'It turned into an ice sculpture. The mayor later called it modern art.' },
      ] },
    ],
  },
  { // 3
    tag: { ru: 'HEROOUT // ВСЕГДА НА СМЕНЕ', en: 'HEROOUT // ALWAYS ON SHIFT' },
    wide: { cols: '1fr 1fr 0.9fr 1.05fr', rows: '0.55fr 1fr', areas: '"a a a a" "b c d e"' },
    tall: { cols: '1fr 1fr', rows: '0.42fr 1fr 1fr', areas: '"a a" "b c" "d e"' },
    panels: [
      { img: 'crowd_top', area: 'a', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [3, 8], w: 64, ru: 'На такие вызовы выезжают спасатели HeroOut. Это не супергерои, а обычная городская служба, как пожарные. Просто костюмы у них покруче.', en: 'HeroOut rescuers answer calls like these. They’re not superheroes, just a city service, like firefighters. Their suits are just cooler.' },
      ] },
      { img: 'lineman_kid', area: 'b', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'say', who: 'lineman', at: [8, 64], w: 84, tail: 't', ru: 'Держись крепче, я тебя поймал. Всё, ты в безопасности.', en: 'Hold on tight, I’ve got you. There, you’re safe.' },
      ] },
      { img: 'frost_fire', area: 'c', kb: [1.0, 1.04, 0, 0], fx: 'embers', beats: [] },
      { img: 'kiln_fire', area: 'd', kb: [1.0, 1.04, 0, 0], fx: 'embers', beats: [
        { k: 'say', who: 'kiln', at: [6, 64], w: 88, tail: 't', ru: 'Осторожно. Вы горячая штучка.', en: 'Careful. You’re a hot one.' },
      ] },
      { img: 'seraph_fly', area: 'e', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'say', who: 'seraph', at: [8, 70], w: 84, tail: 't', ru: 'Все живы! Даже кот!', en: 'Everyone’s alive! Even the cat!' },
      ] },
    ],
  },
  { // 4
    tag: { ru: 'СРОЧНЫЕ НОВОСТИ', en: 'BREAKING NEWS' },
    wide: { cols: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    tall: { cols: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    panels: [
      { img: 'news_serious', area: 'a', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'say', who: 'anchor', at: [4, 72], w: 92, tail: 't', ru: 'Срочные новости. В нашем прекрасном городе сегодня…', en: 'Breaking news. Today in our beautiful city…' },
      ] },
      { img: 'news_smile', area: 'b', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'say', who: 'anchor', at: [4, 72], w: 92, tail: 't', ru: '…ничего не произошло.', en: '…nothing happened.' },
        { k: 'cap', at: [4, 78], w: 92, ru: 'В такие дни спасатели HeroOut просто пили кофе на крыше. Это были хорошие дни. Их было немного.', en: 'On days like that, HeroOut rescuers just drank coffee on the roof. Those were good days. There weren’t many of them.' },
      ] },
    ],
  },
  { // 5
    tag: { ru: 'ЦЕНА СПАСЕНИЯ // SPLICE', en: 'THE PRICE OF RESCUE // SPLICE' },
    wide: { cols: '1.2fr 0.9fr 0.75fr', rows: '1fr 1fr', areas: '"a a d" "b c d"' },
    tall: { cols: '1fr 1fr', rows: '0.8fr 0.9fr 1fr', areas: '"a a" "b d" "c d"' },
    panels: [
      { img: 'lab_team', area: 'a', fit: 'contain', kb: [1.0, 1.03, 0, 0], beats: [
        { k: 'cap', at: [3, 80], w: 70, ru: 'Работа у спасателей опасная. Они получали ожоги и переломы, а некоторые теряли руки и ноги.', en: 'Rescue work is dangerous. They got burns and broken bones, and some of them lost arms and legs.' },
      ] },
      { img: 'clinic', area: 'b', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [3, 4], w: 80, ru: 'Сначала были протезы. Хорошие. Но железо не чувствует, как дочка держит за руку.', en: 'First there were prosthetics. Good ones. But metal can’t feel a daughter holding your hand.' },
      ] },
      { img: 'leg_tank', area: 'c', kb: [1.0, 1.04, 0, 0], fx: 'glow', beats: [
        { k: 'cap', at: [3, 4], w: 80, ru: 'Никакой магии: биоткань, гель и нейроинтерфейс. Можно было получить руку, которая не горит в огне, или ногу, которая не мёрзнет во льду.', en: 'No magic: bio-tissue, gel and a neural interface. You could get an arm that doesn’t burn in a fire, or a leg that doesn’t freeze in ice.' },
      ] },
      { img: 'gel_capsule', area: 'd', kb: [1.0, 1.05, 0, 0], fx: 'glow', beats: [
        { k: 'cap', at: [5, 4], w: 90, ru: 'Тогда HeroOut придумала гель Splice. Он заживлял раны и отращивал потерянные руки и ноги.', en: 'That’s when HeroOut came up with Splice gel. It healed wounds and regrew lost arms and legs.' },
        { k: 'ad', at: [5, 70], w: 90, ru: 'Потеряли руку? Не теряйте надежду! Гель Splice: отрастёт к понедельнику.', en: 'Lost an arm? Don’t lose hope! Splice gel: regrown by Monday.' },
      ] },
    ],
  },
  { // 6
    tag: { ru: 'УРОВЕНЬ 42 // РУКОВОДСТВО', en: 'LEVEL 42 // EXECUTIVE' },
    wide: { cols: '1fr 0.5fr', rows: '1.1fr 0.62fr', areas: '"a d" "b d"' },
    tall: { cols: '1fr 0.55fr', rows: '1fr 0.9fr', areas: '"a a" "b d"' },
    panels: [
      { img: 'boardroom', area: 'a', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'say', who: 'exec', at: [33, 3], w: 27, tail: 'r', ru: 'Город платит нам, пока у него что-то случается.', en: 'The city pays us as long as something keeps happening.' },
        { k: 'say', who: 'boss', at: [3, 64], w: 36, tail: 't', ru: 'Значит, пусть случается почаще.', en: 'Then let it happen more often.' },
      ] },
      { img: 'button', area: 'b', kb: [1.0, 1.05, 1, 1], fx: 'redpulse', beats: [
        { k: 'cap', at: [4, 5], w: 90, ru: 'С тех пор кошки почему-то стали чаще залезать на деревья, а краны чаще сходить с ума.', en: 'From then on, for some reason, cats climbed trees more often and cranes went crazy more often.', sfx: 'ui_tap' },
        { k: 'cap', at: [4, 66], w: 90, ru: 'А на геле Splice HeroOut стала самой богатой компанией в городе.', en: 'And Splice gel made HeroOut the richest company in the city.' },
      ] },
      { img: 'tower_cutaway', area: 'd', kb: [1.0, 1.06, 0, 1], beats: [
        { k: 'cap', at: [4, 4], w: 92, ru: 'Гель варили глубоко под башней HeroOut, на минус сорок втором этаже.', en: 'The gel was brewed deep under the HeroOut tower, on floor minus forty-two.' },
      ] },
    ],
  },
  { // 7: the Lower Product (Антон 2026-10-10: the Demon is made down here; dropping it breaks the logic)
    dark: true,
    tag: { ru: 'УРОВЕНЬ −42 // ПРОДУКТ', en: 'LEVEL −42 // THE PRODUCT' },
    wide: { cols: '1.1fr 0.9fr 0.75fr', rows: '0.9fr 1.1fr', areas: '"a a v" "d c v"' },
    tall: { cols: '1fr 1fr', rows: '0.6fr 1fr 0.8fr', areas: '"a a" "v d" "v c"' },
    panels: [
      { img: 'factory', area: 'a', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [3, 5], w: 62, ru: 'Но под башней гель не только варили. Из него собирали людей.', en: 'But under the tower they didn’t just brew the gel. They built people out of it.' },
        { k: 'cap', at: [3, 70], w: 62, ru: 'Брали лучшие части лучших спасателей: четыре руки, хвост-бур. Получился один образец.', en: 'They took the best parts of the best rescuers: four arms, a drill tail. They ended up with one specimen.' },
      ] },
      { img: 'demon_vat', area: 'v', kb: [1.0, 1.05, 0, 1], fx: 'glow', beats: [
        { k: 'cap', at: [4, 4], w: 92, ru: 'Его назвали «Продукт №1: Демон». Спасатель, который не устаёт, не спорит и не просит отпуск.', en: 'They called it “Product No. 1: the Demon”. A rescuer who never gets tired, never argues and never asks for time off.', sfx: 'demon_awake' },
        { k: 'ad', at: [4, 78], w: 92, ru: 'Демон. Скоро на каждом вызове.', en: 'The Demon. Coming soon to every call.' },
      ] },
      { img: 'demon_face', area: 'd', kb: [1.0, 1.06, 0, 0], beats: [
        { k: 'cap', at: [4, 5], w: 90, ru: 'Пока он спал, всё шло по плану.', en: 'While he slept, everything went according to plan.' },
      ] },
      { img: 'glass_crack', area: 'c', fit: 'cover', kb: [1.0, 1.0, 0, 0], glow: 'glass_crack_glow', beats: [
        { k: 'cap', at: [3, 6], w: 80, ru: 'А потом его капсула треснула.', en: 'And then his capsule cracked.', fx: 'crackglow', sfx: 'nest_open' },
      ] },
    ],
  },
  { // 7
    dark: true,
    tag: { ru: 'ПРОТОКОЛ // EVERYONE IS ON CALL', en: 'PROTOCOL // EVERYONE IS ON CALL' },
    wide: { cols: '0.42fr 1.58fr', rows: '0.85fr 1fr', areas: '"a b" "c c"' },
    tall: { cols: '1fr', rows: '0.75fr 0.95fr 0.45fr', areas: '"b" "c" "a"' },
    panels: [
      { img: 'alarm_lamp', area: 'a', kb: [1.0, 1.04, 0, 0], fx: 'redpulse', beats: [] },
      { img: 'heroes_alarm', area: 'b', fit: 'cover', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'ctrl', at: [4, 5], w: 74, ru: 'Запущен протокол EVERYONE IS ON CALL. Сохраняйте спокойствие.', en: 'Protocol EVERYONE IS ON CALL is now active. Please remain calm.', sfx: 'threat_level_up' },
      ] },
      { img: 'gel_burst', area: 'c', kb: [1.0, 1.05, 0, 0], fx: 'alarm', beats: [
        { k: 'cap', at: [3, 5], w: 60, ru: 'Гель прорвался в реактор, а оттуда в сеть спасения по всему городу. И начал заражать людей.', en: 'The gel broke into the reactor, and from there into the rescue network across the whole city. And it started infecting people.' },
      ] },
    ],
  },
  { // 8
    tag: { ru: 'ЗАРАЖЕНИЕ // ГЕРОИ ВНЕ СМЕНЫ', en: 'INFECTION // HEROES OFF THE LEASH' },
    wide: { cols: '1.25fr 1fr', rows: '1fr 1fr', areas: '"a c" "b c"' },
    tall: { cols: '1fr', rows: '0.5fr 0.5fr 1fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'heroes_before', area: 'a', fit: 'contain', kb: [1.0, 1.02, 0, 0], beats: [
        { k: 'cap', at: [3, 4], w: 60, ru: 'Ещё вчера это были лучшие спасатели города.', en: 'Just yesterday, these were the best rescuers in the city.' },
      ] },
      { img: 'heroes_after', area: 'b', fit: 'contain', kb: [1.0, 1.02, 0, 0], fx: 'alarm', beats: [
        { k: 'cap', at: [3, 4], w: 70, ru: 'Сегодня у них чужие руки и чужие ноги. Заражённые сходили с ума один за другим. Герои тоже.', en: 'Today they have someone else’s arms and someone else’s legs. The infected lost their minds one after another. So did the heroes.', sfx: 'threat_level_up' },
      ] },
      { art: 'dossier', area: 'c', beats: [
        { k: 'cap', at: [3, 3], w: 94, ru: 'Килн, Линейщик, Фростлайн и Серафим теперь носятся по городу.', en: 'Kiln, Lineman, Frostline and Seraph now tear around the city.', fx: 'stamp' },
        { k: 'cap', at: [3, 86], w: 94, ru: 'Они до сих пор всех спасают. Просто теперь от их помощи приходится убегать.', en: 'They still rescue everyone. It’s just that now people have to run from their help.' },
      ] },
    ],
  },
  { // 9
    tag: { ru: 'ГЕРОИ ВНЕ СМЕНЫ // ИХ МНОГО', en: 'HEROES OFF THE LEASH // THERE ARE MANY' },
    wide: { cols: '1fr', rows: '0.42fr 1.58fr', areas: '"a" "b"' },
    tall: { cols: '1fr', rows: '0.45fr 1fr', areas: '"a" "b"' },
    panels: [
      { img: 'heroes_action', area: 'a', fit: 'contain', kb: [1.0, 1.04, 0, 0], fx: 'alarm', beats: [
        { k: 'cap', at: [3, 5], w: 70, ru: 'Килн выносит людей из домов, где нет пожара. Фростлайн тушит всё, что тёплое. Серафим лечит тех, кто не болен. Демон уводит всех под землю, «в безопасность».', en: 'Kiln carries people out of houses that aren’t on fire. Frostline puts out anything warm. Seraph heals people who aren’t sick. The Demon takes everyone underground, “to safety”.', sfx: 'demon_awake' },
      ] },
      { img: 'mad_crowd', area: 'b', fit: 'contain', kb: [1.0, 1.02, 0, 0], beats: [
        { k: 'cap', at: [4, 80], w: 60, ru: 'Таких героев в городе больше десятка. И все они на смене.', en: 'There are more than a dozen heroes like that in the city. And every one of them is on shift.' },
      ] },
    ],
  },
  { // 10
    tag: { ru: 'КАРАНТИН // ГОЛОС КОНТРОЛЯ', en: 'QUARANTINE // THE VOICE OF CONTROL' },
    wide: { cols: '0.45fr 1.55fr', rows: '1fr 1fr', areas: '"a b" "a c"' },
    tall: { cols: '1fr', rows: '0.45fr 1fr 1fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'tendril', area: 'a', kb: [1.0, 1.05, 0, 0], fx: 'glow', beats: [
        { k: 'cap', at: [4, 5], w: 90, ru: 'Заражение расползается дальше, квартал за кварталом.', en: 'The infection keeps spreading, block after block.' },
      ] },
      { img: 'quarantine_city', area: 'b', fit: 'contain', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [4, 5], w: 60, ru: 'Купол превратился в карантин. Город заперли вместе с заразой.', en: 'The Dome turned into a quarantine. The city got locked in with the infection.' },
      ] },
      { img: 'warehouse', area: 'c', fit: 'contain', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'ctrl', at: [6, 56], w: 80, ru: 'Уважаемые жители! Вы являетесь имуществом HeroOut.', en: 'Dear residents! You are the property of HeroOut.' },
        { k: 'ctrl', at: [6, 56], w: 80, ru: 'Пожалуйста, пройдите на склад.', en: 'Please proceed to the warehouse.', replace: true },
        { k: 'ctrl', at: [6, 56], w: 80, ru: 'Склад работает круглосуточно. Очередь на склад тоже является заботой о вас.', en: 'The warehouse is open 24/7. The queue for the warehouse is also part of our care.', replace: true },
      ] },
    ],
  },
  { // 11
    tag: { ru: 'СМЕНА 01 // ТВОЙ ХОД', en: 'SHIFT 01 // YOUR MOVE' },
    wide: { cols: '1.1fr 0.9fr', rows: '0.6fr 1fr', areas: '"a a" "b c"' },
    tall: { cols: '1fr', rows: '0.6fr 0.9fr 1fr', areas: '"a" "b" "c"' },
    panels: [
      { img: 'backup_print', area: 'a', fit: 'contain', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [4, 4], w: 92, ru: 'Но у HeroOut остались бэкапы всех спасателей, снятые ещё до вспышки. Из них можно напечатать героев, которые пока в своём уме.', en: 'But HeroOut still has backups of every rescuer, taken before the outbreak. You can print heroes from them who are still in their right minds.' },
      ] },
      { img: 'backup_arm', area: 'b', fit: 'contain', kb: [1.0, 1.04, 0, 0], beats: [
        { k: 'cap', at: [4, 72], w: 70, ru: 'Наши герои побеждают заражённых и забирают их руки и ноги. А вместе с ними и силу.', en: 'Our heroes beat the infected and take their arms and legs. And their power along with them.' },
      ] },
      { img: 'command_center', area: 'c', fit: 'contain', kb: [1.0, 1.03, 0, 0], beats: [
        { k: 'cap', at: [4, 5], w: 70, ru: 'Из всех штабов HeroOut на связи остался один. Твой.', en: 'Out of every HeroOut headquarters, only one is still answering. Yours.' },
        { k: 'cap', at: [4, 74], w: 70, ru: 'Открывай кварталы, печатай героев и верни город людям.', en: 'Open the blocks, print your heroes and give the city back to its people.' },
      ] },
    ],
  },
];

const UI = {
  ru: { skip: 'Пропустить', start: 'Начать смену', tap: 'Коснись, чтобы начать', next: 'Дальше', title: 'Пролог', sound: 'Звук', subtitle: 'Спасатели больше не придут. Теперь твоя смена.' },
  en: { skip: 'Skip', start: 'Start the shift', tap: 'Tap to begin', next: 'Next', title: 'Prologue', sound: 'Sound', subtitle: 'The rescuers aren’t coming. Now it’s your shift.' },
};
const WHO = {
  ru: { kiln: 'КИЛН', seraph: 'СЕРАФИМ', kid: '', lineman: 'ЛИНЕЙЩИК', exec: '', boss: '', anchor: 'НОВОСТИ LUMEN', ctrl: 'КОНТРОЛЬ', ad: 'РЕКЛАМА' },
  en: { kiln: 'KILN', seraph: 'SERAPH', kid: '', lineman: 'LINEMAN', exec: '', boss: '', anchor: 'LUMEN NEWS', ctrl: 'CONTROL', ad: 'ADVERTISEMENT' },
};

// ---------------------------------------------------------------- styles
const CSS = `
.psc{--night:#0B1117;--graph:#10171C;--paper:#F4F7F7;--paper2:#EDF4F5;--seam:#57D8F2;--glow:#9FF4FF;--deep:#115A80;--teal:#007E89;--coral:#EF5C73;--amber:#E8A33A;
 position:fixed;inset:0;z-index:9999;background:radial-gradient(120% 90% at 50% 0%,#16232d 0%,var(--night) 70%);color:var(--graph);
 font-family:'Golos Text',system-ui,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.psc *{box-sizing:border-box}
.psc-top{position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;gap:12px;padding:0 max(16px,env(safe-area-inset-left));z-index:5}
.psc-tag{font:700 10px/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--seam);white-space:nowrap;flex:1;min-width:0;display:flex;gap:8px;align-items:baseline}
.psc-tag .t{overflow:hidden;text-overflow:ellipsis;min-width:0}
.psc-tag .n{flex:0 0 auto;color:#fff;opacity:.8}
@media (max-width:480px){.psc-prog{display:none}}
.psc-prog{display:flex;gap:4px;flex:0 0 auto}
.psc-prog i{display:block;width:16px;height:3px;background:#ffffff26;clip-path:polygon(2px 0,100% 0,calc(100% - 2px) 100%,0 100%)}
.psc-prog i.on{background:var(--seam)}
.psc-btn{white-space:nowrap;font:700 11px/1 Unbounded,sans-serif;letter-spacing:.08em;color:#fff;background:#ffffff14;border:1px solid #ffffff2e;padding:10px 14px;cursor:pointer;
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);min-height:36px}
.psc-btn:hover{background:#ffffff26}
.psc-btn.icon{width:40px;padding:0;display:grid;place-items:center}
.psc-stage{position:absolute;left:0;right:0;top:52px;bottom:0;display:grid;place-items:center;padding:6px 12px max(30px,env(safe-area-inset-bottom))}
.psc-page{position:relative;display:grid;gap:8px;padding:8px;background:var(--paper);box-shadow:0 30px 80px #0009;
 clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .5s}
.psc-page::after{content:'';position:absolute;inset:3px;border:1px solid var(--seam);pointer-events:none;
 clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psc-page.out{transform:translateX(-40px) scale(.97);opacity:0}
.psc-page.in{transform:translateX(40px) scale(.97);opacity:0}
.psc-panel{position:relative;overflow:hidden;display:flex;flex-direction:column;background:var(--graph);border:3px solid var(--graph);opacity:0;transform:scale(.94);
 transition:opacity .45s ease,transform .6s cubic-bezier(.2,.9,.25,1.15),clip-path .6s ease;clip-path:inset(0 100% 0 0)}
.psc-panel.show{opacity:1;transform:none;clip-path:inset(0 0 0 0)}
.psc-pic{position:relative;flex:1;min-height:0;overflow:hidden}
.psc-band{flex:none;display:flex;flex-direction:column;gap:5px;padding:7px 8px;background:var(--graph)}
.psc-band:empty{display:none}
.psc-band .psc-b{position:static;max-width:100%}
.psc-pic>img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%;will-change:transform}
.psc-pic>img.bd{position:absolute;inset:-8%;width:116%;height:116%;object-fit:cover;filter:blur(16px) brightness(.62) saturate(.9);display:none}
.psc-panel.contain .psc-pic>img.bd{display:block}
.psc-pic>img.gl{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;opacity:0;pointer-events:none}
.psc-pic>img.gl.on{animation:psc-crackglow 1.6s ease-in-out infinite}
@keyframes psc-crackglow{0%{opacity:0}25%{opacity:1}60%{opacity:.55}100%{opacity:1}}
.psc-panel.contain .psc-pic>img.bg{box-shadow:0 0 0 2px var(--graph),0 10px 30px #0008}
.psc-dos{background:linear-gradient(#0f1a21,#0B1117);display:flex;gap:2.5%;padding:clamp(38px,9vh,70px) 3% clamp(40px,8vh,64px);align-items:center;justify-content:center}
.psc-card{position:relative;flex:1;max-width:24%;aspect-ratio:.6;max-height:100%;background:var(--paper);border:2px solid var(--graph);overflow:hidden;opacity:0;transform:translateY(14px) rotate(var(--r));transition:opacity .4s,transform .5s cubic-bezier(.2,.9,.3,1.3);
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.psc-card.on{opacity:1;transform:rotate(var(--r))}
.psc-card img{position:absolute;inset:0 0 16% 0;width:100%;height:84%;object-fit:contain;object-position:50% 100%;background:linear-gradient(#4f9fdc,#c7dfee)}
.psc-card .nm{position:absolute;left:0;right:0;bottom:0;height:16%;display:grid;place-items:center;background:var(--graph);color:#fff;font:800 clamp(7px,1.3vmin,12px)/1.1 Unbounded,sans-serif;letter-spacing:.1em;text-align:center}
.psc-card .scan{position:absolute;left:0;right:0;height:18%;background:linear-gradient(#EF5C7300,#EF5C7366,#EF5C7300);animation:psc-scan 2.2s linear infinite}
@keyframes psc-scan{from{top:-18%}to{top:100%}}
.psc-card .st{position:absolute;left:6%;right:6%;top:40%;padding:5px 0;text-align:center;border:3px solid var(--coral);color:var(--coral);background:#F4F7F7d9;font:900 clamp(8px,1.6vmin,15px)/1 Unbounded,sans-serif;letter-spacing:.08em;
 transform:rotate(-12deg) scale(2.2);opacity:0;transition:transform .25s cubic-bezier(.5,0,.6,1.6),opacity .2s}
.psc-card .st.on{transform:rotate(-12deg) scale(1);opacity:1}
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
.psc-who{display:block;font:800 9px/1.3 Unbounded,sans-serif;letter-spacing:.14em;color:var(--deep);margin-bottom:4px}
.psc-b.ctrl{background:var(--paper);color:var(--graph);padding:9px 12px 10px;border:2px solid var(--coral);box-shadow:0 6px 18px #0006;font-weight:600;
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.psc-ctrlhead{display:flex;gap:8px;align-items:center;margin-bottom:5px;font:800 9px/1 Unbounded,sans-serif;letter-spacing:.14em}
.psc-ctrlhead b{background:var(--graph);color:#fff;padding:3px 5px}
.psc-ctrlhead span{color:var(--coral)}
.psc-b.ad{background:linear-gradient(135deg,var(--deep),var(--teal));color:#fff;padding:8px 12px 10px;border:2px solid var(--glow);box-shadow:0 0 0 2px var(--graph),0 6px 18px #0006;font-weight:700;font-style:italic;
 clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.psc-b.ad .psc-ctrlhead span{color:var(--glow)}
.psc-caret{display:inline-block;width:.5em}
.psc-log{background:linear-gradient(#0f1a21,#0B1117);padding:12% 6% 6%;display:flex;flex-direction:column;gap:3.2%;font:600 clamp(10px,1.65vmin,15px)/1.25 'Golos Text',sans-serif;color:#d9e8ec}
.psc-log .hd{font:800 clamp(8px,1.2vmin,11px)/1 Unbounded,sans-serif;letter-spacing:.14em;color:var(--seam);display:flex;justify-content:space-between;margin-bottom:2%}
.psc-log .hd i{font-style:normal;color:var(--coral);animation:psc-blink 1s steps(2) infinite}
.psc-log .row{display:flex;gap:4%;align-items:baseline;padding:2.2% 3%;background:#ffffff0d;border-left:3px solid var(--seam);opacity:0;transform:translateX(-10px);transition:.35s}
.psc-log .row.on{opacity:1;transform:none}
.psc-log .row b{font:800 .85em/1 Unbounded,sans-serif;color:var(--seam);flex:0 0 auto}
.psc-log .row.hot{border-left-color:var(--coral);background:#EF5C7322}
.psc-log .row.hot b{color:var(--coral)}
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
.psc-adapt{left:14%;height:60%;aspect-ratio:50/106;image-rendering:pixelated;animation:psc-sway 1.4s ease-in-out infinite;filter:drop-shadow(0 0 6px #EF5C73aa)}
.psc-adapt img{width:100%;height:100%;image-rendering:pixelated;display:block}
@keyframes psc-sway{50%{transform:translateY(-3%)}}
.psc-adapt.dead{opacity:0;transform:translateY(10%) scale(.8);filter:brightness(3)}
.psc-res{right:16%;height:54%}
.psc-res img{image-rendering:pixelated;height:100%;position:absolute;right:0;bottom:0;transition:opacity .25s}
.psc-orb{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(#fff,#9FF4FF 40%,#57D8F200 70%);left:22%;bottom:40%;opacity:0}
.psc-orb.fly{animation:psc-orb .8s cubic-bezier(.4,0,.2,1) forwards}
@keyframes psc-orb{0%{opacity:1;transform:none}100%{opacity:1;transform:translate(var(--tx),var(--ty)) scale(1.6)}}
.psc-badge{position:absolute;right:6%;top:24%;font:800 10px/1 Unbounded,sans-serif;letter-spacing:.12em;background:var(--teal);color:#fff;padding:6px 8px;opacity:0;transform:translateY(8px);transition:.4s;
 clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.psc-badge.on{opacity:1;transform:none}
.psc-core{background:radial-gradient(circle at 51% 54%,#13283a,#0B1117 70%)}
.psc-core svg{width:100%;height:100%}
.psc-core .glow{transform-origin:102px 64px;animation:psc-beat 1.6s ease-in-out infinite}
.psc-core .veins path{stroke-dasharray:260;stroke-dashoffset:260;animation:psc-draw 3.5s ease-out forwards,psc-blink 2s 3.5s ease-in-out infinite}
@keyframes psc-beat{0%,100%{transform:scale(.9);opacity:.8}45%{transform:scale(1.12);opacity:1}}
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
.psc-hint{position:absolute;right:16px;bottom:max(9px,calc(env(safe-area-inset-bottom) - 18px));font:700 9px/1 Unbounded,sans-serif;letter-spacing:.14em;color:#ffffff66;z-index:5;pointer-events:none}
@media (max-width:520px){.psc-prog{display:none}.psc-tag{font-size:9px}}
@media (prefers-reduced-motion:reduce){.psc *{animation:none!important;transition:opacity .2s!important}}
`;

// ---------------------------------------------------------------- helpers
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const MAX_UP = 1.35; // largest allowed upscale of a source image
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
  const vol = (v) => Math.max(0, Math.min(1, v ?? 1));
  const MUSIC = vol(opts.musicVolume), SFX = vol(opts.sfxVolume);
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
    to *= MUSIC;
    const from = music.volume, t0 = performance.now();
    fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); music.volume = from + (to - from) * k; if (k >= 1) clearInterval(fadeT); }, 40);
  };
  const sfx = (name, vol = 0.7) => { if (!soundOn || !name) return; const a = mk(name).cloneNode(); a.volume = vol * SFX; a.play().catch(() => {}); };
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
    const cs = getComputedStyle(stage), W = stage.clientWidth - 24, H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4;
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
  const onResize = () => { if (current) { applyGrid(current.el, current.def); fitPage(current.el); current.panels.forEach(c => c.fit && c.fit()); } };
  window.addEventListener('resize', onResize);

  // ---- drawn panels
  const ART = {
    dossier(p) {
      const a = el('div', 'psc-art psc-dos');
      const H = [['c_lineman', lang === 'ru' ? 'ЛИНЕЙЩИК' : 'LINEMAN', '-3deg'], ['c_frostline', lang === 'ru' ? 'ФРОСТЛАЙН' : 'FROSTLINE', '2deg'], ['c_kiln', lang === 'ru' ? 'КИЛН' : 'KILN', '-1.5deg'], ['c_seraph', lang === 'ru' ? 'СЕРАФИМ' : 'SERAPH', '2.5deg']];
      const cards = H.map(([img, name, r]) => {
        const c = el('div', 'psc-card', `<img src="${url('panels/' + img + '.jpg')}" alt=""><div class="scan"></div><div class="nm">${name}</div><div class="st">${lang === 'ru' ? 'ЗАРАЖЁН' : 'INFECTED'}</div>`);
        c.style.setProperty('--r', r); a.appendChild(c); return c;
      });
      a.appendChild(el('div', 'psc-stripe'));
      cards.forEach((c, i) => setTimeout(() => c.classList.add('on'), 700 + i * 260));
      p.fxStamp = () => cards.forEach((c, i) => setTimeout(() => c.querySelector('.st').classList.add('on'), 300 + i * 380));
      return a;
    },
    log() {
      // HeroOut dispatch board: an ordinary day of calls, the last one arrives suspiciously on time
      const a = el('div', 'psc-art psc-log');
      const R = lang === 'ru' ? [
        ['08:02', 'Кошка на дереве. Снова та же кошка.'],
        ['09:15', 'Строительный кран сошёл с ума.'],
        ['11:40', 'Люк решил стать фонтаном.'],
        ['13:05', 'Лифт застрял вместе с рекламной съёмкой.'],
        ['14:59', 'Пожар. Начался ровно за минуту до патруля.', 1],
      ] : [
        ['08:02', 'Cat stuck in a tree. The same cat again.'],
        ['09:15', 'Construction crane gone crazy.'],
        ['11:40', 'A manhole decided to be a fountain.'],
        ['13:05', 'Elevator stuck with an ad shoot inside.'],
        ['14:59', 'Fire. Started exactly one minute before the patrol.', 1],
      ];
      a.appendChild(el('div', 'hd', `<span>HERO | OUT · ${lang === 'ru' ? 'ВЫЗОВЫ' : 'DISPATCH'}</span><i>● LIVE</i>`));
      const rows = R.map(([t, x, hot]) => { const r = el('div', 'row' + (hot ? ' hot' : ''), `<b>${t}</b><span>${x}</span>`); a.appendChild(r); return r; });
      rows.forEach((r, i) => setTimeout(() => r.classList.add('on'), 600 + i * 650));
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
    else if (b.k === 'ad') head = `<div class="psc-ctrlhead"><b>HERO | OUT</b><span>${WHO[lang].ad}</span></div>`;
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
      const pic = el('div', 'psc-pic'), band = el('div', 'psc-band');
      n.append(pic, band);
      const ctx = { def: p, node: n, pic, band };
      if (p.img) {
        const img = el('img', 'bg'); img.src = url('panels/' + p.img + '.jpg'); img.alt = ''; img.draggable = false;
        const [s0, s1, dx, dy] = p.kb || [1.06, 1, 0, 0];
        img.style.transform = `scale(${s0})`;
        img.style.objectPosition = p.pos || '50% 0%';
        ctx.kb = () => { if (RM) return; img.animate([{ transform: `scale(${s0}) translate(0,0)` }, { transform: `scale(${s1}) translate(${dx}%,${dy}%)` }], { duration: p.kbMs || 12000, fill: 'forwards', easing: 'ease-out' }); };
        // Small source crops must not be blown up: if covering the box needs more than MAX_UP zoom,
        // show the whole picture at a readable size over a blurred copy of itself.
        const bd = el('img', 'bd'); bd.src = img.src; bd.alt = ''; bd.draggable = false;
        ctx.fit = () => {
          const W = pic.clientWidth, H = pic.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
          if (!W || !nw) return;
          const need = Math.max(W / nw, H / nh) * Math.max(s0, s1);
          const contain = p.fit === 'contain' || (p.fit !== 'cover' && need > MAX_UP);
          n.classList.toggle('contain', contain);
          if (contain) {
            const k = Math.min(W / nw, H / nh, MAX_UP), w = nw * k, h = nh * k;
            Object.assign(img.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px' });
          } else Object.assign(img.style, { width: '', height: '', left: '', top: '' });
        };
        img.addEventListener('load', ctx.fit);
        pic.append(bd, img);
        if (p.glow) { const gl = el('img', 'gl'); gl.src = url('panels/' + p.glow + '.png'); gl.alt = ''; pic.appendChild(gl); ctx.glow = gl; }
      } else if (p.art) {
        pic.appendChild(ART[p.art](ctx));
      }
      const fx = el('div', 'psc-fx'); pic.appendChild(fx); ctx.fx = fx;
      const flash = el('div', 'psc-flash'); pic.appendChild(flash); ctx.flash = flash;
      page.appendChild(n);
      return ctx;
    });
    prog.querySelectorAll('i').forEach((e, i) => e.classList.toggle('on', i <= idx));
    tag.innerHTML = `<span class="t"></span><span class="n">${idx + 1}/${SCRIPT.length}</span>`; tag.firstChild.textContent = def.tag[lang];
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
    else if (name === 'stamp') { ctx.fxStamp && ctx.fxStamp(); }
    else if (name === 'crackglow') { ctx.glow && ctx.glow.classList.add('on'); ctx.flash.classList.add('go'); ctx.node.classList.add('psc-shake'); }
    else if (FX[name]) FX[name](ctx.fx);
  };

  // ---- main sequence
  const run = async () => {
    for (let pi = 0; pi < SCRIPT.length && !finished; pi++) {
      const def = SCRIPT[pi];
      const page = buildPage(def, pi);
      const prev = current; current = page;
      if (prev) { prev.el.classList.add('out'); await wait(380); prev.el.remove(); }
      stage.appendChild(page.el); fitPage(page.el); page.panels.forEach(c => c.fit && c.fit());
      void page.el.offsetWidth; page.el.classList.remove('in');
      if (def.dark) fadeMusic(soundOn ? .25 : 0, 1500);
      if (pi === SCRIPT.length - 1) fadeMusic(soundOn ? .45 : 0, 2000);
      await wait(350);
      for (const ctx of page.panels) {
        if (finished) return;
        ctx.node.classList.add('show'); ctx.kb && ctx.kb(); runFx(ctx, ctx.def.fx);
        await wait(650);
        let last = null;
        for (const b of ctx.def.beats) {
          if (finished) return;
          if (b.replace && last) { last.node.classList.add('gone'); await wait(200); last.node.remove(); }
          const bub = makeBubble(b); (b.k === 'say' ? ctx.pic : ctx.band).appendChild(bub.node);
          if (b.k !== 'say') { bub.node.style.left = bub.node.style.top = ''; }
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
