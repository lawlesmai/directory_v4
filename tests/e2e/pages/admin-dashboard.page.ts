import { Page, Locator } from '@playwright/test';

export class AdminDashboardPage {
  private page: Page;
  private dashboardContainer: Locator;
  private navigationItems: Locator;
  private sessionsTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dashboardContainer = page.getByTestId('admin-dashboard');
    this.navigationItems = page.getByTestId('nav-item');
    this.sessionsTable = page.getByTestId('active-sessions-table');
  }

  async isVisible(): Promise<boolean> {
    return this.dashboardContainer.isVisible();
  }

  async isResponsive(): Promise<boolean> {
    const viewportSize = this.page.viewportSize();
    const dashboardWidth = await this.dashboardContainer.evaluate(el => el.clientWidth);
    return !!(viewportSize && dashboardWidth <= viewportSize.width);
  }

  async getNavigationItems() {
    const items = await this.navigationItems.all();
    return Promise.all(items.map(async item => ({
      ariaLabel: await item.getAttribute('aria-label'),
      isKeyboardAccessible: await item.evaluate(el => 
        el.getAttribute('tabindex') !== null
      )
    })));
  }

  async hasFeatureAccess(feature: string): Promise<boolean> {
    const featureTestId = 'feature-' + feature.toLowerCase().replace(' ', '-');
    const featureLocator = this.page.getByTestId(featureTestId);
    return featureLocator.isVisible();
  }

  async getActiveSessions() {
    const rows = await this.sessionsTable.getByRole('row').all();
    return Promise.all(rows.slice(1).map(async row => ({
      id: await row.getAttribute('data-session-id'),
      ipAddress: await row.getByTestId('session-ip').textContent(),
      loginTime: await row.getByTestId('session-login-time').textContent(),
      browser: await row.getByTestId('session-browser').textContent()
    })));
  }

  async terminateSession(sessionId: string) {
    const terminateButton = this.page.getByTestId('terminate-session-' + sessionId);
    await terminateButton.click();
  }
}
