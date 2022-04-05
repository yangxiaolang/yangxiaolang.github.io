---
title: Webpack升级导致内存泄露的定位排查
date: 2021-01-27 11:54:00
updated: 2021-01-27 11:54:00
tags:
---
给开发项目做webpack v3升级到webpack v4的之后，在build的时候出现了内存泄漏的问题，折腾了好几天终于定位解决了，虽然这个问题估计几乎不会有人能遇到了，但还是记录一下，主要是定位的思路。
是内存不足还是内存泄漏?内存泄漏
是运行时还是编译时的内存泄漏?编译时
使用什么方法排查编译时的内存泄漏发生在打包什么模块时?二分法

## 问题背景
开发的项目使用的是之前的前端在github找的一个vue后台管理模板，按要求更换到公司的vue后台管理模板工程，涉及到webpack v3到webpack v4的升级，在升级完成之后，dev模式启动未出现问题，但是build的时候却出现了内存泄露的问题。
![内存泄漏问题截图](https://s3.bmp.ovh/imgs/2022/04/05/e36cefe5c968e771.png "内存泄漏问题截图")
## 问题定位
根据搜索build时JavaScript heap out of memory,得到一般的解决方案为增加node进程可用的最大内存
```shell
node --max_old_space_size=4096 build/build.js
```
增加node在打包时的可用最大内存为4G，但同样会出现上述的JavaScript heap out of memory，猜测有内存泄漏的问题。
观察windows的任务管理器，打包生产版本时内存使用率达到了1G以上且仍在增长，正常情况应稳定为400-600MB。
![任务管理器](https://s3.bmp.ovh/imgs/2022/04/05/f3cb5c76024f899c.png "任务管理器")
由于dev版本并没有这样的问题，所以应该不是运行时的内存泄漏，而是编译时的内存泄漏，也就是内存泄漏并不是业务代码造成的，而是webpack打包配置有问题造成编译时的内存泄漏。
是编译时的内存泄露，那么错误报告中的堆栈信息作用就有限了，需要使用其他办法定位内存泄漏是在打包代码的什么模块时发生。
由于Webpack打包是静态代码打包机制，所以使用二分法来尝试webpack是在打包什么模块时产生的内存泄漏，即从入口文件开始注释掉一半的导入文件来排查内存泄漏发生在打包哪个模块的时候。
![注释一半的模块重新打包来确认内存泄漏发生在哪个模块](https://s3.bmp.ovh/imgs/2022/04/05/609ad8f0e0bd1da9.png "注释一半的模块重新打包来确认内存泄漏发生在哪个模块")
从入口文件排查到打包store和router两个模块时产生了内存泄漏，而store模块内部也引入了部分router模块的内容，注释掉该部分后打包成功，说明内存泄漏发生在打包router模块时。
router模块引入的路由分为静态和动态两部分，同样使用二分法得到内存泄漏发生在打包路由引入的indexHome.vue和index.vue两个文件。
这两个文件的共同点就是都引入了这两个css文件
![可能有问题的两个css文件](https://s3.bmp.ovh/imgs/2022/04/05/3d4804667a18189b.png "可能有问题的两个css文件")
将这两个文件拿出来单独打包果然发生了内存泄漏，检查webpack打包样式文件的loader配置，发现生产版本比开发版本多一条extract的属性。
![config](https://s3.bmp.ovh/imgs/2022/04/05/6d65c0e19dc673d9.png "config")
该属性配置是在生成处理样式文件的一组loader时，决定最后使用哪个loader处理之前的loader处理样式文件生成的js文件。
```javascript
const loaders = []

// Extract CSS when that option is specified
// (which is the case during production mode)
if(options.extract){
    loaders.push(MiniCssExtractPlugin.loader)
}else{
    loaders.push('vue-style-lodaer')
}
```
如果extract配置为true，那么样式文件的处理最后就会使用MiniCssExxtractPlugin.loader从js文件中提取出独立的CSS文件注入。而如果配置为false,则会使用vue-style-loader直接将css样式注入。

这就是开发版本和生产版本处理样式文件的loader配置的不同，所以内存泄漏应该是出现在MiniCssExxtractPlugin.loader的工作流程中。

## 问题解决
那么解决内存泄漏最简单的解决方案当然就是不使用MiniCssExxtractPlugin.loader，这样就不会产生内存泄漏了，将extract注释掉就好。
但是这样打包出来的产品是没有css文件的，样式全在js文件里。本着不影响最终制品的原则，检查导致MiniCssExxtractPlugin.loader打包时内存泄漏的两个css文件。在common.css中发现以下样式配置
```css
body{
    font: ...;
    color :...;
    _background-attachment:fixed;
    _background-image:url(about:blank)
}
```
这个'_'把我整懵了，搜索之后发现这是IE6才识别的写法，作用是探测应用的运行在什么浏览器上的.。(这个作用存疑，只在CSDN上看到有人说，但是WebMDN等网站并未搜索到该用法)
不清楚这里探测IE6浏览器的目的，能开本身也没有需要探测运行浏览器的需求，所以这两条属性直接注释掉MiniCssExxtractPlugin.loader在打包时就不会产生内存泄露了。
![_的用法](https://s3.bmp.ovh/imgs/2022/04/05/609ad8f0e0bd1da9.png "_的用法")