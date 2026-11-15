// End-to-end verification of the TrojanLink AI demo journey in a real browser.
//
// Prerequisites (see README "Frontend verification"):
//   1. backend running on a FRESHLY SEEDED database:  cd backend && python -m app.seed --reset && uvicorn app.main:app
//   2. frontend running:                              cd frontend && npm run dev
//   3. npm install && npx playwright install chromium
// Run:  DEMO_PASSWORD=<DEMO_USER_PASSWORD> npm run e2e
//
// Env: BASE_URL (default http://localhost:5173), DEMO_PASSWORD (required),
//      CHROME_PATH (optional: use an installed Chrome), SCREENSHOTS (optional output dir), HEADED=1.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '') + '/';
const PASSWORD = process.env.DEMO_PASSWORD;
const SHOTS = process.env.SCREENSHOTS;
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD to the backend DEMO_USER_PASSWORD.');
  process.exit(2);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// A tiny valid PDF to upload as a resume (fictional).
const resumePath = join(tmpdir(), 'trojanlink-e2e-resume.pdf');
writeFileSync(
  resumePath,
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

const results = [];
let failed = false;
async function step(name, fn) {
  try {
    const note = await fn();
    results.push({ step: name, ok: true, note: note ?? '' });
    console.log(`  ok   ${name}${note ? `  (${note})` : ''}`);
  } catch (e) {
    failed = true;
    results.push({ step: name, ok: false, note: String(e.message || e).split('\n')[0] });
    console.log(`  FAIL ${name}: ${String(e.message || e).split('\n')[0]}`);
    throw e;
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({
  headless: !process.env.HEADED,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {}),
});
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.replace(/\/$/, '') });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_NAME|ERR_INTERNET/.test(m.text()) && pageErrors.push(m.text()));

const shot = async (name, fullPage = false) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage });
const nav = (name) => page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: new RegExp(`^${name}`) });
/** Waits (up to 5 s) until the Messages nav item shows the given unread count. */
const waitForBadge = (n) =>
  page.waitForFunction(
    (count) => [...document.querySelectorAll('nav[aria-label="Main"] a')].some((a) => new RegExp(`^Messages\\s*${count}$`).test(a.innerText.trim())),
    n,
    { timeout: 5000 },
  );
const toast = (text) => page.getByRole('status').filter({ hasText: text }).first().waitFor();

async function loginAs(name) {
  await page.goto(`${BASE}#/login`);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('heading', { name: /^Hi / }).waitFor();
}
async function logout() {
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.getByRole('heading', { name: 'Log in' }).waitFor();
}

