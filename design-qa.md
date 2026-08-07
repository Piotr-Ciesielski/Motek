# Motek — staging design QA

Date: 2026-08-07

## Scope

Staging implementation of the approved light/dark artwork treatment for Magazyn, Dopasowanie, Katalog and Konto, plus the icon-only theme control.

## Automated checks

- `node --test --test-isolation=none test/design-regression.test.js test/design-layout.test.js test/theme-policy.test.js test/catalog-controller.test.js` — passed, 31/31.
- `node --check app.js` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed.

## Visual check

Final result: blocked.

The local server process owns port 3001, but the endpoint is unavailable to the current shell and the connected browser blocks `localhost` and `127.0.0.1`. Therefore the four views and the 1440/1024/768/390 viewport matrix were not visually verified in-browser in this session.

## Next verification

Open the staging server in a local browser and check both themes at 1440, 1024, 768 and 390 CSS px. Confirm navigation, theme persistence, image switching, inventory actions, matching states, catalog filters/pagination and auth states against the PNG references in `Designs/`.
