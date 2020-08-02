package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "github.com/hyperledger/fabric/core/chaincode/shim"
    pb "github.com/hyperledger/fabric/protos/peer"
    "regexp"
    "strconv"
)

//数据格式
type Config struct {
    Info []string
    Action  []string
    CurrentStatus []string
    NewStatus []string
    NashPath [][]string
    Id string
    Name string
    NashInfo [][]string
}
type SimpleChaincode struct {
}



//将utf-8八进制转为可显示的汉字编码
func convertOctonaryUtf8(in string) string {
    s := []byte(in)
    reg := regexp.MustCompile(`\\[0-7]{3}`)

    out := reg.ReplaceAllFunc(s,
        func(b []byte) []byte {
            i, _ := strconv.ParseInt(string(b[1:]), 8, 0)
            return []byte{byte(i)}
        })
    return string(out)
}
//匹配纳什路径的动作名称

// =========================================
//       Init - initializes chaincode
// =========================================
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
    return shim.Success(nil)
}

// ======================================================
//       Invoke - Our entry point for Invocations
// ======================================================
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
    function, args := stub.GetFunctionAndParameters()
    fmt.Println("invoke is running " + function)
    if function == "QueryByKey" {
        return t.QueryByKey(stub, args)
    } else if function == "HistoryQuery" {
        return t.HistoryQuery(stub, args)
    } else if function == "RangeQuery" {
        return t.RangeQuery(stub, args)
    } else if function == "RichQuery" {
        return t.RichQuery(stub, args)
    } else if function == "Delete" {
        return t.Delete(stub, args)
    } else if function == "Put" {
        return t.Put(stub, args)
    } else {
        return shim.Error("Error func name!")
    }

}

func (t *SimpleChaincode)QueryByKey(stub shim.ChaincodeStubInterface, args []string) pb.Response {
    if len(args) !=1 {
        return shim.Error("Incorrect arguments. Expecting a key and a value")
    }
    key := args[0]
    bstatus, err := stub.GetState(key)
    if err != nil||bstatus==nil {
        return shim.Error("Query form status fail, form number:" + key)
    }

    return shim.Success([]byte(bstatus))
}

func (t *SimpleChaincode)RichQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response {
    if len(args) !=1 {
        return shim.Error("Incorrect arguments. Expecting a key and a value")
    }
    name := args[0]
    queryString := fmt.Sprintf(`{"selector":{"key":"%s"}}`, name)
    resultsIterator, err := stub.GetQueryResult(queryString)
    if err != nil {
        return shim.Error("Rich query failed")
    }
    defer resultsIterator.Close() //释放迭代器
    var buffer bytes.Buffer
    bArrayMemberAlreadyWritten := false
    buffer.WriteString(`{"result":[`)

    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next() //获取迭代器中的每一个值
        if err != nil {
            return shim.Error("Fail")
        }
        if bArrayMemberAlreadyWritten == true {
            buffer.WriteString(",")
        }

        buffer.WriteString(string(queryResponse.Value)) //将查询结果放入Buffer中
        bArrayMemberAlreadyWritten = true
    }
    buffer.WriteString(`]}`)
    fmt.Print("Query result: %s", buffer.String())
    return shim.Success([]byte(buffer.String()))

}
func (t *SimpleChaincode) HistoryQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response{
    if len(args) !=1 {
        return shim.Error("Incorrect arguments. Expecting a key and a value")
    }
    key:=args[0]
    it,err:= stub.GetHistoryForKey(key)
    if err!=nil{
        return shim.Error(err.Error())
    }
    var result,_= getHistoryListResult(it)
    return shim.Success(result)
}

func getHistoryListResult(resultsIterator shim.HistoryQueryIteratorInterface) ([]byte,error){
    defer resultsIterator.Close()
    // buffer is a JSON array containing QueryRecords
    var buffer bytes.Buffer
    buffer.WriteString("[")
    bArrayMemberAlreadyWritten := false
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        // Add a comma before array members, suppress it for the first array member
        if bArrayMemberAlreadyWritten == true {
            buffer.WriteString(",")
        }
        item,_:= json.Marshal( queryResponse)
        buffer.Write(item)
        bArrayMemberAlreadyWritten = true
    }
    buffer.WriteString("]")
    fmt.Printf("queryResult:\n%s\n", buffer.String())
    return buffer.Bytes(), nil
}
func (t *SimpleChaincode) RangeQuery(stub shim.ChaincodeStubInterface, args []string) pb.Response{
    resultsIterator,err:= stub.GetStateByRange(args[0],args[1])
    if err!=nil{
        return shim.Error("Query by Range failed")
    }
    res,err:=getListResult(resultsIterator)
    if err!=nil{
        return shim.Error("getListResult failed")
    }
    return shim.Success(res)
}

func getListResult(resultsIterator shim.StateQueryIteratorInterface) ([]byte,error){
    defer resultsIterator.Close()
    // buffer is a JSON array containing QueryRecords
    var buffer bytes.Buffer
    buffer.WriteString("[")
    bArrayMemberAlreadyWritten := false
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        // Add a comma before array members, suppress it for the first array member
        if bArrayMemberAlreadyWritten == true {
            buffer.WriteString(",")
        }
        buffer.WriteString("{\"Key\":")
        buffer.WriteString("\"")
        buffer.WriteString(queryResponse.Key)
        buffer.WriteString("\"")
        buffer.WriteString(", \"Record\":")
        // Record is a JSON object, so we write as-is
        buffer.WriteString(string(queryResponse.Value))
        buffer.WriteString("}")
        bArrayMemberAlreadyWritten = true
    }
    buffer.WriteString("]")
    fmt.Printf("queryResult:\n%s\n", buffer.String())
    return buffer.Bytes(), nil
}

func (t *SimpleChaincode)Put(stub shim.ChaincodeStubInterface, args []string) pb.Response{
    if len(args) != 2 {
        return shim.Error("Incorrect arguments. Expecting a key and a value")
    }
    key:=args[0]
    err := stub.PutState(key, []byte(args[1]))
    if err != nil {
        return shim.Error("Failed to set asset: %s"+ args[0])
    }
    return shim.Success([]byte("put "+key+" success"))
}

func (t *SimpleChaincode)Delete(stub shim.ChaincodeStubInterface, args []string) pb.Response{
    key:=args[0]
    err:= stub.DelState(key)
    if err != nil {
    return shim.Error("Failed to delete Student from DB, key is: "+key)
    }
    return shim.Success([]byte("Delete Success,Key is: "+key))
}
//     Main
// ============
func main() {
    err := shim.Start(new(SimpleChaincode))
    if err != nil {
        fmt.Printf("Error starting Contract chaincode: %s", err)
    }
}




