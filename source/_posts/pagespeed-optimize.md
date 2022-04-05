---
title: 前端页面响应速度优化实践总结
date: 2020-12-28 17:50:00
updated: 2022-04-05 17:50:00
tags:
---
目前常用的前端应用架构主要为原生JS或Jquery等构筑的多页面应用（MPA)以及借助Angular/React/Vue等现代前端框架搭建的单页面应用(SPA)。
MPA的页面主要是分布在服务器上各个静态资源，即html及其引入的脚本文件和样式文件，每次跳转新的页面都要把对应页面HTML文件及其依赖下载一遍，在网速不好时，页面间的跳转会有明显的白屏时间。
SPA的页面只有一个，即首次访问时下载的index.html文件，其内容是有JS动态渲染到页面上的，跳转页面其实是由JS动态的将组件替换到页面上，页面跳转时不会受到网速影响，基本相当于原生的响应速度。但是所有依赖文件都会在首次访问时被下载，会使得首屏的白屏时间相当明显。
其他方案诸如SSR和BigPipe的架构方案暂无实践，不讨论。
**2022-04-05迁移注:** 本文档主要为当时的经验总结，但实际上MPA的优化方案同样能用webpack处理，以后会再写一些文档梳理优化知识。本文档主要展示优化方案和总结思考。
## MPA的前端优化方案
MPA的优化方案的重点是压缩每次访问的html文件所引入的依赖大小，并提高下载速度。一般为使用CDN服务器进行加速，压缩JS文件以及使用依赖的生产版本。
### CDN服务器加速
CDN的全称是Content Delivery Network，即[内容分发网络](https://baike.baidu.com/item/%E5%86%85%E5%AE%B9%E5%88%86%E5%8F%91%E7%BD%91%E7%BB%9C/4034265)。CDN是构建在现有网络基础之上的智能虚拟网络，依靠部署在各地的边缘服务器，通过中心平台的负载均衡、内容分发、调度等功能模块，使用户就近获取所需内容，降低网络拥塞，提高用户访问响应速度和命中率。CDN的关键技术主要有内容存储和分发技术。
![使用CDN](https://img3.qq.tc/2022/04/05/CDN.png "使用CDN")
### 压缩JS文件
即减少JS文件的体积，可以通过各种工具对JS文件进行压缩，删除空格及注释等字符，压缩文件体积。
![静态资源在线压缩工具](https://img3.qq.tc/2022/04/05/65d1c5b9fdfd67bed11674f8530d0b11.png "静态资源在线压缩工具")
### 使用第三方依赖的生产版本
许多第三方依赖都提供两个版本——开发版本和生产版本。开发版本会提供完整的错误提示信息来帮助开发，生产版本则去掉这些内容并对代码进行压缩，减少了依赖体积。
![开发环境和生产环境版本](https://img3.qq.tc/2022/04/05/590c62a8d2bf68c935c55a7e1c79dda9.png "开发环境和生产环境版本")
### 总结
以上方案的痛点有：
1.    依赖未必有对应版本的CDN服务，且内网环境无法使用第三方提供的CDN服务。
2.    压缩代码及使用生产版本替换都需要在每次部署到生产环境时都需要手动进行处理，效率不高。且未必所有依赖都有其生产版本。

## SPA的前端优化方案
SPA的优化方案同样也有CDN加速以及压缩JS文件，且一般SPA都会由webpack等构建工具来打包生产环境，可以通过插件自动地压缩JS代码，不必再手动进行处理。
但是由于SPA一般通过npm来管理依赖，若SPA没有使用CDN加速的方式引入第三方依赖，是没有开发版本和生产版本之分的。
SPA一般只会在首屏加载时白屏时间长，所以优化的重点在于压缩首屏加载时引入文件的体积。一般的方案有： CDN加速、压缩代码、首屏加载所有第三方依赖、使用时加载组件、按需引入依赖和依赖拆分等。
### CDN加速
SPA同样可以使用CDN加速，但使用起来比较麻烦，且不利于开发。
SPA的所有依赖都是在main.js中引入的，如果使用CDN加速的话，需要去掉main.js中使用import引入的依赖，改为在html直接使用script标签引入，且需要在webpack打包配置中的externals属性中声明不需要webpack打包的依赖。
```javascript
// Webpack配置
module.exports={
    ...,
    externals:{
        'vue':'Vue',
        'vue-router':'VueRouter',
        'element-ui':'ELEMENT',
        'vcharts':'vcharts'
    }
}
```
左值是webpack不打包的依赖，右值是应用中使用这些依赖的变量名，webpack是的打包构建是通过静态分析的，如果不配置右值，会将使用的变量名打包成其他名称，造成运行时获取的依赖无法正常使用。

同样的由于依赖是运行时获取的，eslint等静态代码检查工具在开发时是会报错的。

### 压缩代码
由于SPA一般都有webpack这样的打包工具，这些工具的默认配置会在打包生产环境时会自动进行代码压缩。同样地也能使用插件配置来定制化压缩。
```javascript
// 使用UglifyJsPlugin删除console和debugger语句
new webpack.optimize.UglifyJsPlugin({
    compress:{
        warnings:false,
        drop_debugger:true,
        drop_console:true
    }
})
```

### 使用时加载组件
SPA首屏响应时间较长的原因是在首屏加载时就载入了所有依赖文件，其中包括所有的页面组件文件。
但是由于许多页面并不会在一开始就展示出来，所以没有在首屏加载时就下载的必要，所以页面的组件文件要在路由中进行按需加载。即仅在该页面被首次访问时，才下载该组件文件，此后访问即可直接使用内存中的组件文件。
![在路由中动态引入组件](https://img3.qq.tc/2022/04/05/8b7c2b7fdc303ccccd1155a6ce2f73c7.png '在路由中动态引入组件')

### 按需引入第三方依赖
一般第三方依赖的文档都会写明有两种引入方式——全部引入和按需引入。一般诸如图表库和组件库，我们只使用其中的一部分图表或组件，就没必要全部引入，全部引入虽然方便开发但是会增加引入的体积。

一些组件库如vuetify本身提供摇树（treeshaking）功能，会自动移除 JavaScript 上下文中的未引用代码(dead-code)，所以无需按需引入。
```javascript
// 全部引入element-ui
import Vue from 'vue';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import App from './App.vue';

Vue.use(ElementUI);

new Vue({
  el: '#app',
  render: h => h(App)
});
```
```javascript
// 按需引入element-ui,babel配置不粘贴了https://element.eleme.cn/#/zh-CN/component/quickstart
import Vue from 'vue';
import { Button, Select } from 'element-ui';
import App from './App.vue';

Vue.component(Button.name, Button);
Vue.component(Select.name, Select);
/* 或写为
 * Vue.use(Button)
 * Vue.use(Select)
 */

new Vue({
  el: '#app',
  render: h => h(App)
});
```

### 依赖拆分
一般webpack打包时会将业务代码打到app.js，第三方依赖全部打包到vendor.js文件，如文章开头所说，优化响应速度地要点是压缩单个文件的体积。

app.js和vendor.js在浏览器中是并行加载的，如果第三方依赖较多，就会导致vendor.js文件体积过大，不利于响应速度的提升，所以我们需要将一些依赖从vendor文件中提取出来跟他们并行下载。

使用webpack的CommonsChunkPlugin(webpack4后被弃用）或SplitChunksPlugin（webpack4以上）进行代码块的提取。
```javascript
// Webpack提取代码块配置
new webpack.optimize.CommonsChunkPlugin({
    name:'echarts',
    chunks:['vendor'],
    minChunks(modules){
        return (
            module.resource &&
            /echarts/.test(module.resource)
        )
    }
}),
new webpack.optimize.CommonsChunkPlugin({
    name:'v-charts',
    chunks:['vendor'],
    minChunks(modules){
        return (
            module.resource &&
            /v-charts/.test(module.resource)
        )
    }
})
```
这些依赖文件在打包后是在index.html文件中通过script标签来引入的，所以要注意依赖引入的顺序。
```javascript
// 调整依赖引入顺序配置
new HtmlWebpackPlugin({
    filename:config.build.index,
    template:'index.html',
    favicon:resolve('favicon.ico'),
    inject:true,
    minify:{
        removeComments:true,
        collapseWhitespace:true,
        removeAttributeQuotes:true
    },
    // 手动排序代码块
    chunksSortMode:'manual',
    chunks:['manifest','vendor','vue','vue-router','element-ui','echarts','v-charts','app']
})

new webpack.optimize.CommonsChunkPlugin({
    name:'manifest',
    chunks:['vendor','vue','vue-router','element-ui','echarts','v-charts','app'],
    minChunks:Infinity
})
```

## 服务器端优化前端响应速度方案
大部分浏览器现在都支持解压gzip压缩文件，所以可以将请求的文件压缩成gzip压缩文件进行传输，可以有效减少传输文件的体积。此方法需要服务器的支持，在nginx服务器中配置如下。
![Nginx开启gzip压缩](https://img3.qq.tc/2022/04/05/nginxgzip.png 'Nginx开启gzip压缩')
服务器会自行将访问的js等静态资源文件实时压缩成gzip文件传输给客户端，显然此举会增加服务器的压力，所以前端可以在webpack打包时除了js文件外另外生成一份同名的gzip文件，可以由服务器直接将该gzip文件传输给客户端，减轻服务器压力。

使用compression-webpack-plugin插件增加如下配置。
```javascript
// Webpack生成gzip文件配置
module.exports={
    ...,
    productionGzip:true,
    productionGzipExtensions:['js','css']
}
```
