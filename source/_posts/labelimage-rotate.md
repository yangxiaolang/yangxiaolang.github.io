---
title: 标注组件旋转功能的实现
date: 2021-12-02 17:40:00
updated: 2021-12-02 17:40:00
tags:
---
标注组件需要增加旋转功能，以便摆正拍摄时时不是正向的图片进行标注。同时在图片上已经标注的标注框也要跟随旋转。另外跟开发算法的同事确认了下算法使用的数据集图片应该都是摆正后的，所以训练集中的非正向图片也要更新为摆正后的图片。

## 技术方案
目前标注组件全部使用SVG绘制矢量图形，但是所有矢量图形都是相对标注图片宽高比生成的坐标系的，旋转操作会改变原有的坐标系，同时旋转操作需要更改原图片，svg并不能很好的操作标注图片本身。
而Canvas绘图能很好的处理图片，toDataUrl的API能直接给出旋转后图片的BASE64编码。
所以旋转操作需要分为两种处理，标注图片的旋转需要使用canvas进行位图处理，标注框的旋转仍然使用SVG处理

## 标注图片的处理
标注图片使用canvas进行处理，canvas提供了直接的旋转API——rotate，但是旋转是相对canvas绘图原点而不是图片本身旋转，需要注意进行相应的平移处理
```javascript
ctx.fillStyle='lightgreen'
ctx.fillRect(0,0,200,100)
ctx.rotate(0.5*Math.PI)

ctx.fillStyle='red'
ctx.fillRect(0,0,200,100)
```
![旋转说明演示](https://s3.bmp.ovh/imgs/2022/04/07/dfd1d126b52e2a58.png "旋转说明演示")
可以看到，旋转后的图形出现在了第二象限，并不在我们的画布上（假设画布在第一象限），canvas图形的绘制都是从原点(0,0)开始绘制的，要想将旋转后的红色矩形绘制到第一象限上，需要向右平移坐标原点原矩形的高度距离，即
```javascript
ctx.translate(0,-100)
```
旋转后，向下为x轴正向，向左为y轴正向，所以绘制原点要在y轴上平移-100的距离即可得到
![旋转后平移](https://s3.bmp.ovh/imgs/2022/04/07/101eedd18594de76.png "旋转后平移")

## 标注框的旋转
![旋转前(三角形为SVG绘制)](https://s3.bmp.ovh/imgs/2022/04/07/0e4bfb7de4de1236.png "旋转前(三角形为SVG绘制)")
标注框是使用svg绘制的矢量图形，虽然svg也提供了旋转的API，但它只是将图形元素增加了一个transform属性，原生的位置属性是没有改变的，而我们需要的是位置属性的改变，所以我们需要手动实现标注框的旋转。
旋转操作类似canvas的旋转即可，即根据当前标注图形所有端点当前的位置计算绕原点旋转90度后在平移到第一象限的位置，更新到图形元素即可完成旋转
绕原点旋转的坐标计算公式实现
```javascript
/**
 * @typedef {{x:number,y:number}} basePoint
 */
/**
 * @function 计算绕某点旋转90度后点坐标
 * @param {number} x
 * @param {number} y
 * @param {basePoint} basePoint
 * @returns {basePoint}
 */
const rotateLocation = (x, y, basePoint) => {
    return {
      x:
        (x - basePoint.x) * Math.cos(-0.5 * Math.PI) -
        (y - basePoint.y) * Math.sin(-0.5 * Math.PI) +
        basePoint.x,
      y:
        (y - basePoint.y) * Math.cos(-0.5 * Math.PI) +
        (x - basePoint.x) * Math.sin(-0.5 * Math.PI) +
        basePoint.y,
    };
};
```
该公式的问题有：
1. 该公式是默认坐标轴向右向上为正，但画布都是向右向下为正
2. JS的计算精度问题，90度的余弦值不是0，而是一个接近0的极限值

![JS的余弦函数](https://s3.bmp.ovh/imgs/2022/04/07/4b1a3e58df830d2c.png "JS的余弦函数")
又跟算法的同事确认了下，一般来说都是绕原点旋转90度，再歪的图片基本就不用了。所以可以简化成，正余弦直接1和0。不考虑其他角度的旋转。
```javascript
const rotateLocation = (x, y, basePoint) => {
   // 因为坐标系是向右向下为正，顺时针90度-Π/2 其实是计算逆时针的Π/2
   return {
      x:  basePoint.y + basePoint.x-y,
      y: basePoint.y + (x - basePoint.x),
    };
};
```
![旋转后(三角形为SVG绘制)](https://s3.bmp.ovh/imgs/2022/04/07/46097cf40dc090cc.png "旋转后(三角形为SVG绘制)")
多边形的旋转绘制完成了，因为多边形的所有点都经过了旋转变换，从旋转后的点集即可得到旋转后的多边形。
但是矩形的旋转绘制比较特殊，矩形都是从左上起始点根据宽高绘制到，旋转后，原矩形的左上点则移动到了右上，不能将其作为起始点。
因为此处每次旋转步长固定为90度，所以每次旋转后的起始点其实就是原矩形的左下点，只要矩形旋转时计算的是（x，y+rect.height）的旋转后点即可，接下来就是宽变高，高变宽，即可获得旋转后的矩形
```javascript
if (graph.type === "rect") {
    const { x, y, width, height } = graph.attr([
    "x",
    "y",
    "width",
    "height",
    ]);
    const { x: x1, y: y1 } = rotateLocation(
    x * this.bitScale,
    (y + height) * this.bitScale,
    { x: 0, y: 0 }
    );
    graph.attr({
    x: Math.round(imageWidth + x1) / bitScale,
    y: Math.round(y1) / bitScale,
    width: (height * this.bitScale) / bitScale,
    height: (width * this.bitScale) / bitScale,
    });
}
```
