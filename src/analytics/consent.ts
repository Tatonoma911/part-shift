import { t } from '../i18n';
import type { Analytics } from './analytics';

const STYLE = `
.ps-consent-shade{position:fixed;inset:0;background:#0a1218;opacity:0;z-index:2147482999;transition:opacity .25s ease}
.ps-consent-shade.on{opacity:.55}
.ps-consent{position:fixed;left:50%;top:50%;transform:translate(-50%,calc(-50% + 24px));opacity:0;z-index:2147483000;
  width:min(440px,calc(100vw - 32px));box-sizing:border-box;padding:16px 16px 14px 20px;background:#F4F7F7;color:#10171C;
  border-radius:16px;box-shadow:0 10px 32px #10171c40;border-left:6px solid #007E89;font:500 14px/1.4 "Golos Text",system-ui,sans-serif;
  transition:transform .25s ease,opacity .25s ease}
.ps-consent.on{transform:translate(-50%,-50%);opacity:1}
.ps-consent b{display:block;font:800 12px/1 Unbounded,"Golos Text",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#007E89;margin-bottom:8px}
.ps-consent p{margin:0 0 12px}
.ps-consent .row{display:flex;gap:8px;justify-content:flex-end}
.ps-consent button{font:700 14px/1 "Golos Text",system-ui,sans-serif;border:0;border-radius:10px;padding:11px 16px;cursor:pointer}
.ps-consent .yes{background:#007E89;color:#fff}
.ps-consent .no{background:#10171c14;color:#10171C}
`;

/**
 * A modal card over a dimmed screen, once per device, after the first finished shift (UI_SPEC §6.1, AR-09):
 * may the game send anonymous play statistics? Until it is answered nothing is sent. Settings has the same switch.
 */
export function askConsent(a: Analytics): void {
  if (!a.shouldAsk || document.querySelector('.ps-consent')) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  const box = document.createElement('div');
  box.className = 'ps-consent';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', t('analytics.consent.title'));
  const title = document.createElement('b');
  title.textContent = t('analytics.consent.title');
  const text = document.createElement('p');
  text.textContent = t('analytics.consent.text');
  const row = document.createElement('div');
  row.className = 'row';
  const no = document.createElement('button');
  no.className = 'no';
  no.textContent = t('analytics.consent.no');
  const yes = document.createElement('button');
  yes.className = 'yes';
  yes.textContent = t('analytics.consent.yes');
  row.append(no, yes);
  box.append(title, text, row);
  const shade = document.createElement('div');
  shade.className = 'ps-consent-shade';
  shade.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.head.append(style);
  document.body.append(shade, box);
  requestAnimationFrame(() => requestAnimationFrame(() => [box, shade].forEach((el) => el.classList.add('on'))));
  const answer = (granted: boolean) => (e: Event) => {
    e.stopPropagation();
    a.setConsent(granted);
    box.classList.remove('on');
    shade.classList.remove('on');
    setTimeout(() => {
      box.remove();
      shade.remove();
      style.remove();
    }, 300);
  };
  // Taps on the card must not reach the game canvas under it.
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  no.addEventListener('click', answer(false));
  yes.addEventListener('click', answer(true));
}
