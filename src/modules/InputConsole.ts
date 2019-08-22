import * as readline from 'readline';

export default class InputConsole {
  public static readonly interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  public static async inputUser(): Promise<string[]> {
    InputConsole.interface.setPrompt('账号: ');
    InputConsole.interface.prompt();

    const username = await InputConsole.getLineContent();
    InputConsole.interface.setPrompt('密码: ');
    InputConsole.interface.prompt();
    const password = await InputConsole.getLineContent();
    InputConsole.interface.close();
    return [username.trim(), password.trim()];
  }

  private static getLineContent(): Promise<string> {
    return new Promise((resolve): void => {
      InputConsole.interface.on('line', (line): void => {
        resolve(line);
      });
    });
  }
}
