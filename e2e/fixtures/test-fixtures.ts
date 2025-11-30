import { test as base, Page } from '@playwright/test';

// Test user credentials (use test accounts)
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

// Page object helpers
export class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth');
  }

  async fillEmail(email: string) {
    await this.page.getByLabel(/email/i).fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByLabel(/password/i).fill(password);
  }

  async clickSignIn() {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async clickSignUp() {
    await this.page.getByRole('button', { name: /sign up/i }).click();
  }

  async switchToSignUp() {
    await this.page.getByText(/don't have an account/i).click();
  }

  async switchToSignIn() {
    await this.page.getByText(/already have an account/i).click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  async signup(email: string, password: string) {
    await this.switchToSignUp();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignUp();
  }
}

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/rep');
  }

  async waitForLoad() {
    await this.page.waitForSelector('h1');
  }

  async getWelcomeText() {
    return this.page.locator('h1').textContent();
  }

  async fillTranscript(text: string) {
    await this.page.getByLabel(/transcript/i).fill(text);
  }

  async fillAccountName(name: string) {
    await this.page.getByPlaceholder(/select or type account/i).fill(name);
  }

  async fillStakeholder(name: string) {
    await this.page.getByPlaceholder(/who was on the call/i).fill(name);
  }

  async fillSalesforceLink(url: string) {
    await this.page.getByLabel(/salesforce/i).fill(url);
  }

  async submitCall() {
    await this.page.getByRole('button', { name: /analyze call/i }).click();
  }
}

// Extended test with fixtures
export const test = base.extend<{
  authPage: AuthPage;
  dashboardPage: DashboardPage;
}>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from '@playwright/test';
