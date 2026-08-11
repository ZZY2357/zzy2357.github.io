+++
date = '2026-08-05T16:55:20+08:00'
title = '手写 HTTP 服务器'
showToc = true
tags = ['http', 'web', 'python', 'socket', 'asyncio']

+++

本文将从 TCP socket 出发，用 Python 手把手实现一个最小可用的 HTTP 服务器。

## 什么是 socket？

Socket（套接字）是操作系统提供给应用程序的网络通信接口，支持 TCP 和 UDP 协议。有了 socket，你只需要发送和接收数据，而无需关心底层网卡、路由等复杂细节。Python 也拥有操作 socket 的标准库，可以使用 socket 在 Python 中接收和发送数据。

### 客户端 Socket

```bash
# 用 netcat 建立一个 TCP 服务器，只要连接上就会发送 Hello world!
$ echo "Hello world!" | nc -lvnp 6767
```

```python
import socket

client_socket = socket.socket(
    socket.AF_INET,		# 使用 IPv4
    socket.SOCK_STREAM	# 使用面向流的TCP协议
)

# 连接到 127.0.0.1:6767
client_socket.connect(('127.0.0.1', 6767))
# 一次性接收最大 1024 字节的数据
print(client_socket.recv(1024))
# b'Hello world!\r\n'
```

### 服务端 Socket

```python
import socket

server_socket = socket.socket(
    socket.AF_INET,		# 使用 IPv4
    socket.SOCK_STREAM	# 使用面向流的TCP协议
)
# 允许端口复用，避免重启时 "Address already in use"
server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
# 绑定到 127.0.0.1:6767，此时还没有开始监听
server_socket.bind(('127.0.0.1', 6767))
# 开始监听，括号里填一个整数可以指定最大同时连接数
server_socket.listen()
print('服务器正在运行')

while True: # 重复等待连接
    conn, addr = server_socket.accept()
    print(f'{ addr } 已连接')
    conn.sendall(b'Hello world!') # 发送完整的数据
    conn.close()
```

```bash
$ nc 127.0.0.1 6767
Hello world!
```

## HTTP 协议（摘自 MDN）

HTTP 是一种用作获取诸如 HTML 文档这类资源的协议。它是 Web 上进行任何数据交换的基础，同时，也是一种客户端—服务器（client-server）协议，也就是说，请求是由接受方——通常是 Web 浏览器——发起的。完整网页文档通常由文本、布局描述、图片、视频、脚本等资源构成。

### HTTP 请求

