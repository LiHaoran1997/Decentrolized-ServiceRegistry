/**
 * 2018 ruc SCAS 0.5
 *
 */

var query = require('../query.js');
var invoke = require('../invoke-transaction.js');
var helper = require('../helper.js');
var schedule = require("node-schedule");

var request = require("./request.js");
var listener = require("./task-listener.js");
const asn1 = require('asn1.js');
var crypto = require('crypto');
var util = require('util');

var logger = helper.getLogger('Negotiation-Util');

var writeTask = async function(task, peer, channelName, chaincodeName, username, org_name) {
  try{
    var cryptoContent = helper.getKey(username, org_name);
  	var key = cryptoContent.privateKeyPEM;  // privateKey
  	var cert = cryptoContent.signedCertPEM;

	  logger.debug("write task");
		var fcn = "addTask";
		var args = [];

    //做签名
    const EcdsaDerSigTask = asn1.define('ECPrivateKey', function() {
      return this.seq().obj(
        this.key('r').int(),
        this.key('s').int()
      );
    });

    var sign = crypto.createSign('SHA256');
    args[0] = '{"taskName":"' + task[0] + '","requester":"' + task[1] + '","description":"' + task[2] + '"}';
    sign.update(args[0]);
    var sig = sign.sign(key, 'buffer');
    const rsSigTask = EcdsaDerSigTask.decode(sig, 'der');
    args[1] = rsSigTask.r.toString();
    args[2] = rsSigTask.s.toString();
    args[3] = cert;

    let taskAsBytes = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);

		logger.info("successfully add a task " + taskAsBytes);
		return taskAsBytes;
	} catch (err) {
		logger.error(err);
		return err.toString();
	}
};

var writeRequest = async function(request, peer, channelName, chaincodeName, username, org_name){
	try{

    logger.debug("write request");
		var fcn = "writeRequest";
    var args = [];

		let requestAsBytes = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, request, username, org_name);

		logger.info("successfully add a request " + requestAsBytes + " on the task " + request[1]);
		return requestAsBytes;
	} catch (err) {
		logger.error(err);
		return err.toString();
	}
};

var writeResponse = async function(response, peer, channelName, chaincodeName, username, org_name){
	try{
    var cryptoContent = helper.getKey(username, org_name);
  	var key = cryptoContent.privateKeyPEM;  // privateKey
  	var cert = cryptoContent.signedCertPEM;

		var fcn = "writeResponse";
    var args = [];
		//var peerNames = [peer];

    //做签名
   	const EcdsaDerSigTask = asn1.define('ECPrivateKey', function() {
  		return this.seq().obj(
  			this.key('r').int(),
      	this.key('s').int()
  		);
  	});

    var sign = crypto.createSign('SHA256');
    args[0] = response[3]; // taskId
    args[1] = '{"reqId":"' + response[0] + '","requester":"' + response[1] + '","provider":"'
                           + response[2] + '","url":"' + response[4] + '","expireTime":"'
                           + response[5] + '","responseTime":' + response[6] + ',"throughput":'
                           + response[7] + ',"price":' + response[8] + '}';
  	sign.update(args[1]);
  	var sig = sign.sign(key, 'buffer');
  	const rsSigTask = EcdsaDerSigTask.decode(sig, 'der');
    args[2] = rsSigTask.r.toString();
    args[3] = rsSigTask.s.toString();
    args[4] = cert;

		let responseAsBytes = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);
		logger.info("successfully add a response " + responseAsBytes + " to the request " + response[0]);
		return responseAsBytes;
	} catch (err) {
		logger.error(err);
		return err.toString();
	}
};

var check = async function(taskId, peer, channelName, chaincodeName, username, org_name){
	try{

		var fcn = "check";
		var args = [];
		args[0] = taskId;
		//peerNames = [peer];

    let agreementAsBytes = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);

    logger.info("sucessfully create an agreement " + agreementAsBytes);
    return agreementAsBytes;
	} catch (err) {
		logger.error(err);
		return err.toString();
	}
};

var getagreement = async function(taskname, peer, channelName, chaincodeName, username, org_name){
  try{

    var fcn = "queryTaskByNameAndRequester";
    var args = [];
    args[0] = username;
    args[1] = taskname;

    let taskAsBytes = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org_name);

    if (taskAsBytes && typeof taskAsBytes === 'string' &&
            (taskAsBytes.includes('Error:')||taskAsBytes.includes('Error'))){
      logger.error(taskAsBytes);
      return taskAsBytes;
    }

    //logger.debug(taskAsBytes);
    if (!taskAsBytes) {
      return taskAsBytes;
    }

    var taskJson = JSON.parse(taskAsBytes);
    if(taskJson.length <= 0){
      logger.error("no task for taskname " + taskname + " and requester " + username);
      return "no task for taskname " + taskname + " and requester " + username;
    }

    var taskId = taskJson[0].id;

    fcn = "queryByObjectType";
    var args = [];
    args[0] = taskId;
    args[1] = "agreement";

    var agreementAsBytes = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org_name);
    return agreementAsBytes;

  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}

var newround = async function(taskId, peer, channelName, chaincodeName, username, org_name){
  try{
    var peerNames = [peer];

    var fcn = "changeStateToInstantiation";
    var args = [];
    args[0] = taskId;
    await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);
    logger.info("sucessfully change state to instantiation for task " + taskId);

    fcn = "drop";
    args = [];
    args[0] = taskId;
    await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);
    logger.info("sucessfully delete requests & responses for task " + taskId);
    //return "successfully start a new round!\n";
    //return taskId + "\n";
    var result = {
      success: true,
      message: "sucessfully delete requests & responses for task " + taskId
    }
    return result;
  } catch (err) {
		logger.error(err);
    return err.toString();
	}
};

