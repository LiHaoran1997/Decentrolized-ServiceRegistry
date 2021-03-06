

var path = require('path');
var helper = require('../helper.js');
var hfc = require('fabric-client');
var helper = require('../helper.js');
var logger = helper.getLogger('Request-Strategy');
var util = require('util');
var fs = require('fs');
var schedule = require("node-schedule");
var query = require('../query.js');
var invoke = require('../invoke-transaction.js');

var negoUtil = require('./negotiation-utils.js');
var listener = require('./task-listener.js');
var profile = require('./strategy.js');

const asn1 = require('asn1.js');
var crypto = require('crypto');
var util = require('util');

var taskMap = new Map();
var requestMap = new Map();
var taskJsonMap = new Map();
//var strategyMap = new Map();

var propose = async function(taskNames, requesterName, peer, channelName, chaincodeName, username, orgname) {
  try{

    logger.debug(profile.requestStrategyMap);
    var requestStrategyPath = profile.requestStrategyMap.get(requesterName);
    if (!requestStrategyPath) {
      logger.error("no strategy file for requester: " + requesterName);
      return "no strategy file for requester: " + requesterName;
    }
    //将strategy文件解析为JSON对象
    var requestJson = JSON.parse(fs.readFileSync(requestStrategyPath));

    var taskNum = taskNames.length;
    var agrementArrayString = "[";
    var errorString = "[";

    var taskArray = [];
    for(t=0;t<taskNum;t++){
      taskName = taskNames[t];

      taskArray[t] = strategyByTaskName(taskName, requestJson, peer, channelName, chaincodeName, username, orgname).then((agreementString)=>{
        agrementArrayString = agrementArrayString + agreementString + ", ";
      }, (err)=>{
        errorString = errorString + "{\"error\":\"" + err.toString() + "\"}, ";
        //logger.error(err.toString());
      });
    }
    await Promise.all(taskArray);

    var result;
    if(agrementArrayString != "[") { //没有出错
      result = agrementArrayString.substring(0,agrementArrayString.length-2);
      result = result + "]";
    } else {
      result = errorString.substring(0,errorString.length-2);
      result = result + "]";
    }
    return result;

  } catch (err) {
		logger.error(err);
		return err.toString();
	}

}

var strategyByTaskName = async function(taskName, requestJson, peer, channelName, chaincodeName, username, orgname) {
  try{
    var result;
    var roundIndex = 0;
    do{
      logger.info("==================== task: " + taskName + ", round: " + roundIndex + " =======================");
      result = await strategyByTaskNameRound(taskName, requestJson, roundIndex, peer, channelName, chaincodeName, username, orgname);
      //logger.debug("hellooooooo: " + result);
      var flag = false;
      if (result && typeof result === 'string' && result.includes('Error:')) {
        flag = true;
        roundIndex ++;
        //await negoUtil.newround(taskId, peer, channelName, chaincodeName, username, orgname);
      }
    } while (flag);
    return result;

  } catch (err) {
		logger.error(err);
		//return err.toString();
    throw err;
	}
}

