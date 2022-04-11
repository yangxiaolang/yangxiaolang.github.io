---
title: Audio标签音频源无法播放的问题记录及解决
date: 2021-06-03 21:48:00
updated: 2021-06-03 21:48:00
tags:
---
在前端获取音频文件的base64编码构造dataURL进行音频的播放，遇到了播放器不能播放音频以及在更换音频源src时仍然播放之前加载的音频源的的问题,在此做简单记录。

## audio标签的src无法使用dataURL
audio的src引用的是dataUrl时,即音频文件的base64编码在前面加上媒体描述，会发生request too large的错误，原因是文本超出了url的限制，需要将音频的base64码转为文件二进制(Blob)对象，再创建一个指向该对象的URL，用src加载该URL来实现音频源的更换
```javascript
const bytes = window.atob(voiceBase64)
const ab = new ArrayBuffer(bytes.length)
const ia = new Uint8Array(ab)
for(let i=0;i<bytes.length>;i++){
    ia[i]=bytes.charCodeAt(i)
}
const url = URL.createObjectURL(
    new Blob([ab],{type:'audio/mpeg'})
)
```

## 更换src音频源后仍然播放更换前的音频文件
在更换音频源后，播放器未重新加载新的音频源导致新音频不能被播放，解决方案：需要调用播放器元素的load()方法重新加载音频源  [HTMLMediaElement.load() - Web API 接口参考 | MDN (mozilla.org)](https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLMediaElement/load)

```javascript
const player = document.querySelector('audio-player')
player.src = newUrl
player.load()
```