+++
date = '2026-07-07T20:38:00+08:00'
title = '从 Vue + fetch 到现代 Web 架构：一些踩坑后的认知'
showToc = true
tags = ['前端', 'Vue', 'Spring Boot', '架构']
+++

最近用 Vue 3 + Spring Boot 写论坛，踩了不少坑。回头整理一下，发现很多我以为"理所应当"的认知其实都是错的。

## URL 里的 # 号

一开始路由全是 `localhost/#/user` 这种带 `#` 的，以为 Vue Router 就这样。后来才知道这是 Hash 模式——默认值，不需要后端配合但 URL 丑。

换成 History 模式：

```js
// Vue Router
const router = createRouter({
  history: createWebHistory(),  // 不是 createWebHashHistory()
  routes: [...]
})
```

改完访问 `localhost/user` 确实干净了，但一刷新就 404。因为浏览器把 `/user` 当成真实路径发给了后端，后端根本没这个路由。

Nginx 加一行兜底就解决了：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

找不到对应文件就把请求还给前端入口，让 Vue Router 自己接管。这个组合才是 SPA 的标准玩法。

## 前后端分离不等于前端直接调后端

我之前理解的"前后端分离"就是：浏览器 `fetch` 后端 API，拿到 JSON 渲染。简单粗暴。

但像淘宝这种体量的网站不可能这么搞。实际架构是三层：

**后端（Spring Boot / Go）** → 管数据库和业务逻辑，不直接对着浏览器。

**BFF 层（Node.js）** → 把后端几十个零散接口聚合成前端一个页面需要的数据，该裁的裁、该拼的拼。

**前端（Vue / React）** → 只管交互和渲染。

需要 SEO 的页面（比如商品详情），BFF 层直接跑一遍组件渲染出带数据的 HTML 发回去（SSR）。不需要 SEO 的强交互页面（比如购物车），纯前端 CSR。不是说用了 SSR 就全站 SSR，CSR 就全站 CSR——看场景混着用。

## SSR ≠ 放弃 Spring Boot

学 Nuxt.js 的时候我最大的困惑：这玩意是 Node.js 框架，用它了是不是 Spring Boot 就废了？

不是。Nuxt / Next 是"前端元框架"，不是替代后端的。引入 SSR 之后架构长这样：

```
浏览器 → Nuxt (Node.js) → Spring Boot (Java)
```

Nuxt 在这一层做的事情：收到请求、跑 Vue 组件、像普通前端一样 fetch 后端拿 JSON、拼成完整 HTML 返回浏览器。

**Spring Boot 是后厨炒菜的，Nuxt 是传菜的**。菜还是 Java 后端做的，Node 只负责摆盘。

顺带一提，用了 SSR 之后路由自动就是 History 模式，上面说的刷新 404 问题直接没了——因为每个请求都是 Node 实时处理的，不是纯静态文件。

## Pinia 不是什么都往里塞

之前觉得 Pinia（或者说 Vuex）就是前端数据库，所有从后端拿的数据都应该存进去。帖子列表、用户详情、评论列表……全往 store 里塞。

然后发现自己在手写一套简陋的数据缓存系统：手动维护 loading 状态、手动处理请求失败重试、手动清理过期数据。累死。

后来才搞明白分类：

- **客户端状态** → Pinia。比如用户登录态、侧边栏开没开、主题切没切。这些跟后端没关系，纯前端的事。
- **服务器状态** → 用数据获取库。比如帖子列表、用户信息。本质上就是从后端拿回来的缓存副本，用专门的库（`useFetch`、TanStack Query 之类）直接写在组件里，让库去管缓存、去重、重试。

之前 `fetch` 一把梭的思路，说白了是拿工具写业务，而不是让工具帮你干脏活。

## 总结

回过头看，之前 Vue + fetch 的写法本质是单体前端思维——把所有逻辑堆在一起。现代 Web 开发的核心是把职责拆清楚：后端管数据、BFF 管聚合渲染、前端管交互、Nginx 管路由分发。

技术选型不是二选一。要不要 SEO、要不要多端复用、要不要首屏秒开——根据场景挑工具，混着用才是常态。
