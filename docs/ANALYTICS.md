# Analytics

Anonymous product analytics: where new players drop off between the intro comic, the tutorial and the first match, whether they come back, and how long a shift lasts.

## Choice: Firebase Analytics (Google Analytics 4)

- Free with no event limit, and the same Firebase project as accounts (docs/ACCOUNTS.md), so one console for everything.
- GA4 has the reports we need out of the box: funnel exploration, retention by cohort (day 1 / 7 / 30), path exploration, and averages of any event parameter.
- Works in the browser and inside the Android app's WebView; a native Capacitor plugin can replace it later without touching the game code.

The game code only talks to `src/analytics/analytics.ts` (`analytics.track(name, params)`), so the provider can be swapped (PostHog, Umami) by writing another `Sink` in `src/analytics/firebase.ts`.

## Privacy

- **Nothing is sent before the player agrees.** A small card asks once per device, after the intro comic (or on the menu when the comic was already seen). Settings has a «Статистика» switch.
- Before the answer, events wait in memory (at most 60). "Yes" sends them, "No" drops them. Do Not Track or Global Privacy Control in the browser counts as a permanent "No" and the card never shows.
- The Firebase Analytics script is downloaded only after "Yes". No user id, no name or email, Google signals and ad personalization off, no automatic page views.
- The answer lives in `partshift-analytics.consent` (not `partshift.`, so accounts do not sync it: consent is per device).
- The claude.ai Artifact preview and the learning preview are built without analytics (`__ANALYTICS__` in vite.config.ts).

## Events

| Event | When | Parameters |
| --- | --- | --- |
| `game_boot` | every launch | `first_launch`, `launch_count`, `days_since_first`, `platform` (web/android), `layout` (portrait/landscape), `lang` |
| `intro_start` | the comic starts | `auto` (1 on first launch, 0 from the «История мира» button) |
| `intro_end` | the comic closes | `auto`, `skipped`, `seconds` |
| `menu_view` | main menu shown | `tutorial_done`, `has_run` |
| `tutorial_begin` | tutorial opens | |
| `tutorial_step` | each tutorial card | `step` (0-based), `step_id`, `seconds` (game time) |
| `tutorial_skip` | «Пропустить» | match parameters below |
| `tutorial_complete` | last card reached | `seconds` |
| `tutorial_leave` / `match_leave` | back to the menu mid-run | match parameters |
| `tutorial_end` / `match_end` | victory, defeat or restart | `result` + match parameters |
| `match_start` | free play opens | `slot`, `continued`, `assist`, `seconds` |
| `app_hide` | tab or app goes to the background | `screen` (boot/intro/menu/tutorial/match) + that screen's details |

Match parameters: `mode` (tutorial/free), `seconds` (game time), `started` (Command Center placed), `threat`, `nests`, `caches`, `buildings`, `defenders`, and `step` in the tutorial.

`app_hide` is the quit point: a player's last `app_hide` before they never come back says where they left (the intro, tutorial step 5, minute 3 of a match).

Debug: open the game with `?analytics=debug` to print every event in the browser console (nothing is sent unless the player agreed and the config is set).

## Reports to build in GA4

1. **Funnel** (Explore → Funnel exploration, open funnel): `game_boot` with `first_launch = 1` → `intro_end` → `tutorial_begin` → `tutorial_step` step 3 → `tutorial_complete` → `match_start` → `match_end`.
2. **Tutorial drop-off**: `tutorial_step` count broken down by `step`.
3. **Retention**: Reports → Retention (cohorts by first visit), plus `days_since_first` on `game_boot`.
4. **Match length**: `match_end` average of `seconds`, broken down by `result`. Register `seconds`, `step`, `result`, `screen`, `threat` as custom dimensions/metrics (Admin → Custom definitions) so they show in reports.
5. **Where players quit**: `app_hide` broken down by `screen` and `step`.

## Setup (once)

1. In the Firebase project for accounts: Project settings → Integrations → Google Analytics → Enable (create a GA account if asked; "Default Account for Firebase" is fine). Data location: any.
2. Project settings → General → Your apps → the web app: copy the `firebaseConfig`; it now has `measurementId: "G-…"`.
3. Paste it into `src/analytics/config.ts` (same object as `src/account/config.ts`).
4. In Google Analytics (analytics.google.com) → Admin → Data collection: leave Google signals off. Admin → Data retention: 14 months.

## Adding an event

```ts
import { analytics } from '../analytics';
analytics.track('building_built', { type: 'reactor', seconds: world.s.time });
```

Names: lowercase snake_case up to 40 characters; parameters: up to 25, text up to 100 characters (clean() enforces this). Add the event to the table above.
