/**
 * Where the money and the links go. Антон fills these in; empty values hide that option.
 * Docs: docs/SOCIAL.md.
 */

/** Public link to the game; share texts and challenge links point here. */
export const GAME_URL = 'https://tatonoma911.github.io/part-shift/play/';

/** Author's ЮMoney wallet number (starts with 4100). Not a secret: it only lets people send money. */
export const YOOMONEY_WALLET: string = '';

/** Ruble presets on the donation sheet; the free field accepts any amount from MIN to MAX. */
export const DONATE_PRESETS = [50, 100, 300, 500, 1000];
export const DONATE_DEFAULT = 300;
export const DONATE_MIN = 10;
export const DONATE_MAX = 100000;

/** Other ways to support, shown under the ruble form when set. */
export const EXTRA_LINKS: { id: 'tribute' | 'boosty'; url: string }[] = [];

/** Crypto addresses for players abroad (copy button). */
export const CRYPTO: { id: string; label: string; address: string }[] = [];

/** ЮMoney transfer form (https://yoomoney.ru/docs/payment-buttons/using-api/forms): card payment with the amount filled in. */
export function yoomoneyUrl(sum: number, comment: string): string {
  const q = new URLSearchParams({
    receiver: YOOMONEY_WALLET,
    'quickpay-form': 'button',
    paymentType: 'AC',
    sum: String(sum),
    targets: comment,
    label: 'partshift-donate',
  });
  return `https://yoomoney.ru/quickpay/confirm?${q}`;
}

export const donateReady = (): boolean => YOOMONEY_WALLET !== '' || EXTRA_LINKS.length > 0 || CRYPTO.length > 0;
