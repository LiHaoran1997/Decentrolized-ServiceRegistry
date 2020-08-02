# 去中心化服务注册

## 系统设计架构

我们结合了区块链技术，用区块链的共识机制代替了服务注册节点的分布式一致性协议，同时也改变了中心化的服务监控思路，提出了面向跨信任域场景的服务质量监控框架。最后我们在开源组件Spring Cloud的基础上，结合联盟链Hyperledger Fabric，开发了一整套去中心化环境下的、面向跨信任域的服务质量监控框架。

此项目为架构中的服务注册发现模块

![nacos-1](https://github.com/modriclee/Decentrolized-ServiceRegistry/blob/master/nacos-架构图.jpg?raw=true)

![nacos-2](https://github.com/modriclee/Decentrolized-ServiceRegistry/blob/master/nacos-架构图2.jpg?raw=true)

服务监控见Decentrolized-monitor仓库

## 运行方法

### 方法一：编译安装

#### 1.安装Hyperledger fabric 1.1版本

#### 2.启动区块链

```
cd fabric-nodejs
./runApp.sh   #启动配置好的fabric集群，kafka/zookeeper/CA/order/peer
cd new_scripts
./channel.sh  #创建通道并加入通道
./install_nacos.sh #安装并实例化链码
```

#### 3.运行

```
cd nacos

#导入并编译项目
mvn clean package -Dmaven.test.skip=true
mvn -Prelease-nacos clean install -U  -Dmaven.test.skip=true

#修改application.properties 中末尾的fabric地址端口以及配置mysql地址
vi distribution\conf/application.properties

#单机模式
bash distribution/target/nacos-server-1.2.0-SNAPSHOT/nacos/bin/startup.sh -m standalone
#集群模式
bash distribution/target/nacos-server-1.2.0-SNAPSHOT/nacos/bin/startup.sh
#关闭
bash distribution/target/nacos-server-1.2.0-SNAPSHOT/nacos/bin/shutdown.sh

```

### 方法二：从镜像安装（推荐）

docker-compose文件：

```
version: '2'
services:
  nacos-server1:
    image: registry.cn-hangzhou.aliyuncs.com/nacos-fabric/nacos-server:1.3.1
    container_name: nacos-server1
    restart: always
    privileged: true
    environment:
      PREFER_HOST_MODE: ip 
      NACOS_SERVER_IP: 10.77.70.177  #设定该服务器ip
      NACOS_SERVERS: 10.77.70.178:8848 10.77.70.177:8849 10.77.70.175:8848 #集群内其他ip
    ports:
    "8848:8848"
    "9555:9555"
```

```
docker-compose -f  xxxxxxx.yml up  #启动镜像 
docker-compose -f  xxxxxxx.yml down  #关闭镜像 
```