![HTTP 请求](https://mdn.github.io/shared-assets/images/diagrams/http/overview/http-request.svg)

请求由以下元素组成：

- HTTP 方法，通常是由一个动词，像 GET、POST 等，或者一个名词，像 OPTIONS、HEAD 等，来定义客户端执行的动作。典型场景有：客户端意图获取某个资源（使用 GET）；发送 HTML 表单的参数值（使用 POST）；以及其他情况下需要的那些其他操作。
- 要获取的那个资源的路径——去除了当前上下文中显而易见的信息之后的 URL，比如说，它不包括协议（http://）、域名（这里是 developer.mozilla.org），或是 TCP 的端口（这里是 80）。
- HTTP 协议版本号。
- 为服务端表达其他信息的可选标头。
- 请求体（body），类似于响应中的请求体，一些像 `POST` 这样的方法，请求体内包含需要了发送的资源。

### HTTP 响应

![HTTP 响应](https://mdn.github.io/shared-assets/images/diagrams/http/overview/http-response.svg)

响应报文包含了下面的元素：

- HTTP 协议版本号。
- 状态码，来指明对应请求已成功执行与否，以及不成功时相应的原因。
- 状态信息，这个信息是一个不权威、简短的状态码描述。
- HTTP 标头，与请求标头类似。
- 可选项，一个包含了被获取资源的主体。

## 异步

`socket.accept` 函数是会阻塞程序的，因此在循环中，只有有新的连接加入才会从 `accept` 的那一行跳到下一行，否则将会一直等待。但是服务器是要同时和多个客户端进行交互的，需要在等待新连接的同时处理已连接的 socket，因此这样行不通。

其中一种解决办法是使用多线程，等待新连接是一个线程，每当有新的连接就新建一个线程专门处理这个连接，这样就不会因为一直等待新的连接而阻断别的事务处理了。

```python
import socket
import threading

def handle_client(conn: socket.socket, addr: tuple):
    # 处理单个客户端连接（在独立线程中运行）
    try:
        data = conn.recv(4096)
        conn.sendall(b'Hello ' + data)
    except Exception as e:
        print(f'{addr} 错误：{e}')
    finally:
        conn.close()
        print(f'{addr} 断连')

server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
# 允许端口复用，避免重启时 "Address already in use"
server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server_socket.bind(("127.0.0.1", 6767))
server_socket.listen(5)
print("服务器运行在 127.0.0.1:6767")

while True:
    conn, addr = server_socket.accept()
    print(f"{addr} 已连接")
    # 每个连接启动一个守护线程，主线程不会被阻塞
    # 当进程中所有非守护线程（即主线程和其他普通线程）都结束时，Python 解释器会立即退出，不会等待守护线程完成。
    t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
    t.start()
```

但是给每一个会话都分配一个线程实在是太浪费了，一个会话不可能频繁地发消息，在会话空闲的时候，这个线程就无事可做了，在这种低强度的并发需求下，给每一个会话分配一个线程会造成极大浪费。

那有没有一种方案，能把等待新连接和等待会话的新事务的空闲时间利用起来呢？有的，这就是异步。

### 协程

协程又叫微线程，在执行的过程中，可以随时中断，让事件循环去处理下一个任务，这样可以做到一个线程同时做多个事情。

需要注意的是，异步提升的并不是 CPU 的计算速度，而是 **IO 等待期间的利用率**。当服务器在等待某个客户端发送数据时，CPU 处于完全空闲状态；异步模型允许事件循环在此期间切换去处理其他已就绪的连接，从而在单线程内实现高并发。如果所有任务都是纯 CPU 计算、没有任何 IO 等待，那么串行执行和异步执行的总耗时确实相同——但这不是网络服务器的典型场景。

### asyncio（代码摘自菜鸟教程）

`asyncio` 是 Python 的一个内置库，主要用于编写单线程并发代码，通过协程实现异步 I/O 操作。它在 Python 3.4 版本中引入，提供了基于事件循环的并发模型。

#### 定义协程

引入 `asyncio` 库后，在 `def` 前加上 `async` 关键字即可把该函数定义为协程。

```python
import asyncio

async def say_hello():
    print("Hello")
    await asyncio.sleep(1)
    print("World")
```

#### 事件循环

事件循环是 `asyncio` 的核心组件，负责调度和执行协程。它不断地检查是否有任务需要执行，并在任务完成后调用相应的回调函数。

```python
async def main():
    await say_hello()

asyncio.run(main())
```

#### 任务

任务是对协程的封装，表示一个正在执行或将要执行的协程。你可以通过 `asyncio.create_task()` 函数创建任务，并将其添加到事件循环中。

```python
async def main():
    task = asyncio.create_task(say_hello())
    await task
```

#### Future

`Future` 是一个表示异步操作结果的对象。它通常用于底层 API，表示一个尚未完成的操作。你可以通过 `await` 关键字等待 `Future` 完成。Future 是更底层的机制，通常由库内部使用，你暂时不需要直接操作。

```python
async def main():
    future = asyncio.Future()
    await future
```

#### `asyncio` 对 socket 进行了封装

`asyncio.start_server()` 对 socket 进行了封装，可以用来创建一个异步的 TCP 服务器，包含了自动接受连接、自动处理连接的关闭与异常等功能：

```python
async def handle_client(reader, writer):
    ...
server = await asyncio.start_server(handle_client, '0.0.0.0', 4000)
async with server:
    await server.serve_forever()
```

 不过，为了更深入地理解异步 IO 与 socket 的底层交互原理，这里我们采用手动结合事件循环 (`loop.sock_accept` / `loop.sock_recv` / `loop.sock_sendall`) 操作原生 socket 的写法。

## 开始写代码

使用 `asyncio` 处理 socket 的话，一定要设置 `socket.setblocking(False)`，将服务器套接字设置为非阻塞模式，这是配合 `asyncio` 事件循环的必要前提。若保持默认阻塞模式，socket 等待时会卡住线程。这会导致整个事件循环停滞。其他并发任务也无法被处理。设为非阻塞后，可结合 `await` 异步方法使用。IO 等待时便能主动让出控制权。事件循环就能继续调度其他协程。最终实现单线程下的高并发处理。

同时，`socket.accept()` 和 `socket.sendall()` 等方法不能直接调用。它们会绕过事件循环并可能引发异常。必须替换为对应的异步版本。首先，需要使用 `asyncio.get_running_loop()` 函数获取当前正在运行的事件循环对象，然后使用 `await loop.sock_accept()` 接收连接，使用 `await loop.sock_sendall()` 发送数据。这样才能保证 IO 操作真正融入异步调度机制。

以下是基础的主事件循环：

```python
async def main():
    # 获取当前正在运行的事件循环对象
    loop = asyncio.get_running_loop()

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(('0.0.0.0', 4000))
    server_socket.listen()
    server_socket.setblocking(False) # 设置为非阻塞模式
    print(f'Server running at http://127.0.0.1:4000')

    while True:
        # 异步等待新连接
        conn, addr = await loop.sock_accept(server_socket)
        print(f'[+] { addr } connected')
        # 添加到事件循环
        asyncio.create_task(handle_client(conn, addr))

asyncio.run(main()) # `main()` 函数是协程，不能直接运行
```

现在主循环写好了，该写 `handle_client()` 函数了。该函数是一个协程，用来 处理单个客户端连接的 HTTP 请求并返回响应（本示例省略了请求解析步骤）：

```python
async def handle_client(conn: socket.socket, addr):
    loop = asyncio.get_running_loop()

    try:
        while True:
            recv = await loop.sock_recv(conn, 4096)
            if not recv: # 在 TCP 中，空数据代表对方优雅关闭了连接
                break
            await loop.sock_sendall(conn, http_response)
    except ConnectionResetError: # 对方强制关闭了连接
        pass # 引发错误已经打断了 while 循环，pass 到 finally 中
    finally:
        conn.close()
        print(f'[-] { addr } disconnected')
```

现在，我们可以专注于 `http_response` 的编写。该变量应该是一串 **`bytes`** 类型的 HTTP 响应。这里，我们读取当前目录下的 `index.html`，并作为响应主体进行发送：

```python
with open('index.html', 'rb') as f:
    html = f.read()

http_response = bytes(f'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: { len(html) }\r\n\r\n'.encode() + html)
```

### 完整代码

#### `main.py`

```python
import socket
import asyncio

with open('index.html', 'rb') as f:
    html = f.read()

http_response = bytes(f'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: { len(html) }\r\n\r\n'.encode() + html)

async def handle_client(conn: socket.socket, addr):
    loop = asyncio.get_running_loop()

    try:
        while True:
            recv = await loop.sock_recv(conn, 4096)
            if not recv: # 对方优雅关闭了连接
                break
            await loop.sock_sendall(conn, http_response)
    except ConnectionResetError: # 对方强制关闭了连接
        pass
    finally:
        conn.close()
        print(f'[-] { addr } disconnected')

async def main():
    loop = asyncio.get_running_loop()

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(('0.0.0.0', 4000))
    server_socket.listen()
    server_socket.setblocking(False)
    print(f'Server running at http://127.0.0.1:4000')

    while True:
        conn, addr = await loop.sock_accept(server_socket)
        print(f'[+] { addr } connected')
        asyncio.create_task(handle_client(conn, addr))

asyncio.run(main())
```

#### `index.html`

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Socket HTTP Server</title>
        
        <style>
            html {
                font-size: max(16px, 2vw);
            }

            .container {
                margin: 32px;
            }
        </style>

    </head>
    <body>
        <div class="container">
            <h1>This is a HTTP server based on socket!</h1>
            <p>No frameworks. No libraries. Just raw sockets and asyncio.</p>
            <h2>How it works</h2>
            <ol>
                <li>
                    <code>socket.socket()</code> creates a TCP listener on port
                    4000
                </li>
                <li>
                    <code>asyncio</code> handles multiple connections
                    concurrently
                </li>
            </ol>
            <h2>Stack</h2>
            <ul>
                <li>Python 3</li>
                <li>socket + asyncio</li>
                <li>HTTP/1.1</li>
            </ul>
        </div>
    </body>
</html>

```

这样，我们就完成了一个基于 `asyncio` 和原生 socket 的最小可用 HTTP 服务器的实现。你还可以继续完善它，比如让它不仅仅只响应 `index.html`，而是根据请求的路径来响应正确的内容；以及异常处理等功能。