// add task and write requests
var strategyByTaskNameRound = async function(taskName, requestJson, roundIndex, peer, channelName, chaincodeName, username, orgname){
  try{

    var task = [];
    task[0] = taskName;
    task[1] = requestJson["requester"];
    task[2] = requestJson[taskName]["description"];
    //logger.debug(task[2]);
    ///task[2] = r.taskName.description;

    if (roundIndex < 0) {
      logger.debug("roundIndex should be postive integer!");
      throw new Error("roundIndex should be postive integer!");
    }

    //taskName = task[0];
    var requesterName = task[1];
    var taskKey = taskName + "~" + requesterName;
    var taskId = taskMap.get(taskKey);

    if (!taskId) {
      let taskAsBytes = await negoUtil.writeTask(task, peer, channelName, chaincodeName, username, orgname);

      if (taskAsBytes && typeof taskAsBytes === 'string' && taskAsBytes.includes('Error:')) {
        logger.error(taskAsBytes);
        throw new Error(taskAsBytes);
      }

      var taskJSON = JSON.parse(taskAsBytes);
      var taskSignString = taskJSON.signString;
      var taskId = taskJSON.id;
      var taskSignJSON = JSON.parse(taskSignString);
      var taskName = taskSignJSON.taskName;
      var requesterName = taskSignJSON.requester;

      //logger.debug(taskName);
      taskKey = taskName + "~" + requesterName;
      taskMap.set(taskKey, taskId);
      taskJsonMap.set(taskId, taskJSON);
    }

    var requestObj = requestJson[taskName]["round"][roundIndex];
    if(!requestObj){
      logger.error("task " + taskName + ". No requests in round " + roundIndex);
      throw new Error("task " + taskName + ". No requests in round " + roundIndex);
    }

    var requestLen = Object.keys(requestObj).length;
    var requestArray = [];

    for(i = 0; i < requestLen; i ++) {
      var infoLen = Object.keys(requestJson[taskName]["round"][roundIndex][i]["info"]).length;
      var requestIndex = requestJson[taskName]["round"][roundIndex][i]["request"];

      var requestInfo = [];
      requestInfo[0] = requestIndex;
      requestInfo[1] = taskName;
      requestInfo[2] = requesterName;
      requestInfo[3] = taskId;

      for(j = 0; j < infoLen; j ++){
        requestInfo[j + 4] = requestJson[taskName]["round"][roundIndex][i]["info"][j];
      }

      requestArray[i] = writeRequest(roundIndex, requestInfo, peer, channelName, chaincodeName, username, orgname);

    }

    await Promise.all(requestArray);

    await negoUtil.sleep(1000);

    logger.debug("trigger task-listener!");
    event = listener.event;
    event.emit(taskName, requesterName, roundIndex);

    //logger.debug(taskMap);
    //logger.debug(requestMap);

    await negoUtil.sleep(requestJson["timeout"]);

    //logger.debug("request " + requestStrategyPath + " for task " + taskName + " have been loaded!");
    //return "request " + requestStrategyPath + " for task " + taskName + " have been loaded!";
    taskKey = taskName + "~" + requesterName;
    taskId = taskMap.get(taskKey);
    //logger.debug(taskId + ", " + taskName);

    let message = await negoUtil.check(taskId, peer, channelName, chaincodeName, username, orgname);

    logger.debug(message);

    if (message && typeof message === 'string' && message.includes('Error:')) {
      logger.debug(message);
      //throw new Error(message);
    } else {
      var agreementJson = JSON.parse(message);
      agreementJson["taskName"]=taskName;
      message = JSON.stringify(agreementJson);

      var expireTime = agreementJson.expireTime;
      var expireTimeDate = new Date(expireTime);
      logger.debug("Transfer Time: " + expireTimeDate);

      //定时执行最后的转账
      schedule.scheduleJob(taskId, expireTimeDate, async function(){
        logger.info("scheduled Transfer: " + expireTimeDate);
        var fcn = "confirmPay";
        var args = [taskId];
        var peerNames = [peer];
        var chaincodeName = "currency";
        await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, orgname);
      });
    }

    return message;

  } catch (err) {
		logger.error(err);
		//return err.toString();
    throw err;
	}
}

var writeRequest = async function(roundIndex, requestInfo, peer, channelName, chaincodeName, username, org_name){
	try{
    var cryptoContent = helper.getKey(username, org_name);
  	var key = cryptoContent.privateKeyPEM;  // privateKey
  	var cert = cryptoContent.signedCertPEM;

    logger.debug("write request");
		var fcn = "writeRequest";
    var args = [];
    reqeuster = requestInfo[2];//reqeusterName
    taskId = requestInfo[3];//taskId
    responseTime = requestInfo[4];//response time
    throughput = requestInfo[5];//throughput
    budget = requestInfo[6];//budget

    //做签名
   	const EcdsaDerSigTask = asn1.define('ECPrivateKey', function() {
  		return this.seq().obj(
  			this.key('r').int(),
      	this.key('s').int()
  		);
  	});

    var sign = crypto.createSign('SHA256');
    args[0] = taskId;
    args[1] = '{"requester":"' + reqeuster + '","responseTime":' + responseTime + ',"throughput":' + throughput + ',"budget":' + budget + '}';
    sign.update(args[1]);
  	var sig = sign.sign(key, 'buffer');
  	const rsSigTask = EcdsaDerSigTask.decode(sig, 'der');
    args[2] = rsSigTask.r.toString();
    args[3] = rsSigTask.s.toString();
    args[4] = cert;

		//let requestJson =
    //let requestAsBytes = await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);
    //logger.debug("test: " + args);
    //let requestAsBytes = await negoUtil.writeRequest(args, peer, channelName, chaincodeName, username, org_name);
		var fcn = "writeRequest";
    let requestAsBytes = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);

    if (requestAsBytes && typeof requestAsBytes === 'string' && requestAsBytes.includes('Error:')) {
      logger.error(requestAsBytes);
      throw new Error(requestAsBytes);
    }

    var requestJson = JSON.parse(requestAsBytes);
    var requestId = requestJson.reqId;
    var requestSignString = requestJson.signString;
    var requestSignJson = JSON.parse(requestSignString);
    var requesterName = requestSignJson.requester;

    var requestIndex = requestInfo[0];
    var taskName = requestInfo[1];
    var key = taskName + "~" + requesterName + "~" + requestIndex + "~" + "round" + roundIndex;

    requestMap.set(key, requestId);

		logger.info("successfully add a request " + requestJson + " on the task " + requestInfo[3]);
		return requestJson;
	} catch (err) {
		logger.error(err);
		//return err.toString();
    throw err;
	}
};



module.exports.taskMap = taskMap;
module.exports.requestMap = requestMap;
module.exports.taskJsonMap = taskJsonMap;

exports.propose = propose;
