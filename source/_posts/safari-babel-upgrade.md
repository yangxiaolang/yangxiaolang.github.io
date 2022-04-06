---
title: Safari10兼容性处理及Babel升级
date: 2022-02-09 14:27:00
updated: 2022-02-09 14:27:00
tags:
---
不知道哪个地方的项目经理，售前阶段准备熟悉下我们平台，结果白屏了，老大发了我一个问题截图，报错信息是'未预期的符号“...”,预期一个属性名',似乎是浏览器不支持展开运算符，导致的项目不能正常加载，问下了使用的浏览器，safari10 。emmm...,苹果的升级策略看样子挺保守的(-_-) 。
![问题截图](https://s3.bmp.ovh/imgs/2022/04/06/ff26f7e3b731bfdf.png "问题截图")

## 兼容性问题确认
报错信息：**未预期的符号"...",预期一个属性名**
先定位下报错截图处的代码，应该不是用在函数执行时的剩余运算符"..." [剩余参数 - JavaScript | MDN (mozilla.org)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Functions/Rest_parameters) 。
 这里的 "..." 是ES2015增加的展开语法，用来展开数组等结构，展开对象是ES2018的标准，此处应该是浏览器支持的标准不支持此语法用于对象（expect a property name） [展开语法 - JavaScript | MDN (mozilla.org)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Spread_syntax#Spread_in_object_literals)
查询支持 ...语法 的浏览器版本
![Spread in object literals兼容性](https://s3.bmp.ovh/imgs/2022/04/06/6ec732159a8a1a0c.jpg "Spread in object literals兼容性")
可以看到Safari11以下版本的浏览器是不支持的[Spread in object literals](https://caniuse.com/?search=Spread%20in%20object%20literals)
但是，在使用webpack打包时是使用babel编译过源代码的，目标代码应该被babel降级到了es5标准，制品中应该不存在展开语法,在制品中查找到在对象结构中使用了展开语法的语句
![问题代码](https://s3.bmp.ovh/imgs/2022/04/06/0b6982a22f071a2e.jpg "问题代码")
问题语句上下文使用了**isMatrixLike()**方法，业务代码中没有这个方法，定位到使用的绘图用svgjs依赖中存在此方法。也就是babel未处理node_modules里的依赖（一般也不用处理，因为npm仓库上的一般也是提供者自己处理过的
在AI能开的模板工程中，babel使用的是v6版本，会自动忽略node_modules目录，需要升级到v7才能通过配置文件babel.config.js 来指定处理目录
![Babel升级文档](https://s3.bmp.ovh/imgs/2022/04/06/10d5ded8dba2b7d0.jpg "Babel升级文档")

## Babel升级
### Babel简介
Babel 是一个工具链，主要用于将采用 ECMAScript 2015+ 语法编写的代码转换为向后兼容的 JavaScript 语法，以便能够运行在当前和旧版本的浏览器或其他环境中。下面列出的是 Babel 能为你做的事情：
* 语法转换
* 通过 Polyfill 方式在目标环境中添加缺失的特性 （通过引入第三方 polyfill 模块，例如 core-js）
* 源码转换（codemods）
  
### 升级步骤
1. 删除package.json依赖列表中babel相关依赖，删除node_modules目录
2. 重新npm install依赖
3. 根据手册安装babel核心组件  使用指南 · Babel 中文网 (babeljs.cn)
```shell
npm install --save-dev @babel/core @babel/cli @babel/preset-env
```
4. 根据原有babel6.x使用的插件安装新的babel7.x对应的插件及其依赖（命名规则也改变了
    * @babel/eslint-parse  替代 babel-eslint 做静态代码分析
    * @babel/plugin-transform-runtime
    * @babel/plugin-syntax-dynamic-inmport
    * @babel/runtime-corejs3
    * corejs@3
    * babel-loader@8
5. 修改配置文件 .babelrc => babel.config.js , 内容修改
```javascript
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'entry',
        corejs: 3,
        targets: {
          'browsers': ['> 1%', 'last 4 versions', 'not ie <= 8']
        }
      }
    ]
  ],
  plugins: [
    // 内置在preset-env中，不需要单独安装,开启loose模式,提高兼容性
    ['@babel/plugin-transform-spread', { useBuiltIns: true, loose: true }],
    [
      '@babel/plugin-proposal-object-rest-spread',
      { useBuiltIns: true, loose: true }
    ]
  ],
  env: {
    development: {
      plugins: ['@babel/plugin-syntax-dynamic-import']
    }
  }
};
```
6. babel-polyfill已被弃用，修改main.js
```javascript
// remove
import "babel-polyfill"
```
7. 替换eslint配置使用的解析为@babel/eslint-parser
```javascript
module.exports={
    parserOptions:{
        // parser:"babel-eslint"
        parser:"@babel/eslint-parser"
    }
}
```
8. webpack的打包基础配置修改，babel-loader指定处理svgjs目录
```javascript
{
    test:/\.js$/,
    loader:'babel-loader?cacheDirectory',
    include:[
        resolve('node_modules/@svgdotjs/scgjs')
    ]
}
```
## 最终效果
因为我没有Mac设备，所以兼容性测试用了下一些云测试平台，[lambdatest平台](https://app.lambdatest.com/)
![处理前](https://s3.bmp.ovh/imgs/2022/04/06/07a878edb6d016bc.jpg "处理前")
![处理后](https://s3.bmp.ovh/imgs/2022/04/06/f220d925addf32a3.jpg "处理后")

## 小插曲
说起来这个兼容性问题我一直耿耿于怀，因为当初用svgdotjs开发标注组件的时候，还特意看了下兼容性，记得文档里提到了safari3.2以上的都支持，这作者没测试充分呀。
于是憋了半天用英文写好了issue，说明了问题和我的解决方案，检查了好几遍英文有没有问题才发出去，结果发完了才发现

**他文档里说的是SVG的兼容性**

尴尬的我赶紧关了issue，作者应该还没看见吧（-_-）