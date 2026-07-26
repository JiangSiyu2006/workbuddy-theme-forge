# 创建 WorkBuddy Theme Forge 项目的 GPT 提示词

你是一名资深桌面应用、Electron、Chromium DevTools Protocol（CDP）、TypeScript/Node.js 和 UI 工程师。请在当前工作目录中，从零创建一个可运行、可维护、可扩展的开源项目：`WorkBuddy Theme Forge`。

## 一、项目目标

为腾讯 WorkBuddy Windows 桌面客户端提供第三方、可逆、非侵入式的换肤能力。项目通过 WorkBuddy 已提供的本机 Chromium/CDP 调试接口，将 CSS、主题变量和有限的前端 UI 注入正在运行的 renderer，不修改官方安装目录、`WorkBuddy.exe`、`app.asar`、官方资源或代码签名。

产品定位不是“一次性换色脚本”，而是一个具备自动重注入、主题编辑、主题包管理、版本兼容检查、安全边界和故障回滚能力的主题引擎。

## 二、必须参考的项目

请先阅读并总结以下仓库的 README、目录结构、启动脚本、CDP 客户端、注入逻辑、主题 schema 和许可证信息，然后吸收其可复用的设计思想。不要直接复制代码、图片、字体、官方资源、README 文案或受版权保护的主题素材；所有实现应重新组织并注明灵感来源。

1. `https://github.com/cdredfox/workbuddy-skin-studio`
   - 重点参考：WorkBuddy CDP renderer 发现、主题菜单、自定义图片取色、`--cb-*` 变量覆盖、Windows/macOS 启动脚本、`SKILL.md` 自动化流程。
2. `https://github.com/HeiGeAi/heige-codex-skin-studio`
   - 重点参考：CDP 注入架构、主题 schema、主题存储、CSS 构建和可逆恢复思路。
3. `https://github.com/Fei-Away/Codex-Dream-Skin`
   - 重点参考：Windows PowerShell 启动套路、CDP 检测/等待、路径探测、light/dark 自动适配和用户使用体验。

这三个仓库在本工作目录的.reference-cache\下。

## 三、技术和安全边界

- 首选 TypeScript；若使用 JavaScript，必须使用 ESM、严格错误处理和清晰的 JSDoc 类型说明。
- 目标平台第一阶段为 Windows；代码结构应为未来 macOS 适配保留边界。
- WorkBuddy 目标安装路径不可硬编码为单一位置，应支持快捷方式、注册表、环境变量和常见安装目录探测。
- 优先使用 WorkBuddy 的 `WORKBUDDY_REMOTE_DEBUGGING_PORT` 环境变量；兼容必要时的 `--remote-debugging-port=<port>` 启动参数。
- CDP 只允许连接 `127.0.0.1`，端口默认随机或可配置，不监听公网地址。
- 不读取、保存、上传聊天内容、Token、Cookie、账号信息或业务数据。
- 第三方主题默认只允许 CSS、变量和图片资源；不要默认执行主题包中的任意 JavaScript。
- 不绕过登录、授权、风控、完整性校验、安全机制或更新机制。
- 提供明确的暂停、恢复原生、清理注入、回滚和诊断命令。
- 需要在 README 中声明：项目为第三方非官方工具，与腾讯及 WorkBuddy 无隶属、授权或合作关系。
- 不内置原神、火影、初音未来、鸣潮、恋与深空等商业 IP 素材。内置主题必须使用原创渐变、美女（ai生成）、帅哥（ai生成）或兼容 CC0/明确许可的素材，并附许可证信息。

## 四、产品差异化要求

相对于参考项目，至少实现以下差异化能力：

### 1. 自动重注入守护

- 监测 WorkBuddy 进程启动、退出、renderer 刷新、CDP target 变化和连接断开。
- WorkBuddy 重启或页面刷新后自动重新注入当前主题。
- 支持托盘菜单：启用/暂停、当前主题、切换主题、恢复原生、打开编辑器、查看日志、退出守护。
- 守护程序异常时不影响 WorkBuddy 正常启动。

### 2. 独立主题编辑器

不要把全部功能都塞进 WorkBuddy 页面右上角。提供独立的本地编辑器（可以先做 Web UI + 本地服务，后续再封装 Electron）：

- 主色、辅色、背景色、文本色、边框色、错误/警告/成功色；
- 顶栏、侧边栏、对话区、输入区、代码区、工具面板、弹窗分别配置；
- 背景图选择、裁剪/定位、透明度、模糊、暗角和遮罩；
- 圆角、阴影、毛玻璃强度；
- 字体、字号、行高；
- 动画开关、动画速度和“减少动效”模式；
- 实时预览、对比度检测、保存草稿和撤销/重做。

### 3. 主题包格式

设计独立的 `.wbtheme` 主题包（建议 ZIP 容器），至少包含：

```text
theme.json
theme.css
assets/
preview.png
LICENSE
```

`theme.json` 至少支持：

```json
{
  "schemaVersion": 1,
  "id": "aurora-night",
  "name": "Aurora Night",
  "author": "",
  "license": "CC0-1.0",
  "workbuddy": { "minVersion": "4.22.0", "maxVersion": null },
  "colors": {},
  "variables": {},
  "selectors": {},
  "assets": {},
  "reducedMotion": {}
}
```

实现主题导入、导出、复制、删除、启用、禁用和主题目录扫描。导入时必须校验路径、大小、扩展名、JSON schema 和资源引用，防止目录穿越。

