import Phaser from 'phaser';
import type { World } from '../core/world';
import { t } from '../i18n';
import { C, FONT, FONT_NUM, GUIDE, INK } from './layout';
import { plate } from './ui';

/**
 * Shift summary in the right column on a wide screen (UI_SPEC §7.1, ART_REVIEW
 * AR-06): the space between the HUD and the dock was empty on PC. Four counters
 * with progress bars, the time to the next threat level, and the last three
 * messages, because toasts vanish and on a big screen there is room to keep them.
 * Landscape only; portrait has no free column.
 */
const ROWS = ['blocks', 'nests', 'caches', 'survivors'] as const;
type Row = (typeof ROWS)[number];

export class SidePanel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly labels = new Map<Row, Phaser.GameObjects.Text>();
  private readonly values = new Map<Row, Phaser.GameObjects.Text>();
  private readonly threat: Phaser.GameObjects.Text;
  private readonly log: Phaser.GameObjects.Text[] = [];
  private readonly lines: string[] = [];
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private sig = '';

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly y: number,
    private readonly h: number,
  ) {
    const x = GUIDE.x;
    const w = GUIDE.w;
    this.g = scene.add.graphics().setDepth(20);
    this.title = scene.add
      .text(x + 34, y + 30, t('side.title').toUpperCase(), { fontFamily: FONT_NUM, fontStyle: '800', fontSize: '15px', color: INK.dim, letterSpacing: 1.5 })
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.threat = scene.add
      .text(x + w - 34, y + 30, '', { fontFamily: FONT, fontStyle: '600', fontSize: '18px', color: INK.dim })
      .setOrigin(1, 0.5)
      .setDepth(21);
    const colW = (w - 68) / 4;
    ROWS.forEach((r, i) => {
      const cx = x + 34 + colW * i;
      this.labels.set(r, scene.add.text(cx, y + 64, t(`side.${r}`), { fontFamily: FONT, fontStyle: '600', fontSize: '17px', color: INK.dim }).setDepth(21));
      this.values.set(r, scene.add.text(cx, y + 86, '', { fontFamily: FONT_NUM, fontStyle: '800', fontSize: '30px', color: INK.graphite }).setDepth(21));
    });
    for (let k = 0; k < 3; k++) {
      this.log.push(
        scene.add
          .text(x + 50, y + 172 + k * 34, '', { fontFamily: FONT, fontStyle: '500', fontSize: '18px', color: INK.graphite })
          .setDepth(21),
      );
    }
    this.all.push(this.g, this.title, this.threat, ...this.labels.values(), ...this.values.values(), ...this.log);
  }

  /** A toast or an announcement also stays here, newest on top. */
  note(text: string): void {
    const line = text.replace(/\s+/g, ' ').trim();
    if (!line || this.lines[0] === line) return;
    this.lines.unshift(line);
    this.lines.length = Math.min(this.lines.length, 3);
    this.sig = '';
  }

  setVisible(on: boolean): void {
    for (const o of this.all) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
  }

  update(): void {
    const w = this.world;
    const s = w.s;
    let open = 0;
    let caches = 0;
    let cachesOpen = 0;
    let surv = 0;
    let nestCells = 0;
    let survOpen = 0;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = w.cell(x, y);
        if (c.revealed) open++;
        if (c.content === 'cache') {
          caches++;
          if (c.revealed) cachesOpen++;
        }
        if (c.content === 'nest' || c.content === 'heavy_nest') nestCells++;
        if (c.content === 'survivor') {
          surv++;
          if (c.revealed) survOpen++;
        }
      }
    }
    // Like a mine counter: nests destroyed out of all nests on the map.
    const down = s.sites.filter((x) => x.kind !== 'boss_hatch' && x.destroyed).length;
    const total = s.width * s.height;
    const data: Record<Row, [number, number]> = {
      blocks: [open, total],
      nests: [down, nestCells],
      caches: [cachesOpen, caches],
      survivors: [survOpen, surv],
    };
    const lvl = w.threatLevel;
    const left = Math.ceil((1 - w.threatProgress) * w.cfg.threat.secondsPerLevel);
    const sig = JSON.stringify([data, lvl, left, this.lines]);
    if (sig === this.sig) return;
    this.sig = sig;

    const g = this.g;
    g.clear();
    plate(g, GUIDE.x, this.y, GUIDE.w, this.h, 22);
    const colW = (GUIDE.w - 68) / 4;
    ROWS.forEach((r, i) => {
      const [n, of] = data[r];
      // Blocks show a percentage; the rest show "found / on the map".
      this.values.get(r)!.setText(r === 'blocks' ? `${Math.round((n / Math.max(1, of)) * 100)}%` : `${n}/${of}`);
      const bx = GUIDE.x + 34 + colW * i;
      const bw = colW - 24;
      g.fillStyle(C.graphite, 0.1);
      g.fillRoundedRect(bx, this.y + 130, bw, 8, 4);
      const f = of ? n / of : 0;
      if (f > 0) {
        g.fillStyle(r === 'nests' ? C.coral : r === 'blocks' ? C.seam : C.teal, 1);
        g.fillRoundedRect(bx, this.y + 130, Math.max(8, bw * f), 8, 4);
      }
    });
    this.threat.setText(s.rules?.threatEnabled === false ? '' : t('side.threat_next', { level: lvl + 1, time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` }));
    // Divider, then the message log with a seam mark per line.
    g.fillStyle(C.graphite, 0.08);
    g.fillRect(GUIDE.x + 34, this.y + 154, GUIDE.w - 68, 2);
    this.log.forEach((tx, k) => {
      const line = this.lines[k] ?? '';
      // Cut at a word so the line fits the panel, with an ellipsis.
      const maxW = GUIDE.w - 84;
      tx.setText(line);
      for (let words = line.split(' '); tx.width > maxW && words.length > 1; ) {
        words = words.slice(0, -1);
        tx.setText(`${words.join(' ').replace(/[,:;.—-]+$/, '')}…`);
      }
      tx.setAlpha(1 - k * 0.28);
      if (line) {
        g.fillStyle(C.seam, 1 - k * 0.28);
        g.fillCircle(GUIDE.x + 38, this.y + 183 + k * 34, 4);
      }
    });
  }
}
