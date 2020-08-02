说明：

文件结构：
-fsm:状态机文件示例
-Nash:纳什均衡路径
-new-server_scripts:操作脚本
-run:链码
-run_push.sh上传状态机到fabric容器中
-upload_file.py: 上面run_push.sh执行的py文件（不想写python3 blabla


状态机JSON结构：
{
    Info []string
    Action  []string
    CurrentStatus []string
    NewStatus []string
    NashPath [][]string
    Id string
    Name string
    NashInfo [][]string
}

操作脚本:
change.sh:更换以下所有的脚本cc_name（不过这个版本没啥用了）
channel.sh:创建通道 args参数：
history.sh:查询statedb中键值历史数据 args参数：["fa105be2"]（键值名称）（可查询到Txid）
InitContract.sh:初始化合同（状态机）args参数：["fa105be2"]（状态机名称，不要加.json）
install.sh:安装并且实例化链码 
QueryById.sh:根据合同唯一ID查询当前状态以及后续可能的纳什均衡路径 args参数：["b864e6a07573"]
QueryByName.sh:根据合同名称查询当前状态以及后续可能的纳什均衡路径 args参数：["fa105be2"
QueryByTxid.sh:根据交易ID查询交易状况（用来查询历史数据&操作）
regist.sh:注册token
task.sh:变更状态机状态并显示变化后可能走到的纳什均衡路径 args参数：["b864e6a07573","sat","A","Term1"](["id","操作","执行人","轮数"])

使用过程：
1.将状态机放置到fsm文件夹下上传服务器Docker
	./run_push.sh
2.(如果之前没有做)创建通道并安装实例化chaincode
	./channel.sh
	./install.sh
3.初始化合同
	./InitContract.sh
4.(后续无先后顺序)
./QueryById.sh:根据合同唯一ID查询当前状态以及后续可能的纳什均衡路径 
./4QueryByName.sh:根据合同名称查询当前状态以及后续可能的纳什均衡路径
./QueryByTxid.sh:根据交易ID查询交易状况（用来查询历史数据&操作）
./task.sh:变更状态机状态并显示变化后可能走到的纳什均衡路径 
(在脚本里面args改变参数)