### 4. WorkBuddy 版本兼容层

- 启动时读取 WorkBuddy 文件版本和 renderer 基本信息。
- 检查主题使用的 CSS 变量、DOM 锚点和 selector 命中率。
- 为不同 WorkBuddy 版本保留 adapter 机制，例如 `adapter-422`、`adapter-423`。
- 当部分 selector 失效时给出可读诊断，不要静默失败。
- 主题应用前生成当前状态快照，应用后可一键回滚。

### 5. 可访问性和稳定性

- 内置高对比度、色弱友好、低动效、大字体主题。
- 检测文字与背景对比度，至少提示 WCAG AA 风险。
- 注入必须幂等，重复运行不能创建重复 style、菜单或监听器。
- 使用严格的超时、重试、连接关闭和日志策略。
- 不因主题资源损坏导致 WorkBuddy renderer 崩溃。

## 五、建议架构

请按清晰模块拆分，至少包括：

```text
apps/
  daemon/              # 托盘/守护进程
  editor/              # 独立主题编辑器
packages/
  cdp-client/          # CDP HTTP target discovery + WebSocket session
  injector/            # CSS/变量注入、恢复、幂等检查
  theme-schema/        # schema、校验、导入导出
  adapters/            # WorkBuddy 版本适配器
  diagnostics/         # doctor、selector 命中率、日志
themes/
  builtin-*/           # 仅原创或明确许可素材
scripts/
docs/
tests/
```

如果实际选择单包结构，必须保留等价的职责边界，并解释取舍。

## 六、命令行接口

至少实现以下命令，命名可以调整但功能不能缺失：

```text
wb-theme doctor
wb-theme status
wb-theme list
wb-theme apply --theme <id>
wb-theme pause
wb-theme restore
wb-theme daemon
wb-theme create --image <path> --name <name>
wb-theme import <file.wbtheme>
wb-theme export <id> --out <file.wbtheme>
wb-theme validate <file-or-id>
wb-theme inspect
wb-theme rollback
```

所有命令都要有 `--json` 机器可读输出和友好的中文/英文错误信息。危险操作（例如重启 WorkBuddy）要提前提示用户保存未完成工作。

## 七、实现顺序

请按以下顺序完成，不要只生成空目录或伪代码：

1. 检查当前目录和工具链，创建项目骨架、许可证和 `.gitignore`。
2. 实现 CDP target discovery、连接、超时、重试和安全校验。
3. 实现主题 schema、内置原创主题、导入导出和路径安全。
4. 实现注入/恢复/快照/回滚，并适配 WorkBuddy 4.22.x 的 renderer 和 CSS 变量。
5. 实现 CLI 和 `doctor/status/validate/inspect`。
6. 实现守护进程的自动重注入。
7. 实现最小可用独立编辑器和托盘控制；如完整桌面 GUI 过大，先提供本地 Web 编辑器，但 API 和目录结构要支持后续封装。
8. 编写测试、README、故障排查和合规说明。
9. 运行格式检查、类型检查、单元测试和 Windows 端关键流程验证。

## 八、测试要求

至少包含：

- CDP 消息匹配、超时、断线和重连测试；
- target 过滤和多个 renderer 测试；
- theme schema 合法/非法测试；
- ZIP 导入导出、路径穿越和过大资源测试；
- CSS 注入幂等、恢复和回滚测试；
- 版本 adapter 和 selector 命中率测试；
- 自定义图片取色测试；
- 守护进程在 WorkBuddy 重启/renderer 刷新后的重注入测试；
- CLI JSON 输出测试。

如果无法在当前环境启动真实 WorkBuddy，必须提供 mock CDP server 和清晰的手工验证步骤，不能宣称真实端到端测试已经通过。

## 九、文档和交付物

最终应交付：

- 可运行源码；
- `README.md`（大致介绍、安装、首次运行、日常使用、恢复、故障排查、参考仓库）；
- `CONTRIBUTING.md`；
- `SECURITY.md`；
- `LICENSE`；
- `docs/architecture.md`；
- `docs/theme-format.md`；
- `docs/legal-boundaries.md`；
- 示例主题和主题制作指南；
- 测试和构建脚本；
- Windows 发布/打包说明。

README 必须明确：

- 不修改官方安装包；
- CDP 仅绑定本机回环；
- 使用时应避免运行不可信的本机程序；
- 主题不会读取或上传 WorkBuddy 业务数据；
- 第三方主题作者对其素材和许可证负责；
- 用户应自行确认符合 WorkBuddy 服务条款和当地法律。

## 十、工作方式和输出要求

- 先给出简短实施计划，然后开始创建文件和实现代码。
- 每完成一个阶段运行相应验证，并报告真实结果；不要编造测试结果。
- 遇到不确定的 WorkBuddy DOM 结构时，先实现运行时探测、适配器和诊断，不要把脆弱 selector 散落在业务代码中。
- 不要复制参考仓库的源码或素材；代码和 UI 文案要有独立实现。
- 不要修改用户已有的无关文件，不要执行破坏性 Git 操作。
- 最终报告必须列出：已实现功能、未完成项、测试命令及结果、已知风险、下一步建议。

现在开始创建 `WorkBuddy Theme Forge` 项目。先检查环境和当前目录，然后按上述顺序实现一个真正可运行的 MVP，并持续验证。
