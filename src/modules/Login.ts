import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import InputConsole from './InputConsole';
import Puppeteer from './Puppeteer';
import Util from '../common/Util';
import Config from '../common/Config';

export default class Login {

  public static async init(page: Page, [username, password]: string[]) {

    await page.$eval(
      'span.login',
      (login: any): void => login.click(),
    );

    await Promise.all([
      await page.type('input[name="loginPhoneOrEmail"]', username),
      await page.type('input[name="loginPassword"]', password),
    ]);

    await page.$eval('div.panel > button.btn', (btn: any): void => btn.click());

    page.on('response', async (res): Promise<void> => {
      if (res.url() === 'https://juejin.im/auth/type/phoneNumber') {
        if (res.status() === 200 && res.ok()) {
          const cookiesArray: Record<string, any>[] = [];
          const headers = res.headers();
          for (let key in headers) {
            if (key === 'set-cookie') {
              // 分组 cookies
              const cookiesList = headers[key].split('\n');
              // 遍历分组 cookies
              cookiesList.forEach(cookiesString => {
                // 以 ; 分割成数组
                const splitHeaders = cookiesString.split(';');
                // 设置 domain 为掘金
                const cookies: Record<string, any> = { domain: 'juejin.im' };
                // 遍历每一项
                splitHeaders.forEach((headers, index) => {
                  // 以 = 分割，注意不要分割掉 auth 最后的 =，所以正则匹配后面不为空的 = 来分割
                  const [key, value] = headers.split(/=(?=\S)/);
                  // 如果 value 存在，则设置对应的属性，否则是 httpOnly 这些设置为 true
                  if (value) {
                    if (index === 0) {
                      cookies.name = key.trim();
                      cookies.value = value.trim();
                    } else {
                      if (key.trim().toLowerCase() === 'expires') {
                        cookies[key.trim()] = new Date(value).getTime();
                      } else {
                        cookies[key.trim()] = value.trim();
                      }
                    }
                  } else {
                    const resultKey = key.trim().toLowerCase() === 'httponly' ? 'httpOnly' : key.trim();
                    cookies[resultKey] = true;
                  }
                });
                // 存入数组
                cookiesArray.push(cookies);
              });
            }
          }
          // 写入本地文件保存
          fs.writeFileSync(Config.cookiesPath, JSON.stringify(cookiesArray), 'utf-8');
          console.clear();
          console.log('登陆成功');
        } else {
          console.log('账号/密码错误');
        }
      }
    });
  }

  public static async firstLogin(): Promise<[Page, Browser]> {
    return new Promise(async resolve => {
      let result: string[] = [];
      InputConsole.interface.on('close', async (): Promise<void> => {
        const [page, browser] = await Puppeteer.init();
        await Util.goTo(page);
        await Login.init(page, result);
        resolve([page, browser]);
      });
      result = await InputConsole.inputUser();
    });
  };
}
