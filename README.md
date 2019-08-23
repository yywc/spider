## 前言

 `puppeteer` 这个库，可以在 node.js 下爬取一些 ajax 请求后渲染的页面数据，然后打算练习一下，就用这个库来关注一下掘金的优秀作者。

## 1. 效果演示

### 1.1 登录

![first_login](https://github.com/yywc/spider/blob/master/README.assets/first_login.gif)

### 1.2 关注优秀作者

![focus](https://github.com/yywc/spider/blob/master/README.assets/focus.gif)

### 1.4 提取优秀作者信息

![get_msg](https://github.com/yywc/spider/blob/master/README.assets/get_msg.gif)

## 2. 需求

1. 实现登录，保存 cookies 到本地；
2. 查找优秀作者信息并整理到本地，且可以关注和取关；
3. 用 typescript 面向对象写；

确定好需求，那可以开始写代码了。

## 3. 准备工作

![Spider](https://github.com/yywc/spider/blob/master/README.assets/Spider.png)

## 4. puppeteer 简单介绍

> puppeteer 是一个 chrome 官方出品的 node.js 库，他提供了在无 UI 情况下使用 chrome 的功能

可以截图，导出 pdf，进行 UI 自动化测试，爬虫等等。当然我们这里主要是对页面爬取功能进行一次试探，下面介绍简单使用方法。

`export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 1` 设置不下载 chrome，自行下载会更快，[前往下载地址。](https://www.chromium.org/)

```shell
npm init -y
npm i puppeteer
touch app.js
```

```js
// app.js
const puppeteer = require('puppeteer');

(async () => {
  // 开启浏览器
  const browser = await puppeteer.launch({
    headless: false, // 设置为 true 启用无 UI 模式
    slowMo: 20, // 降低执行速度，方便看到执行动作
    executablePath: './chrome/Chromium.app/Contents/MacOS/Chromium' // chromium 路径
  });
  const page = await browser.newPage(); // 打开新的标签页
  await page.goto('https://baidu.com'); // 前往百度页面
  await page.screenshot({path: 'baidu.png'}); // 截图

  await browser.close(); // 关闭浏览器
})();
```

这样就打开了百度并截了个图。

更多 API 的介绍可以看[官网。](https://zhaoqize.github.io/puppeteer-api-zh_CN/#?product=Puppeteer&version=v1.19.0&show=outline)

## 5. 实现

![process](https://github.com/yywc/spider/blob/master/README.assets/process.png)

### 5.1 登录

`App.js`部分代码：

```ts
try {
  // 读取本地 cookies
  const cookiesString = await fs.readFileSync(Config.cookiesPath, 'utf-8');
  const cookies: SetCookie[] = JSON.parse(cookiesString);
  // 判断是否过期
  if (cookies[0].expires && Util.isNotOverdue(cookies[0].expires)) {
    [page, browser] = await Puppeteer.init(); // 初始化浏览器
    await page.setCookie(...cookies); // 页面设置 cookie
    await Util.goTo(page); // 前往掘金首页
  } else {
    // 首次登陆
    [page, browser] = await Login.firstLogin();
  }
} catch (e) {
  // 首次登陆
  [page, browser] = await Login.firstLogin();
}
```

### 5.2 首次登录

首次登录我们需要自己输入账号密码，通过 node.js 从命令行读取。

`InputConsole.ts`：

```ts
import * as readline from 'readline';

export default class InputConsole {
  // 定义逐行读取的实例
  public static readonly interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  public static async inputUser(): Promise<string[]> {
    InputConsole.interface.setPrompt('账号: '); // 提示输入账号
    InputConsole.interface.prompt(); // 提供可输入新位置

    const username = await InputConsole.getLineContent(); // 获取用户输入账号
    InputConsole.interface.setPrompt('密码: '); // 提示输入密码
    InputConsole.interface.prompt(); // 提供可输入新位置
    const password = await InputConsole.getLineContent(); // 获取用户输入密码
    InputConsole.interface.close(); // 关闭实例
    return [username.trim(), password.trim()]; // 返回账号密码
  }

  // 监听 'line' 事件获取输入内容
  private static getLineContent(): Promise<string> {
    return new Promise((resolve): void => {
      InputConsole.interface.on('line', (line): void => {
        resolve(line);
      });
    });
  }
}
```

`Login.ts`：登录逻辑

由于某些 cookie 是通过 document.cookie 获取不到的，所以我们要通过登录后的响应头获取

```ts
public static async firstLogin(): Promise<[Page, Browser]> {
  return new Promise(async resolve => {
    let result: string[] = [];
    // 监听 readline interface 关闭
    InputConsole.interface.on('close', async (): Promise<void> => {
      // 初始化 puppeteer 相关设置，获取 page 和 browser 对象
      const [page, browser] = await Puppeteer.init();
      // 前往掘金页面
      await Util.goTo(page);
      // 登录初始化，如果登陆过成功，返回 page 和 browser
      // 否则关闭浏览器
      const success = await Login.init(page, result);
      if (success) {
        resolve([page, browser]);
      } else {
        await browser.close();
      }
    });
    result = await InputConsole.inputUser();
  });
};


// init 函数
private static async init(page: Page, [username, password]: string[]): Promise<Boolean> {

  // 点击登录按钮
  await page.$eval(
    'span.login',
    (login: any): void => login.click(),
  );

  // 输入从命令行读取的账号密码
  await Promise.all([
    await page.type('input[name="loginPhoneOrEmail"]', username),
    await page.type('input[name="loginPassword"]', password),
  ]);

  // 点击确定按钮
  await page.$eval('div.panel > button.btn', (btn: any): void => btn.click());

  return new Promise((resolve) => {
    // 监听页面内的 response
    page.on('response', async (res): Promise<void> => {
      const url = res.url();
      // 判断是不是登录接口
      if (url === 'https://juejin.im/auth/type/phoneNumber'
        || url === 'https://juejin.im/auth/type/email') {
        // 如果接口调用成功，从 headers 里获取 cookie 存入本地，返回成功
        // 返回失败
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
          resolve(true);
        } else {
          console.log('账号/密码错误');
          resolve(false);
        }
      }
    });
  });
}
```

### 5.3 滚动屏幕

通过 window.scrollBy 来实现滚动，主要的部分就要判断当前页面内容高度和滚动高度，然后来调用方法进行滚动。由于是数据异步加载后再渲染 UI，所以我们要等待 UI 渲染完成后才去获取高度。

`Author.ts`：

```ts
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
```

### 5.4 关注/取关优秀作者

`Author.ts`：

```ts
// focus：true 为关注，false 取关
public static async focus(page: Page, focus: boolean) {
  // 获取全部关注/已关注按钮
  const buttons = await page.$$('a.link button.follow-btn') as ElementHandle[];
  // 存放按钮点击的数组
  const buttonPr: Promise<void>[] = [];
  // 遍历全部按钮将执行方法存入数组
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
  // 同时异步执行
  await Promise.all(buttonPr);
}
```

### 5.5 收集优秀作者信息

这里分为两步，首先获取所有优秀作者可点击项，然后依次点击每一项开启新页面整理数据然后再关闭，同时打开太多个会加载不出来页面。

`Author.ts`

```ts
// 信息收集，获取所有的点击项
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


// 作者信息整理
public static async getUserMsg(page: Page, browser: Browser): Promise<boolean> {
  // 存放所有优秀作者信息的数组
  const users: User[] = [];
  // 获取优秀作者可点击项
  const buttonPr = await Author.collectMsg(page);
  const isLoaded: Promise<boolean> = new Promise((resolve) => {
    // 监听新开的页面
    browser.on('targetcreated', async (target) => {
      const newPage = await target.page();
      await Promise.all([
        newPage.setJavaScriptEnabled(true),
        newPage.setViewport(Config.viewport),
      ]);
      // 等待 UI 渲染
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
```

## 总结

经过这一波练习之后，还是掌握了一些常用 API 的，这个过程中也再次发现 TS 的优势，TS 大法好！如果觉得有用麻烦你点个 star 吧 😝。