/** Accessibility smoke checks for the current page. */
async function a11yCheck() {
  return page.evaluate(() => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const name = (el) => {
      const labelled = el.getAttribute('aria-labelledby');
      const byId = labelled ? labelled.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
      const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
      return (el.getAttribute('aria-label') || byId || label || el.closest('label')?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
    };
    const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(visible);
    const unnamed = controls.filter((el) => !name(el)).map((el) => el.outerHTML.slice(0, 80));
    const h1 = [...document.querySelectorAll('h1')].filter(visible).length;
    const imgsNoAlt = [...document.querySelectorAll('img:not([alt])')].length;
    return { unnamed, h1, imgsNoAlt, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}
async function assertA11y(label) {
  const r = await a11yCheck();
  expect(r.unnamed.length === 0, `${label}: controls without accessible names: ${r.unnamed.join(' | ')}`);
  expect(r.h1 === 1, `${label}: expected exactly one visible h1, found ${r.h1}`);
  expect(r.imgsNoAlt === 0, `${label}: images without alt`);
  return r;
}

const PAGES = ['#/dashboard', '#/discover', '#/discover?tab=directory', '#/connections', '#/connections?tab=requests',
  '#/connections?tab=students', '#/coffee-chats', '#/messages', '#/messages/7', '#/me', '#/profiles/7'];

try {
  console.log(`TrojanLink AI e2e against ${BASE}`);

  await step('Login page is accessible and offers fictional demo accounts', async () => {
    await page.goto(`${BASE}#/login`);
    await page.getByText('Try a demo account').waitFor();
    await assertA11y('login');
    await shot('01-login');
  });

  await step('Student logs in (Alex Chen)', async () => {
    await loginAs('Alex Chen');
    await waitForBadge(1).catch(() => expect(false, 'seeded unread message badge missing'));
    const navText = await page.getByRole('navigation', { name: 'Main' }).first().innerText();
    expect(!/Seminar|Jobs|Video/i.test(navText), 'excluded features appear in navigation');
    await shot('02-dashboard');
    return navText.replace(/\s*\n\s*/g, ' | ');
  });

  await step('Profile: edit career goals and experience', async () => {
    await nav('My Profile').click();
    await page.getByRole('heading', { name: 'My profile' }).waitFor();
    await page.getByRole('button', { name: '+ Software Engineering' }).first().click();
    await page.locator('#p-exp').fill('Research assistant on a course-recommendation project. Built a React study-group finder.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await toast('Profile saved');
  });

  await step('Profile: upload resume and set visibility', async () => {
    await page.locator('input[type=file]').setInputFiles(resumePath);
    await toast('Resume uploaded');
    await page.locator('#set-resume').selectOption('connections');
    await toast('Settings saved');
    await shot('03-profile', true);
  });

  await step('Discover: AI recommendations with explanation', async () => {
    await page.getByRole('link', { name: 'See alumni recommended for you' }).click();
    await page.getByText('Things you could ask about').first().waitFor();
    const top = await page.locator('article').first().locator('a').first().textContent();
    expect(top === 'Sarah Kim', `top recommendation was ${top}`);
    await shot('04-recommendations');
    return `top match: ${top}`;
  });

  await step('Discover: alumni directory search and filters', async () => {
    await page.getByRole('tab', { name: 'Alumni directory' }).click();
    await page.locator('#f-company').fill('Brightline');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText(/^2 alumni$/).waitFor();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.locator('#f-degree').fill('M.S.');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText(/^2 alumni$/).waitFor();
    // keyboard: arrow keys move between tabs
    await page.getByRole('tab', { name: 'Alumni directory' }).focus();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('tab', { name: 'Recommended for you', selected: true }).waitFor();
    return 'company + degree filters; arrow-key tabs';
  });

  await step('Alumni profile + AI introduction + coffee chat request', async () => {
    await page.goto(`${BASE}#/profiles/7?compose=1`);
    await page.getByRole('heading', { name: /Introduce yourself/ }).waitFor();
    expect((await page.getByRole('button', { name: 'Message', exact: true }).count()) === 0, 'Message shown before trust');
    await page.getByRole('button', { name: 'Generate Introduction with AI' }).last().click();
    const draft = page.locator('#mg-draft');
    await draft.waitFor();
    const text = await draft.inputValue();
    expect(text.startsWith('Hi Sarah,'), 'unexpected draft');
    await draft.fill(text.replace('Thank you for your time!', 'Thank you so much for your time. Fight On!'));
    await page.getByRole('button', { name: 'Use in coffee chat request' }).click();
    expect((await page.locator('#cc-msg').inputValue()).includes('Fight On!'), 'edited message not carried into request');
    // focus stays inside the dialog
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus escaped the dialog');
    await page.getByRole('button', { name: 'Send request' }).click();
    await toast('Coffee chat request sent');
  });

  await step('Connections: accept incoming, withdraw outgoing, remove a connection', async () => {
    await nav('Connections').click();
    await page.getByRole('tab', { name: /Requests/ }).click();
    await page.getByRole('button', { name: 'Accept request from Mia Nguyen' }).click();
    await toast("You're now connected with Mia Nguyen");
    await page.getByRole('button', { name: 'Withdraw request to David Okafor' }).click();
    await toast('Request to David Okafor withdrawn');
    await page.getByRole('tab', { name: /My network/ }).click();
    await page.getByRole('button', { name: 'Remove Sofia Martinez from connections' }).click();
    await page.getByRole('dialog', { name: 'Remove Sofia Martinez?' }).waitFor();
    await shot('05-remove-confirm');
    await page.getByRole('button', { name: 'Remove connection' }).click();
    await toast('Removed Sofia Martinez');
    const network = await page.locator('main li').allInnerTexts();
    expect(network.some((t) => t.includes('Mia Nguyen')) && !network.some((t) => t.includes('Sofia Martinez')), 'network not updated');
  });

  await step('Privacy setting: hide from search', async () => {
    await nav('My Profile').click();
    await page.getByLabel(/Show me in search/).uncheck();
    await toast('Settings saved');
    await logout();
    await loginAs('Sarah Kim');
    await page.goto(`${BASE}#/connections?tab=students`);
    await page.getByRole('heading', { name: 'Connections' }).waitFor();
    await page.locator('main ul li').first().waitFor();
    const names = await page.locator('main ul li').allInnerTexts();
    expect(!names.some((t) => t.includes('Alex Chen')), 'hidden student still listed');
    await logout();
    await loginAs('Alex Chen');
    await nav('My Profile').click();
    await page.getByLabel(/Show me in search/).check();
    await toast('Settings saved');
    await logout();
  });

  await step('Alumna accepts the coffee chat and can view the resume', async () => {
    await loginAs('Sarah Kim');
    await nav('Coffee Chats').click();
    const item = page.locator('li', { hasText: 'Alex Chen' }).first();
    await item.getByRole('button', { name: 'Accept' }).click();
    await toast('Coffee chat confirmed');
    await page.goto(`${BASE}#/profiles/1`);
    await page.getByRole('heading', { name: 'Alex Chen' }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Resume \(PDF\)/ }).click();
    return `downloaded ${(await download).suggestedFilename()}`;
  });

  await step('Student sees the confirmed chat and messages the alumna', async () => {
    await logout();
    await loginAs('Alex Chen');
    await nav('Coffee Chats').click();
    await page.getByRole('tab', { name: /Confirmed/ }).click();
    const chat = page.locator('li', { hasText: 'Sarah Kim' });
    await chat.getByText('Confirmed').waitFor();
    await shot('06-confirmed');
    await chat.getByRole('link', { name: 'Message' }).click();
    await page.locator('#msg-input').fill('Thanks for accepting, Sarah! Would Zoom or a campus cafe work better?');
    await page.locator('#msg-input').press('Enter');
    await page.getByText('Would Zoom or a campus cafe').first().waitFor();
  });

  await step('Alumna replies; student sees reply with read receipt', async () => {
    await logout();
    await loginAs('Sarah Kim');
    await waitForBadge(1).catch(() => expect(false, 'unread badge missing for alumna'));
    await nav('Messages').click();
    await page.locator('a', { hasText: 'Alex Chen' }).first().click();
    await page.locator('#msg-input').fill('Zoom works great. Talk soon!');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Zoom works great').first().waitFor();
    await shot('07-messages');
    await logout();
    await loginAs('Alex Chen');
    await page.goto(`${BASE}#/messages/7`);
    await page.getByText('Zoom works great').first().waitFor();
    await page.getByText(', seen').first().waitFor();
  });

  await step('Excluded features are not reachable', async () => {
    await page.goto(`${BASE}#/seminars`);
    await page.getByRole('heading', { name: /^Hi / }).waitFor();
    return '#/seminars falls back to the dashboard';
  });

  await step('Keyboard: skip link moves focus to the main content', async () => {
    await page.goto(`${BASE}#/dashboard`);
    await page.reload(); // fresh page load: focus starts at the top of the document
    await page.getByRole('heading', { name: /^Hi / }).waitFor();
    await page.keyboard.press('Tab');
    expect((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Skip to content', 'skip link is not first');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.id === 'main'), 'skip link did not focus main');
  });

  await step('Accessibility sweep: names, one h1, no overflow (desktop)', async () => {
    for (const p of PAGES) {
      await page.goto(BASE + p);
      await page.locator('main h1').first().waitFor();
      await page.waitForTimeout(250);
      const r = await assertA11y(p);
      expect(r.overflow <= 0, `${p}: horizontal overflow ${r.overflow}px`);
    }
    return `${PAGES.length} pages`;
  });

  await step('Mobile sweep at 390px: no horizontal overflow, menu works', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of PAGES) {
      await page.goto(BASE + p);
      await page.locator('main h1').first().waitFor();
      await page.waitForTimeout(250);
      const r = await assertA11y(`${p} (mobile)`);
      expect(r.overflow <= 0, `${p} (mobile): horizontal overflow ${r.overflow}px`);
    }
    await page.goto(`${BASE}#/dashboard`);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('#mobile-menu').getByRole('link', { name: /^Messages/ }).click();
    await page.getByRole('heading', { name: 'Messages' }).waitFor();
    await page.goto(`${BASE}#/messages/7`);
    await page.locator('#msg-input').waitFor();
    await shot('08-mobile-messages');
    await page.goto(`${BASE}#/login`);
    return `${PAGES.length} pages`;
  });

  expect(pageErrors.length === 0, `browser errors: ${pageErrors.join(' | ')}`);
} catch {
  failed = true;
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} steps passed${pageErrors.length ? `; browser errors: ${pageErrors.length}` : ''}`);
  if (SHOTS) writeFileSync(join(SHOTS, 'results.json'), JSON.stringify({ base: BASE, results, pageErrors }, null, 2));
  process.exit(failed ? 1 : 0);
}
