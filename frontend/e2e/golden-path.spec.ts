import { test, expect } from '@playwright/test';

/**
 * The whole interview-demo flow in one spec: register a new user, sign in,
 * create an account, post a transaction with an idempotency key, watch it land
 * in the table, watch the analytics page pick it up via the Kafka pipeline,
 * sign out.
 *
 * Prereq: the full backend stack must be running on :8080 (gateway + 4 services
 * + infra). Vite dev server is auto-started by playwright.config.ts.
 */

const PASSWORD = 'password123';
const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.com`;

test.describe('LedgerLite — golden path', () => {
  test.setTimeout(60_000);

  test('register → login → account → transaction → analytics → logout', async ({ page }) => {
    const email = uniqueEmail();

    // ─── Register ───────────────────────────────────────────────────────────
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/account created/i)).toBeVisible();

    // ─── Login ──────────────────────────────────────────────────────────────
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(email)).toBeVisible();

    // ─── Create account ─────────────────────────────────────────────────────
    await page.getByRole('link', { name: 'Accounts' }).click();
    // Empty state CTA on first visit, otherwise the header button
    await page.getByRole('button', { name: /create your first account|new account/i })
      .first()
      .click();
    const newAccountDialog = page.getByRole('dialog');
    await newAccountDialog.getByRole('textbox', { name: /account name/i }).fill('Demo Checking');
    await newAccountDialog.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('heading', { name: 'Demo Checking' })).toBeVisible();

    // ─── Post transaction ───────────────────────────────────────────────────
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('button', { name: 'New Transaction' }).click();
    const txDialog = page.getByRole('dialog');

    // Account select
    await txDialog.getByRole('combobox', { name: 'Account' }).click();
    await page.getByRole('option', { name: /demo checking/i }).click();

    // Amount as a negative debit string — the BigDecimal-as-string contract
    // means the form submits "-50.00" verbatim. -50 (without trailing zeros)
    // also passes the schema; the explicit ".00" mirrors how a user would type.
    await txDialog.getByRole('textbox', { name: 'Amount' }).fill('-50.00');

    // Category select
    await txDialog.getByRole('combobox', { name: 'Category' }).click();
    await page.getByRole('option', { name: /food & dining/i }).click();

    await txDialog.getByRole('textbox', { name: /description/i }).fill('Lunch e2e');
    await txDialog.getByRole('button', { name: /submit/i }).click();

    // Radix's Toast renders title + accessible-name in nested nodes; first()
    // collapses the strict-mode duplicate match to the visible title.
    await expect(page.getByText(/transaction created/i).first()).toBeVisible();

    // Filter by the account to make the table populate (transactions page uses
    // an explicit account filter so the empty state is "select an account…").
    await page.getByRole('combobox', { name: 'Account' }).click();
    await page.getByRole('option', { name: 'Demo Checking' }).click();
    await expect(page.getByRole('cell', { name: 'Lunch e2e' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '-$50.00' })).toBeVisible();

    // ─── Analytics — eventual consistency via Kafka ─────────────────────────
    await page.getByRole('link', { name: 'Analytics' }).click();

    // The transaction-service publishes to Kafka after the DB write; analytics-
    // service consumes, upserts, then the GET we issue here returns the
    // aggregated row. This is the actual proof of the event-driven pipeline.
    // Poll-and-reload because TanStack Query has a 30s staleTime — we don't
    // want a cached empty result on the second click.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(/total spending:\s*\$50\.00/i)).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    // ─── Logout ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
