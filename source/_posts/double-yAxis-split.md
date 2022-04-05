---
title: 双y轴图表两根y轴刻度不齐的处理
date: 2020-08-18 19:40:00
updated: 2020-08-18 19:40:00
tags: 
---

双y轴的图表，由于两根y轴上各自描述了两组不同维度的数据，echarts自动计算两根y轴的刻度线时会出现显示上的间隔不均匀的情况，导致图表显示的不自然。需要手动去计算合适的y轴最大值及分割区间来解决双y轴刻度不齐的问题。
![](https://s3.bmp.ovh/imgs/2022/04/04/642bbc0b6464b006.png)

## 问题分析
这是由于Echarts图表会自己根据数据计算合适的比例，而两根y轴的刻度间隔都是按自己维度上的数据计算得来的，这里就需要我们自己来设置要划出多少刻度，每个刻度的间隔。
Echarts文档中提到了splitNumber的属性,但它仅是一个建议值,实际上可能并不会生效。
![splitNumber属性说明](https://s3.bmp.ovh/imgs/2022/04/04/4e05872a4ab55c5e.png "splitNumber属性说明")
![splitNumber并未生效](https://s3.bmp.ovh/imgs/2022/04/04/02fa968444bcb679.png "splitNumber并未生效")
## 解决方案
普遍的做法是手动设置y轴的最大最小值，并设置y轴interval，即每个刻度的间隔值。
![interval属性说明](https://s3.bmp.ovh/imgs/2022/04/04/bbe0ab1249be93fa.png "interval属性说明")
需要在**setOption**之前根据option的数据配置计算出适合每根轴线的最大值及刻度间隔写回option
```javascript
function alignYAxisScale(option, splitNum) {
    //找到两根轴上的最大值向上取整
    const leftMax = Math.ceil(Math.max(...option.series[0].data))
    const rightMax = Math.ceil(Math.max(...option.series[1].data))
    //除去刻度数，得到每个刻度区间的值
    const leftInterval = leftMax / splitNum
    const rightInterval = rightMax / splitNum
    //修改图表配置
    option.yAxis[0].max = leftMax
    option.yAxis[0].interval = leftInterval
    option.yAxis[1].max = rightMax
    option.yAxis[1].interval = rightInterval
}
alignYAxisScale(option, 5)
```
![设置后的图表](https://s3.bmp.ovh/imgs/2022/04/04/f2a364e348df6d11.png "设置后的图表")
可以看到图表已经实现我们想要的效果，两根y轴刻度对齐了，但是仍然存在一些问题，比如刻度值出现了小数等。此时仍然可以通过设置最大值max来调整刻度值以及线柱距最大值的距离（我一般会让线柱距离最大值之间保持一段距离）
```javascript
// 增加一个取合适的最大值的函数，个人喜好
function countPropertyMax(max,splitNum){
    // 最大值加上自己的1/10
    max = max+Math.ceil(max/10)
    // 递增到能被整除
    while(max%splitNum!==0){
        max++
    }
    return max
}

function alignYAxisScale(option, splitNum) {
    //找到两根轴上的最大值向上取整,取合适的最大值
    const leftMax = countPropertyMax(Math.ceil(Math.max(...option.series[0].data)),splitNum)
    const rightMax = countPropertyMax(Math.ceil(Math.max(...option.series[1].data)),splitNum)
    //除去刻度数，得到每个刻度区间的值
    const leftInterval = leftMax / splitNum
    const rightInterval = rightMax / splitNum
    //修改图表配置
    option.yAxis[0].max = leftMax
    option.yAxis[0].interval = leftInterval
    option.yAxis[1].max = rightMax
    option.yAxis[1].interval = rightInterval
}
```
就可以得到刻度线值及线柱距顶部距离比较合适的图表了
![最终效果](https://s3.bmp.ovh/imgs/2022/04/05/fe386b18462ebeca.png "最终效果")