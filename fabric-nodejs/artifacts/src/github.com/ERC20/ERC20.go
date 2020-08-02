package main

import (

	"encoding/json"

	"fmt"

	"strconv"

"github.com/hyperledger/fabric/core/chaincode/shim"

sc "github.com/hyperledger/fabric/protos/peer"

)

//默认合约数据结构

type SmartContract struct {

}

//积分数据结构定义

type Token struct {

	Owner string `json:"Owner"`

	TotalSupply int `json:"TotalSupply"`

	TokenName string `json:"TokenName"`

	TokenSymbol string `json:"TokenSymbol"`

	BalanceOf map[string]int `json:"BalanceOf"`

}

//积分总额初始化函数

func (token *Token) initialSupply(){

	token.BalanceOf[token.Owner] = token.TotalSupply;

}

//积分转移函数

func (token *Token) transfer (_from string, _to string, _value int){

	if(token.BalanceOf[_from] >= _value){

		token.BalanceOf[_from] -= _value;

		token.BalanceOf[_to] += _value;

	}

}

//积分余额函数

func (token *Token) balance (_from string) int{

	return token.BalanceOf[_from]

}

//管理员账户积分部分销毁函数

func (token *Token) burn(_value int) {

	if(token.BalanceOf[token.Owner] >= _value){

		token.BalanceOf[token.Owner] -= _value;

		token.TotalSupply -= _value;

	}

}

//普通账户积分销毁函数

func (token *Token) burnFrom(_from string, _value int) {

	if(token.BalanceOf[_from] >= _value){

		token.BalanceOf[_from] -= _value;

		token.TotalSupply -= _value;

	}

}

//矿工函数，积分供应总额增加

func (token *Token) mint(_value int) {



	token.BalanceOf[token.Owner] += _value;

	token.TotalSupply += _value;

}

//合约默认初始化方法

func (s *SmartContract) Init(stub shim.ChaincodeStubInterface) sc.Response {

	return shim.Success(nil)

}

//合约初始化账本函数

func (s *SmartContract) initLedger(stub shim.ChaincodeStubInterface, args []string) sc.Response {

	//参数为3个，否则报错

	if len(args) != 3 {

		return shim.Error("Incorrect number of arguments. Expecting 2")

}

	//参数1为积分标志，参数2为积分名字，参数3为积分总额

	symbol:= args[0]

	name := args[1]

	supply,_:= strconv.Atoi(args[2])

	//token数据结构初始化

	token := &Token{

		Owner: "coinbase",

		TotalSupply: supply,

		TokenName: name,

		TokenSymbol: symbol,

		BalanceOf: map[string]int{}}

	//调用积分总额初始化函数

	token.initialSupply()

	//将token数据结构序列化写入区块链

	tokenAsBytes, _ := json.Marshal(token)

	err := stub.PutState(symbol, tokenAsBytes)

	if err != nil {

		return shim.Error(err.Error())

	}

	fmt.Printf("Init %s \n", string(tokenAsBytes))



	return shim.Success(nil)

}

//积分交易函数

func (s *SmartContract) transferToken(stub shim.ChaincodeStubInterface, args []string) sc.Response {

	//参数不为4个报错

	if len(args) != 4 {

		return shim.Error("Incorrect number of arguments. Expecting 4")

	}

	_from := args[1] //积分发生账户

	_to := args[2] //积分接受账户

	_amount,_ := strconv.Atoi(args[3]) //积分转移数量

	if(_amount <= 0){

		return shim.Error("Incorrect number of amount")

	}

	//获取积分发送账户的值数据

	tokenAsBytes,err := stub.GetState(args[0])

	if err != nil {

		return shim.Error(err.Error())

	}

	fmt.Printf("transferToken - begin %s \n", string(tokenAsBytes))

	//新建积分数据结构

	token := Token{}

	//将得到的二进制数据反序列化写入token数据结构

	json.Unmarshal(tokenAsBytes, &token)

	token.transfer(_from, _to, _amount) //调用积分转移函数

	//将转移后的token数据结构序列化为二进制数组

	tokenAsBytes, err = json.Marshal(token)

	if err != nil {

		return shim.Error(err.Error())

	}

	err = stub.PutState(args[0], tokenAsBytes) //写入区块链

	if err != nil {

		return shim.Error(err.Error())

	}

	fmt.Printf("transferToken - end %s \n", string(tokenAsBytes))


	return shim.Success(nil)

}

//积分余额查询函数

func (s *SmartContract) balanceToken(stub shim.ChaincodeStubInterface, args []string) sc.Response {

	//参数不为2报错

	if len(args) != 2 {

		return shim.Error("Incorrect number of arguments. Expecting 2")

	}

	//获取参数0对应的值

	tokenAsBytes,err := stub.GetState(args[0])

	if err != nil {

		return shim.Error(err.Error())

	}

	token := Token{} //新建token数据结构

	//将得到的值反序列化写入token数据结构

	json.Unmarshal(tokenAsBytes, &token)

	amount := token.balance(args[1])

	value := strconv.Itoa(amount)

	fmt.Printf("%s balance is %s \n", args[1], value)

	//jsonVal, _ := json.Marshal(string(value))

	return shim.Success([]byte(value))

}

//合约调用函数方法

func (s *SmartContract) Invoke(stub shim.ChaincodeStubInterface) sc.Response {

	//获取要调用的智能合约的函数和参数

	function, args := stub.GetFunctionAndParameters()

	//根据参数匹配合适的调用函数

	if function == "balanceToken" {

		return s.balanceToken(stub, args)

	} else if function == "initLedger" {

		return s.initLedger(stub, args)

	} else if function == "transferToken" {

		return s.transferToken(stub, args)

	}


	return shim.Error("Invalid Smart Contract function name.")

}

//合约执行开始方法，主要功能仅与单元测试模式有关。

func main() {

	//创建一个新的合约，合约开始执行

	err := shim.Start(new(SmartContract))

	if err != nil {

		fmt.Printf("Error creating new Smart Contract: %s", err)

	}

}
