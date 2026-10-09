import { ClipPlayer } from './clip';
import { CLIPS } from './clips';
import { COACH } from './content';
import { progress } from './progress';
import { tr } from './text';
import { h } from './views';

export interface CoachOptions {
  host?: HTMLElement;
  onClose?: () => void;
  onOpenGuide?: (entry?: string) => void;
}

/**
 * "New mechanic" card: shown once, the first time a mechanic shows up in a
 * match (first nest opened, first trophy, threat level 1, …). A clip, two
 * lines of text, «Понятно» and a link into the guide.
 */
export function showCoach(topic: string, opts: CoachOptions = {}): boolean {
  const c = COACH[topic];
  if (!c) return false;
  progress.markCoach(topic);
  let player: ClipPlayer | null = null;
  const close = () => {
    player?.destroy();
    wrap.remove();
    document.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  const clipHost = h('div');
  const off = h<HTMLInputElement>('input', { type: 'checkbox' });
  off.checked = progress.coachOff;
  off.addEventListener('change', () => (progress.coachOff = off.checked));
  const card = h(
    'div.psl-plate.psl-coach',
    { role: 'dialog', 'aria-modal': 'true' },
    h('div.psl-caps', {}, tr('ui.new_mechanic', { name: tr(c.name) })),
    h('h3.psl-h', { style: 'margin-top:6px' }, tr(c.title)),
    clipHost,
    h('p.psl-p', {}, tr(c.text)),
    h(
      'div.psl-nav',
      {},
      c.entry && opts.onOpenGuide ? h('button.psl-btn.ghost', { onclick: () => (close(), opts.onOpenGuide?.(c.entry)) }, tr('ui.guide')) : null,
      h('button.psl-btn', { onclick: close }, tr('ui.got_it')),
    ),
    h('label.psl-check', {}, off, tr('ui.dont_show')),
  );
  const wrap = h('div.psl-coach-wrap', {}, card);
  wrap.addEventListener('click', (e) => e.target === wrap && close());
  (opts.host ?? document.body).append(wrap);
  player = new ClipPlayer(clipHost, CLIPS[c.clip]);
  document.addEventListener('keydown', onKey, true);
  return true;
}