var scheduledTransfer = async function(taskId, peer, channelName, chaincodeName, username, org_name){
  try{
    var fcn = "queryByObjectType";
    var args = [];
    args[0] = taskId;
    args[1] = "agreement";

    //logger.debug(args[0] + ", " + args[1]);
    var result = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org_name);
    //logger.debug(agreementAsBytes);
    if (result && typeof result === 'string' &&
            (result.includes('Error:')||result.includes('Error'))){
      logger.error(result);
      return result;
    }

    var agreementJson = JSON.parse(result);
    if(agreementJson.length <= 0){
      logger.error("no agreement for the task " + taskId);
      return "no agreement for the task: " + taskId;
    }
    var agreement = agreementJson[0];
    var expireTime = agreement.expireTime;
    var expireTimeDate = new Date(expireTime);
    //expireTimeDate = new Date("2018-04-14T16:25:00+08:00");
    logger.debug(expireTimeDate);
    schedule.scheduleJob(taskId, expireTimeDate, async function(){
      logger.debug("scheduled Transfer!");
      //requester = agreement.requester;
      //provider = agreement.provider;
      //finalPrice = agreement.finalPrice;

      var fcn = "confirmPay";
      var args = [taskId];
      var peerNames = [peer];
      await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);
      //await query.queryChaincode(peer, channelName, chaincodeName, "[]", "queryTask", username, org_name);
    });
    //schedule.cancelNext(taskId);
    //expireTimeDate = new Date("2018-04-12T15:31+08:00");
    //schedule.rescheduleJob(taskId, expireTimeDate);
    //var all_jobs = schedule.scheduledJobs;
    //logger.debug(all_jobs[taskId]);

  } catch (err) {
		logger.error(err);
		return err.toString();
	}

  return "Starig Scheduled Transfer!\n"
}

var deleteTask = async function(taskName, requesterName, peer, channelName, chaincodeName, username, org_name) {
  try{
    //logger.debug(request.taskMap);
    var taskKey = taskName + "~" + requesterName;
    var taskId = request.taskMap.get(taskKey);
    if (!taskId) {
      logger.error("no task " + taskName + " of requester " + requesterName + " in taskMap!");
      throw new Error("no task " + taskName + " of requester " + requesterName + " in taskMap!");
    }

    var fcn = "deleteTask";
    var args = [taskId];
    var peerNames = [peer];

    await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);

    request.taskMap.delete(taskKey);
    request.taskJsonMap.delete(taskId);
    request.requestMap.clear();

    var message = "sucessfully delete task: " + taskName + " of requester: " + requesterName;
    logger.info(message);

    var result = {
      success: true,
      message: message
    }
    return result;
  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}

var deleteServiceTX = async function(peer, channelName, chaincodeName, username, org_name) {
  try{
    var fcn = "deleteServiceTX";
    var peerNames = [peer];
    var args = [];

    await invoke.invokeChaincode(peerNames, channelName, chaincodeName, fcn, args, username, org_name);


    var message = "sucessfully delete serviceTXs";
    logger.info(message);

    var result = {
      success: true,
      message: message
    }
    return result;
  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}

var joinChaincode = async function(description, peer, channelName, chaincodeName, username, org_name) {
	try{
		var fcn = "regist";
		var args = [];
		args[0] = username;
		args[1] = org_name;
		args[2] = description;

		let result = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);
		logger.debug(result);
		return result;
	} catch (err) {
		logger.error(err);
		return err.toString();
	}
}

var sleep = function(timeout = 0) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  })
}

var getTaskMap = function(){
  var taskJsons = [];
  var i = 0;
  for (var taskKey of request.taskMap.keys()) {
    taskId = request.taskMap.get(taskKey);
    json = {
      key: taskKey,
      value: taskId
    }
    taskJsons[i++] = json;
  }
  return taskJsons;
}

var getRequestMap = function(){
  var requestJsons = [];
  var i = 0;
  for (var requestKey of request.requestMap.keys()) {
    reqId = request.requestMap.get(requestKey);
    json = {
      key: requestKey,
      value: reqId
    }
    requestJsons[i++] = json;
  }
  return requestJsons;
}

var getTaskJsonMap = function(){
  var taskJsons = [];
  var i = 0;
  for (var taskKey of request.taskJsonMap.keys()) {
    taskJson = request.taskJsonMap.get(taskKey);
    json = {
      key: taskKey,
      value: taskJson
    }
    taskJsons[i++] = json;
  }
  return taskJsons;
}

var getListenerMap = function(){
  var listenerJsons = [];
  var i = 0;
  for (var key of listener.listenerMap.keys()) {
    index = listener.listenerMap.get(key);
    json = {
      key: key,
      value: index
    }
    listenerJsons[i++] = json;
  }
  return listenerJsons;
}

exports.writeTask = writeTask;
exports.writeRequest = writeRequest;
exports.writeResponse = writeResponse;
exports.check = check;
exports.getagreement = getagreement;
exports.newround = newround;
exports.scheduledTransfer = scheduledTransfer;
exports.deleteTask = deleteTask;
exports.deleteServiceTX = deleteServiceTX;
exports.joinChaincode = joinChaincode;
exports.sleep = sleep;
exports.getTaskMap = getTaskMap;
exports.getRequestMap = getRequestMap;
exports.getTaskJsonMap = getTaskJsonMap;
exports.getListenerMap = getListenerMap;
