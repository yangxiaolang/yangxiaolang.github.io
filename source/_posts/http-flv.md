---
title: 使用HTTP-FLV增强流媒体服务器实现低延迟直播
date: 2022-04-11 19:10:44
updated: 2022-04-11 19:10:44
tags:
---
之前曾使用Nginx的nginx-rtmp-module接收安防摄像头转码后的rtmp流，在服务器上生成m3u8索引文件及ts切片文件，前端通过HLS来读取m3u8进行播放，但是发现HLS的直播随着播放时间的增加，延迟也在逐渐增长。对于低延迟的场景，HLS，不太合适。直接使用RTMP协议也不合理，浏览器不支持该协议。
所以目前的需求是 使用HTTP协议传输，低延迟。采用了[HTTP-FLV直播](https://zhuanlan.zhihu.com/p/28722048)，WebRTC当时并未考虑。

## HTTP-FLV流媒体服务器镜像搭建
### Dockerfile
HTTP-FLV需要Nginx安装第三方模块[nginx-http-flv-module](https://github.com/winshining/nginx-http-flv-module/blob/master/README.CN.md)(这个模块包含了nginx-rtmp-module)，所以一个Nginx可以同时验证hls和http-flv
下载nginx-http-flv-module模块并解压，将目录移动到之前制作流媒体服务器镜像的目录，
改写Dockerfile
```Dockerfile
FROM alpine

RUN mkdir rtmp-server
COPY nginx-1.14.0 rtmp-server/nginx-1.14.0
COPY nginx-http-flv-module rtmp-server/nginx-http-flv-module
# 设置软件包镜像源并更新
RUN echo "https://mirror.tuna.tsinghua.edu.cn/alpine/v3.4/main/" > /etc/apk/repositories \
    && apk update \
    && apk upgrade \
    # 安装nginx的编译环境
    && apk add gcc g++ make libffi-dev openssl-dev \
    && cd /rtmp-server/nginx-1.14.0 \
    # 配置编译安装nginx
    && sh configure --prefix=/usr/local/nginx --add-module=../nginx-http-flv-module --with-http_ssl_module --without-http_rewrite_module \
    && make \
    && make install \
    # 卸载编译环境
    && apk del gcc g++ make libffi-dev openssl-dev 
    #&& mkdir /usr/local/nginx/html/cctvf
COPY nginx.conf /usr/local/nginx/conf/nginx.conf
COPY html /usr/local/nginx/html
ENTRYPOINT ["/usr/local/nginx/sbin/nginx","-g","daemon off;"]

```

### Nginx配置
配置Nginx开启RTMP及HTTP-FLV用于传输视频，对比延迟效果
```perl
#user  nobody;
worker_processes 1;
#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;
#pid        logs/nginx.pid;
events {
    worker_connections 1024;
}

rtmp {
    server {
        listen 1935;
        chunk_size 4000;
        application cctvf {
            live on;
            hls on;
            hls_path /usr/local/nginx/html/cctvf;
            hls_fragment 5s;
        }
    }
}

http {
    include mime.types;
    default_type application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
    access_log logs/access.log main;
    sendfile on;
    #tcp_nopush     on;
    #keepalive_timeout  0;
    keepalive_timeout 65;
    #gzip  on;
    server {
        listen 80;
        server_name localhost;
        location / {
            root /usr/local/nginx/html/;
            index index.html index.htm;
        }
        location /live {
            flv_live on; 
            chunked_transfer_encoding on; 

            add_header 'Access-Control-Allow-Origin' '*'; #添加额外的 HTTP 头
            add_header 'Access-Control-Allow-Credentials' 'true'; #添加额外的 HTTP 头
        }
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root html;
        }
    }
}

```
### 测试页面
html 内是用来测试延迟的测试页面，分别使用hls.js和flv.js来播放验证HLS和HTTP-FLV两种直播的效果，内置读秒器来记录延迟。
```html
<body>
<h1 id="count"></h1>
<video width="720" height="480" muted id="video1"></video>
<video width="720" height="480" muted id="video2"></video>
<button id="button">按钮</button>
<script src="https://cdn.jsdelivr.net/hls.js/latest/hls.min.js"></script>
<script src="./flv.min.js"></script>
<script>
    let index = 0;
    setInterval(() => {
    document.getElementById("count").innerText = index;
    index++;
    }, 1000);
    const video = document.getElementById("video1");
    if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource("/cctvf/lang.m3u8");
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // 改变 hls 播放流后就会进入该事件
        video.play();
    });
    }

    document.getElementById("button").addEventListener("click", () => {
    if (flvjs.isSupported()) {
        const videoElement = document.getElementById('video2')
        var flvPlayer = flvjs.createPlayer({
        type: "flv",
        url: "/live?app=cctvf&stream=lang",
        });
        flvPlayer.attachMediaElement(videoElement);
        flvPlayer.load();
        videoElement.play();
        flvPlayer.on(flvjs.Events.ERROR, function (errType, errDetail) {
        switch (errType) {
            case flvjs.ErrorTypes.NETWORK_ERROR:
            switch (errDetail) {
                case flvjs.ErrorDetails.NETWORK_EXECPTION:
                console.log("NETWORK_EXECPTION");
                break;
                case flvjs.ErrorDetails.NETWORK_STATUS_CODE_INVALID:
                console.log("NETWORK_STATUS_CODE_INVALID");
                break;
                case flvjs.ErrorDetails.NETWORK_TIMEOUT:
                console.log("NETWORK_TIMEOUT");
                break;
                case flvjs.ErrorDetails.NETWORK_UNRECOVERABLE_EARLY_EOF:
                console.log("NETWORK_UNRECOVERABLE_EARLY_EOF");
                flvPlayer.unload();
                flvPlayer.detachMediaElement(videoElement);
                flvPlayer.attachMediaElement(videoElement);
                flvPlayer.load();
                videoElement.play();
                break;
            }
            break;
            case flvjs.ErrorTypes.MEDIA_ERROR:
            switch (errDetail) {
                case flvjs.ErrorDetails.MEDIA_MSE_ERROR:
                console.log("MEDIA_MSE_ERROR");
                break;
                case flvjs.ErrorDetails.FORMAT_ERROR:
                console.log("FORMAT_ERROR");
                break;
                case flvjs.ErrorDetails.FORMAT_UNSUPPORTED:
                console.log("FORMAT_UNSUPPERTED");
                break;
                case flvjs.ErrorDetails.CODEC_UNSUPPORTED:
                console.log("CODEC_UNSUPPORTED");
                break;
            }
            break;
            case flvjs.ErrorTypes.OTHER_ERROR:
            console.log("OTHER_ERROR");
            break;
        }
        });
    }
    });
</script>
</body>
```
## 使用验证
1. 在Dockerfile目录下，build镜像
```shell
docker build -t http-flv:v1 .
```
2. 启动http-flv服务容器，指定端口。-d 后台运行 -p设置端口映射
```shell
docker run -d -p10101:1935 -p10102:80 http-flv:v1
```
3. 访问测试页面 (容器内80端口)

4. 使用OBS录制测试页面向容器内1935端口推送串流，测试用的串流密钥为lang
![OBS设置推流](https://s3.bmp.ovh/imgs/2022/04/11/a722b3e2621e7095.png "OBS设置推流")
5. 返回测试页面，HLS会自动探测m3u8是否可用，HTTP-FLV需要点击按钮手动开启，观察延迟差异
![HLS与HTTP-FLV延迟对比](https://s3.bmp.ovh/imgs/2022/04/11/653a4bf570a4148d.png "HLS与HTTP-FLV延迟对比")

## 待办
其实还有一种直播技术，就是WebRTC，听说可以把延迟降到几百ms，不过简单看了下，更像是P2P的那种，一对多的似乎也有，之后有时间搞一下，WebRTC能实现自然比Nginx这类相对简单一些（对于前端