+++
date = '2026-05-29T13:50:00+08:00'
title = 'Oh My OpenAgent 只显示 plan/build 两个 Agent 的修复记录'
showToc = true
tags = ['opencode', 'omo', 'oh-my-openagent', 'ai']
+++

## 问题

装了 oh-my-openagent 之后，`opencode agent list` 和执行 `npx oh-my-openagent doctor` 都显示正常，但 opencode TUI/Desktop 的 Agent 选择器里**只显示 `plan` 和 `build`**，没有 Sisyphus、Prometheus、Oracle 等 OMO Agent。

这个问题在官方仓库有多人在追踪：

- [#3456](https://github.com/code-yeongyu/oh-my-openagent/issues/3456) — "[Question]: installed OMO, reopen opencode can not find Sisyphus in agents"
- [#3835](https://github.com/code-yeongyu/oh-my-openagent/issues/3835) — "[Bug]: oh-my-openagent custom agents not showing in OpenCode Desktop UI after v1.14.x update"

## 原因分析

实际导致这个症状的原因有两种，需要对症排查：

### 原因一：配置作用域不匹配

OpenCode 的配置文件有两个层级：

| 作用域 | 路径 | 优先级 |
|--------|------|--------|
| 全局 | `~/.config/opencode/opencode.json` | 低 |
| 项目本地 | `.opencode/opencode.json`（启动目录下） | **高** |

通过 `npx oh-my-openagent install` 安装时，写入的是**全局**配置。但如果启动 opencode 的工作目录下恰好存在 `.opencode/opencode.json`（哪怕只有简单几行），opencode 就会优先读这个本地配置，而本地配置可能没有注册插件。

在我自己的环境里，`C:\Users\lenovo\Documents\.opencode\opencode.json` 就这么存在了，导致插件似乎装了但 opencode 不认。

### 原因二：插件缓存损坏

另一个更隐蔽的问题是 OpenCode 的插件缓存目录 `~/.cache/opencode/packages/oh-my-openagent@latest/` 中 `node_modules` 不完整。典型表现为 `zod` 模块缺少运行时的 JS 入口文件：

```
Failed to load plugin oh-my-openagent@latest:
Cannot find module 'C:\Users\xxxxx\.cache\opencode\packages\oh-my-openagent@latest\node_modules\zod\index.js'
```

插件根本没加载起来，Desktop 自然就只能显示本地 Agent。

## 解决方案

### 步骤一：修复配置作用域

从 opencode 的**启动工作目录**执行：

```powershell
opencode plugin oh-my-openagent@latest
```

这条命令会把插件注册到 opencode **实际在用的**那个 `opencode.json`，并确保缓存目录安装完整。

如果不确定 opencode 读的是哪个配置，看命令输出里的 `Scope` 行：

```
•  Scope: local (C:\Users\xxx\Documents\.opencode)
```

### 步骤二：重建插件缓存（如果步骤一无法解决）

如果上面跑完还是不行，说明缓存已经损坏，需要完全重建：

```powershell
# 1. 关闭 opencode Desktop/TUI

# 2. 删除缓存
Remove-Item -LiteralPath "$env:USERPROFILE\.cache\opencode\packages\oh-my-openagent@latest" -Recurse -Force

# 3. 重新安装插件（会自动重建缓存）
opencode plugin oh-my-openagent@latest
```

### 步骤三：验证

```powershell
# 检查 zod 完整
Test-Path "$env:USERPROFILE\.cache\opencode\packages\oh-my-openagent@latest\node_modules\zod\index.js"
# 应返回 True

# 检查 doctor
npx oh-my-openagent doctor
# 应显示 System OK，仅 GitHub CLI missing 可忽略
```

重启 opencode，Agent 列表应该出现 Sisyphus、Hephaestus、Prometheus、Atlas 等全部 Agent。

## 总结

| 症状 | 可能原因 | 修复 |
|------|----------|------|
| doctor OK 但 Agent 列表不完整 | 配置作用域不匹配 | `opencode plugin oh-my-openagent@latest` |
| 同上 | 缓存损坏（zod 等模块缺失） | 删除缓存后重装 |

这两个原因都跟 OpenCode 的插件加载机制有关：它通过本地缓存加载插件，同时配置作用域优先级容易让人踩坑。Issue #3835 的 Desktop `mode` 字段过滤问题已在 OMO 4.x 中修复，但缓存完整性仍需要用户自行确保。
