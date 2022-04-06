---
title: 页面展示PDF文档的方案
date: 2021-03-11 10:50:00
updated: 2021-03-11 10:50:00
tags:
---
在自己负责的项目接入公司级平台的时候，要求项目页面上提供说明文档，而且不能是类似VuePress那样的静态博客网站式的文档，正好项目本身有PDF版本的说明文档，尝试一下实现PDF阅览器展示PDF说明文档实现这个要求。
## iframe使用built-in pdf viewer
目前大多数的主流浏览器都支持PDF文档的浏览，所以如果想要在页面中展示PDF文件，一个比较简单的方案就是使用iframe嵌套一个browsing context。它能够将另一个打开了PDF阅览器的页面嵌入到当前页面中。
* 优点是浏览器本身的PDF阅览器的功能丰富，展示效果好，不需要额外开发。
* 缺点则是无法拓展阅览器功能，且受浏览器兼容性限制[Built-in PDF viewer兼容性](https://caniuse.com/?search=pdf)。


![built-in-pdf-viewer兼容性](https://img3.qq.tc/2022/04/06/built-in-pdf-viewer.png "built-in-pdf-viewer兼容性")

```html
<body>
    <h1>pdf</h1>
    <iframe id="pdf" style="width:500px;height:400px"></iframe>
    <script>
        function convertDataURIToBinary(base64data){//编码转换
            const raw = window.atob(base64data)
            const rawLength = raw.length
            const array = new Uint8Array(new ArrayBuffer(rawLength))
            for(let i=0;i<rawLength;i++){
                array[i] = raw.charCodeAt(i)&0xff
            }
            return array
        }

        function base2Blob(base64data){
            const u8arr = convertDataURIToBinary(base64data)
            return new Blob([u8arr],{
                type:"application/pdf"
            })
        }

        window.onload=()=>{
            const blob = base2Blob(base64)
            const el = document.querySelector('#pdf')
            el.setAttribute('src',URL.createObjectURL(blob))
        }
    </script>
</body>
```
![iframe展示PDF文档](https://img3.qq.tc/2022/04/06/iframe.png "iframe展示PDF文档")
## Mozila pdfjs
另一个方案则是使用Mozila开源的pdf.js 来实现pdf在前端页面上的阅览功能 [GitHub - mozilla/pdf.js: PDF Reader in JavaScript](https://github.com/mozilla/pdf.js),它可以读取远程的PDF文件，并将它的相应页码绘制在canvas上，透过它，我们可以自定义开发一些浏览器内置的PDF阅览器不支持的功能.


### 使用npm 安装pdfjs的依赖，在入口文件中引入

```javascript
const pdfjs = require('pdfjs-dist/es5/build/pdf') 
const pdfjsWorker = require('pdfjs-dist/es5/build/pdf.worker.entry')
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker
```
**注意:** pdfjs使用了js语法的新特性，直接引入可能会报错，解决方案见[node packge pdfjs-dist@2.6.347 syntax error · Issue #13190 · mozilla/pdf.js · GitHub](https://github.com/mozilla/pdf.js/issues/13190#issuecomment-814701619)

### 新建PDFViewer组件
```html
<div
    id="content"
    v-infinite-scroll="loadPage"
    :infinite-scroll-distance="20"
    class="content"
><div>
```
使用canvas渲染pdf页面内容，canvas的父容器使用element的无限加载做加载下一页
组件挂载完成后获取该父容器的Element对象保存，loadPage方法主要是将pdf的内容渲染到canvas节点再添加到父容器的子结点上。

```js
{
    mounted() {
        this.contentEl = document.getElementById('content');
    },
    methods: {
        loadPage() {
            const div = document.createElement('div');
            div.setAttribute('id', 'page' + this.pageCount);
            div.setAttribute('class', 'page');
            div.style.marginTop = '30px';
            this.contentEl.appendChild(div);
            this.$nextTick((_) => {
              this.renderPage(div, this.pageCount).then((_) => {
                this.pageCount++;
              });
            });
        },
        // 渲染对应页面
        renderPage: function(div, pageNum) {
             // 异步获取pdf对象对应页的内容渲染到canvas节点上
            return new Promise((resolve, reject) => {
                this.doc
                .getPage(pageNum)
                .then((content) => {
                    const canvas = document.createElement('canvas');
                    div.appendChild(canvas);
                    const ctx = canvas.getContext('2d');
                    const dpr = window.devicePixelRatio || 1;
                    const bsr =
                      ctx.webkitBackingStorePixelRatio ||
                      ctx.mozBackingStorePixelRatio ||
                      ctx.msBackingStorePixelRatio ||
                      ctx.oBackingStorePixelRatio ||
                      ctx.backingStorePixelRatio ||
                      1;
                    const ratio = dpr / bsr;
                    const viewport = content.getViewport({ scale: 1.2 });
                    canvas.width = viewport.width * ratio;
                    canvas.height = viewport.height * ratio;
                    canvas.style.width = viewport.width + 'px';
                    canvas.style.height = viewport.height + 'px';
                    if (this.pageHeight < div.clientHeight) {
                      this.pageHeight = div.clientHeight;
                    }
                    div.style.height = `${this.pageHeight}px`;
                    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                    const renderContext = {
                      canvasContext: ctx,
                      viewport
                    };
                    content.render(renderContext);
                    resolve();
                })
                .catch(() => {
                    reject();
                });
            });
        },
    }
}
 
```
pdfjs获取的pdf文档，即getDocument方法的入参是pdf文件的url，所以需要webpack遇到引入pdf文件时将其作为静态资源处理，增加url-loader对pdf文件的处理。
```javascript
{
    test: /\.pdf$/,
    loader: 'url-loader',
    options: {
      limit:10000,
      name: utils.assetsPath('pdf/[name].[hash:7].[ext]')
    }
}
```
### 实现效果

初步效果，翻页缩放等控件还需要手动开发
![pdfjs绘制的PDF文档](https://img3.qq.tc/2022/04/06/pdfjs.png "pdfjs绘制的PDF文档")