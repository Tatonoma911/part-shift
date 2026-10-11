/** In-game cursor overlay: bracket crosshair on desktop, touch ring on mobile/stylus. */

const SVG_CURSOR =
  "url(\"data:image/svg+xml," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>" +
  "<path stroke='%2357d8f2' stroke-width='1.5' fill='none' d='M4 8 L4 4 L8 4'/>" +
  "<path stroke='%2357d8f2' stroke-width='1.5' fill='none' d='M16 4 L20 4 L20 8'/>" +
  "<path stroke='%2357d8f2' stroke-width='1.5' fill='none' d='M4 16 L4 20 L8 20'/>" +
  "<path stroke='%2357d8f2' stroke-width='1.5' fill='none' d='M16 20 L20 20 L20 16'/>" +
  "<circle cx='12' cy='12' r='1.5' fill='%2357d8f2'/>" +
  "</svg>\") 12 12, crosshair";

export function initCursor(container: HTMLElement): void {
  container.style.cursor = SVG_CURSOR;

  // Touch / stylus ring — appears at each active touch point
  const pool: HTMLDivElement[] = [];
  const active = new Map<number, HTMLDivElement>();

  const getRing = (): HTMLDivElement => {
    const el = pool.pop() ?? (() => {
      const d = document.createElement('div');
      d.style.cssText =
        'position:fixed;pointer-events:none;z-index:9999;' +
        'width:36px;height:36px;border-radius:50%;' +
        'border:2px solid #57d8f2;box-shadow:0 0 10px #57d8f260;' +
        'transform:translate(-50%,-50%);display:none;';
      document.body.appendChild(d);
      return d;
    })();
    return el;
  };

  const show = (id: number, x: number, y: number) => {
    let el = active.get(id);
    if (!el) { el = getRing(); active.set(id, el); }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.display = 'block';
  };

  const hide = (id: number) => {
    const el = active.get(id);
    if (!el) return;
    el.style.display = 'none';
    active.delete(id);
    pool.push(el);
  };

  container.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) show(t.identifier, t.clientX, t.clientY);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) show(t.identifier, t.clientX, t.clientY);
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) hide(t.identifier);
  }, { passive: true });

  container.addEventListener('touchcancel', (e) => {
    for (const t of e.changedTouches) hide(t.identifier);
  }, { passive: true });
}
