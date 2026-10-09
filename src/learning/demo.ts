import { createLearning, CLIPS, COACH, tr, type Lang } from './index';
import { h, ICON } from './views';

/**
 * Preview page for the learning layer (learning.html, `npm run learning-artifact`):
 * the guide, every clip and every coach card, in Russian and English.
 */
const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'ru';
const learning = createLearning({ lang, onPlayIntro: () => alert(lang === 'ru' ? 'Здесь запустится комикс-вступление' : 'The comic intro plays here') });

const css = `
:root{color-scheme:light}
html,body{margin:0;background:#DFEEF3;font-family:"Golos Text",system-ui,sans-serif;color:#10171C}
.demo{max-width:980px;margin:0 auto;padding:20px 16px 60px}
.demo-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.demo-logo{font-family:Unbounded,sans-serif;font-weight:900;font-size:26px;letter-spacing:-.01em}
.demo-logo b{color:#007E89}
.demo-caps{font-family:Unbounded,sans-serif;font-weight:700;font-size:10px;letter-spacing:.14em;color:#115A80;text-transform:uppercase}
.demo-lang{margin-left:auto;display:flex;background:rgba(16,23,28,.08)}
.demo-lang button{border:0;background:none;font:inherit;font-weight:700;padding:10px 14px;cursor:pointer}
.demo-lang button.on{background:#10171C;color:#fff}
.demo-row{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 26px}
.demo-row .psl-btn{flex:0 1 auto}
.demo h2{font-family:Unbounded,sans-serif;font-size:16px;margin:26px 0 4px}
.demo p.lead{margin:4px 0 14px;color:#5B6B75;font-size:14.5px;max-width:640px}
.demo-clips{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.demo-clip{background:#fff;padding:10px;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.demo-clip .demo-caps{margin:10px 2px 2px}
.demo-chips{display:flex;flex-wrap:wrap;gap:8px}
`;
document.head.append(h('style', {}, css));

function render(): void {
  const root = document.getElementById('learning-demo')!;
  root.replaceChildren();
  const ru = lang === 'ru';
  const langBtn = (l: Lang, label: string) =>
    h(`button${lang === l ? '.on' : ''}`, {
      onclick: () => {
        lang = l;
        learning.setLang(l);
        render();
      },
    }, label);
  const clips = h('div.demo-clips');
  const names: Record<string, string> = {
    start: 'lesson.start.title', dig: 'lesson.dig.title', clue: 'lesson.clue.title', deduce: 'lesson.deduce.title', cascade: 'clue.empty.name', build: 'lesson.build.title',
    order: 'lesson.fight.title', nest: 'clue.danger.name', parts: 'lesson.parts.title', elements: 'lesson.elements.title', heroes: 'hero.lairs.name', call: 'lesson.call.title', threat: 'res.threat.name', caution: 'clue.caution.name', energy: 'resource.energy.name',
  };
  root.append(
    h('div.demo', {},
      h('div.demo-top', {},
        h('div', {}, h('div.demo-caps', {}, ru ? 'ОБУЧЕНИЕ // ПРЕВЬЮ' : 'LEARNING // PREVIEW'), h('div.demo-logo', { html: 'PART<b>SHIFT</b>' })),
        h('div.demo-lang', {}, langBtn('ru', 'RU'), langBtn('en', 'EN')),
      ),
      h('div.demo-row', {},
        h('button.psl-btn', { onclick: () => learning.openGuide() }, tr('ui.open_guide')),
        h('button.psl-btn.dark', { onclick: () => learning.openGuide('lessons') }, tr('sec.basics')),
      ),
      h('h2', {}, ru ? 'Подсказки «новая механика»' : '"New mechanic" cards'),
      h('p.lead', {}, ru ? 'В игре каждая всплывает один раз, когда механика впервые встречается в партии: первый бой, первый трофей, рост угрозы, выход героя, цель вызова. Игра на это время встаёт на паузу.' : 'In the game each pops up once, the first time the mechanic appears in a match. The game pauses meanwhile.'),
      h('div.demo-chips', {}, ...Object.keys(COACH).map((k) => h('button.psl-chip', { onclick: () => learning.coach(k as keyof typeof COACH, true) }, tr(COACH[k].title)))),
      h('h2', {}, ru ? 'Все обучающие ролики' : 'All teaching clips'),
      h('p.lead', {}, ru ? 'Нарисованы движком из спрайтов игры. Нажмите на ролик, чтобы начать его заново.' : 'Drawn live from the game sprites. Tap a clip to restart it.'),
      clips,
    ),
  );
  for (const id of Object.keys(CLIPS)) {
    const box = h('div.demo-clip');
    clips.append(box);
    learning.playClip(box, id as keyof typeof CLIPS);
    box.append(h('div.demo-caps', {}, tr(names[id] ?? id)));
  }
  void ICON;
}

void learning.ready.then(() => {
  render();
  if (params.get('open') !== '0') learning.openGuide(params.get('at') ?? undefined);
});
