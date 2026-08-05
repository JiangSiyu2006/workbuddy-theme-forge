# Changelog

本文件记录 WorkBuddy Theme Forge 的用户可见版本变化，格式参考 Keep a Changelog，版本号遵循语义化版本（SemVer）。

## [Unreleased]

用于记录下一版本尚未发布的变化。

## [0.2.1] - 2026-07-28

### Fixed

- 修复控制台内联脚本转义错误；主题列表、预览、保存、加载、应用、导入和导出恢复可用。
- 控制台改为独立静态模块和表单状态模型，支持即时结构化预览、校验、撤销/重做、草稿保护，以及内置主题自动复制后编辑。
- 预览与实际注入共用语义 token，补齐 WorkBuddy 5.3.5 侧栏、主内容、输入区、代码区、详情面板、背景、圆角、阴影、毛玻璃、字体和动效映射。
- adapter 现要求根节点、侧栏和主内容全部命中；主题 selector 仅作为经过语法校验的兼容扩展，并支持未知版本的严格身份/DOM/变量签名匹配。
- 修复 `appearance:auto` 恢复、版本未知时 daemon 重复注入、WebSocket 超时清理和控制台/daemon 竞争。
- 多 renderer 应用改为先保存全部快照的事务式注入，部分失败会回滚并保留正确状态与 renderer 错误详情。
- `npm run start:control` 改用确认式 Windows 管理启动：不再发现或复用已有 CDP；未运行时输入 `YES` 后启动 WorkBuddy，已运行时输入 `YES` 后重启 WorkBuddy，再打开控制台。
- `ws` 调整为运行时依赖，并扩充控制台脚本、编辑契约、adapter、CDP、超时和多 renderer 事务测试。

## [0.2.0] - 2026-07-27

### Added

- WorkBuddy 5.3.x adapter、逻辑区域诊断、深浅外观同步和多 renderer 注入。
- 本地 Web 控制台、会话令牌防护、Windows 确认式启动器和进程内守护。
- `resume`、`duplicate`、`logs`、`serve` 与 `apply --force` CLI 能力。
- 图片背景控制、安全 CSS、标准 ZIP store/deflate、资源限制和冲突策略。
- `Aurora Dawn` 浅色主题以及重做的 `Aurora Night` 深色主题。
- mock CDP、状态迁移、控制台、主题包、CSS、图片和启动器测试。

### Changed

- 主题状态明确为 `active`、`paused` 和 `native`，暂停不再丢失主题选择。
- 守护通过主题 ID 和 CSS 哈希检测刷新、样式丢失及新 renderer。
- 状态、快照和主题使用原子写入；内置主题不可覆盖、编辑或删除。

### Security

- 主题包拒绝路径穿越、链接、重复路径、嵌套压缩包、未登记文件和过量解压数据。
- 自定义 CSS 禁止外部资源和危险 at-rule，并限制在当前激活主题作用域。

## [0.1.0] - 2026-07-25

首个可运行 MVP，适合作为 GitHub 仓库初始版本。

### Added

- 本机回环 CDP target 发现、连接、超时和 renderer 过滤。
- CSS/主题变量注入、幂等恢复、快照和回滚。
- `theme.json` schema 校验、WCAG 对比度检测和原创 `Aurora Night` 内置主题。
- `.wbtheme` 导入、导出、主题目录扫描和路径穿越防护。
- 完整 CLI 命令集与 `--json` 输出。
- 本地 Web 主题编辑器和自动重注入守护逻辑。
- 架构、主题格式、Windows 使用、安全边界和贡献指南文档。
- CDP、主题 schema、注入器基础单元测试。

### Known limitations

- 尚未提供原生 Windows 系统托盘 GUI。
- ZIP 导入器当前为无外部依赖 MVP，通用压缩算法兼容性仍需增强。
- 图片自动取色、复杂裁剪和完整版本命中率诊断尚未完成。

[Unreleased]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/releases/tag/v0.1.0
