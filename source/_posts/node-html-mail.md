---
title: Html mail编写
date: 2020-09-25 17:19:00
updated: 2020-11-10 17:15:00
tags:
---
项目中的各个流程需要使用邮件通知相关人员流程的信息，当前项目仍然使用简单的字符串拼接的方式生成邮件内容，邮件样式比较简单，不够美观。可以使用html mail的方式发送样式丰富的邮件。并通过服务端渲染来替代简单的字符串拼接，让前端人员参与模板文件的开发，后端人员只需要拿到数据渲染到模板上得到最终的html发送给目标邮箱。
[阮一峰的Html mail编写指南](http://www.ruanyifeng.com/blog/2013/06/html_email.html),本文档参照腾讯云文档的样式来编写Html mail,因为邮件的html显示会受到对应邮件客户端兼容性的影响，所以尽量使用table布局，只使用内联样式。

## 环境准备
主要使用的依赖有：
* nodemailer(邮件发送)
* ejs(服务端渲染)
* koa-bodyparse(解析request的body，接收参数)
* koa-router(路由)
* koa-log4(日志打印)

使用nodemailer发送邮件，使用ejs模板引擎将数据渲染到模板文件上得到html字符串。服务端框架使用koa2。
![目录结构](https://s3.bmp.ovh/imgs/2022/04/05/9346e609aa4bd385.png "目录结构")
