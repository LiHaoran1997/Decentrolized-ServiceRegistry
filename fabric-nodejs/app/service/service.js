/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var httpRequest = require('request');
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var query = require('../query.js');
var invoke = require('../invoke-transaction.js');
var helper = require('../helper.js');
var logger = helper.getLogger('Service');

var request = require('./request.js');
var negoUtil = require('./negotiation-utils.js');
var listener = require('./task-listener.js');

//var length = args.length;
//if (length < 6 ) {
//	logger.error("Incorrect number of arguments. Expecting 6+");
//	throw new Error("Incorrect number of arguments. Expecting 6+");
//}

//var taskId = args[0];
//var requester = args[1];
//var provider = args[2];

//logger.debug(taskId);

var agreementMap = new Map();

var invokeRestAPI = async function(peer, channelName, chaincodeName, args, username, org_name) {
	//logger.error(args);

  var requester = args[0];
	var taskId = args[1];
	//logger.debug("taskId: " + taskId);
	var provider = args[2];
	var toleranceString = args[3];
	var url = args[4];
	var method = args[5];

	var agreement = agreementMap.get(taskId);

	if(!agreement){
		var fcn = "queryByObjectType";
    var ccArgs = [];
    ccArgs[0] = taskId;
    ccArgs[1] = "agreement";

    //logger.debug(args[0] + ", " + args[1]);
    var result = await query.queryChaincode(peer, channelName, chaincodeName, ccArgs, fcn, username, org_name);
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
    agreement = agreementJson[0];
		//logger.debug(agreement);
		agreementMap.set(taskId, agreement);
	}
	//logger.debug(agreement);

	var aRequester = agreement.requester;
	var aProvider = agreement.provider;
	var aUrl = agreement.url;
	var aBeginTime = agreement.beginTime;
	var aExpireTime = agreement.expireTime;
	var aResponseTime = agreement.responseTime;
	var aThroughput = agreement.throughput;

  if(requester != aRequester){
		logger.error("no valid requester " + requester);
		return "no valid requester " + requester;
	}else if(provider != aProvider){
		logger.error("no valid provider " + provider);
		return "no valid provider " + provider;
	}else if(url.indexOf(aUrl)==-1){
		logger.error("no valid url " + url + " Expected " + aUrl);
		return "no valid url " + url + " Expected " + aUrl;
	}else {
		var nowTimeISO = new Date();
		var nowTime = nowTimeISO.getTime();
		var beginTime = new Date(aBeginTime).getTime();
		var expireTime = new Date(aExpireTime).getTime();

    //logger.error(beginTime);
		//logger.error(nowTime);
		//logger.error(expireTime);
		if(nowTime < beginTime || nowTime > expireTime){
			logger.error("no valid time. Current time is " + nowTimeISO + ". Expected between " + aBeginTime + " and " + aExpireTime);
			return "no valid time. Current time is " + nowTimeISO + ". Expected between " + aBeginTime + " and " + aExpireTime;
		}
	}

  var success;
  var tolerance = parseFloat(toleranceString);
	//logger.error(tolerance);
  var startTime = new Date();
	var endTime;

  var options
	if(method == "get"){
		options = {
	    url: url,
		  timeout: aResponseTime*tolerance*1000,
			method: "GET",
			//json: true,
			//headers: {"content-type":"application/json"},
    }
	}else if(method == "post") {
		var postJSONString = args[6];
		//logger.debug(postJSONString);
    options = {
			url: url,
			timeout: aResponseTime*tolerance*1000,
			method: "POST",
			json: true,
			//headers: {"content-type":"application/json"},
			//body: {id:11,airlinename:"测试航空",abb:"测试", tel:"0101001", website:"http://www.testair.com.cn/",description:"测试"}
			body: postJSONString
		}
	}

	//logger.debug(options);

	//var resultJson;

  var message = await new Promise((resolve, reject) => {
    httpRequest(options, async function(error, response, body){
      endTime = new Date();
      var messageJson;
	    if(error){
			  logger.error("error: " + url);

			   //endTime = new Date();
		    success = "false";
		    var task = [];
	      task[0] = requester; //requesterName;
		    task[1] = taskId; //taskId;
		    task[2] = provider; //providerName;

		    var result = await recovery(task, peer, channelName, chaincodeName, username, org_name);
		    agreementJson = JSON.parse(result);
	      if(agreementJson.length <= 0){
          logger.error("no new agreement for the task " + taskId);
          return "no new agreement for the task: " + taskId;
	      }
	      agreement = agreementJson[0];
	      agreementMap.set(taskId, agreement);
		    //resolve(agreementJson);
			  messageJson = agreementJson;

	    } else {
		     //endTime = new Date();
				 if (response.statusCode == 200){
					 success = "true";
				 }else{
					 success = "false";
				 }

			   var resultJson = {
			  	 message: body,
				   startTime: startTime,
				   endTime: endTime,
			  	 aResponseTime: aResponseTime,
				   aThroughput: aThroughput
			   }
			   //resolve(resultJson);
				 messageJson = resultJson;
	    }

		  //将messageJson传出去
		  resolve(messageJson);
    });
  }).then(messageJson => {
	 //logger.debug(result);
	 return messageJson;
 })

 // if (response.statusCode == 200)

 //.catch(err => {
   //logger.debug(err);
//	 return err;
 //});

 //异步将访问记录写入链
 fcn = "saveServiceTX";
 args = [];
 args[0] = taskId;
 args[1] = requester;
 args[2] = provider;
 args[3] = url;
 args[4] = success;
 args[5] = startTime.toISOString();
 args[6] = endTime.toISOString();
 //logger.debug(args);
 invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, org_name);

 return message;
}


