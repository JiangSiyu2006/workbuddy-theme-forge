# Changelog

本文件记录 WorkBuddy Theme Forge 的用户可见版本变化，格式参考 Keep a Changelog，版本号遵循语义化版本（SemVer）。

## [Unreleased]

用于记录下一版本尚未发布的变化。

### Added

- 预留下一版本的变更记录区域。

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

[Unreleased]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JiangSiyu2006/workbuddy-theme-forge/releases/tag/v0.1.0
