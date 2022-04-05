---
title: Mock.js的简单使用
date: 2020-09-09 21:48:00
updated: 2020-09-09 21:48:00
tags:
---
在前后端分离的开发中可以使用Mock.js启动MockServer拦截ajax请求并处理返回伪造的各种数据，更重要的一点是，Mock.js是无侵入的，不会破坏原本的代码结构，在后端接口开发好后就可以直接对接（接口名和数据格式需要提前约定）。
[Mock.js Github地址](https://github.com/nuysoft/Mock/wiki/Getting-Started)
## 目录结构
MockServer可以和webpack-dev-server一样，都可以当作在前端开发环境下的服务器。所以MockServer的服务我按照api-service-model的结构存放在项目的mock目录下。
![目录结构](https://s3.bmp.ovh/imgs/2022/04/05/cdc928bbc406c604.png "目录结构")
分层并不是必要的，这样做只是按照一般服务端开发的习惯来编排，正巧当时写过golang的服务端，就按这种结构来划分了。同时也是为了从多个Mock接口获得的数据都是从同一份随机生成的数据计算获取而来，保证页面整体模拟数据的一致性。
* api层负责拦截ajax请求，解析请求携带的数据，将数据传给service层处理，将处理好的数据返回
* service层接到api层的数据，获取model层的数据进行处理，将处理好的数据返回给api层
* model层主要使用mock.js提供的各种随机生成数据方式，生成随机数据供service层使用。需要明确的是，这份随机数据在浏览器刷新前是固定的。

## 模拟数据构造
model层伪造运营数据，首先先确定一部分具有内部结构的数据，系统的能力必然是系统所拥有的能力，而能力名称与能力ID则是一一对应的关系。这里静态的部分写在一个json文件里。
![运营数据结构](https://s3.bmp.ovh/imgs/2022/04/05/146b78e2f2e05063.png "运营数据结构")
```json
[
        {"name":"人证对比","id":"FaceCouple"},
        {"name":"人脸识别","id":"FaceRecognization"}
]
```
固定给出3个系统，并随机选择5-15个能力各自添加到这些系统的拥有能力下。
```javascript
const mock = require('mockjs') 
const ability = require('./ability') //上面的json文件，这里的require会自动解析JSON

const systems = ['慧拍','测温门','北京门禁']

Mock.Random.extend({ //拓展Random方法
        systemAbility:function (){
                // pick是内置方法，在数组内选择指定随机数量的元素
                return this.pick(ability,5,15)
        }
})

const systemInfo=(()=>{ // 立即执行函数，生成基础的系统信息
        let systemInfo=[]
        for(let count=0;count<systems.length;count++){
                systemInfo.push(mock.mock({
                        systemName:systems[count],
                        //使用占位符来标记使用Random方法的属性，mock会据此调用对应方法
                        systemAbility:'@SYSTEMABILITY'
                }))
        }
        return systemInfo
})()

module.exports=systemInfo
```
再根据模拟的系统信息systemInfo模拟运营数据
```javascript
const operateData=(()=>{
        // 生成300-500随机数量的运营数据
        const randomNum = mock.Random.integer(300,500)
        const data = []
        for(let count=0;count<randomNum;count++){
                // Random拓展方法，随机选取一个系统，并随机选取系统下的一个能力
                const system = mock.Radnom.system()
                const ability = mock.Random.ability(system)
                // 生成一条详情数据
                const one = mock.mock({
                        serialNumber:mock.Random.string('number',8),
                        capabilityId:ability.id,
                        capabilityName:ability.name,
                        userSystem:system.systemName,
                        // 拓展的在指定日期范围内随机选择一个日期的方法，mock原生的随机日期方法较弱
                        callDate:mock.Random.dateInRange(new Date('2020-07-07').getTime(),new Date().getTime()),
                        //生成0||1,生成1的概率为85/(85+15),布尔型强转为Number
                        status:Number(mock.Random.boolean(85,15,true))
                }) 
                data.push(one)
                
        }
        return data
})()
```
## 请求拦截
api层使用mock.mock()方法拦截ajax请求，使用JSON.parse()解析出js对象，将数据交给service层处理，再将响应传回。
```javascript
const mock = require('mock')
const OperationDataService = require('@/service/operationData/operationData')

const JsonExit=(flag,message,data)=>{
        return {
                flag,
                message,
                data
        }
}

// 匹配路由拦截ajax请求，建议使用正则表达式
mock.mock('/service/getall',(options)=>{
        // 解析请求体
        const {body} = JSON.parse(options)
        const pageNo = parseInt(body.pageNo)
        const responseData = OperateDataService.getall(pageNo)
        return JsonExit(true,'祝你好运',responseData)
})


```
service就跟普通的后端service层一样，负责业务逻辑
```javascript
const operationData = require('@/model/operationData/operationData')
module.exports={
        getall:(pageNo)=>{
                return {
                        total:operationData.length.
                        currentData=operationData.slice((pageNo-1)*10,pageNo*10)
                }
        }
}
```
## 最终效果
![效果1](https://s3.bmp.ovh/imgs/2022/04/05/2fe9079337f8d8da.png "效果1")
![效果2](https://s3.bmp.ovh/imgs/2022/04/05/43bbf99cb9e00637.png "效果2")
这样，前端能够获得渲染页面的数据，也能够帮助后端以前端的角度梳理后端数据的处理逻辑。当然从MockServer获得的数据都是处理好的不需要前端再进行处理，后端传来的数据未必不需要处理。一般来说mock数据并不需要这么多繁琐的分层步骤，这里只是为了整体页面的数据一致性才做的，不需要保证多个视图的数据计算来源一致的情况下，一般在拦截ajax请求时直接临时mock数据返回即可。