# WorkBuddy Theme Forge

WorkBuddy Theme Forge 是一个面向 Windows 的第三方主题引擎 MVP。它通过 WorkBuddy 已开放的本机 Chromium DevTools Protocol（CDP）把 CSS 和主题变量注入正在运行的 renderer，并提供独立本地编辑器、主题包管理、诊断、快照与回滚能力。

当前版本：`v0.1.0`（首个可运行 MVP）。版本变化记录见 [CHANGELOG.md](CHANGELOG.md)，版本号和迭代流程见 [docs/versioning.md](docs/versioning.md)。

> 本项目与腾讯、WorkBuddy 没有隶属、授权或合作关系。它不会修改官方安装目录、`WorkBuddy.exe`、`app.asar`、官方资源或代码签名。

## 快速开始

需要 Node.js 20+。在项目目录运行：

```powershell
npm test
npm run lint
node src/cli.mjs doctor --json
node src/cli.mjs list
node src/cli.mjs apply --theme aurora-night
```

独立编辑器：

```powershell
npm run start:editor
# 浏览器打开 http://127.0.0.1:4782
```

WorkBuddy 需以 `--remote-debugging-port=<port>` 启动，或设置 `WORKBUDDY_REMOTE_DEBUGGING_PORT`。CDP 始终只连接 `127.0.0.1`，默认端口 9223。真实 WorkBuddy 未在当前环境中运行时，`doctor` 会如实报告不可达。

## CLI

`doctor`、`status`、`list`、`apply --theme <id>`、`pause`、`restore`、`daemon`、`create --image <path> --name <name>`、`import <file.wbtheme>`、`export <id> --out <file.wbtheme>`、`validate <theme.json>`、`inspect`、`rollback` 均支持 `--json`。

主题守护会观察 renderer target 变化，在 WorkBuddy 重启或页面刷新后重新注入当前主题。守护异常会被隔离，不会阻止 WorkBuddy 正常启动。

## 安全边界

- 只访问本机回环 CDP；不监听公网地址。
- 不读取、保存或上传聊天内容、Token、Cookie、账号或业务数据。
- 主题包默认只允许 JSON、CSS 和图片，不执行主题 JavaScript。
- 导入校验相对路径、扩展名和 32 MiB 上限，拒绝目录穿越。
- 使用前请保存 WorkBuddy 未完成的任务，并避免同时运行不可信的本机程序。
- 第三方主题作者必须自行确认素材权利和许可证；用户应自行确认符合 WorkBuddy 服务条款及当地法律。

## 参考与致谢

实现吸收了 `.reference-cache` 中三个项目关于 CDP target 发现、幂等 style 注入、主题 schema、Windows 启动与诊断的设计思想，但代码、文案和内置主题均为独立实现，没有复制其源码、图片或商业 IP 素材。

更多信息见：`docs/architecture.md`、`docs/theme-format.md`、`docs/legal-boundaries.md`、`CONTRIBUTING.md`、`SECURITY.md`。

