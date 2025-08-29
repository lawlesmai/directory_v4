import { Page, Locator } from '@playwright/test';

export class PaymentPage {
  readonly page: Page;
  readonly cardNumberInput: Locator;
  readonly cardExpiryInput: Locator;
  readonly cardCVCInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cardNumberInput = page.locator('input[name="cardNumber"]');
    this.cardExpiryInput = page.locator('input[name="cardExpiry"]');
    this.cardCVCInput = page.locator('input[name="cardCVC"]');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async navigateToCheckout() {
    await this.page.goto('/checkout');
  }

  async fillPaymentDetails(cardNumber: string, expiry: string, cvc: string) {
    await this.cardNumberInput.fill(cardNumber);
    await this.cardExpiryInput.fill(expiry);
    await this.cardCVCInput.fill(cvc);
  }

  async submitPayment() {
    await this.submitButton.click();
  }

  async isPaymentSuccessful() {
    return this.page.locator('.payment-success').isVisible();
  }
}
