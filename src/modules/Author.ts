import { Browser, ElementHandle, Page } from 'puppeteer';
import User from '../interfaces/User';
import Config from '../common/Config';
import * as fs from 'fs';

export default class Author {

  // 信息收集
  private static async collectMsg(page: Page): Promise<(() => Promise<void>)[]> {
    // 获取所有优秀作者的点击项
    const liList = await page.$$('ul.user-list li.item a.link') as ElementHandle[];
    const buttonPr: (() => Promise<void>)[] = [];
    // 存到 promise 数组，之后一个个取出来拿数据
    liList.forEach((item): void => {
      buttonPr.push(async () => {
        await page.evaluate((li): void => {
          li.click();
        }, item);
      });
    });
    return buttonPr;
  }

  // 获取 body 高度
  public static async getBodyHeight(page: Page): Promise<number> {
    // 等待数据加载完成再获取
    await page.waitForResponse((response): boolean => {
      if (response.url() === 'https://web-api.juejin.im/query') {
        const data = JSON.parse(response.request().postData() as string);
        return response.status() === 200 && data.variables && data.variables.channel;
      }
      return false;
    });
    // 返回 body 高
    return await page.$eval('body', (body: any): number => body.clientHeight);
  };

  public static async goToAuthorPage(page: Page): Promise<void> {
    try {
      // 等待按钮渲染再点击
      await page.waitFor(
        () => !!document.querySelector('ul.user-list div.more'),
        { timeout: 5000 },
      );
      await page.$eval('ul.user-list div.more', (btn: any): void => btn.click());
    } catch (e) {
      // 如果没有导航按钮，则手动导航
      await page.goto('https://juejin.im/recommendation/authors/recommended');
    }
  }

  // 滚动屏幕
  public static async scroll(page: Page): Promise<void> {
    // 取出 body 高度
    let height = await Author.getBodyHeight(page);
    // 20条数据的 li 元素高度
    const scrollHeight = 96 * 20;
    // 每次滚动的高度
    let offsetHeight = scrollHeight;
    // 取数计数器
    let count = 1;
    // 循环，滚动到底部前或者计数器未满
    while (offsetHeight < height && count < 10) {
      // 计数 + 1
      count += 1;
      // 执行滚动
      await page.evaluate(scrollTop => {
        window.scrollBy({
          top: scrollTop,
          left: 0,
          // behavior: 'smooth',
        });
      }, offsetHeight);
      // 重新计算 body 高度
      height = await Author.getBodyHeight(page);
      // 计算下一次需要滚动的距离
      offsetHeight = scrollHeight * count;
    }
  }

  // 作者信息合并
  public static async getUserMsg(page: Page, browser: Browser): Promise<boolean> {
    const users: User[] = [];
    const buttonPr = await Author.collectMsg(page);
    const isLoaded: Promise<boolean> = new Promise((resolve) => {
      // 监听新开的页面
      browser.on('targetcreated', async (target) => {
        const newPage = await target.page();
        await Promise.all([
          newPage.setJavaScriptEnabled(true),
          newPage.setViewport(Config.viewport),
        ]);
        await newPage.waitForSelector('div.user-info-block.block.shadow > div.lazy.avatar.loaded');
        // 从页面拿所需要的作者数据
        const [
          name, level, job, company, motto,
          like, read, value,
        ] = await Promise.all([
          newPage.$eval(
            'h1.username',
            (h1: any) => h1.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'h1.username > a.rank > img',
            (img: any) => img.getAttribute('alt'))
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.position > span.content > span:first-of-type',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.position > span.content > span:nth-of-type(3)',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.intro > span.content',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.block-body > div.stat-item:nth-last-of-type(3) span.count',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.block-body > div.stat-item:nth-last-of-type(2) span.count',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
          newPage.$eval(
            'div.block-body > div.stat-item:last-of-type span.count',
            (span: any) => span.innerText.trim())
            .catch(() => new Promise(resolve => resolve(''))),
        ]);
        // 构建作者对象
        const user = new User(name, level, job, company, motto, like, read, value);
        // 存入数组
        users.push(user);
        if (buttonPr.length > 0) {
          // 如果作者数组还有对象，取第一个点击，获取完数据再关闭页面
          fn = buttonPr.shift() as (() => Promise<void>);
          await fn();
          await newPage.close();
        } else {
          // 如果当前也所有作者信息获取完毕，写入本地 json 文件，并通知上层该步骤结束
          fs.writeFileSync(Config.usersPath, JSON.stringify(users), 'utf-8');
          resolve(true);
        }
      });
    });
    // 取出第一个作者的 item，执行点击
    let fn = buttonPr.shift() as (() => Promise<void>);
    await fn();
    return isLoaded;
  }

  /**
   * 关注作者
   * @param page
   * @param focus true/关注、false/取关
   */
  public static async focus(page: Page, focus: boolean) {
    const buttons = await page.$$('a.link button.follow-btn') as ElementHandle[];
    const buttonPr: Promise<void>[] = [];
    buttons.forEach((button): void => {
      buttonPr.push(
        page.evaluate((btn, focus): void => {
          if (btn.innerText.trim() === '关注' && focus) {
            btn.click();
          } else if (btn.innerText.trim() === '已关注' && !focus) {
            btn.click();
          }
        }, button, focus),
      );
    });
    await Promise.all(buttonPr);
  }

}