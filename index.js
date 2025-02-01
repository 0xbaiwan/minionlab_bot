const banner = require('./banner.js');
const axios = require('axios');
const chalk = require('chalk');
const { HttpsProxyAgent } = require('https-proxy-agent');
const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');

class WebSocketManager {
  constructor(accountManager, proxyManager) {
    this.sockets = [];
    this.lastUpdateds = [];
    this.emails = [];
    this.messages = [];
    this.userIds = [];
    this.browserIds = [];
    this.accessTokens = [];
    this.accountManager = accountManager;
    this.proxyManager = proxyManager;
    this.useProxy = false;
  }

  initialize(useProxy) {
    this.useProxy = useProxy;
    
    for (let i = 0; i < this.accountManager.accounts.length; i++) {
      this.sockets[i] = [];
      this.lastUpdateds[i] = [];
      this.messages[i] = [];
      this.browserIds[i] = [];
      
      const connectionCount = useProxy ? this.proxyManager.proxies.length : 1;
      for (let j = 0; j < connectionCount; j++) {
        this.getUserId(i, j);
      }
    }
  }

  generateBrowserId() {
    const characters = 'abcdef0123456789';
    let browserId = '';
    for (let i = 0; i < 32; i++) {
      browserId += characters[Math.floor(Math.random() * characters.length)];
    }
    return browserId;
  }