//在ChainCode里调用Rest API
var invokeRestAPIviaCC = async function(peer, channelName, chaincodeName, args, username, org_name) {
	try{
		//logger.debug("here");
		//peerNames = [peer];
   //var submitTime = new Date();
	 //logger.debug(submitTime.toISOString());
   //var arglen = args.length;
	 //args[arglen] = submitTime.toISOString();

		let result = await invokeChaincode(peer, channelName, chaincodeName, args, username, org_name);

		if (result && typeof result === 'string' && result.includes('Error:')) {
				logger.error(result);
				return result;
		}

		if (result.toString() && (result.includes('Failed to invoke service') ||
		                             result.includes('Failed to get response'))) {
			logger.error(result.toString());
			var task = [];
			task[0] = args[0]; //requesterName;
			task[1] = args[1]; //taskId;
			task[2] = args[2]; //providerName;

			result = await recovery(task, peer, channelName, chaincodeName, username, org_name);
			return result;
		}

		var resultJson = JSON.parse(result);
	  var message = resultJson.message;
	  var startTime = new Date(resultJson.startTime);
	  var endTime = new Date(resultJson.endTime);
		var reqResTime = resultJson.reqResTime;

		var actualTime = (endTime - startTime)/1000; //单位：秒
		var tolerance = parseFloat(args[3]);

		if (actualTime > reqResTime*tolerance) {
			logger.info("the actual response time %s can not satisfy the required response time %s!", actualTime, reqResTime);
			var task = [];
			task[0] = args[0]; //requesterName;
			task[1] = args[1]; //taskId;
			task[2] = args[2]; //providerName;

			result = await recovery(task, peer, channelName, chaincodeName, username, org_name);
			return result;
		} else {
			//logger.debug(resultJson);
			return resultJson;
		}

	} catch (err) {
    logger.error(err.toString());
    return err.toString();
  }

}


var invokeChaincode = async function(peerNames, channelName, chaincodeName, args, username, org_name) {
	logger.debug(util.format('\n============ invoke transaction on channel %s ============\n', channelName));
	var error_message = null;
	var tx_id_string = null;
	try {
		// first setup the client for this org
		var client = await helper.getClientForOrg(org_name, username);
		logger.debug('Successfully got the fabric client for the organization "%s"', org_name);
		var channel = client.getChannel(channelName);
		if(!channel) {
			let message = util.format('Channel %s was not defined in the connection profile', channelName);
			logger.error(message);
			throw new Error(message);
		}
		var tx_id = client.newTransactionID();
		// will need the transaction ID string for the event registration later
		tx_id_string = tx_id.getTransactionID();

		//logger.error(peerNames);

		//peerNames = ['peer1.fabric.gfe.com'];

		// send proposal to endorser
		var request = {
			targets: peerNames,
			//targets:[],
			chaincodeId: chaincodeName,
			fcn: "invokeRestAPI",
			//fcn: "saveServiceTX",
			args: args,
			chainId: channelName,
			txId: tx_id
		};

		let results = await channel.sendTransactionProposal(request);

		// the returned object has both the endorsement results
		// and the actual proposal, the proposal will be needed
		// later when we send a transaction to the orderer
		var proposalResponses = results[0];
		var proposal = results[1];

		//logger.debug(proposalResponses[0].details)

		// lets have a look at the responses to see if they are
		// all good, if good they will also include signatures
		// required to be committed
		var all_good = true;
		for (var i in proposalResponses) {
			//logger.error('test: ' + i);
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response &&
				proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.debug('invoke chaincode proposal was good');
			} else {
				logger.error('invoke chaincode proposal was bad');
			}
			all_good = all_good & one_good;
		}

		if (all_good) {
			//logger.debug(util.format(
			//	'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
			//	proposalResponses[0].response.status, proposalResponses[0].response.message,
			//	proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));

        //异步写block，这里不会等待写入block之后再返回
				commit(channel, tx_id_string, tx_id, proposalResponses, proposal);

				//var resultJson = JSON.parse(proposalResponses[0].response.payload);
				//logger.debug(resultJson.message);
				//logger.debug(resultJson.startTime);
				//logger.debug(resultJson.endTime);
				//var test = '[{"id":1,"airlineid":1,"type":"one-trip"},{"startTime":2018-06-15}]';
				//JSON.parse(test);

				return proposalResponses[0].response.payload;

		} else {
			//logger.debug(proposalResponses[0].details)
			if(proposalResponses[0].details) {
				error_message = util.format(proposalResponses[0].details);
			} else {
				error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
			}
			logger.debug(error_message);
		}
	} catch (error) {
		logger.error('Failed to invoke due to error: ' + error.stack ? error.stack : error);
		error_message = error.toString();
	}

	if (!error_message) {
		let message = util.format(
			'Successfully invoked the chaincode %s to the channel \'%s\' for transaction ID: %s',
			org_name, channelName, tx_id_string);
		logger.debug(message);

		//异步写block，这里不会等待写入block之后再返回
		//commit(channel, tx_id_string, tx_id, proposalResponses, proposal);

		//return tx_id_string;
		//logger.info("Response result is " + proposalResponses[0].response.payload.toString('utf8'));
		//return proposalResponses[0].response.payload.toString('utf8');
	} else {
		//let message = util.format('Failed to invoke chaincode. cause: %s',error_message);
		//logger.error(message);
		//throw new Error(message);

		logger.error(error_message);
		throw new Error(error_message);
	}
};

