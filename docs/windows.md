# Windows notes

推荐入口：

```powershell
.\scripts\start-control.ps1 -OpenBrowser
```

启动器依次检查显式 `-WorkBuddyExe`、`WORKBUDDY_EXE`、常见安装目录和卸载注册表，并要求 Node.js 20+。

如果 `127.0.0.1:9223` 尚无 WorkBuddy renderer，启动器会提醒保存未完成任务。只有准确输入 `YES` 后才会正常关闭 WorkBuddy，并使用 `--remote-debugging-port=9223` 启动；其他输入不会改变 WorkBuddy。

参数：

```powershell
.\scripts\start-control.ps1 -CdpPort 9223 -ControlPort 4782 -WorkBuddyExe C:\path\WorkBuddy.exe -OpenBrowser
```

控制台端口被占用时，Node.js 服务最多尝试后续 9 个端口。v0.2.0 不安装系统托盘、服务、开机项或计划任务。

正式手动验证基线为 Windows WorkBuddy `5.3.5`。其他版本会显示为未知或实验性；默认应用会拒绝未知版本，CLI 可用 `--force` 显式继续。