  async getUserId(accountIndex, proxyIndex) {
    const loginUrl = "https://api.allstream.ai/web/v1/auth/emailLogin";
    const proxy = this.useProxy ? this.proxyManager.proxies[proxyIndex] : null;
    const agent = proxy ? new HttpsProxyAgent(this.proxyManager.normalizeProxyUrl(proxy)) : undefined;

    try {
      const response = await axios.post(
        loginUrl,
        {
          email: this.accountManager.accounts[accountIndex].email,
          password: this.accountManager.accounts[accountIndex].password,
        },
        {
          httpsAgent: agent,
          headers: {
            Authorization: `Bearer ${this.accessTokens[accountIndex]}`,
            "Content-Type": "application/json",
          },
        }
      );

      const { data } = response.data;
      this.emails[accountIndex] = data.user.email;
      this.userIds[accountIndex] = data.user.uuid;
      this.accessTokens[accountIndex] = data.token;
      this.browserIds[accountIndex][proxyIndex] = this.generateBrowserId();

      Logger.logSuccess(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        '连接成功'
      );
      
      await this.connectWebSocket(accountIndex, proxyIndex);
    } catch (error) {
      Logger.logError(
        `账户 ${this.accountManager.accounts[accountIndex].email}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        `连接失败: ${error.message}`
      );
    }
  }

  async connectWebSocket(accountIndex, proxyIndex) {
    if (this.sockets[accountIndex][proxyIndex]) return;
    
    const url = "wss://gw0.streamapp365.com/connect";
    const proxy = this.useProxy ? this.proxyManager.proxies[proxyIndex] : null;
    const agent = proxy ? new HttpsProxyAgent(this.proxyManager.normalizeProxyUrl(proxy)) : undefined;
    const wsOptions = agent ? { agent } : {};
    
    this.sockets[accountIndex][proxyIndex] = new WebSocket(url, wsOptions);

    this.sockets[accountIndex][proxyIndex].on('open', async () => {
      this.lastUpdateds[accountIndex][proxyIndex] = new Date().toISOString();
      Logger.logSuccess(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        'WebSocket 已连接'
      );
      
      this.sendRegisterMessage(accountIndex, proxyIndex);
      this.startPinging(accountIndex, proxyIndex);
    });

    this.sockets[accountIndex][proxyIndex].on('message', async (data) => {
      let rawData = data.toString();
    
      if (rawData.startsWith("{") && rawData.endsWith("}")) {
        try {
          const message = JSON.parse(rawData);
          await this.handleMessage(accountIndex, proxyIndex, message);
        } catch (error) {
          Logger.logError(
            `账户 ${this.emails[accountIndex]}`,
            this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
            `消息解析错误: ${error.message}`
          );
        }
      }
    });
    
    this.sockets[accountIndex][proxyIndex].on('close', () => {
      Logger.logWarning(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        'WebSocket 已断开 - 正在尝试重新连接'
      );
      this.reconnectWebSocket(accountIndex, proxyIndex);
    });

    this.sockets[accountIndex][proxyIndex].on('error', (error) => {
      Logger.logError(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        `WebSocket 错误: ${error.message}`
      );
    });
  }

  async reconnectWebSocket(accountIndex, proxyIndex) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    this.connectWebSocket(accountIndex, proxyIndex);
  }

  async handleMessage(accountIndex, proxyIndex, message) {
    if (message.type === "request") {
      const { taskid, data } = message;
      const { method, url, headers, body, timeout } = data;

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: method === "POST" ? body : undefined,
          signal: AbortSignal.timeout(timeout),
        });

        this.sockets[accountIndex][proxyIndex].send(
          JSON.stringify({
            type: "response",
            taskid,
            result: {
              parsed: "",
              html: "JTdCJTIyY291bnRyeSUyMiUzQSUyMklEJTIyJTJDJTIyYXNuJTIyJTNBJTdCJTIyYXNudW0lMjIlM0E5MzQxJTJDJTIyb3JnX25hbWUlMjIlM0ElMjJQVCUyMElORE9ORVNJQSUyMENPTU5FVFMlMjBQTFVTJTIyJTdEJTJDJTIyZ2VvJTIyJTNBJTdCJTIyY2l0eSUyMiUzQSUyMiUyMiUyQyUyMnJlZ2lvbiUyMiUzQSUyMiUyMiUyQyUyMnJlZ2lvbl9uYW1lJTIyJTNBJTIyJTIyJTJDJTIycG9zdGFsX2NvZGUlMjIlM0ElMjIlMjIlMkMlMjJsYXRpdHVkZSUyMiUzQS02LjE3NSUyQyUyMmxvbmdpdHVkZSUyMiUzQTEwNi44Mjg2JTJDJTIydHolMjIlM0ElMjJBc2lhJTJGSmFrYXJ0YSUyMiU3RCU3RA==",
              rawStatus: response.status,
            },
          })
        );
        
        Logger.logInfo(
          `账户 ${this.emails[accountIndex]}`,
          this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
          `Request handled successfully`
        );
      } catch (error) {
        this.sockets[accountIndex][proxyIndex].send(
          JSON.stringify({
            type: "error",
            taskid,
            error: error.message,
            errorCode: 50000001,
            rawStatus: 500,
          })
        );
        
        Logger.logError(
          `账户 ${this.emails[accountIndex]}`,
          this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
          `Request handling error: ${error.message}`
        );
      }
    }
  }

  startPinging(accountIndex, proxyIndex) {
    const pingServer = async () => {
      if (this.sockets[accountIndex][proxyIndex]?.readyState === WebSocket.OPEN) {
        this.sockets[accountIndex][proxyIndex].send(JSON.stringify({ type: "ping" }));
        await this.getPoint(accountIndex, proxyIndex);
      }
      setTimeout(pingServer, 60000);
    };

    pingServer();
  }

  async getPoint(accountIndex, proxyIndex) {
    const pointUrl = `https://api.allstream.ai/web/v1/dashBoard/info`;
    const proxy = this.useProxy ? this.proxyManager.proxies[proxyIndex] : null;
    const agent = proxy ? new HttpsProxyAgent(this.proxyManager.normalizeProxyUrl(proxy)) : undefined;

    try {
      const response = await axios.get(pointUrl, {
        httpsAgent: agent,
        headers: {
          Authorization: `Bearer ${this.accessTokens[accountIndex]}`,
          "Content-Type": "application/json",
        },
      });

      const { data } = response.data;
      Logger.logSuccess(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        `Points: Total=${data.totalScore ?? 0}, Today=${data.todayScore ?? 0}`
      );
    } catch (error) {
      Logger.logError(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        `Failed to get points: ${error.message}`
      );
    }
  }

  sendRegisterMessage(accountIndex, proxyIndex) {
    if (this.sockets[accountIndex][proxyIndex]?.readyState === WebSocket.OPEN) {
      const message = {
        type: "register",
        user: this.userIds[accountIndex],
        dev: this.browserIds[accountIndex][proxyIndex],
      };

      this.sockets[accountIndex][proxyIndex].send(JSON.stringify(message));
      Logger.logSuccess(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        `已注册浏览器 ID: ${this.browserIds[accountIndex][proxyIndex]}`
      );
    } else {
      Logger.logError(
        `账户 ${this.emails[accountIndex]}`,
        this.useProxy ? `(代理 ${proxyIndex + 1})` : '',
        'WebSocket 未连接 - 无法注册'
      );
    }
  }
}

class AccountManager {
  constructor() {
    this.accounts = [];
  }

  loadAccounts() {
    if (!fs.existsSync("accounts.txt")) {
      Logger.logError('配置', '', 'accounts.txt 文件未找到');
      process.exit(1);
    }

    try {
      const data = fs.readFileSync("accounts.txt", "utf8");
      this.accounts = data
        .split("\n")
        .map((line) => {
          const [email, password] = line.split(":");
          if (email && password) {
            return { email: email.trim(), password: password.trim() };
          }
          return null;
        })
        .filter((account) => account !== null);
    } catch (err) {
      Logger.logError('配置', '', `加载账户失败: ${err.message}`);
      process.exit(1);
    }
  }
}

class ProxyManager {
  constructor() {
    this.proxies = [];
  }

  loadProxies() {
    if (!fs.existsSync("proxy.txt")) {
      Logger.logError('配置', '', 'proxy.txt 文件未找到');
      process.exit(1);
    }

    try {
      const data = fs.readFileSync("proxy.txt", "utf8");
      this.proxies = data
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);
    } catch (err) {
      Logger.logError('配置', '', `加载代理失败: ${err.message}`);
      process.exit(1);
    }
  }

  normalizeProxyUrl(proxy) {
    if (!proxy.startsWith("http://") && !proxy.startsWith("https://")) {
      proxy = "http://" + proxy;
    }
    return proxy;
  }
}

class Logger {
  static logSuccess(account, proxy, message) {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(
      `${chalk.gray(timestamp)} ${chalk.green('✓')} ${chalk.cyan(account)} ${chalk.gray(proxy)} ${message}`
    );
  }

