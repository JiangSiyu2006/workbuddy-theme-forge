# WorkBuddy Theme Forge

WorkBuddy Theme Forge 是面向 Windows 的第三方主题引擎。它通过 WorkBuddy 的本机 Chromium DevTools Protocol（CDP）注入可逆 CSS，不修改 `WorkBuddy.exe`、`app.asar`、官方资源或代码签名。

当前版本：`v0.2.0`。正式适配并手动验证 WorkBuddy `5.3.5`。
版本变化记录见 [CHANGELOG.md](CHANGELOG.md)，版本号和迭代流程见 [docs/versioning.md](docs/versioning.md)。

> 本项目与腾讯、WorkBuddy 没有隶属、授权或合作关系。

## v0.2.0 亮点

- 新增 WorkBuddy 5.3.x adapter、逻辑区域命中诊断和深浅外观同步。
- 新增本地 Web 控制台，可应用、暂停、继续、恢复、回滚、编辑、复制、导入和导出主题。
- 守护进程按 CSS 哈希检查所有 renderer，页面刷新或样式丢失时自动补针。
- 图片主题支持位置、缩放、透明度、模糊、遮罩和暗角。
- `.wbtheme` 支持标准 ZIP store/deflate，并校验路径、资源、CRC、数量和解压大小。
- 自定义 CSS 经过解析、资源白名单和主题作用域限制，不允许远程 URL 或 `@import`。
- 内置克制原生风格的 `Aurora Night` 与 `Aurora Dawn`。

## 快速开始

需要 Node.js 20+。WorkBuddy 已使用 CDP 启动时：

```powershell
npm install
npm test
npm run start:control
```

也可以使用 Windows 启动器。若 WorkBuddy 尚未开启 CDP，它会先要求输入 `YES` 确认，再执行重启：

```powershell
.\scripts\start-control.ps1 -OpenBrowser
```

默认控制台为 `http://127.0.0.1:4782`，CDP 为 `127.0.0.1:9223`。两者均不监听公网地址。

## CLI

```powershell
node src/cli.mjs doctor --json
node src/cli.mjs list
node src/cli.mjs apply --theme aurora-night
node src/cli.mjs pause
node src/cli.mjs resume
node src/cli.mjs restore
node src/cli.mjs rollback
node src/cli.mjs duplicate aurora-night --name "My Night"
node src/cli.mjs create --image C:\path\background.png --name "My Theme"
node src/cli.mjs import theme.wbtheme --conflict copy
node src/cli.mjs export aurora-night --out aurora-night.wbtheme
node src/cli.mjs inspect --json
node src/cli.mjs logs --tail 50 --json
node src/cli.mjs serve --open
```

未知 WorkBuddy 版本或核心 selector 全部失效时，`apply` 默认拒绝继续。确认风险后可以使用 `--force`。

## 状态语义

- `active`：主题已应用，守护会自动补针。
- `paused`：当前 renderer 恢复原生，但保留主题选择，可用 `resume` 继续。
- `native`：恢复原生并清除当前主题选择。
- `rollback`：恢复最近一次应用前保存的样式和外观快照。

## 安全边界

- 只访问 `127.0.0.1` CDP；本地控制台使用随机会话令牌、Host 和 Origin 校验。
- 不读取、保存或上传聊天内容、Token、Cookie、账号或业务数据。
- 主题包仅允许 JSON、CSS、许可证和已声明图片，不执行主题 JavaScript。
- 单包最多 32 MiB、解压后 64 MiB、64 个条目；单图最多 10 MiB、16384 px/边和 50 MP。
- 使用 CDP 时避免同时运行不可信的本机程序；CDP 在本机同权限进程边界内没有认证。
- 第三方主题作者负责素材权利和许可证，用户应自行确认符合 WorkBuddy 服务条款及当地法律。

## 参考与致谢

实现吸收了 [Codex-Dream-Skin]、[heige-codex-skin-studio]和[workbuddy-skin-studio]三个项目关于 CDP target 发现、幂等 style 注入、主题 schema、Windows 启动与诊断的设计思想，但代码、文案和内置主题均为独立实现，没有复制其源码、图片或商业 IP 素材。

更多信息见 `docs/architecture.md`、`docs/theme-format.md`、`docs/windows.md`、`docs/legal-boundaries.md` 和 `SECURITY.md`。

[Codex-Dream-Skin]: https://github.com/Fei-Away/Codex-Dream-Skin
[heige-codex-skin-studio]: https://github.com/HeiGeAi/heige-codex-skin-studio
[workbuddy-skin-studio]: https://github.com/cdredfox/workbuddy-skin-studio
