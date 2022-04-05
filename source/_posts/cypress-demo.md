---
title: Cypress-端到端测试框架使用
date: 2020-09-22 18:36:00
updated: 2020-12-30 14:57:00
tags:
---
上周对开发的项目进行了一次端到端测试，暴露出了一些bug问题及不足，都是在开发时端到端测试流程所没有顾及到的，手动测试确实会有忽略及考虑不到的情况，平时也不能常常进行端到端测试。最好能够解放人力，使用自动化的方式，对项目中的一些固定关键流程定义进行自动化端到端测试。
正好最近学习Vue文档时对此关注了测试的部分。其中端到端测试尝试使用了推荐的Cypress框架。
[Cypress官方网站](https://www.cypress.io/)

## 基础使用
只需要写一些简单的JS脚本作为测试用例就能对开发的前端工程进行端到端自动化测试，并能留存每一步测试的截图甚至是视频。因为cypress提供了大量的内置API，所以即使JS的基础并不强，也可以通过阅读[文档](https://docs.cypress.io/)来编写简单的测试脚本。这里只分享一下自己的操作使用。
![测试界面截图](https://s3.bmp.ovh/imgs/2022/04/05/08a3bb0eeffa6b5b.png "测试界面截图")
可以在项目中使用
```shell
npm install cypress --save-dev
```
在项目中引入cypress框架，但在项目的前端工程中，因为依赖的冲突，所以不能直接使用。
取而代之的做法是使用npm init新建了一个空项目直接将该项目作为一个测试工程，去测试服务器上的开发环境。
![目录结构](https://s3.bmp.ovh/imgs/2022/04/05/98da935d7335ed64.png "目录结构")
* **/cypress** 存放测试工程的资源
* **/fixtures** 存放模拟数据
* **integration** 存放测试脚本
* **/plugins** 存放插件
* **/support** 存放封装的自定义方法，比如在每次测试之前必然要登录到后台，可以将登录的测试流程封装起来，在每个测试脚本的before生命周期钩子中调用。


cypress.json对cypress进行配置，比如测试访问的baseUrl，测试资源的存放地址，测试截图视频的存放地址，测试窗口的视窗大小等。
```json
{
    "baseUrl":"baseUrl",
    "viewportWidth":1920,
    "viewportHeight":1080,
}
```
将一些会经常使用的脚本封装为自定义方法，以便复用。比如登录操作。
```javascript
// 登录操作的封装
Cypress.Commands.add('login',(username,password)=>{
    // 访问URL地址
    cy.visit('/')
    // 获取DOM节点并执行点击动作
    cy.get('.login_span').click()
    // 断言当前页面为登录页
    cy.url().should('inclued','loginNew')
    cy.get('[placeholder="请输入登录ID"]')type(username)
    cy.get('[placeholder="请输入密码"]')type(password)
    cy.get('.login_button').click()
})
```
经过注册之后，就可以在integration中的测试用例脚本中直接使用这些命令。
使用describe()描述一个测试用例集，it()定义一个测试用例，一个用例集中必须至少有一个测试用例。
虽然是基于js的自动化测试工具，但是几乎不需要多少js的知识，只要使用官方提供的API就能完成绝大多数测试。基本是
>1. 链式调用get()、contains()找到页面上符合条件的唯一DOM元素
>2. 使用type()和click()对获取的DOM元素进行操作
>3. 使用should()进行断言。
>   **注意：** 关于获取唯一的DOM元素这一点，官方推荐在需要的DOM上显式指定的data-v此类属性来帮助我们编写测试脚本时直接通过属性选择器获取，但这里还是尽量不改动原项目的代码来进行cypress的测试，使用一般的类、兄弟、父子和属性等选择器组合来获取DOM。  


```javascript
describe('能力使用者申请能力授权',()=>{
    // 在全部用例执行前执行的钩子
    before(()=>{
        // 刚刚注册自定义的方法，执行登录操作
        cy.login('yangxiaolang','yangxiaolangspasswd')
        // 登录成功进行/dashboard,断言url包含/dashboard
        cy.url().should('inclued','/dashboard')
    })
    it('进入申请页面',()=>{
        cy.get('.el-icon-help').click()
        cy.get('.el-menu-item').contains('能力授权').click()
        cy.url().should('include','apply')
        cy.get('a[href="apply"]').should('contain','授权申请')
    })
    it('正确填写表单',()=>{
        cy.get('[placeholder="输入系统名称"').type('@SYSTEMNAME')
        cy.typeDateRange() //也是注册的自定义方法，用于输入element的日期选择器
        cy.get('.el-checkbox__label').contain('@ABILITYNAME').click()
    })
    it('提交表单',()=>{
        cy.get('span').contains('提交申请').click()
    })
})
```
在package.json中注册脚本命令
```json
"scripts":{
    "test":"cypress open"
}
```
在控制台中输入
```shell
npm run test
```
启动测试,会启动一个基于electron的桌面应用，选择对应的测试脚本即可进行测试
![应用页面](https://s3.bmp.ovh/imgs/2022/04/05/c868f2c694efd221.png "应用页面")
![测试页面](https://s3.bmp.ovh/imgs/2022/04/05/12767dd84df8528e.png "测试页面")

即可对项目进行对应功能的端到端测试，在左侧可以选择查看每一步的snapshot，并且执行的测试脚本是可以热更新的。



## 测试用例间持久化存储
目前遇到的问题有每个测试用例间cookie和localStorage等持续化存储不共用，官方提供了不同测试用例间共用cookie的API。
![cookie共用方法](https://s3.bmp.ovh/imgs/2022/04/05/176c577453d523c7.png "cookie共用方法")
localStorage的共用官方并未提供解决方案，但项目github的issue上有不少解决方案。[issue](https://github.com/cypress-io/cypress/issues/461)
![localStorage共用方法](https://s3.bmp.ovh/imgs/2022/04/05/c1e1a5cddc637ea2.png "localStorage共用方法")

## 一条命令执行自动化测试
[官方文档 Run Cypress with a single Docker command](https://www.cypress.io/blog/2019/05/02/run-cypress-with-a-single-docker-command/)
使用cypress官方提供的镜像,[镜像github地址](https://github.com/cypress-io/cypress-docker-images),拉取镜像到本地的镜像仓库
```shell
docker pull cypress/included:5.4.0
```
![docker images](https://s3.bmp.ovh/imgs/2022/04/05/a0ff164f0769ec5c.png "docker images")
该镜像已经安装好了执行端到端测试所需的所有依赖、浏览器和cypress,使用
```shell
docker run -it -v $PWD:/e2e -w /e2e 8dbc 
```
将自己的cypress项目挂载到容器中并启动
![终端输出](https://s3.bmp.ovh/imgs/2022/04/05/4ff06141c0c2a7c9.png "终端输出")
![测试结果](https://s3.bmp.ovh/imgs/2022/04/05/a3c1f8d422e2fd7a.png "测试结果")
测试过程的视频保存在项目的video文件夹对应的测试目录下，若有测试失败则保存截图在screenshot目录。

## 学习参考
[Cypress官方文档](https://docs.cypress.io/guides/overview/why-cypress)

[国内一个比较详细的中文博客](https://www.cnblogs.com/poloyy/tag/Cypress/)