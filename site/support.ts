import { DONATE_DEFAULT, DONATE_MAX, DONATE_MIN, DONATE_PRESETS, yoomoneyUrl } from '../src/social/config';
import type { Lang } from './content';

/**
 * Download and donation blocks shared by the site and the /play frame.
 * The donation uses the game's own flow (src/social/config.ts: the same ЮMoney wallet, presets and payment link),
 * so the site and the game send money the same way.
 */

/** Current Android build. Switches to the release APK when the game is done (team/release.md). */
export const APK_URL = 'https://github.com/Tatonoma911/part-shift/releases/download/android-debug/part-shift-debug.apk';

const fmt = (n: number) => n.toLocaleString('ru-RU');

export function supportBlock(lang: Lang): string {
  const R = (ru: string, en: string) => (lang === 'ru' ? ru : en);
  return `<div class="support">
    <div class="slab support-card">
      <span class="caps">${R('ТЕЛЕФОН // ANDROID', 'PHONE // ANDROID')}</span>
      <h3>${R('Скачать для Android', 'Download for Android')}</h3>
      <p>${R('Файл APK: скачай и открой на телефоне. Если Android спросит, разреши установку из этого источника.', 'An APK file: download it and open it on your phone. If Android asks, allow installs from this source.')}</p>
      <a class="btn btn-primary btn-lg" href="${APK_URL}" rel="noopener">${R('Скачать APK', 'Download APK')}</a>
      <p class="dim">${R('Пока это тестовая сборка. iPhone позже, через App Store: Apple не разрешает ставить игры в обход магазина.', 'This is a test build for now. iPhone comes later through the App Store: Apple doesn’t allow installs outside its store.')}</p>
    </div>
    <div class="slab support-card">
      <span class="caps">${R('АВТОРУ // НА КОФЕ', 'TO THE AUTHOR // COFFEE')}</span>
      <h3>${R('Отправить автору донат', 'Send the author a tip')}</h3>
      <p>${R('Игра бесплатная и без платного контента. Если нравится, поддержи автора любой суммой.', 'The game is free with no paid content. If you like it, support the author with any amount.')}</p>
      <div class="sums">${DONATE_PRESETS.map((s) => `<button type="button" data-sum="${s}" aria-pressed="${s === DONATE_DEFAULT}">${fmt(s)} ₽</button>`).join('')}</div>
      <label class="sum-field"><span class="caps">${R('СВОЯ СУММА, ₽', 'YOUR AMOUNT, ₽')}</span><input type="number" inputmode="numeric" min="${DONATE_MIN}" max="${DONATE_MAX}" step="1" value="${DONATE_DEFAULT}" data-sum-input></label>
      <button type="button" class="btn btn-primary btn-lg" data-donate>${R('Отправить', 'Send')} ${fmt(DONATE_DEFAULT)} ₽</button>
      <p class="dim" data-donate-note>${R('Оплата картой через ЮMoney, деньги приходят автору напрямую.', 'Card payment through YooMoney; the money goes straight to the author.')}</p>
    </div>
  </div>`;
}

/** Wires every support block inside root (presets, free field, pay button). Safe to call after each render. */
export function wireSupport(root: HTMLElement, lang: Lang): void {
  const R = (ru: string, en: string) => (lang === 'ru' ? ru : en);
  root.querySelectorAll<HTMLElement>('.support').forEach((box) => {
    const input = box.querySelector<HTMLInputElement>('[data-sum-input]')!;
    const pay = box.querySelector<HTMLButtonElement>('[data-donate]')!;
    const note = box.querySelector<HTMLElement>('[data-donate-note]')!;
    const valid = (n: number) => Number.isFinite(n) && n >= DONATE_MIN && n <= DONATE_MAX;
    const sync = () => {
      const n = Math.round(Number(input.value));
      pay.disabled = !valid(n);
      pay.textContent = `${R('Отправить', 'Send')} ${valid(n) ? fmt(n) : '…'} ₽`;
      box.querySelectorAll<HTMLButtonElement>('[data-sum]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sum) === n)));
      note.textContent = valid(n)
        ? R('Оплата картой через ЮMoney, деньги приходят автору напрямую.', 'Card payment through YooMoney; the money goes straight to the author.')
        : R(`Сумма от ${DONATE_MIN} до ${fmt(DONATE_MAX)} ₽`, `Amount from ${DONATE_MIN} to ${fmt(DONATE_MAX)} ₽`);
    };
    box.querySelectorAll<HTMLButtonElement>('[data-sum]').forEach((b) =>
      b.addEventListener('click', () => {
        input.value = b.dataset.sum!;
        sync();
      }),
    );
    input.addEventListener('input', sync);
    pay.addEventListener('click', () => {
      const n = Math.round(Number(input.value));
      if (!valid(n)) return;
      window.open(yoomoneyUrl(n, R('Донат автору PART SHIFT', 'PART SHIFT tip')), '_blank', 'noopener');
      note.textContent = R('Спасибо! Оплата открылась в новой вкладке.', 'Thank you! Payment opened in a new tab.');
    });
    sync();
  });
}
