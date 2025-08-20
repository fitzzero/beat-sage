// Test authentication utilities for Playwright and integration tests

export type TestCredentials = {
  email: string;
  password: string;
  name?: string;
};

// Predefined test accounts for consistent testing
export const TEST_ACCOUNTS = {
  user1: {
    email: "test@example.com",
    password: "testpassword123",
    name: "Test User",
  },
  user2: {
    email: "test2@example.com",
    password: "testpassword123",
    name: "Test User 2",
  },
  admin: {
    email: "admin@example.com",
    password: "adminpassword123",
    name: "Admin User",
  },
} as const;

// Helper to get test credentials
export function getTestCredentials(
  userType: keyof typeof TEST_ACCOUNTS = "user1"
): TestCredentials {
  return TEST_ACCOUNTS[userType];
}

// Playwright page interface for better type safety
type PlaywrightPage = {
  goto: (url: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  click: (selector: string) => Promise<void>;
  waitForURL: (url: string) => Promise<void>;
  waitForText: (text: string) => Promise<void>;
  waitForSelector: (selector: string) => Promise<void>;
};

// Playwright-specific auth helpers
export const PlaywrightAuthHelpers = {
  // Sign in via email/password form
  async signInWithCredentials(
    page: PlaywrightPage,
    credentials?: TestCredentials
  ) {
    const creds = credentials || getTestCredentials();

    // Navigate to sign-in page
    await page.goto("/auth/signin");

    // Fill in credentials
    await page.fill('input[type="email"]', creds.email);
    await page.fill('input[type="password"]', creds.password);

    // Click sign in button (not create account)
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to home page
    await page.waitForURL("/");

    // Verify we're signed in
    await page.waitForText(`Welcome, ${creds.name || creds.email}`);
  },

  // Create account via email/password form
  async createAccountWithCredentials(
    page: PlaywrightPage,
    credentials?: TestCredentials
  ) {
    const creds = credentials || getTestCredentials();

    // Navigate to sign-in page
    await page.goto("/auth/signin");

    // Fill in credentials
    await page.fill('input[type="email"]', creds.email);
    await page.fill('input[type="password"]', creds.password);

    // Click create account button
    await page.click('button:has-text("Create Account")');

    // Wait for redirect to home page
    await page.waitForURL("/");

    // Verify we're signed in
    await page.waitForText(`Welcome, ${creds.name || creds.email}`);
  },

  // Check if socket is connected
  async verifySocketConnection(page: PlaywrightPage) {
    // Wait for socket connection status
    await page.waitForText("Connected to server");

    // Verify we have a socket ID
    await page.waitForSelector("text=Socket ID:");
  },

  // Sign out
  async signOut(page: PlaywrightPage) {
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL("/auth/signin");
  },
};
