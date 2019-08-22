import { Page } from 'puppeteer';

export default class Util {
  public static isNotOverdue(dateTime: number): boolean {
    return new Date().getTime() <= dateTime;
  }

  public static async goTo(page: Page) {
    await page.goto('https://juejin.im');
  }
}