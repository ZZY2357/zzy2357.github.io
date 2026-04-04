+++
date = '2026-04-04T12:38:49+08:00'
title = '使用 SSH 建立 Socks5 代理'
showToc = true
tags = ['ssh']

+++

只要知道服务器的 IP 和 密码就能直接建立，不需要额外安装软件

在本地执行：

``` bash
ssh -D port user@passwd
```

然后输入密码连接，看上去跟平常使用 SSH 一样，但是在本地已经建立了一个连接到服务器的 Socks5 代理，这个时候更改代理为 `Socks5` 类型的代理：`127.0.0.1:port` 即可。
