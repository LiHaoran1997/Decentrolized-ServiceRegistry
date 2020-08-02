
var path = require('path');
var helper = require('../helper.js');
var hfc = require('fabric-client');
var helper = require('../helper.js');
var logger = helper.getLogger('Request-Strategy');
var util = require('util');
var fs = require('fs');
var query = require('../query.js');
var invoke = require('../invoke-transaction.js');

var negoUtil = require('./negotiation-utils.js');
var listener = require('./task-listener.js');
var profile = require('./strategy.js');

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
      //logger.debug(taskName);
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
      flag = false;
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


    task = [];
    task[0] = taskName;
    task[1] = requestJson["requester"];
    task[2] = requestJson[taskName]["description"];
    //logger.debug(task[2]);
    ///task[2] = r.taskName.description;

    //logger.debug(peer);

    if (roundIndex < 0) {
      logger.debug("roundIndex should be postive integer!");
      throw new Error("roundIndex should be postive integer!");
    }

    //taskName = task[0];
    requesterName = task[1];
    taskKey = taskName + "~" + requesterName;
    taskId = taskMap.get(taskKey);
    if (!taskId) {
      let taskAsBytes = await negoUtil.writeTask(task, peer, channelName, chaincodeName, username, orgname);

      if (taskAsBytes && typeof taskAsBytes === 'string' && taskAsBytes.includes('Error:')) {
        logger.error(taskAsBytes);
        throw new Error(taskAsBytes);
      }

      taskJSON = JSON.parse(taskAsBytes);
      taskName = taskJSON.taskName;
      taskId = taskJSON.id;
      //requesterName = taskJSON.requester;

      //logger.debug(taskName);
      taskKey = taskName + "~" + requesterName;
      taskMap.set(taskKey, taskId);
      taskJsonMap.set(taskId, taskJSON);
    }

    requestObj = requestJson[taskName]["round"][roundIndex];
    if(!requestObj){
      logger.error("task " + taskName + ". No requests in round " + roundIndex);
      throw new Error("task " + taskName + ". No requests in round " + roundIndex);
    }

    requestLen = Object.keys(requestObj).length;
    requestArray = [];

    for(i = 0; i < requestLen; i ++) {
      infoLen = Object.keys(requestJson[taskName]["round"][roundIndex][i]["info"]).length;
      requestIndex = requestJson[taskName]["round"][roundIndex][i]["request"];

      requestInfo = [];
      requestInfo[0] = requestIndex;
      requestInfo[1] = taskName;
      requestInfo[2] = requesterName;
      requestInfo[3] = taskId;

      for(j = 0; j < infoLen; j ++){
        requestInfo[j + 4] = requestJson[taskName]["round"][roundIndex][i]["info"][j];
      }

      requestArray[i] = writeRequest(requestInfo, peer, channelName, chaincodeName, username, orgname).then((result) =>{
        //logger.debug(result);
        if (result && typeof result === 'string' && result.includes('Error:')) {
          logger.error(result);
          throw new Error(result);
          //return result;
        }

        requestJSON = JSON.parse(result);
        requestId = requestJSON.reqId;
        requestIndex = requestJSON.index;
        taskName = requestJSON.taskName;
        requesterName = requestJSON.requester;

        key = taskName + "~" + requesterName + "~" + requestIndex + "~" + "round" + roundIndex;

        requestMap.set(key, requestId);
        return key;
      }, (err) => {
        //return err.toString();
        throw err;
      });
    }

    await Promise.all(requestArray);

    logger.debug("trigger task-listener!");
    event = listener.event;
    event.emit(taskName, requesterName, roundIndex, peer, channelName, chaincodeName, username, orgname);

    //logger.debug(taskMap);
    //logger.debug(requestMap);

    await negoUtil.sleep(requestJson["timeout"]);

    //logger.debug("request " + requestStrategyPath + " for task " + taskName + " have been loaded!");
    //return "request " + requestStrategyPath + " for task " + taskName + " have been loaded!";
    taskKey = taskName + "~" + requesterName;
    taskId = taskMap.get(taskKey);
    //logger.debug(taskId + ", " + taskName);

    let message = await negoUtil.check(taskId, peer, channelName, chaincodeName, username, orgname);

    /*if (message && typeof message === 'string' && message.includes('Error:')) {
      logger.debug(message);
      //throw new Error(message);
    } else {
      agreementJson = JSON.parse(message);
      agreementJson["taskName"]=taskName;
      message = JSON.stringify(agreementJson);
    }*/

    return message;
    //return "hello!";

  } catch (err) {
		logger.error(err);
		//return err.toString();
    throw err;
	}
}

var writeRequest = async function(requestInfo, peer, channelName, chaincodeName, username, org_name){
	try{
	  logger.debug("generate unique requestId");
		fcn = "generateUniqueId";
		args = [];
		let requestId = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org_name);

    logger.debug("write request");
		fcn = "writeRequest";
    args = [];
    args[0] = requestId;
    args[1] = requestInfo[2];//reqeusterName
    args[2] = requestInfo[3];//taskId
    args[3] = requestInfo[4];//response time
    args[4] = requestInfo[5];//throughput
    args[5] = requestInfo[6];//budget
		peerNames = [peer];
		//let requestJson =
    await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);

    requestJson = '{"reqId":"' + requestId + '","requester":"' + requestInfo[2] + '","taskId":"'
                               + requestInfo[3] + '","responseTime":"' + requestInfo[4] + '","thouthput":"'
                               + requestInfo[5] + '","budget":"' + requestInfo[6] + '","index":"'
                               + requestInfo[0] + '","taskName":"' + requestInfo[1] + '"}';
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
