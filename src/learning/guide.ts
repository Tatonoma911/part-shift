import { ClipPlayer } from './clip';
import { CLIPS } from './clips';
import { ENTRY, LESSONS, SECTIONS, sectionOf, type Entry } from './content';
import { progress } from './progress';
import { has, tr } from './text';
import { h, ICON, visualView } from './views';

/** "key|value" from content.ts: a text key with {v}, a list of elements or parts, or a raw value. */
function statValue(value: string): string {
  const [key, v] = value.split('|');
  if (key === 'stat.techs') return v.split(',').map((t) => tr(`tech.${t}`)).join(', ');
  if (key === 'stat.parts') return v.split(',').map((p) => (has(`part.${p}.label`) ? tr(`part.${p}.label`) : tr(`part.${p}`))).join(' + ');
  return key ? tr(key, { v }) : v;
}

type View = { kind: 'home' } | { kind: 'section'; id: string } | { kind: 'lessons'; index: number } | { kind: 'entry'; id: string };

export interface GuideOptions {
  /** Where the overlay is mounted (default document.body). */
  host?: HTMLElement;
  /** Section, entry id or "lessons" to open at. */
  startAt?: string;
  onClose?: () => void;
  /** Shown as a button in the "World" section when the game has the comic intro. */
  onPlayIntro?: () => void;
}

/**
 * The in-game field guide: a lessons track with clips, then sections (numbers,
 * resources, buildings, people, trophies, enemies, the city, controls, world).
 * Opens over the game; the game pauses while it is open (see index.ts).
 */
export class Guide {
  readonly el: HTMLDivElement;
  private sheet: HTMLDivElement;
  private head: HTMLDivElement;
  private body: HTMLDivElement;
  private stack: View[] = [];
  private players: ClipPlayer[] = [];

