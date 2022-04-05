---
title: 流媒体服务器镜像制作及视频ffmpeg循环推流
date: 2021-07-01 18:24:00
updated: 2021-07-01 18:24:00
tags:
---
项目在某地的落地需要引入对摄像头等设备的RTSP视频流数据的处理，目前测试用的摄像头无法支持稳定的多客户端连接且处于无法访问的状态。为了便于测试和日后的部署安装流媒体服务器，需要制作一个流媒体服务器的Docker镜像以及用一个普通视频循环推流模拟一个未预期视频流长度的的视频流。

## 方案设计
1. 考虑搭建nginx流媒体服务器，接收视频流存储为TS切片文件，处理来自客户端的访问，这样多客户端访问的就是流媒体服务器上的视频流(TS切片文件)，而非直连硬件设备。
2. 制作Docker镜像以方便部署流媒体服务器容器到目标主机，一次编译安装流媒体服务器即可到处部署。
3. 使用ffmpeg编解码工具将摄像头的rtsp视频流或循环读取视频转为rtmp视频流推送到流媒体服务器。

## 方案实施
1. 下载[Nginx源码](http://nginx.org/en/download.html)和[nginx-rtmp-module](https://github.com/arut/nginx-rtmp-module)源码到相同目录
2. 编写nginx配置
```nginx
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
```
3. 编写Dockerfile
```dockerfile
# 基于最小的Linux系统镜像
FROM alpine
RUN mkdir rtmp-server
COPY nginx-1.14.0 rtmp-server/nginx-1.14.0
COPY nginx-rtmp-module rtmp-server/nginx-rtmp-module
# 设置软件包镜像源并更新
RUN echo "https://mirror.tuna.tsinghua.edu.cn/alpine/v3.4/main/" > /etc/apk/repositories \
&& apk update \
&& apk upgrade \
# 安装nginx的编译环境
&& apk add gcc g++ make libffi-dev openssl-dev \
&& cd /rtmp-server/nginx-1.14.0 \
# 配置编译安装nginx
&& sh configure --prefix=/usr/local/nginx --add-module=../nginx-rtmp-module     --with-http_ssl_module --without-http_rewrite_module \
&& make \
&& make install \
# 卸载编译环境
&& apk del gcc g++ make libffi-dev openssl-dev \
&& mkdir /usr/local/nginx/html/cctvf
COPY nginx.conf /usr/local/nginx/conf/nginx.conf
ENTRYPOINT ["/usr/local/nginx/sbin/nginx","-g","daemon off;"]
```
4. 执行Docker命令制作镜像
```shell
docker build -t rtmp-server .
```
5. 启动容器
```shell
docker run -d -p$port:$port rtmp-server
```
6. 使用ffmepg循环读取视频文件并推流。[ffmpeg安装教程](https://www.jianshu.com/p/2b609afb9800)
```shell
  ffmpeg -re  -stream_loop -1 -i $video_topath -vcodec copy -acodec copy -f flv -y rtmp://$ip:$port/$rmtp_path
```
7. 使用OBS或VLC等可读取网络串流的媒体播放器播放
![ffmpeg推流](https://img3.qq.tc/2022/04/05/ffmpeg.png 'ffmpeg推流')
![通过OBS播放视频流](https://img3.qq.tc/2022/04/05/OBS.png '通过OBS播放视频流')