---
title: 0.0.0.0 & 127.0.0.1 & 本机IP的差别
date: 2022-03-31 14:13:38
updated: 2022-03-31 14:13:38
tags:
  - 计算机网络
  - 部署
---

同事在部署项目到部署环境上启动验证的时候，使用 curl 访问本机 IP 的时候 Connection refused 的了。因为 HTTP 服务启动时监听的 Host 是 127.0.0.1,导致了只有目的地址是 127.0.0.1 的请求才能被进程处理。借此也了解学习了一下 0.0.0.0 & 127.0.0.1 & 本机 IP 的差别。

## 地址对比

### 0.0.0.0

代表的是本机所有 IP 地址,无论主机绑定了多少 IP 地址,只要监听了本机的 0.0.0.0 上的端口，就等于监听机器上的所有 IP 的该端口。**主机所有 IP 各自所在网络的请求都可以被接收**。

### 127.0.0.1

是[环回地址（Loopback Address）](https://baike.baidu.com/item/%E5%9B%9E%E9%80%81%E5%9C%B0%E5%9D%80/8021522),代表本地主机。发往环回地址的请求，会在 **IP 层**短路，不再向下传递，而是立即返回。一般用于网络软件测试或进程间通信。
需要注意的是，如果进程监听的是本机的 127.0.0.1 上的端口，就只能接受**来自本机的请求**。

### 本机 IP

本机 IP 是开放的 IP 地址，在网络中代表本机的 IP 地址，可通过这些 IP 地址远程访问或控制主机。进程的监听效果跟 127.0.0.1 相同，只有在 **IP 所在网络内的请求**才可以被接收,**不包括本机**。
即，主机有一个内网地址 IP 和一个外网地址 IP，监听哪个网络的 IP 就只能接收来自该网络内发往该 IP 的请求。

### localhost

**localhost 不是 IP 地址，而是一个在本地的 hosts 文件里定义好解析后 IP 的域名**，一般解析为 127.0.0.1，所以一般将其作为“本地主机”。
!["windows解析为ipv6地址::1,linux解析为ipv4地址127.0.0.1"](https://s3.bmp.ovh/imgs/2022/03/31/40d08de3414bee88.png "windows解析为ipv6地址::1,linux解析为ipv4地址127.0.0.1")

### 总结

- 127.0.0.1 和 localhost 代表本地主机，发送到该目的地址的请求不参与网络传输，一般只用于本地测试。
- 本机 IP 代表网络中的本机，本机 IP 是主机多个 IP 中的一个。
- 0.0.0.0 代表主机所有的 IP，包括内外网地址和环回地址。
  | 名称 |定义|特性|作为 Host 接收何种请求|
  | -- |--|--|--|
  | 127.0.0.1 |这是一个[回送地址](https://baike.baidu.com/item/%E5%9B%9E%E9%80%81%E5%9C%B0%E5%9D%80/8021522)，即主机 IP 堆栈内部的 IP 地址。|使用回送地址发送数据，协议软件立即返回，不进行任何网络传输;|只接受本地请求|
  | 本机 IP |一种由网络地址和主机地址组成的互联网协议地址，目前存在 IPv4 和 IPv6 两种协议的 IP 地址。|在同一个网络地址下，主机间可相互访问。代表在该网络地址下的本机|只接受来自 IP 所在网络请求，不包括本机|
  | 0.0.0.0 |在 IPv4 中，它是一个不可路由的元地址，用于指定无效、未知或不适用的目标。|any IPv4 address at all，所在所有网络下的本机|接收任意来源请求|

## 程序验证

其实这种问题很少遇到，一般网络框架都会对监听的 Host 有一个缺省值，即 0.0.0.0，除非指定了 host。下面就是通过显式声明来指定进程监听的 host 来验证。

```javascript
// 验证代码
const http = require("http");
const url = require("url");

const host = "127.0.0.1";
const port = 8080;

http
  .createServer(function (request, response) {
    const { query } = url.parse(request.url, true);
    console.log(query.name);
    response.write(`Hello ${query.name || "Stranger"} , You can access me!\n`);
    response.end();
  })
  .listen(port, host);
console.log(`Server running at http://${host}:${port}/`);
```

测试环境使用 windows 和 wsl 作为同一局域网下的两台主机,wsl 运行验证程序,同样使用 curl 进行验证。
!["WSL主机IP eth0-inet:172.20.163.64"](https://s3.bmp.ovh/imgs/2022/03/31/9ddc682431a989d8.png "WSL主机IP eth0-inet:172.20.163.64")

> **注意：**事实上，windows 和 wsl 并不适合作为测试，因为他们共享了 127.0.0.1 和 localhost,并且 windows 下的 0.0.0.0 是无效地址了。这里只是目前手头比较快速的验证方法

### host="127.0.0.1"

![](https://s3.bmp.ovh/imgs/2022/03/31/75ccd5aa7d8e30b6.png)

### host="172.20.163.64" (本机 IP)

![](https://s3.bmp.ovh/imgs/2022/03/31/5bf775d54a808504.png)

### host="0.0.0.0"

![](https://s3.bmp.ovh/imgs/2022/03/31/f13de708fb8db9b3.png)

## 参考资料

1. [localhost、127.0.0.1、0.0.0.0 的联系与区别](https://juejin.cn/post/7065520262573195294)
2. [【计算机网络】0.0.0.0 与 127.0.0.1 的区别](https://blog.csdn.net/m0_45406092/article/details/118860649)
