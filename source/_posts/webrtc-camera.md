---
title: WebRTC调用摄像头进行视频录制
date: 2021-09-27 14:26:00
updated: 2022-02-21 14:26:00
tags:
---
需要做一个简单的活体检测的demo，得调用设备上的设备头去录制视频进行活体检测，于是了解了下浏览器使用WebRTC调用设备的摄像头，用在PC端和手机浏览器端都没啥问题，打包在公司的安卓底座上倒是调不起摄像头，不过是底座使用浏览器的问题，跨端兼容性问题不大。
主要使用的API: **navigator.mediaDevices(访问客户端摄像头和麦克风设备)** **MediaRecorder(视频录制)**

## 调用摄像头
使用 **[MediaDevices.getUserMedia()](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia)** 调用设备摄像头
这里使用了 async/await 语法使流程看起来更清晰，获取到媒体流
```javascript
async function getUserMedia() {
  const MediaStream = await navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'user'} })
    .catch((error) => {
      console.log(error);
    });
  return MediaStream;
}

```
使用canvas播放视频,这里使用Canvas播放视频主要是为了获取视频帧，用作活体检测完成后人脸识别的入参图片，视频播放过程中每隔一段时间获取一帧检测人脸质量，最后提交人脸质量得分最高的
```javascript
const video = document.createElement("video");
video.srcObject = stream;

video.addEventListener("play", () => {
    let i = 1;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderTask = setInterval(() => {
    ctx.drawImage(
        video,
        0,
        0,
        Math.max(canvas.width, video.videoWidth),
        Math.max(canvas.height, video.videoHeight)
    );
    if (i % 200 === 0) {
        const faceBase64 = canvas.toDataURL("image/jpeg", 0.9);
        checkFace(faceBase64)
    }
    i++;
    }, 1);
});
video.play();
```
![摄像头采集画面](https://s3.bmp.ovh/imgs/2022/04/07/42ce51ac64e23a99.png "摄像头采集画面")
## 视频录制
通过 **[MediaDevices.getUserMedia()](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia)** 获取到摄像头的视频流后，就可以通过 **[MediaRecorder](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaRecorder)**进行录制了
```javascript
function getRecorder(stream) {
  const mediaRecord = new MediaRecorder(stream, {
    mimeType: "video/webm",
  });
  // ondataavailable该事件可用于获取录制的媒体资源 (在事件的 data 属性中会提供一个可用的 Blob 对象.)
  mediaRecord.ondataavailable = (e) => {
    const videoBlob = new Blob([e.data], { type: "video/webm" });
    const fr = new FileReader();
    const index = parameters.findIndex((el) => el.video === "");
    fr.readAsDataURL(videoBlob);
    fr.onload = (e) => {
      parameters[index].video = e.target.result.split(",")[1];
    };
  };
  return mediaRecord;
}
```
有了录制视频，我们就可以进行检测了
```javascript
async function detect(actions,stream,retry){
    const action = actions.shift()
    const mediaRecord = getRecorder(stream)

    await retry?Promise.resolve():renderContent(`请 <span style="color:red;">${action.label}</span>`)
    // 控制提示语的动画显示
    await sleep(1500)
    // 每次检测，都录制一段1s或3s的视频片段用来检测
    mediaRecord.start()
    await countdown()
    mediaRecord.stop()
    if(actions.length===0){
        return
    }
    // 还有需要检测的动作，继续录制检测
    await detect(actions,stream)
}

async function countdown(){
    return new Promise(res=>{
        // 是否允许重试
        let total = getQueryVariable('retry')?1:3
        const countdown = setInterval(()=>{
            total--
            if(total<0){
                clearInterval(countdown)
                res()
            }
        },1000)
    })
}
```
当所有的录制都结束后，就可以将录制的视频提交上去进行活体检测了
```javascript
await sleep(50);
await detect(list, stream);
await sleep(50);

Promise.all(parameters.map((el) => submit(el)))
```
![录制视频播放](https://s3.bmp.ovh/imgs/2022/04/07/9e4716e1f0fde0bf.png "录制视频播放")
## iframe通信
因为需求是摄像头页面要能通过iframe嵌入到其他需要集成活体检测的页面，所以需要进行父子间iframe的通信，所幸不考虑父子不同源的情况，这里采取的是通过 **window.parent&&window.iframes** 对象上定义的方法进行通信。
即只要父子页面分别实现了这些方法，就可以进行通信
```javascript
// child_teleport.js 父页面会尝试调用这些方法，只要子页面实现了
function getResponse() {
  return responses;
}

function getFace(){
  return face
}

function closeMedia() {
  document.querySelector("#circle").removeAttribute("class");
  stream.getTracks().forEach((el) => el.stop());
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  clearInterval(renderTask);
}

function setActions(actions) {
  fixedActions = [...actions];
}

function getActions() {
  return actions;
}

// parent-teleport.js
// 父页面只要实现detectDone方法即可，子页面任务完成后即可调用其操作父页面
function detectDone(res) {
    $("#empty").hide();
    $("#result").children().remove()
    $("#result").show();

    // console.log("res", res, actions);
    res.forEach((el) => {
      $("#result").append(`
        <li class="list-group-item"><span style="color:${
          el.result ? "green" : "red"
        }"><span class="iconfont ${
        el.result ? "icon-check-circle" : "icon-close-circle"
      }" style="font-size:20px"></span>${
        " " + actions.find((item) => item.value === el.action).label
      }</span></li>
      `);
    });
  }
```
![嵌入其他页面效果，仅圆框部分是iframe嵌入](https://s3.bmp.ovh/imgs/2022/04/11/616ca798d9b8b265.png "嵌入其他页面效果，仅圆框部分是iframe嵌入")