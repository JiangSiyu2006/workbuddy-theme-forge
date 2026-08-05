# Windows notes

推荐入口：

```powershell
npm run start:control
```

等价的显式脚本入口：

```powershell
.\scripts\start-control.ps1 -OpenBrowser
```

启动器依次检查显式 `-WorkBuddyExe`、`WORKBUDDY_EXE`、常见安装目录和卸载注册表，并要求 Node.js 20+。

启动器不查找、不连接也不复用任何已有 CDP。WorkBuddy 未运行时，只有准确输入 `YES` 后才会启动 WorkBuddy 和控制台；WorkBuddy 已运行时，会先提醒保存未完成任务，只有准确输入 `YES` 后才开始重启并打开控制台。

重启时，启动器先请求主窗口正常关闭，短暂等待后会强制终止仍残留的 WorkBuddy 后台及子进程，确认全部退出后再启动新实例。启动参数包含 `--remote-debugging-address=127.0.0.1`；优先使用空闲的 `9223`，被占用时选择空闲高位端口。启动器只校验自己刚刚启动的端口是否出现 WorkBuddy renderer，不会回退搜索其他端口。

参数：

```powershell
.\scripts\start-control.ps1 -CdpPort 9223 -ControlPort 4782 -WorkBuddyExe C:\path\WorkBuddy.exe -OpenBrowser
```

控制台端口被占用时，Node.js 服务最多尝试后续 9 个端口。低级入口 `node src/cli.mjs serve --port <cdp-port>` 保留给已知端口场景。v0.2.1 不安装系统托盘、服务、开机项或计划任务。

正式支持基线为 Windows WorkBuddy `5.3.5`。其他版本会显示为未知或实验性；只有严格身份、必需 DOM 区域和关键变量签名全部匹配时才允许未知版本回退，否则默认拒绝，CLI 可用 `--force` 显式继续。