//异步写block
var commit = async function(channel, tx_id_string, tx_id, proposalResponses, proposal) {

	// wait for the channel-based event hub to tell us
	// that the commit was good or bad on each peer in our organizationproposal
	var promises = [];
	let event_hubs = channel.getChannelEventHubsForOrg();
	event_hubs.forEach((eh) => {
		logger.debug('invokeEventPromise - setting up event');
		let invokeEventPromise = new Promise((resolve, reject) => {
			let event_timeout = setTimeout(() => {
				let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
				logger.error(message);
				eh.disconnect();
			}, 1000000);
			eh.registerTxEvent(tx_id_string, (tx, code, block_num) => {
				logger.debug('The chaincode invoke chaincode transaction has been committed on peer %s',eh.getPeerAddr());
				logger.debug('Transaction %s has status of %s in blocl %s', tx, code, block_num);
				clearTimeout(event_timeout);

				if (code !== 'VALID') {
					let message = util.format('The invoke chaincode transaction was invalid, code:%s',code);
					logger.error(message);
					reject(new Error(message));
				} else {
					let message = 'The invoke chaincode transaction was valid.';
					logger.debug(message);
					resolve(message);
				}
			}, (err) => {
				clearTimeout(event_timeout);
				logger.error(err);
				reject(err);
			},
				// the default for 'unregister' is true for transaction listeners
				// so no real need to set here, however for 'disconnect'
				// the default is false as most event hubs are long running
				// in this use case we are using it only once
				{unregister: true, disconnect: true}
			);
			eh.connect();
		});
		promises.push(invokeEventPromise);
	});

	var orderer_request = {
		txId: tx_id,
		proposalResponses: proposalResponses,
		proposal: proposal
	};
	var sendPromise = channel.sendTransaction(orderer_request);
	// put the send to the orderer last so that the events get registered and
	// are ready for the orderering and committing
	promises.push(sendPromise);
	let results = await Promise.all(promises);
	logger.debug(util.format('------->>> R E S P O N S E : %j', results));
	let response = results.pop(); //  orderer results are last in the results
	if (response.status === 'SUCCESS') {
		logger.debug('Successfully sent transaction to the orderer.');
	} else {
		error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
		logger.debug(error_message);
	}

	// now see what each of the event hubs reported
	for(let i in results) {
		let event_hub_result = results[i];
		let event_hub = event_hubs[i];
		logger.debug('Event results for event hub :%s',event_hub.getPeerAddr());
		if(typeof event_hub_result === 'string') {
			logger.debug(event_hub_result);
		} else {
			if(!error_message) error_message = event_hub_result.toString();
			logger.debug(event_hub_result.toString());
		}
	}
}

var recovery = async function(task, peer, channelName, chaincodeName, username, org_name){
	try{
		var requesterName = task[0];
		var taskId = task[1];
		var providerName = task[2];

		var taskJson = request.taskJsonMap.get(taskId);
		if (!taskJson) {
			logger.error("no taskJson for taskId " + taskId);
			throw new Error("no taskJson for taskId " + taskId);
		}

		//logger.debug(taskJson);

    var taskSignString = JSON.parse(taskJson.signString);
		var taskName = taskSignString.taskName;

		logger.info(taskName);
		logger.info(providerName);

		//删除providerName的task-listener
		listener.remove(taskName, providerName);

		//重启新的一轮
		await negoUtil.newround(taskId, peer, channelName, chaincodeName, username, org_name);

		//var taskIds = [];
		//taskIds[0] = taskId;
		//var requestStrategy = request.strategyMap.get(requesterName);
		//if (!requestStrategy) {
		//	logger.error("no strategy profile for requester: " + requesterName);
		//	return "no strategy profile for requester: " + requesterName;
		//}
		var taskNames = [taskName];

		//寻找新的provider
		let result = await request.propose(taskNames, requesterName, peer, channelName, chaincodeName, username, org_name);
		return result;

	}  catch (err) {
    logger.error(err);
    throw err;
  }
}

exports.invokeRestAPI = invokeRestAPI;
exports.invokeRestAPIviaCC = invokeRestAPIviaCC;
