import * as path from 'path';

export default class Config {
  public static readonly chromePath = path.resolve(__dirname, '../../', 'chrome/Chromium.app/Contents/MacOS/Chromium');

  public static readonly cookiesPath = path.resolve(__dirname, '../../', 'cookies.json');

  public static readonly usersPath = path.resolve(__dirname, '../../', 'users.json');

  public static readonly viewport = { width: 1200, height: 710 };

}