# 去中心化服务注册

## 系统设计架构：

针对去中心化环境下的服务注册系统设计，我在阿里的nacos基础上做了二次开发，保持之前系统基本功能不变的情况下 ，将数据持久切换到区块链上，同时将一致性协议（Raft）替换为共识机制，通过共识机制保持节点间的一致性，在保持一致性的情况下，尽量保证高可用性。

架构设计

![nacos-1](https://github.com/modriclee/Decentrolized-ServiceRegistry/blob/master/nacos-架构图.jpg?raw=true)

![nacos-2](https://github.com/modriclee/Decentrolized-ServiceRegistry/blob/master/nacos-架构图2.jpg?raw=true)

服务监控见Decentrolized-monitor仓库

运行方法

1.安装Hyperledger fabric 1.1版本

2.

```
cd fabric-nodejs
./runApp.sh   #启动配置好的fabric集群，kafka/zookeeper/CA/order/peer
cd new_scripts
./channel.sh  #创建通道并加入通道
./install_nacos.sh #安装并实例化链码
```

`

3.运行

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