  static logError(account, proxy, message) {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(
      `${chalk.gray(timestamp)} ${chalk.red('✗')} ${chalk.cyan(account)} ${chalk.gray(proxy)} ${chalk.red(message)}`
    );
  }

  static logInfo(message) {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(
      `${chalk.gray(timestamp)} ${chalk.blue('ℹ')} ${message}`
    );
  }

  static logWarning(account, proxy, message) {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(
      `${chalk.gray(timestamp)} ${chalk.yellow('⚠')} ${chalk.cyan(account)} ${chalk.gray(proxy)} ${chalk.yellow(message)}`
    );
  }
}

class AirdropBot {
  constructor() {
    this.accountManager = new AccountManager();
    this.proxyManager = new ProxyManager();
    this.webSocketManager = new WebSocketManager(
      this.accountManager,
      this.proxyManager
    );
  }

  displayHeader() {
    console.clear();
    console.log(banner);
  }

  async initialize() {
    this.displayHeader();
    
    // Load accounts
    Logger.logInfo('正在加载账户...');
    this.accountManager.loadAccounts();
    Logger.logSuccess('账户', '', `已加载 ${this.accountManager.accounts.length} 个账户`);

    // Handle proxy setup
    const useProxy = await this.promptUseProxy();
    if (useProxy) {
      Logger.logInfo('正在加载代理...');
      this.proxyManager.loadProxies();
      Logger.logSuccess('代理', '', `已加载 ${this.proxyManager.proxies.length} 个代理`);

      if (this.proxyManager.proxies.length < this.accountManager.accounts.length) {
        Logger.logError('配置', '', '代理数量不足，无法满足账户数量要求');
        process.exit(1);
      }
    }

    console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
    Logger.logInfo('正在启动机器人...');
    this.webSocketManager.initialize(useProxy);
  }

  async promptUseProxy() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(chalk.blue('ℹ') + ' 是否使用代理? (y/n): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }
}

// Create bot instance and initialize
const bot = new AirdropBot();
bot.initialize();

module.exports = {
  AirdropBot,
  WebSocketManager,
  AccountManager,
  ProxyManager,
  Logger,
};