  constructor(private opts: GuideOptions = {}) {
    this.el = h<HTMLDivElement>('div.psl-layer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('ui.guide') });
    this.head = h<HTMLDivElement>('div.psl-head');
    this.body = h<HTMLDivElement>('div.psl-body');
    this.sheet = h<HTMLDivElement>('div.psl-sheet', {}, this.head, this.body);
    this.el.append(this.sheet);
    this.el.addEventListener('click', (e) => e.target === this.el && this.close());
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.back();
      }
    });
    this.el.tabIndex = -1;
    (opts.host ?? document.body).append(this.el);
    this.stack = [{ kind: 'home' }];
    const at = opts.startAt;
    if (at === 'lessons') this.stack.push({ kind: 'lessons', index: 0 });
    else if (at && SECTIONS.some((s) => s.id === at)) this.stack.push({ kind: 'section', id: at });
    else if (at && ENTRY.has(at)) {
      const s = sectionOf(at);
      if (s) this.stack.push({ kind: 'section', id: s.id });
      this.stack.push({ kind: 'entry', id: at });
    }
    this.show();
    this.el.focus();
  }

  close(): void {
    this.clearPlayers();
    this.el.remove();
    this.opts.onClose?.();
  }

  private back(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.show();
    } else this.close();
  }

  private go(v: View): void {
    this.stack.push(v);
    this.show();
  }

  private clearPlayers(): void {
    this.players.forEach((p) => p.destroy());
    this.players = [];
  }

  private clip(host: HTMLElement, id: string): void {
    const def = CLIPS[id];
    if (def) this.players.push(new ClipPlayer(host, def));
  }

  private show(): void {
    this.clearPlayers();
    const v = this.stack[this.stack.length - 1];
    this.head.replaceChildren();
    this.body.replaceChildren();
    this.body.scrollTop = 0;
    if (v.kind === 'home') this.home();
    else if (v.kind === 'section') this.section(v.id);
    else if (v.kind === 'lessons') this.lessons(v.index);
    else this.entry(v.id);
  }

  private header(caps: string, title: string): void {
    const backBtn = this.stack.length > 1 ? h('button.psl-btn-icon.light', { 'aria-label': tr('ui.back'), html: ICON.back, onclick: () => this.back() }) : null;
    this.head.append(
      ...[backBtn].filter(Boolean) as HTMLElement[],
      h('div.psl-head-text', {}, h('div.psl-caps', {}, caps), h('h2.psl-title', {}, title)),
      h('button.psl-btn-icon', { 'aria-label': tr('ui.close'), html: ICON.close, onclick: () => this.close() }),
    );
  }

  // ------------------------------------------------------------------ home

  private home(): void {
    this.header(tr('ui.guide.caps'), '');
    const title = this.head.querySelector('.psl-title')!;
    title.innerHTML = 'PART<b>SHIFT</b>';
    const seen = LESSONS.filter((l) => progress.viewed(`lesson.${l.id}`)).length;
    const heroThumb = visualView({ kind: 'anim', set: 'resident', anim: 'dig', scale: 1 }, 'thumb');
    this.body.append(
      h(
        'div.psl-hero',
        { role: 'button', tabindex: '0', onclick: () => this.go({ kind: 'lessons', index: Math.min(seen, LESSONS.length - 1) }) },
        heroThumb,
        h('div', {}, h('div.psl-caps', {}, `${tr('sec.basics.sub')} // ${seen}/${LESSONS.length}`), h('div.psl-hero-title', {}, tr('sec.basics')), h('div.psl-hero-sub', {}, tr(`lesson.${LESSONS[Math.min(seen, LESSONS.length - 1)].id}.title`))),
        h('div.psl-hero-go', { html: ICON.play }),
      ),
    );
    const grid = h('div.psl-grid');
    for (const s of SECTIONS) {
      const done = s.entries.filter((e) => progress.viewed(e.id)).length;
      const icon = visualView({ kind: 'image', key: s.icon }, 'thumb');
      icon?.classList.add('psl-card-icon');
      grid.append(
        h(
          'button.psl-card',
          { onclick: () => this.go({ kind: 'section', id: s.id }) },
          icon,
          h('div.psl-card-title', {}, tr(`sec.${s.id}`)),
          h('div.psl-card-sub', {}, tr(`sec.${s.id}.sub`)),
          h(`span.psl-card-prog${done === s.entries.length ? '.done' : ''}`, {}, done === s.entries.length ? '✓' : `${done}/${s.entries.length}`),
        ),
      );
    }
    this.body.append(grid);
  }

  // -------------------------------------------------------------- lessons

  private lessons(index: number): void {
    const l = LESSONS[index];
    progress.markViewed(`lesson.${l.id}`);
    this.header(tr('ui.lesson', { n: index + 1, total: LESSONS.length }), tr(`lesson.${l.id}.title`));
    const steps = h('div.psl-steps');
    LESSONS.forEach((x, i) => steps.append(h(`i${i === index ? '.on' : progress.viewed(`lesson.${x.id}`) ? '.seen' : ''}`)));
    const clipHost = h('div');
    this.body.append(steps, clipHost, h('div', { style: 'height:14px' }), h('p.psl-p', {}, tr(`lesson.${l.id}.text`)), h('div.psl-tip', {}, h('b', {}, tr('ui.tip')), h('span', {}, tr(`lesson.${l.id}.tip`))));
    this.clip(clipHost, l.clip);
    const replace = (i: number) => {
      this.stack[this.stack.length - 1] = { kind: 'lessons', index: i };
      this.show();
    };
    const last = index === LESSONS.length - 1;
    this.body.append(
      h(
        'div.psl-nav',
        {},
        h('button.psl-btn.ghost', { disabled: index === 0, onclick: () => replace(index - 1) }, tr('ui.prev')),
        h('button.psl-btn', { onclick: () => (last ? this.back() : replace(index + 1)) }, last ? tr('ui.got_it') : tr('ui.next')),
      ),
    );
  }

  // -------------------------------------------------------------- section

  private section(id: string): void {
    const s = SECTIONS.find((x) => x.id === id)!;
    this.header(`${tr('ui.guide.caps').split(' // ')[0]} // ${tr(`sec.${id}`).toUpperCase()}`, tr(`sec.${id}`));
    const list = h('div.psl-list');
    for (const e of s.entries) {
      const thumb = h('div.psl-thumb', {}, visualView(e.visual, 'thumb') ?? (e.clip ? h('div.psl-play', { html: ICON.play }) : ''));
      list.append(
        h(
          'button.psl-row',
          { onclick: () => this.go({ kind: 'entry', id: e.id }) },
          thumb,
          h('div', { style: 'min-width:0' }, h('div.psl-row-name', {}, tr(e.name)), h('div.psl-row-desc', {}, tr(e.desc))),
          h('div.psl-row-meta', {}, e.clip ? h('div.psl-play', { html: ICON.play, title: tr('ui.watch') }) : null, progress.viewed(e.id) ? null : h('i.psl-dot', { title: 'new' })),
        ),
      );
    }
    this.body.append(list);
    if (id === 'world' && this.opts.onPlayIntro) {
      this.body.append(h('div.psl-nav', {}, h('button.psl-btn.dark', { onclick: () => (this.close(), this.opts.onPlayIntro?.()) }, tr('ui.play_intro'))));
    }
  }

  // ---------------------------------------------------------------- entry

  private entry(id: string): void {
    const e = ENTRY.get(id) as Entry;
    progress.markViewed(id);
    const s = sectionOf(id);
    this.header(s ? tr(`sec.${s.id}`).toUpperCase() : '', tr(e.name));
    const visual = h('div.psl-entry-visual');
    this.body.append(visual, h('p.psl-p', {}, tr(e.desc)));
    if (e.clip) this.clip(visual, e.clip);
    else {
      const v = visualView(e.visual, 'big');
      if (v) visual.append(h('div.psl-sprite', {}, v));
    }
    if (e.how?.length) {
      this.body.append(h('div.psl-sub', {}, tr('ui.how')));
      e.how.forEach((k) => this.body.append(h('p.psl-p', {}, tr(k))));
    }
    const stats = e.stats?.();
    if (stats?.length) {
      const box = h('div.psl-stats');
      for (const [label, value] of stats) {
        const text = statValue(value);
        box.append(h(`div.psl-stat${text.length > 11 ? '.wide' : ''}`, {}, h('div.psl-stat-k', {}, tr(label)), h('div.psl-stat-v', {}, text)));
      }
      this.body.append(h('div.psl-sub', {}, tr('ui.stats')), box);
    }
    if (e.items?.length) {
      const list = h('div.psl-items');
      for (const [name, text] of e.items) list.append(h('div.psl-item', {}, h('b', {}, tr(name)), h('span', {}, tr(text))));
      this.body.append(list);
    }
    if (e.alt) {
      const v = visualView(e.alt.visual, 'big');
      if (v) this.body.append(h('div.psl-sub', {}, tr(e.alt.label)), h('div.psl-sprite.alt', {}, v));
    }
    if (e.tip) this.body.append(h('div.psl-tip', {}, h('b', {}, tr('ui.tip')), h('span', {}, tr(e.tip))));
    if (e.clip && e.visual) {
      const v = visualView(e.visual, 'big');
      if (v) this.body.append(h('div', { style: 'height:12px' }), h('div.psl-sprite', {}, v));
    }
    if (e.related?.length) {
      const chips = h('div.psl-chips');
      for (const r of e.related) {
        const re = ENTRY.get(r);
        if (re) chips.append(h('button.psl-chip', { onclick: () => this.go({ kind: 'entry', id: r }) }, tr(re.name)));
      }
      this.body.append(h('div.psl-sub', {}, tr('ui.related')), chips);
    }
  }
}
