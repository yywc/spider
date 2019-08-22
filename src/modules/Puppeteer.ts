import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import Config from '../common/Config';

export default class Puppeteer {

  public static async init(): Promise<[Page, Browser]> {
    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 20,
      executablePath: Config.chromePath,
    });
    const [page] = await browser.pages();
    await Promise.all([
      page.setJavaScriptEnabled(true),
      page.setViewport(Config.viewport),
    ]);
    return [page, browser];
  }
}
