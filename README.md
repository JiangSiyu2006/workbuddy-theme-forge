# WorkBuddy Theme Forge

WorkBuddy Theme Forge 是面向 Windows 的第三方主题引擎。它通过 WorkBuddy 的本机 Chromium DevTools Protocol（CDP）注入可逆 CSS，不修改 `WorkBuddy.exe`、`app.asar`、官方资源或代码签名。

当前版本：`v0.2.1`。正式支持基线为 Windows WorkBuddy `5.3.5`。
版本变化记录见 [CHANGELOG.md](CHANGELOG.md)，版本号和迭代流程见 [docs/versioning.md](docs/versioning.md)。

> 本项目与腾讯、WorkBuddy 没有隶属、授权或合作关系。

## v0.2.1 修复重点

- 修复控制台脚本无法执行，以及保存、加载、应用、导入和导出整体失效。
- 以 WorkBuddy 5.3.5 的侧栏、主内容、输入区、代码区和详情面板重建预览，并与实际注入共用主题 token。
- 修复圆角、背景、模糊、阴影、字体、字号、行高、外观恢复和动画映射。
- 增加确认式 WorkBuddy 管理启动/重启、renderer 身份校验和本地 CDP 端口管理。
- 增加 adapter 必需区域校验、多 renderer 事务回滚、运行时互斥和 daemon 健康诊断。

## 快速开始

需要 Node.js 20+。推荐直接运行管理式入口：

```powershell
npm install
npm test
npm run start:control
```

`npm run start:control` 不会查找或复用已存在的 CDP。WorkBuddy 未运行时，输入精确的 `YES` 后会启动 WorkBuddy 和控制台；WorkBuddy 已运行时，输入精确的 `YES` 后会先关闭现有实例，再以本地 CDP 参数重新启动 WorkBuddy 和控制台。也可直接调用：

```powershell
.\scripts\start-control.ps1 -OpenBrowser
```

默认控制台为 `http://127.0.0.1:4782`。新启动的 WorkBuddy 优先使用 `127.0.0.1:9223`；若 `9223` 被占用则选择空闲高位端口。两者均不监听公网地址。

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
node src/cli.mjs serve --port 9444 --open
```

未知 WorkBuddy 版本仅在 WorkBuddy 身份、根节点/侧栏/主内容和关键变量签名全部匹配时使用 5.3 adapter；否则 `apply` 默认拒绝继续。确认风险后可以使用 `--force`。

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
