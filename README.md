# Minion Lab Auto Bot

一个用于管理空投任务的自动化机器人，支持多账户和代理。
官网：[https://app.minionlab.ai](https://app.minionlab.ai/?referralCode=vLfYVrZE)

## 功能特点
- 多账户支持
- 代理集成
- WebSocket 连接管理
- 自动积分追踪
- 彩色控制台日志
- 自动重连处理

## 系统要求
- Node.js v16 或更高版本
- npm 或 yarn 包管理器

## 安装步骤
1. 克隆仓库
```bash
git clone https://github.com/0xbaiwan/minionlab_bot
cd minionlab_bot
```
2. 安装依赖：
```bash
npm install
```

## 配置说明

### 账户设置
- 1、注册帐号：[https://app.minionlab.ai](https://app.minionlab.ai/?referralCode=vLfYVrZE)

- 2、在项目根目录创建 `accounts.txt` 文件，使用以下格式：
```
email1@example.com:password1
email2@example.com:password2
```

### 代理设置（可选）
在项目根目录创建 `proxy.txt` 文件，使用以下格式：
```
ip:port:username:password
ip:port:username:password
```
或者对于无需认证的代理：
```
ip:port
ip:port
```

## 使用方法
运行机器人：
```bash
node index.js
```

机器人将询问是否使用代理。输入 'y' 表示是，'n' 表示否。

## 控制台输出
机器人提供不同颜色的详细控制台输出：
- ✓ 成功消息（绿色）
- ✗ 错误消息（红色）
- ℹ 信息消息（蓝色）
- ⚠ 警告消息（黄色）

## 错误处理
- WebSocket 连接断开时自动重连
- 详细的错误日志记录
- 优雅的配置问题处理

## 代理服务（可选）

### 免费静态住宅代理
- [WebShare](https://www.webshare.io/?referral_code=gtw7lwqqelgu)
- [ProxyScrape](https://proxyscrape.com/)
- [MonoSans](https://github.com/monosans/proxy-list)

### 付费高级静态住宅代理
- [922proxy](https://www.922proxy.com/register?inviter_code=d6416857)
- [Proxy-Cheap](https://app.proxy-cheap.com/r/Pd6sqg)
- [Infatica](https://dashboard.infatica.io/aff.php?aff=580)

### 付费动态IP代理
- [IPRoyal](https://iproyal.com/?r=733417)
