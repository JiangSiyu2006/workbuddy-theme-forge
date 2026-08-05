# Versioning and release workflow

项目可以直接上传到 GitHub，并通过“小步提交 + 版本标签 + CHANGELOG”持续迭代。当前版本是 `v0.2.1`，修复基线标签为保持不变的 `v0.2.0`。

## 版本号规则

使用语义化版本：`MAJOR.MINOR.PATCH`。

- `PATCH`：向后兼容的 bug 修复、文档修正、测试补充。
- `MINOR`：向后兼容的新能力，例如新主题字段、新 CLI 命令或编辑器功能。
- `MAJOR`：不兼容的 schema、CLI、主题包或运行方式变化。
- 尚未稳定的版本可使用 `0.x.y`；例如 `0.2.0` 表示下一阶段 MVP 能力，`1.0.0` 再表示稳定 API。

`package.json` 的 `version` 是唯一版本来源；发布时同步创建新 Git tag，例如 `v0.2.1`，不得移动或覆盖既有 `v0.2.0`。

## 迭代流程

1. 从 `main` 创建短分支，例如 `feat/theme-editor` 或 `fix/cdp-timeout`。
2. 每次提交只做一个清晰变化，提交前运行 `npm run lint` 和 `npm test`。
3. 在 `CHANGELOG.md` 的 `Unreleased` 下记录用户可见变化。
4. 发布时更新 `package.json` 版本号和 changelog 日期，提交并创建 tag。
5. 推送分支和 tag 到 GitHub，使用 GitHub Release 粘贴对应 changelog 内容。
