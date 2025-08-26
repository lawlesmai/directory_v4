import { test, expect } from '@playwright/test';

// Epic 1: Directory Browsing
// Epic 2: Authentication and User Management

test.describe('Cross-Epic User Journey', () => {
  test('Anonymous to Authenticated Directory Experience', async ({ page }) => {
    // Start as anonymous user
    await page.goto('/');
    
    // Validate directory browsing
    const directoryListings = await page.getByTestId('directory-listing');
    expect(await directoryListings.count()).toBeGreaterThan(0);

    // Initiate authentication
    const loginButton = await page.getByTestId('login-cta');
    await loginButton.click();

    // Perform authentication
    const emailInput = await page.getByTestId('email-input');
    const passwordInput = await page.getByTestId('password-input');
    const submitButton = await page.getByTestId('login-submit');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('SecurePassword123!');
    await submitButton.click();

    // Validate authenticated directory experience
    const personalizedListings = await page.getByTestId('personalized-listing');
    expect(await personalizedListings.count()).toBeGreaterThan(0);

    // Check user profile integration
    const userProfileButton = await page.getByTestId('user-profile-button');
    await userProfileButton.click();

    const profileDetails = await page.getByTestId('profile-details');
    expect(await profileDetails.isVisible()).toBeTruthy();
  });

  test('Business Owner Authentication and Management Flow', async ({ page }) => {
    // Direct business owner authentication
    await page.goto('/business/login');

    const businessEmailInput = await page.getByTestId('business-email-input');
    const businessPasswordInput = await page.getByTestId('business-password-input');
    const businessLoginButton = await page.getByTestId('business-login-submit');

    await businessEmailInput.fill('owner@businessexample.com');
    await businessPasswordInput.fill('BusinessSecure456!');
    await businessLoginButton.click();

    // Validate business dashboard access
    const businessDashboard = await page.getByTestId('business-dashboard');
    expect(await businessDashboard.isVisible()).toBeTruthy();

    // Test business profile management
    const editProfileButton = await page.getByTestId('edit-profile-button');
    await editProfileButton.click();

    const businessNameInput = await page.getByTestId('business-name-input');
    await businessNameInput.fill('Updated Business Name');

    const saveProfileButton = await page.getByTestId('save-profile-button');
    await saveProfileButton.click();

    // Validate profile update
    const updatedBusinessName = await page.getByTestId('business-name-display');
    expect(await updatedBusinessName.textContent()).toBe('Updated Business Name');
  });
});
