import { test, expect, Page } from "@playwright/test";
import { totp } from "./totp";

// Full Phase-4 happy path against a running compose stack (make up + seed):
// register → MFA enroll + step-up → AI-assisted listing → escrow buy →
// ship → confirm → wallet reconciles. The seller is a fresh random account;
// the buyer is seeded bob (¥100,000, MFA off).

const uniq = Date.now();
const seller = { email: `seller-${uniq}@vault.test`, handle: `s${uniq}`, password: "e2e-pass-123" };
const bob = { email: "bob@vault.test", password: "password123!" };
const PRICE = 5000;

// The OIDC redirect chain ends on either the consent screen (first authorization
// for this user+client) or a signed-in page. Race the two so we resolve as soon
// as either lands; click Allow if it's the consent screen.
async function resolveConsent(page: Page) {
  const allow = page.getByRole("button", { name: "Allow" });
  const signedIn = page.getByRole("link", { name: "Sign out" });
  await Promise.race([
    allow.waitFor({ state: "visible", timeout: 20000 }).catch(() => {}),
    signedIn.waitFor({ state: "visible", timeout: 20000 }).catch(() => {}),
  ]);
  if (await allow.isVisible().catch(() => false)) {
    await allow.click();
    await signedIn.waitFor({ state: "visible", timeout: 20000 });
  }
}

async function signOut(page: Page) {
  await page.goto("/auth/logout");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}

// password login; when totpSecret is given, completes the MFA step-up.
async function login(page: Page, email: string, password: string, totpSecret?: string) {
  await page.goto("/auth/start");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (totpSecret) {
    await expect(page.getByText(/6-digit code from your authenticator/)).toBeVisible();
    await page.getByPlaceholder("123456").fill(totp(totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await resolveConsent(page);
  await expect(page.getByRole("link", { name: "Sign out" })).toBeVisible();
}

async function balance(page: Page): Promise<number> {
  await page.goto("/wallet");
  const text = await page.locator(".money").first().innerText(); // "¥95,000"
  return Number(text.replace(/[^0-9]/g, ""));
}

async function openOrder(page: Page, role: "buyer" | "seller") {
  await page.goto(`/orders?role=${role}`);
  await page.getByRole("link").filter({ hasText: "Sony WH-1000XM4" }).first().click();
}

test("register, MFA, AI listing, escrow buy, wallet reconcile", async ({ page }) => {
  // 1. Register the seller (auth/start bounces through the IdP to the login screen).
  await page.goto("/auth/start?next=/sell");
  await page.getByRole("link", { name: "Register" }).click();
  // wait for the client-side nav to the register page before filling, or the
  // email fill races onto the login page's email input and gets wiped
  await expect(page.getByRole("heading", { name: /Create your Vault ID/ })).toBeVisible();
  await page.getByPlaceholder("Email").fill(seller.email);
  await page.getByPlaceholder("Handle (a-z, 0-9, _)").fill(seller.handle);
  await page.getByPlaceholder("Password (8+ characters)").fill(seller.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await resolveConsent(page);
  await expect(page.getByRole("heading", { name: "Sell an item" })).toBeVisible();

  // 2. AI-assisted listing: hint → Suggest fills the fields → override the price.
  await page.getByPlaceholder("Title").fill("Sony WH-1000XM4 headphones");
  await page.getByRole("button", { name: /Suggest/ }).click();
  await expect(page.getByText(/Comparable items sold for/)).toBeVisible();
  await page.getByPlaceholder("Price (yen)").fill(String(PRICE));
  await page.getByRole("button", { name: "List it" }).click();
  await expect(page).toHaveURL(/\/listing\//);
  const listingURL = page.url();

  // 3. MFA enroll — read the secret off the page, compute the code, confirm.
  await page.goto("/auth/mfa");
  await page.getByRole("button", { name: "Enable two-factor authentication" }).click();
  const secret = (await page.locator("code").first().innerText()).trim();
  await page.getByPlaceholder("123456").fill(totp(secret));
  await page.getByRole("button", { name: "Confirm & enable" }).click();
  await expect(page.getByText("Two-factor authentication is now on.")).toBeVisible();

  // 4. Sign out, sign back in — the TOTP step-up must gate the login.
  await signOut(page);
  await login(page, seller.email, seller.password, secret);

  // 5. Buy as bob (seeded, funded). Snapshot his balance first.
  await signOut(page);
  await login(page, bob.email, bob.password);
  const bobBefore = await balance(page);

  await page.goto(listingURL);
  await page.getByRole("button", { name: /Buy/ }).click();
  await expect(page).toHaveURL(/\/checkout\//);
  await page.getByRole("button", { name: /Pay/ }).click();
  await expect(page.locator("span", { hasText: /^funded$/ })).toBeVisible();

  // 6. Seller ships.
  await signOut(page);
  await login(page, seller.email, seller.password, secret);
  await openOrder(page, "seller");
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(page.locator("span", { hasText: /^shipped$/ })).toBeVisible();

  // 7. Bob confirms receipt → escrow releases.
  await signOut(page);
  await login(page, bob.email, bob.password);
  await openOrder(page, "buyer");
  await page.getByRole("button", { name: /Confirm receipt/ }).click();
  await expect(page.locator("span", { hasText: /^completed$/ })).toBeVisible();

  // 8. Wallets reconcile: bob −PRICE, seller +90%.
  expect(await balance(page)).toBe(bobBefore - PRICE);

  await signOut(page);
  await login(page, seller.email, seller.password, secret);
  expect(await balance(page)).toBe(PRICE - PRICE / 10); // 90% after the 10% platform fee
});
