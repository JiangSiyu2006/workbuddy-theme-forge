# `.wbtheme` format

主题包是 ZIP 容器：

```text
theme.json
theme.css
assets/        # theme.json 中明确登记的图片
preview.png    # 可选
LICENSE
```

`schemaVersion` 仍为 `1`。v0.2.1 保持 v0.2.0 的可选字段和主题包结构，无需迁移：

```json
{
  "appearance": "dark",
  "background": {
    "fit": "cover",
    "zoom": 1,
    "positionX": 50,
    "positionY": 50,
    "opacity": 1,
    "blur": 0,
    "overlayColor": "#000000",
    "overlayOpacity": 0,
    "vignette": 0
  }
}
```

- `appearance`: `auto`、`light` 或 `dark`。旧主题默认为 `auto`。
- `fit`: `cover` 或 `contain`；`zoom` 为 `1..3`；位置为 `0..100`。
- 图片透明度、遮罩透明度和暗角为 `0..1`；图片模糊为 `0..40`。
- 资源必须使用包内安全相对路径，推荐 `assets/background.png`。
- 自定义 CSS 最多 256 KiB，禁止远程 URL、`@import`、`@font-face` 和未登记资源。
- 导入器限制压缩包 32 MiB、解压后 64 MiB、64 个条目和单图 10 MiB。
- 导入 ID 冲突默认拒绝；可选择 `copy` 或 `replace`。内置主题永远不能被覆盖。
- 主编辑器展示已验证映射的主色、辅色、背景、表面、文字、边框和错误色；`warning`、`success` 继续保存在 schema 中以兼容旧主题。
- 主题 selector 经过 CSS 语法校验，并作为 adapter 稳定 selector 的兼容扩展；高级 CSS 依赖真实 WorkBuddy DOM，结构化预览不保证完整呈现。
