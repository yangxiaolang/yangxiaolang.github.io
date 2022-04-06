---
title: 第三方标注文件导入绘制矩形位置不正确
date: 2022-01-24 14:01:00
updated: 2022-01-24 14:01:00
tags:
---

标注平台需要支持一些第三方标注平台比如labelme导出的标注文件的解析，绘制到我们自己平台的标注组件上。
但是在导入labelme标注文件之后，我们的标注组件虽然能够正常绘制，但是矩形的位置都有一定程度的偏移，多边形则都是正常的。
分析应该是在处理绘制矩形所需的对角端点时，未处理两端点之间的位置关系导致的。

## 问题分析
标注平台和labelme都是使用矩形的一组对角端点来确定唯一一个矩形的
labelme会判断是哪一组对角端点确定的矩形（左上-右下，左下-右上）
但是标注平台只能会将begin点作为矩形的左上端点，跟end点计算出width和height后绘制出矩形
上述区别导致了标注平台在绘制label导入标注文件的矩形时，都会向下偏移，因为把矩形左下的端点当作了矩形的左上端点
![问题截图-labelme](https://s3.bmp.ovh/imgs/2022/04/06/b705050d4d1beed6.jpg "问题截图-labelme")
![问题截图-labelimage](https://s3.bmp.ovh/imgs/2022/04/06/0400f926e41675a9.png "问题截图-labelimage")

## 问题处理
考虑到文件转换过程中最好不要对原文件的原始数据做计算处理，所以在标注平台的标注组件初始化绘制标注图形时进行处理
通过begin点和end点的y值大小来判断end点是右上还是右下（end点必是右端点
计算出标注平台绘制矩形所需的左上起始点
```javascript
const width = Math.abs(label.beginX - label.endX) *scale
const height = Math.abs(label.beginY - label.endY) *scale
let x,y
x = (label.beginX/this.bitScale)*scale
y = (label.beginY/this.bitScale)*scale
if(label.endY<label.endX){
    //begin为左下端点，y减去height得到左上端点
    x = (label.beginX/this.bitScale)*scale
    y = ((label.beginY-height)/this.bitScale)*scale
}
graph = this.camvas.rect(width/this.bitScale,height/this.bitScale).attr({x,y})
```
此处默认了begin点都是左端点，可以借此抽出通用的根据任意一组对角点获取左上起始点(这种处理仅适用于标注平台采用的的数据结构)
```javascript
/**
 * @typedef {[number,number]} Point
 */
/**
 * @function 根据矩形对角点计算矩形的绘制原点(左上端点)
 * @param {Point} DiagonalPoint1
 * @param {Point} DiagonalPoint2
 * @return {Point} 
 */
function countRectStartPointByDiagonalPoints(DiagonalPoint1,DiagonalPoint2){
    count [[x1,y1],[x2,y2]] = DiagonalPoint2[0] >DiagonalPoint1[0]
        ?[DiagonalPoint1,DiagonalPoint2]
        :[DiagonalPoint2,DiagonalPoint1]
    if(x1===x2||y1===y2){
        // not DiagonalPoints
        return []
    }
    return y2>y1?[x1,y1]:[x1,y2]
}
```
该方法会先计算根据两点的x值大小，取得左端点和右端点的x,y值，若两点x或y值任一相同，则入参两点为同一边上的端点，不能用作确定矩形
若为对角点，则再根据y值对比，返回左上的起始点坐标
```javascript
const width = Math.abs(label.beginX - label.endX) *scale
const height = Math.abs(label.beginY - label.endY) *scale
const [x,y] = countRectStartPointByDiagonalPoints(
    [label.beginX,label.beginY],
    [label.endX,label.endY]
)
if(x&&y){
    graph = this.camvas.rect(width/this.bitScale,height/this.bitScale).attr({x,y})
}

```
## 最终效果
这个改动，仅用在标注平台上的标注组件，因为其数据处理只能用在标注平台的这种描述端点的数据结构上。
此外，多边形不存在这个问题，因为多边形是通过完整的点集描述的闭合路径转换的 。
![最终效果](https://s3.bmp.ovh/imgs/2022/04/06/ad568692cee1c608.png "最终效果")