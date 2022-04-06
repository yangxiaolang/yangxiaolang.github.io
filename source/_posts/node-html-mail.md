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
<!-- ![目录结构](https://s3.bmp.ovh/imgs/2022/04/05/9346e609aa4bd385.png "目录结构") -->
```shell
.
├── app                     // 业务代码
│   └── controller
│       └── sendMail.js
├── app.js                  // 入口文件
├── config                  
│   ├── logger.js           // 日志配置
│   └── transporter.js      // 发件人配置
├── logs                    // 日志
├── middleware          
│   ├── accessLogger.js     // 请求记录中间件
│   └── timer.js            // 请求计时中间件
├── package-lock.json
├── package.json
├── router                  // 路由
│   └── index.js
├── static
│   └── logo.png            // 邮件logo图片
├── utils
│   └── logger.js
└── views                   // 模板目录
    ├── applyExamined.ejs
    ├── handleApply.ejs
    ├── releaseApply.ejs
    ├── releaseExamined.ejs
    └── tokenNotify.ejs
```

## 邮件模板编写
因为即使是相同流程的邮件，因为信息的不同，所发邮件的内容也应该不同，所以要在服务端发送邮件之前，要将数据写到模板上得到最终发送给客户端的Html字符串。跟JSP这些服务端渲染技术是一样的。
因为这里使用的是Node.js,所以模板引擎是ejs,发送邮件使用的是nodemailer。因为项目后端是java，所以最后落地使用的是freemaker。
先写好作为模板的html文件，确认好整体框架样式后，将需要模板引擎处理的部分使用模板标签标记，重命名为ejs可读的ejs文件。
```html
<!-- 考虑兼容性，尽量使用table做布局 -->
<body>
    <table style="width:800px;margin:0 auto;background: rgb(247, 248, 250);padding-top: 8px;">
        <tr>
            <td style="padding-left:50px;"><img style="width: 120px;height:50px;display: block;" src="cid:01">
            </td>
        </tr>
        <tr>
            <td>
                <table
                    style="width: 700px;margin:0 auto;background-color: white;border-top: 3px solid rgb(30, 180, 255);">
                    <tr>
                        <td style="padding-left:2rem;padding-right:2rem;">
                            <h2 style="margin-top:10px">能力授权申请已被审批</h2>
                            <p>尊敬的AI能力开放平台用户，您好！</p>
                            <span>您的系统&nbsp;&nbsp;<span
                                    style="font-weight: bold;"><%= systemName %></span>&nbsp;&nbsp;的能力授权申请已被
                                <% if(status) {%>
                                <span style="color:blue;font-weight: bold;">通过</span>。</span>
                            <p>系统授权码为：<span style="font-weight: bold;"><%= token %></span></p>
                            <% } %>
                            <% if(!status) {%>
                            <span style="color:red;font-weight: bold;">拒绝</span>。</span>
                            <% } %>

                            <p>授权能力概略如下：</p>
                            <br />
                            <table border="1" cellspacing="0"
                                style="width: 100%;border-color:lightgray;text-align: center;font-size: 12px;">
                                <tr style="background: lightgray;">
                                    <th>能力ID</th>
                                    <th>能力名称</th>
                                    <th>调用地址</th>
                                </tr>
                                <% data.forEach(function(item){%>
                                <tr>
                                    <td><%= item.capabilityId %></td>
                                    <td><%= item.capabilityName %></td>
                                    <td><%= item.abilityUrl %></td>
                                </tr>
                                <% }) %>
                            </table>
                            <!-- <br />
                            <p>请等候平台运营者的审批。</p> -->
                            <br />
                            <p style="font-size: 14px;">此致</p>
                            <p style="font-size: 14px;font-weight:bold;color: gray;">AI产品团队</p>
                            <br />
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr style="text-align: center;">
            <td style="font-size: 12px;color: gray;">
                <br />
                <p>此为系统邮件，请勿回复。</p>
                <p>© 2018 信息技术股份有限公司</p>
                <br />
            </td>
        </tr>
    </table>
</body>
```
通过模板引擎，我们可以在模板文件上做好标记，将数据按照标记的规则插入，并且能使用JS的语法和API进行流程控制，比如if和Array.prototype.forEach等。
之后在Node中将模板和对应的数据模型拼装成我们需要的Html字符串。
```javascript
const templatPath = '../../views/' + ctx.params.name + '.ejs'   //根据sendMail/:name的name决定使用的模板文件
const { toAddress,subject,data,flag,appName,tokenContent } = ctx.request.body               //获取request携带的数据
const template = ejs.compile(fs.readFileSync(path.resolve(__dirname, templatPath), 'utf-8'))    //读取模板文件
const mailData = {
    data,
    status:flag,
    systemName:appName,
    token:tokenContent
}
const html = template(mailData)     //将request的data渲染到模板输出html
```

## 邮件发送
得到了渲染好的html就能借助nodemailer将我们的邮件发出去了。需要预先配置我们的邮件传输服务器的凭证，才能通过smtp去发送邮件。
```javascript
// transporter.js
// 邮件传输服务器配置
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    host:'from smtp server address',
    port:25,
    secureConnection:false,
    auth:{
        user:'user',
        pass:'pass'
    }
})

module.exports=transporter


// sendMail.js
const mailOption = {            // 邮件内容配置
    from:'from address',
    to:toAddress,//收件人
    subject,//标题
    html,//html内容
    //附件,如果mail内容有插入媒体，媒体文件则来自附件，由cid指定
    // <img style="width: 120px;height:50px;display: block;" src="cid:01">
    attachments: [{ 
        filename: 'logo.png',
        path: path.resolve(__dirname, '../../static/logo.png'),
        cid: '01'
    }]
}
const start = new Date().getTime()
transporter.sendMail(mailOption, (error, info) => {
    const end = new Date().getTime()
    if (error) {
        log.error(`sendMail Failure  cost : ${end-start}ms`)    //失败打印日志
        log.error(error)
        return
    }
   log.info(`sendMail Success  cost : ${end-start}ms`)  //成功打印日志
   log.info(info)
})
```
## 不同邮件客户端的效果展示

验证过了公司邮箱、163邮箱和foxmail客户端都能够正常显示,但是样式最终都有所差别
### 163邮箱
![163邮箱](https://s3.bmp.ovh/imgs/2022/04/06/afe09763eda492fc.png "163邮箱")
### 公司邮箱
![公司邮箱](https://s3.bmp.ovh/imgs/2022/04/06/fe195b6b169d2b28.png '公司邮箱')
### foxmail邮箱客户端
![foxmail邮箱客户端](https://s3.bmp.ovh/imgs/2022/04/06/e184e7fbbf3ebcb5.png "foxmail邮箱客户端")