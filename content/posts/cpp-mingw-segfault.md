+++
date = '2026-07-13T18:20:00+08:00'
title = 'MinGW-w64 编译通过运行崩？Code Runner 踩坑记'
showToc = true
tags = ['C++', 'MinGW', 'VSCode', '踩坑']
+++

## 症状

VS Code 里写了个 hello world：

```cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello world!" << endl;
    return 0;
}
```

**Ctrl+Alt+N**（Code Runner）→ 编译通过 → 运行崩：

```
[Done] exited with code=3221225477 in 1.097 seconds
```

退出的 `3221225477` 就是 `0xC0000005`，也就是 **STATUS_ACCESS_VIOLATION**——俗称段错误（segfault）。

一个 hello world 能 segfault，说明问题不在代码，在环境。

## 排查

### 第一坑：路径错了

看看编译器的实际位置：

```
$ ls /d/Apps/mingw64/mingw64/bin/g++.exe
```

结果是 **MinGW-w64 15.2.0**（UCRT 版本），而我 Code Runner 里配的是 `D:\Apps\TDM-GCC\bin\g++.exe`——一个根本不存在的目录。

嗯，之前不知道哪个助手写进记忆里的，信了。

### 第二坑：运行时缺 DLL

路径改对后，编译确实过了，但运行还是崩。手动跑一下试试：

```
$ g++ hello.cpp -o hello.exe -static-libgcc -fexec-charset=gbk
$ ./hello.exe
Segmentation fault
```

查一下编译产物依赖的 DLL：

```
$ objdump -p hello.exe | grep "DLL Name"
    DLL Name: libstdc++-6.dll
    DLL Name: KERNEL32.dll
    DLL Name: api-ms-win-crt-environment-l1-1-0.dll
    DLL Name: api-ms-win-crt-heap-l1-1-0.dll
    ...
```

看到了吧——`libstdc++-6.dll`。这个 DLL 在 MinGW 的 bin 目录下，但**不在系统的 PATH 里**。运行时找不到它，直接崩。

前面的 `-static-libgcc` 只处理了 `libgcc` 的静态链接，没管 `libstdc++`。

### 验证

分别试了几种编译方式：

| 编译选项 | 结果 |
|---------|------|
| 无特殊选项 | ❌ 运行崩 |
| `-static-libgcc` | ❌ 运行崩 |
| `-static-libgcc -static-libstdc++` | ✅ 正常输出 |
| `-static`（全静态） | ✅ 正常输出 |

`-static` 也能解决，但编译产物体积会大很多。只加 `-static-libstdc++` 就够了——把 C++ 标准库静态链接进 exe，不依赖外部的 `libstdc++-6.dll`。

## 最终方案

Code Runner 的配置改成：

```json
"cpp": "cd $dir && D:\\Apps\\mingw64\\mingw64\\bin\\g++.exe $fileName -o $fileNameWithoutExt.exe -static-libgcc -static-libstdc++ -fexec-charset=gbk && $dir$fileNameWithoutExt.exe"
```

两个关键点：

- **`-static-libgcc -static-libstdc++`** → 静态链接 GCC 和 C++ 运行时，不依赖外部 DLL
- **`-fexec-charset=gbk`** → 确保中文输出在 Windows 终端不乱码（UTF-8 源码 → GBK 运行时编码）

三个 C++ 项目的 `.vscode/settings.json` 里同理也加上了。

## 教训

1. **信任但验证**——助手写的路径要检查，TDM-GCC 变成了 MinGW-w64 我也不知道过了多久
2. **Code Runner 的坑**——它只编译不验证运行环境，编译通过不代表能跑
3. **MinGW DLL 依赖**——`-static-libgcc` 不够，要配套 `-static-libstdc++`，要不然写再多代码还是崩在第一条 `cout`
