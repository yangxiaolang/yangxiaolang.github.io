---
title: 使用G6绘制知识图谱
date: 2020-12-22 17:48:00
updated: 2022-04-07 21:39:00
tags:
---
**迁移中**
使用 [G6](https://g6.antv.vision/zh) 绘制一个知识图谱，知识图谱的后端主要使用思知的知识图谱API，页面上使用阿里的G6进行绘制，G6的力导向图文档相对详细些。不过相比于[思知官网上使用d3绘制的知识图谱](https://www.ownthink.com/knowledge.html)，性能差距有点大，G6使用canvas在节点数量很大的场景下仍然会有卡顿感，思知的相同数量节点而且用的是SVG看起来还是相当流畅的。
![G6知识图谱](https://s3.bmp.ovh/imgs/2022/04/07/48c609312374e4d9.png "G6知识图谱")
## 知识图谱
**定义:** 知识图谱，是由互相有联系的实体和它们的属性构成的。

通过G6关系图的文档也明白了知识图谱其实也就是一种关系图，用来深度遍历一个实体的关系属性
这里使用力导向图的布局来实现思知知识图谱的节点间作用力动画，交互上
* 1. 初始化一个实体，查询他的所有属性，绘制初始关系图
* 2. 初始实体的属性节点可点击，点击后以此为实体查询其所有属性
* 3. 重复1，2

## 力导向图设置
图除了样式配置外，只有两种数据，点和边
点主要是id和label（文本），边即links主要属性有source（起点），target(终点)及label(文本)
### HTML结构
```html
<!-- index.html -->
<body>
    <div style="width: 100vw;height: 10vh;display: flex;justify-content: center;align-items: center;">
        <input id="entity" placeholder="输入需要查询的实体名称"
            style="text-align: center;width: 50%;height: 40%;outline: none;border-radius: 40px;">
    </div>
    <div id="chart" style="width: 100vw;height: 90vh;"></div>
    <script src="https://gw.alipayobjects.com/os/lib/antv/g6/4.0.3/dist/g6.min.js"></script>
    <!-- 图的配置文件，布局、点和边的样式、力的大小以及拖动事件 -->
    <script src="./options.js"></script>
    <!-- 图的绘制方法定义,用于用户重新输入后绘制 -->
    <script src="./draw.js"></script>
    <!-- 图的重绘方法定义,用于用户点击节点重绘 -->
    <script src="./reDraw.js"></script>
    <script>
        const input = document.getElementById('entity')
        input.onkeypress = (e) => {
            if (input.value) {
                if (e.which === 13) {
                    initChart(input.value)
                }
            }
        }
    </script>
</body>
```
### G6配置
```javascript
// options.js
// 获取DOM
const container = document.querySelector('#chart');
// 数据
const data = {
    nodes: [],
    edges: [],
};
const width = container.scrollWidth;
const height = container.scrollHeight || 500;
const graph = new G6.Graph({
    container: 'chart',
    width,
    height,
    // 布局设置，边长、力导向的斥力等配置
    layout: {
        center: [container.clientWidth / 2, container.clientHeight / 2],
        type: 'force',  
        nodeSize: 15,   
        linkDistance: 150,  
        nodeStrength: -500, 
        edgeStrength: 2,
        preventOverlap: true,
        nodeSpacing: 20,
        collideStrength: 0
    },
    // 设置画布可缩放拖拽，节点可拖拽
    modes: {
        default: [
            'drag-canvas',
            'zoom-canvas',
            'drag-node'
        ],
    },
});
graph.data(data);
graph.render();
```
还需要给节点增加拖拽事件的处理函数，更新节点位置
```javascript
function refreshDragedNodePosition(e) {
    const model = e.item.get('model');
    model.fx = e.x;
    model.fy = e.y;
}
graph.on('node:dragstart', (e) => {
    graph.layout();
    refreshDragedNodePosition(e);
    const nodeItem = e.item
    graph.setItemState(nodeItem, 'drag', true);
});
graph.on('node:drag', (e) => {
    graph.layout();
    refreshDragedNodePosition(e);
});

graph.on('node:dragend', (e) => {
    const nodeItem = e.item
    graph.setItemState(nodeItem, 'drag', false);
    refreshDragedNodePosition(e);
})
```
![空白力导向图](https://s3.bmp.ovh/imgs/2022/04/07/bbffafcc3e5b00e4.png "空白力导向图")
这样就完成了空白力导向图的配置，只差数据接入进行绘制了。

## 思知知识图谱API接入

### 初始请求
只要发送Ajax请求到[思知提供的API](https://www.ownthink.com/docs/kg/)就行了，就直接用XHR整了
```javascript
// draw.js

// 发送ajax请求，获取知识图谱
const xmlhttp = new XMLHttpRequest()
xmlhttp.open('GET', `https://api.ownthink.com/kg/knowledge?entity=${entity}`, true)
xmlhttp.onreadystatechange = () => {
    if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
        // 回调函数
    }
}
xmlhttp.send()
```
返回参数的格式为，主要处理的数据为**avp** , 是一个二维数组，数组元素为 [实体属性,属性值] 即 [边,点]
| 参数    | 类型   | 描述                                                       |
| ------- | ------ | ---------------------------------------------------------- |
| message | string | success表示请求正确，error表示请求错误                     |
| data    | object | 返回的数据                                                 |
| entity  | strin  | 实体名                                                     |
| desc    | strin  | 实体简介                                                   |
| tag     | list   | 实体标签                                                   |
| avp     | list   | 实体属性值，第一列为实体的属性，第二列为实体属性所对应的值 |

将获取到的实体的属性值连接到实体上，即 **实体 -- 实体属性 -> 属性值** 的绘制，我们只需要维护点和边的数据集，将数据集通过G6渲染到力导向图上即可。
```javascript
// draw.js
// 初始实体的点集
const initNodes = (relations) => {
    //遍历关系数组生成节点对象数组
    const nodes = relations.map(([relation,attribute], index) => {
        return {
            id: 'node' + (index + 1 + 1).toString(), //第一个+1是因为nodes数组有已经有初始节点了
            label: attribute,
            // 增加自定义的tag属性，因为中文名属性可能与实体重复
            tag: relation,
            style: {
                fill: colors[index % colors.length],
                stroke: false
            },
            //未选中的属性节点状态为c1
            class: 'c1',
        }
    })
    return nodes
}
// 初始实体的边集
const initEdges = (originNode, nodes) => {
    // 遍历目标节点列表跟源节点生成边
    const links = nodes.map((node, index) => {
        return {
            //边即使用下标即可
            id: 'edge' + index.toString(),
            //源节点ID
            source: originNode.id,
            //目标节点ID
            target: node.id,
            //目标节点的tag属性即为与源节点的关系
            label: node.tag
        }
    })
    return links
}

// XHR的回调函数内部
const res = JSON.parse(xmlhttp.responseText)
// relations = [ relation , attribute ]
const relations = res.data.avp
if(!relations){
    alert('该实体没有对应属性，请重新输入')
    return 
}
// 得到查询的实体作为第一个节点，即初始节点，固定容器中心位置
const originNode = {
    id: 'node1',
    label: res.data.entity,
    tag: 'entity',
    size: 24,
    style: {
        fill: '#98F5FF',
        stroke: false
    },
    // 节点状态c0，标识初始节点
    class: 'c0',
    fx: container.clientWidth / 2,
    fy: container.clientHeight / 2
}
data.nodes.push(originNode)
// 获取新获得的节点列表
const nodes = initNodes(relations)
// 使用源节点和目标节点列表生成边
const links = initEdges(originNode, nodes)

// 更新点、边数据
data.nodes = data.nodes.concat(nodes)
data.edges = links
// 将数据挂载到图实例中
Max_Length = data.nodes.length + 1
graph.data(data);
// 渲染图
graph.render();
```
![初始力导向图](https://s3.bmp.ovh/imgs/2022/04/07/bd19b6cb3d78c175.png "初始力导向图")

### 向下遍历属性
绘制好初始的知识图谱之后就可以继续下一步了，给节点添加点击事件，获取该节点实体的属性
```javascript
// 定义节点的点击事件，将点击的属性节点作为实体查找其属性，重绘
graph.on('node:click', (e) => {
    const nodeItem = e.item
    refreshDragedNodePosition(e);
    graph.setItemState(nodeItem, 'drag', true);
    // 因为没有点击释放事件，所以使用定时器模拟一下点击按下及释放的样式变化
    setTimeout(() => {
        graph.setItemState(nodeItem, 'drag', false);
    }, 100)
    // 重绘
    reDraw(e)
})
```
继续调用思知的知识图谱API，获取属性值
```javascript
// reDraw.js
// 点集和边集的生成跟初始类似
const reDrawNodes = (relations) => {
    // 遍历关系数组生成节点数组
    return relations.map(([relation,attribute], index) => {
        return {
            id: 'node' + (Max_Length + index + 1).toString(),
            label: attribute,
            tag: relation,
            style: {
                fill: colors[index % colors.length],
                stroke: false
            },
            class: 'c1',
        }
    })
}
const reDrawEdges = (source, targets) => {
    // 显然有多少新增节点就有多少新增边,新增节点的边的起点显然也是当前点击的点
    const links = targets.map((targetNode, index) => {
        return {
            id: 'edge' + (Max_Length + index + 1).toString(),
            source: source.id,
            target: targetNode.id,
            label: targetNode.tag
        }
    })
    return data.edges.concat(links)
}

// 回调函数的处理需要处理同名的关系，需要filter到已有的同名关系
const res = JSON.parse(xmlhttp.responseText)
// relations = [ relation , attribute ]
const relations = res.data.avp
// 如果没有属性，不做处理
if (relations !== undefined) {
    // 获取到的关系中剔除图中已有的同名关系
    // todo ： 最好携带parent数据，不然可能排除不同parent的同名节点
    const newRelations = relations.filter(item => {
        return data.nodes.findIndex(node => {
            return node.label === item[1]
        }) === -1
    })
    // 生成新增节点列表
    const newNodes = reDrawNodes(newRelations)
    data.nodes=data.nodes.concat(newNodes)
    // 使用当前节点作为源节点，和新增目标节点列表，生成新增的边列表合并赋给data
    data.edges = reDrawEdges(currentNode, newNodes)
    Max_Length = Max_Length + data.nodes.length
    graph.data(data)
    graph.render()
}
```
此时的效果是
![继续探索](https://s3.bmp.ovh/imgs/2022/04/07/ded3181f21fc2f7c.png "继续探索")

可以看到，每一个查询的实体都会携带自己的属性值，导致无法从知识图谱中整理出一条清晰的脉络，此时就需要我们进行剪枝的操作

### 减除无用的枝干
当我们点击一个实体的属性值时，会把这个属性值当作下一个实体去查询属性值，此时我们关注的就是这个实体的属性而不是上一个实体的属性值。所以需要减除上一个实体未被选中的属性值
```javascript
// reDraw.js

function reDraw(e){
    const currentNode = e.item.get('model');
    // 获取到以当前点为终点的边
    const currentEdge = data.edges.find(item => {
        return item.target === currentNode.id
    })
    // 获取到边的起点，若边为undefined，则点为初始点
    const sourceNode = currentEdge === undefined ? undefined : data.nodes.find(item => {
        return item.id === currentEdge.source
    })
    // 当前点置为选中状态
    currentNode.class = 'c2'
    if (sourceNode) {
        // 若不为起始点，边置为选中状态，进行剪枝操作
        currentEdge.class = 'c2'
        delUserlessNodes(sourceNode, currentNode)
    }
    ...
}

// 剪枝
// 共有三种状态，初始点独占c0状态，被点击过的点及其作为终点连接起点的边被置为c2即选中状态
// 所有刚生成的属性结点为c1状态，剪枝即剪除跟被点击点同源的c1状态的点及边
const delUserlessNodes = (source, target) => {
    // 遍历边生成需要删除的点ID列表
    const delIDList = data.edges.filter(item => {
        // 返回所有起点为source，但终点不为target的边
        return item.source === source.id && item.target !== target.id
    }).map(item => {
        // 返回这些边的终点ID，即为要剪除的点
        return item.target
    })
    // 遍历待删除列表
    delIDList.forEach(item => {
        // 删除边
        // 遍历删除所有终点为item的且未被选中的边
        for (let index = data.edges.findIndex(edge => {
                return edge.target === item && edge.class !== 'c2'
            }); index !== -1; index = data.edges.findIndex(edge => {
                return edge.target === item && edge.class !== 'c2'
            })) {
            data.edges.splice(index, 1)
        }
        // 删除点
        // 遍历删除所有ID为item且不为起始点，未被选中的点
        for (let index = data.nodes.findIndex(dot => {
                return dot.id === item && dot.class !== 'c0' && dot.class !== 'c2'
            }); index !== -1; index = data.edges.findIndex(dot => {
                return dot.id === item && dot.class !== 'c0' && dot.class !== 'c2'
            })) {
            data.nodes.splice(index, 1)
        }
    })
    // 挂载数据，重绘
    graph.data(data)
    graph.render()
}
```
通过剪枝操作，我们最后就能通过知识图谱梳理出清晰的知识脉络了
![实现效果](https://s3.bmp.ovh/imgs/2022/04/07/4265d8967f963cf6.png "实现效果")

## 后记
现在看当时写的知识图谱，还是蛮多问题的，该封装的XHR请求没封装，拖拽事件绑定的处理方法多余等等。
其实主要还是大数量节点导致的掉帧问题，G6之后也很少用了，不太了解咋优化。试了下靠防抖和节流能不能节约一下资源提高下流畅性，结果其实没啥用就不放了。
现在Echarts5的文档关于力导向图的部分也蛮全的，找时间可以尝试下，或者跟思知一样学个d3尝试一下，毕竟没想到最后实现竟然SVG比Canvas流畅 。
回头试好了放Github上。