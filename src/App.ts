import * as fs from 'fs';
import Puppeteer from './modules/Puppeteer';
import Login from './modules/Login';
import { Browser, Page, SetCookie } from 'puppeteer';
import Util from './common/Util';
import Author from './modules/Author';
import Config from './common/Config';

(async () => {
  let page: Page;
  let browser: Browser;
  try {
    // 读取本地 cookies
    const cookiesString = await fs.readFileSync(Config.cookiesPath, 'utf-8');
    const cookies: SetCookie[] = JSON.parse(cookiesString);
    // 判断是否过期
    if (cookies[0].expires && Util.isNotOverdue(cookies[0].expires)) {
      [page, browser] = await Puppeteer.init();
      await page.setCookie(...cookies);
      await Util.goTo(page);
    } else {
      // 首次登陆
      [page, browser] = await Login.firstLogin();
    }
  } catch (e) {
    // 首次登陆
    [page, browser] = await Login.firstLogin();
  }

  // 跳转优秀作者页
  await Author.goToAuthorPage(page);

  // 等待数据加载渲染完成，这里就借用获取 body 高度了，效果是一样的
  await Author.getBodyHeight(page);

  // 滚动页面到底部，加载所有作者信息
  // await Author.scroll(page);

  // 关注页面中出现的优秀作者
  await Author.focus(page, true);

  // 收集当前页内所有的优秀作者信息
  const isLoaded = await Author.getUserMsg(page, browser);
  if (isLoaded) {
    await browser.close();
  }

})();
