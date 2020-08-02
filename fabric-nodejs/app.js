/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('SampleWebApp');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
//var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');

require('./config.js');
var hfc = require('fabric-client');

var helper = require('./app/helper.js');
var createChannel = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var invoke = require('./app/invoke-transaction.js');
var query = require('./app/query.js');

var service = require('./app/service/service.js');
var negoUtil = require('./app/service/negotiation-utils.js');
var request = require('./app/service/request.js');
var response = require('./app/service/response.js');
var taskListener = require('./app/service/task-listener.js');
var strategy = require('./app/service/strategy.js');
var schedule = require("node-schedule");

var host = process.env.HOST || hfc.getConfigSetting('host');
var port = process.env.PORT || hfc.getConfigSetting('port');


///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
	extended: false
}));
// set secret variable
app.set('secret', 'thisismysecret');
app.use(expressJWT({
	secret: 'thisismysecret'
}).unless({
	path: ['/admins','/users','/newtoken','/admin_newtoken']
}));
app.use(bearerToken());

//var req, res, next
app.use(function(req, res, next) {
	logger.debug(' ------>>>>>> new request for %s',req.originalUrl);

	res.header("Access-Control-Allow-Origin", "*");

	if (req.originalUrl.indexOf('/admins') >= 0) {
		return next();
	}

	if (req.originalUrl.indexOf('/users') >= 0) {
		return next();
	}

	if (req.originalUrl.indexOf('/admin_newtoken') >= 0) {
		var token = req.token;
		var decoded = jwt.decode(token, app.get('secret'));
		req.username = decoded.username;
		req.orgname = decoded.orgname;
		req.role = decoded.role;
		//logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s, role - %s', decoded.username, decoded.orgname, decoded.role));

		return next();
	}

	if (req.originalUrl.indexOf('/newtoken') >= 0) {
    var token = req.token;
		var decoded = jwt.decode(token, app.get('secret'));
		req.username = decoded.username;
		req.orgname = decoded.orgname;
		req.channelname = decoded.channelname;
		req.peername = decoded.peername;
		req.role = decoded.role;
		//logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s, role - %s', decoded.username, decoded.orgname, decoded.role));

		return next();
	}

	var token = req.token;
	//logger.info(req);
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token. Make sure to include the ' +
					'token returned from /users call in the authorization header ' +
					' as a Bearer token'
			});
			return;
		} else {
			// add the decoded user name and org name to the request object
			// for the downstream code to use

			//var info = {
			//	username: decoded.username,
			//	orgname: decoded.orgname,
			//	channelname: decoded.channelname,
			//	peername: decoded.peername,
			//	role: decoded.role
			//}

			req.username = decoded.username;
			req.orgname = decoded.orgname;
			req.channelname = decoded.channelname;
			req.peername = decoded.peername;
			req.role = decoded.role;
			//logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s, role - %s', decoded.username, decoded.orgname, decoded.role));
			return next();
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  http://%s:%s  ******************',host,port);

initialize();
server.timeout = 240000;

async function initialize(){
	/*var channelName = hfc.getConfigSetting('channelName');
	var admins = hfc.getConfigSetting('admins');
	var username = admins[0].username;
	var orgname = admins[0].orgname;
	var peer = (hfc.getConfigSetting(orgname))[0].peer;
  var chaincodeName = hfc.getConfigSetting('chaincodeName');

	var client = await helper.getClientForOrg(orgname);
	var admin = await client.getUserContext(username, true);*/

	var channelname = hfc.getConfigSetting('channels')[0]['name'];

	var admins = hfc.getConfigSetting('admins');
	var username = admins[0]['username'];
	var orgname = admins[0]['orgname'];

	var channel =  hfc.getConfigSetting(channelname);
	var peer = channel['orgs'][orgname][0]['peer'];

	//logger.error(orgname);

	var client = await helper.getClientForOrg(orgname);
	var admin = await client.getUserContext(username, true);

	var channelName = channel['name'];
	var chaincodeName = hfc.getConfigSetting('chaincodeName');
	//logger.debug("test: " + Object.keys(channel['orgs']));

	if (admin) {
		//查询blockchain里所有的task
		var fcn = "queryTask"
		var args = [];

		let tasksAsBytes = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, orgname);

		if (tasksAsBytes && typeof tasksAsBytes === 'string' && tasksAsBytes.includes('Error:')) {
		  logger.info("app started!");
			//return tasksAsBytes;
		} else {
			var taskJsons = JSON.parse(tasksAsBytes);
			var taskNum = taskJsons.length;
			//logger.debug(taskNum);
			for (var t=0;t<taskNum;t++) {
				var taskJson = taskJsons[t];
				var taskId = taskJson.id;
				var taskName = taskJson.taskName;
				var requesterName = taskJson.requester;

				var taskKey = taskName + "~" + requesterName;
				var taskJsonKey = taskId;

				request.taskMap.set(taskKey, taskId);
				request.taskJsonMap.set(taskId, taskJson);
			}

			logger.info("app restarted!");
		}
	} else {
		logger.info("app started!");
	}

}

function getErrorMessage(field) {
	//var response = {
	//	success: false,
	//	message: field + ' field is missing or Invalid in the request'
	//};
	//return response;
	return "Error: " + field + " field is missing or Invalid in the request";
}

function getErrorRoleMessage(role, action) {
	//var response = {
	//	success: false,
	//	message: role + ' cannot take this action!'
	//};
	//return response;
	return "Error: " + role + " cannot take this action " + action;
}


///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
// enroll admin user
app.post('/admins', async function(req, res) {
	var username = req.body.username;
	var orgname = req.body.orgname;
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgname);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgname) {
		res.json(getErrorMessage('\'orgname\''));
		return;
	}
	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: username,
		orgname: orgname,
		role: 'administrator'
	}, app.get('secret'));
	let response = await helper.getRegisteredUser(username, orgname, true);
	logger.debug('-- returned from registering the administrator %s for organization %s',username,orgname);
	if (response && typeof response !== 'string') {
		logger.debug('Successfully registered the administrator %s for organization %s',username,orgname);
		response.token = token;
		res.json(response);
	} else {
		logger.debug('Failed to register the administrator %s for organization %s with::%s',username,orgname,response);
		res.json({success: false, message: response});
	}
});

// return new token
app.post('/admin_newtoken', async function(req, res) {
	var username = req.username;
	var orgname = req.orgname;
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgname);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgname) {
		res.json(getErrorMessage('\'orgname\''));
		return;
	}

	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: username,
		orgname: orgname,
		role: 'administrator'
	}, app.get('secret'));
	let response = await helper.getRegisteredUser(username, orgname, true);

	if (response && typeof response !== 'string') {
		if (response.load == false) {
			var result = "The user " + username + " for organization " + orgname + " is not vaild user";
			logger.error(result);
			res.json({success: false, message: result});
		} else {
			logger.debug('Successfully get new token for the username %s for organization %s',username,orgname);
			response.token = token;
			res.json(response);
		}
	} else {
		logger.debug('Failed to register the username %s for organization %s with::%s',username,orgname,response);
		res.json({success: false, message: response});
	}
});

// Create Channel
app.post('/channels', async function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug('End point : /channels');
	var channelName = req.body.channelName;
	var channelConfigPath = req.body.channelConfigPath;
	logger.debug('Channel name : ' + channelName);
	logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!channelConfigPath) {
		res.json(getErrorMessage('\'channelConfigPath\''));
		return;
	}

	let message = await createChannel.createChannel(channelName, channelConfigPath, req.username, req.orgname);
	res.send(message);
});

// Join Channel
app.post('/channels/:channelName/peers', async function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	logger.debug('channelName : ' + channelName);
	logger.debug('peers : ' + peers);
	logger.debug('username :' + req.username);
	logger.debug('orgname:' + req.orgname);

	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}

	let message =  await join.joinChannel(channelName, peers, req.username, req.orgname);
	res.send(message);
});

// Install chaincode on target peers
app.post('/chaincodes', async function(req, res) {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodePath = req.body.chaincodePath;
	var chaincodeVersion = req.body.chaincodeVersion;
	var chaincodeType = req.body.chaincodeType;
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodePath  : ' + chaincodePath);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodePath) {
		res.json(getErrorMessage('\'chaincodePath\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	let message = await install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, chaincodeType, req.username, req.orgname)
	res.send(message);
});

// Instantiate chaincode on target peers
app.post('/channels/:channelName/chaincodes', async function(req, res) {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var chaincodeType = req.body.chaincodeType;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('peers  : ' + peers);
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodeVersion, chaincodeType, fcn, args, req.username, req.orgname);
	res.send(message);
});

// Invoke transaction on chaincode on target peers
app.post('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== INVOKE ON CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.params.chaincodeName;
	var channelName = req.params.channelName;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	res.send(message);
});

// Query on chaincode on target peers
app.get('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');
	var channelName = req.params.channelName;
	var chaincodeName = req.params.chaincodeName;
	let args = req.query.args;
	let fcn = req.query.fcn;
	let peer = req.query.peer;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	args = args.replace(/'/g, '"');
	args = JSON.parse(args);
	logger.debug(args);

	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	res.send(message);
});

//  Query Get Block by BlockNumber
app.get('/channels/:channelName/blocks/:blockId', async function(req, res) {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	let blockId = req.params.blockId;
	let peer = req.query.peer;
	logger.debug('channelName : ' + req.params.channelName);
	logger.debug('BlockID : ' + blockId);
	logger.debug('Peer : ' + peer);
	if (!blockId) {
		res.json(getErrorMessage('\'blockId\''));
		return;
	}

	let message = await query.getBlockByNumber(peer, req.params.channelName, blockId, req.username, req.orgname);
	res.send(message);
});

// Query Get Transaction by Transaction ID
app.get('/channels/:channelName/transactions/:trxnId', async function(req, res) {
	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let trxnId = req.params.trxnId;
	let peer = req.query.peer;
	if (!trxnId) {
		res.json(getErrorMessage('\'trxnId\''));
		return;
	}

	let message = await query.getTransactionByID(peer, req.params.channelName, trxnId, req.username, req.orgname);
	res.send(message);
});

// Query Get Block by Hash
app.get('/channels/:channelName/blocks', async function(req, res) {
	logger.debug('================ GET BLOCK BY HASH ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let hash = req.query.hash;
	let peer = req.query.peer;
	if (!hash) {
		res.json(getErrorMessage('\'hash\''));
		return;
	}

	let message = await query.getBlockByHash(peer, req.params.channelName, hash, req.username, req.orgname);
	res.send(message);
});

//Query for Channel Information
app.get('/channels/:channelName', async function(req, res) {
	logger.debug('================ GET CHANNEL INFORMATION ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let peer = req.query.peer;

	let message = await query.getChainInfo(peer, req.params.channelName, req.username, req.orgname);
	res.send(message);
});

//Query for Channel instantiated chaincodes
app.get('/channels/:channelName/chaincodes', async function(req, res) {
	logger.debug('================ GET INSTANTIATED CHAINCODES ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let peer = req.query.peer;

	let message = await query.getInstalledChaincodes(peer, req.params.channelName, 'instantiated', req.username, req.orgname);
	res.send(message);
});

// Query to fetch all installed chaincodes
app.get('/installed_chaincodes', async function(req, res) {
	var peer = req.query.peer;
	var installType = req.query.type;
	logger.debug('================ GET INSTALLED CHAINCODES ======================');

	let message = await query.getInstalledChaincodes(peer, null, 'installed', req.username, req.orgname)
	res.send(message);
});

// Query to fetch all instantiated chaincodes
app.get('/instantiated_chaincodes', async function(req, res) {
	var peer = req.query.peer;
	var installType = req.query.type;
	logger.debug('================ GET INSTALLED CHAINCODES ======================');

	let message = await query.getInstalledChaincodes(peer, null, 'instantiated', req.username, req.orgname)
	res.send(message);
});

// Query to fetch all Installed/instantiated chaincodes
app.get('/chaincodes', async function(req, res) {
	var peer = req.query.peer;
	var installType = req.query.type;
	logger.debug('================ GET INSTALLED CHAINCODES ======================');

	let message = await query.getInstalledChaincodes(peer, null, 'installed', req.username, req.orgname)
	res.send(message);
});

// Query to fetch channels
app.get('/channels', async function(req, res) {
	logger.debug('================ GET CHANNELS ======================');
	logger.debug('peer: ' + req.query.peer);
	var peer = req.query.peer;
	//logger.debug(peer);
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}

	let message = await query.getChannels(peer, req.username, req.orgname);
	res.send(message);
});

// enroll blockchain users
app.post('/users', async function(req, res) {
	var channelName = req.body.channel;
	//var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var username = req.body.userName;
	//var password = req.body.password;
	var orgname = req.body.orgName;
	var description = req.body.description;

	logger.debug('End point : /users');
	logger.debug('channelName : ' + channelName);
	//logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('User name : ' + username);
	//logger.debug('password : ' + password);
	logger.debug('Org name  : ' + orgname);
	logger.debug('Description  : ' + description);


	//if (!chaincodeName) {
	//	res.json(getErrorMessage('\'chaincodeName\''));
	//	return;
	//}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	//if (!password) {
	//	res.json(getErrorMessage('\'password\''));
	//	return;
	//}
	if (!orgname) {
		res.json(getErrorMessage('\'orgname\''));
		return;
	}
	if (!description) {
		res.json(getErrorMessage('\'description\''));
		return;
	}

	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: username,
		orgname: orgname,
		channelname: channelName,
		peername: peer,
		role: 'user'
	}, app.get('secret'));
	let response = await helper.getRegisteredUser(username, orgname, true);

	if (response && typeof response !== 'string') {
		//如果是之前没注册过的，则将用户信息写入blockchain
		if (response.load == false) {
			var fcn = "regist";
			var args = [];
			args[0] = username;
			args[1] = orgname;
			args[2] = description;

      var chaincodeName = "currency";
			let result = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, username, orgname);
			logger.debug(result);

			if (result && typeof result === 'string' && result.includes('Error:')) {
				logger.error('Failed to write the user %s for organization %s into the blockchain', username, orgname);
				res.json({success: false, message: result});
			}
		}

		logger.debug('Successfully registered the username %s for organization %s',username,orgname);
		response.token = token;
		res.json(response);

	} else {
		logger.debug('Failed to register the username %s for organization %s with::%s',username,orgname,response);
		res.json({success: false, message: response});
	}

});


// return new token
app.post('/newtoken', async function(req, res) {
	var channelName = req.channelname;
	var peer = req.peername;
	var username = req.username;
	var orgname = req.orgname;

	logger.debug('End point : /users');
	logger.debug('channelName : ' + channelName);
	logger.debug('peer : ' + peer);
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgname);

	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgname) {
		res.json(getErrorMessage('\'orgname\''));
		return;
	}

	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: username,
		orgname: orgname,
		channelname: channelName,
		peername: peer,
		role: 'user'
	}, app.get('secret'));
	let response = await helper.getRegisteredUser(username, orgname, true);

	if (response && typeof response !== 'string') {
		if (response.load == false) {
			var result = "The user " + username + " for organization " + orgname + " is not vaild user";
			logger.error(result);
			res.json({success: false, message: result});
		} else {
			logger.debug('Successfully get new token for the username %s for organization %s',username,orgname);
			response.token = token;
			res.json(response);
		}
	} else {
		logger.debug('Failed to register the username %s for organization %s with::%s',username,orgname,response);
		res.json({success: false, message: response});
	}
});

// participate a chaincode
app.post('/joinchaincode', async function(req, res) {
	logger.debug('==================== Join Chaincode ==================');
	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	//var userName = req.username;
	var userDes = req.body.description;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	//logger.debug('userName : ' + userName);
	logger.debug('userDes : ' + userDes);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	//if (!userName) {
	//	res.json(getErrorMessage('\'userName\''));
	//	return;
	//}
	if (!userDes) {
		res.json(getErrorMessage('\'userDes\''));
		return;
	}

	let message = await negoUtil.joinChaincode(userDes, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

// Add task on chaincode on target peers
app.post('/writetask', async function(req, res) {
	logger.debug('==================== Write Task ==================');
	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	var taskName = req.body.name;
	var requesterName = req.username;
	//var requesterName = req.body.requester;
	var taskDes = req.body.description;

	var taskKey = taskName + "~" + requesterName;
	var taskId = request.taskMap.get(taskKey);
	if (taskId) {
		 var response = {
			 success: false,
			 message: taskKey + " has alreadly added!"
		 }
		 res.json(response);
		 return;
	}

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskName : ' + taskName);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('taskDescription : ' + taskDes);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!taskDes) {
		res.json(getErrorMessage('\'taskDes\''));
		return;
	}

	let task = [taskName, requesterName, taskDes];

	let message = await negoUtil.writeTask(task, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//add request on on chaincode on target peer
app.post('/writerequest', async function(req, res) {
	logger.debug('==================== Write Request ==================');

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	var taskId = req.body.taskId;
	var requesterName = req.username;
	//var requesterName = req.body.requester;
  var request = req.body.request;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskId : ' + taskId);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('request : ' + request);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskId) {
		res.json(getErrorMessage('\'taskId\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!request) {
		res.json(getErrorMessage('\'request\''));
		return;
	}

	let requestInfo = [];
	requestInfo[0] = requesterName;
	requestInfo[1] = taskId;
	requestInfo[2] = request[0];//response time
	requestInfo[3] = request[1];//throughput
	requestInfo[4] = request[2];//budget

	let message = await negoUtil.writeRequest(requestInfo, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//add response on on chaincode on target peer
app.post('/writeresponse', async function(req, res) {
	logger.debug('==================== Add Response ==================');

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	var requestId = req.body.requestId;
	var requesterName = req.body.requester;
	var providerName = req.username;
	//let providerName = req.body.provider;
	var taskId = req.body.taskId;
  var response = req.body.response;
	var url = req.body.url;
	var expireTime = req.body.expireTime;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('requestId : ' + requestId);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('providerName : ' + providerName);
	logger.debug('taskId : ' + taskId);
	logger.debug('response : ' + response);
	logger.debug('url : ' + url);
	logger.debug('expireTime : ' + expireTime);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!requestId) {
		res.json(getErrorMessage('\'requesterId\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!providerName) {
		res.json(getErrorMessage('\'providerName\''));
		return;
	}
	if (!taskId) {
		res.json(getErrorMessage('\'taskId\''));
		return;
	}
	if (!response) {
		res.json(getErrorMessage('\'response\''));
		return;
	}
	if (!url) {
		res.json(getErrorMessage('\'url\''));
		return;
	}
	if (!expireTime) {
		res.json(getErrorMessage('\'expireTime\''));
		return;
	}

	let responseInfo = [];
	responseInfo[0] = requestId;
	responseInfo[1] = requesterName;
	responseInfo[2] = providerName;
	responseInfo[3] = taskId;
	responseInfo[4] = url;
	responseInfo[5] = expireTime;
	responseInfo[6] = response[0];//response time
	responseInfo[7] = response[1];//throughput
	responseInfo[8] = response[2];//bid price

	let message = await negoUtil.writeResponse(responseInfo, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//check whether the requests can be satisfied or not
app.post('/check', async function(req, res) {
	logger.debug('==================== Check ==================');

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var taskId = req.body.taskId;
	//var requesterName = req.username;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskId : ' + taskId);
	//logger.debug('requesterName : ' + requesterName);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskId) {
		res.json(getErrorMessage('\'taskId\''));
		return;
	}
	//if (!requesterName) {
	//	res.json(getErrorMessage('\'requesterName\''));
	//	return;
	//}

	//var taskKey = taskName + "~" + requesterName;
	//var taskId = request.taskMap.get(key);
  //if (!taskId) {
	//	res.send("no task " + taskName + ", requester " + requesterName);
	//}
  //logger.debug(chaincodeName);
	let message = await negoUtil.check(taskId, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//get agreement by taskname and requester
app.post('/getagreement', async function(req, res) {
	logger.debug('==================== Check ==================');

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	var requester = req.username;

	var taskname = req.body.taskname;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('requester : ' + requester);
	logger.debug('taskname : ' + taskname);


	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!requester) {
		res.json(getErrorMessage('\'requester\''));
		return;
	}
	if (!taskname) {
		res.json(getErrorMessage('\'taskname\''));
		return;
	}

	let message = await negoUtil.getagreement(taskname, peer, channelName, chaincodeName, requester, req.orgname);
	res.send(message);
});


//a new round
app.post('/new_round', async function(req, res) {
	logger.debug('==================== Check ==================');

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var taskId = req.body.taskId;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskId : ' + taskId);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskId) {
		res.json(getErrorMessage('\'taskId\''));
		return;
	}

	let message = await negoUtil.newround(taskId, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//delete task by administrator
app.post('/delete_task', async function(req, res) {
	logger.debug('==================== delete ==================');

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var taskName = req.body.taskName;
	//var requesterName = req.username;
	var requesterName = req.body.requesterName;

	var role = req.role;
	if (role!="administrator") {
		res.json(getErrorRoleMessage(requesterName, "delete_task"));
		return;
	}


	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskName : ' + taskName);
	logger.debug('requesterName : ' + requesterName);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}

	let message = await negoUtil.deleteTask(taskName, requesterName, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

//delete task by administrator
app.post('/delete_serviceTX', async function(req, res) {
	logger.debug('==================== delete all serviceTX==================');

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;


	var role = req.role;
	if (role!="administrator") {
		res.json(getErrorRoleMessage(requesterName, "delete_serviceTX"));
		return;
	}

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);


	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}


	let message = await negoUtil.deleteServiceTX(peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

// Query on chaincode on target peers
app.post('/query', async function(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');

	var role = req.role;
	if (role!="administrator") {
		res.json(getErrorRoleMessage(requesterName, "invoke"));
		return;
	}

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
  var fcn = req.body.fcn;
	var args = req.body.args;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	try{
		let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
		res.send(message);
	} catch (err) {
		logger.error(err);
		res.send(err.toString());
	}
});

// Query on chaincode on target peers
app.post('/invoke', async function(req, res) {
	logger.debug('==================== INVOKE CHAINCODE ==================');

	var role = req.role;
	if (role!="administrator") {
		res.json(getErrorRoleMessage(requesterName, "invoke"));
		return;
	}

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
  var fcn = req.body.fcn;
	var args = req.body.args;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	try{
		let message = await invoke.invokeChaincode(peer, channelName, chaincodeName, fcn, args, req.username, req.orgname);
		res.send(message);
	} catch (err) {
		logger.error(err);
		res.send(err.toString());
	}
});

// Query on chaincode on target peers
app.post('/service', async function(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	var requesterName = req.username;
	var args = req.body.args;

	var length = args.length;
	var serviceArgs = [];
	serviceArgs[0] = requesterName;
	for (var i=0;i<length;i++) {
		serviceArgs[i+1] = args[i];
	}

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	try{
		let message = await service.invokeRestAPIviaCC(peer, channelName, chaincodeName, serviceArgs, req.username, req.orgname);
		res.send(message);
	} catch (err) {
		logger.error(err);
		res.send(err.toString());
	}
});


// Test
/*app.post('/test', async function(req, res) {
	logger.debug('==================== Test ==================');
	let channelName = req.body.channel;
	let chaincodeName = req.body.chaincode;
	let peer = req.body.peer;
	let taskName = req.body.name;
	let requesterName = req.username;
	//let requesterName = req.body.requester;
	let taskDes = req.body.description;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskName : ' + taskName);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('taskDescription : ' + taskDes);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peerName\''));
		return;
	}
	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!taskDes) {
		res.json(getErrorMessage('\'taskDes\''));
		return;
	}

	let task = [taskName, requesterName, taskDes];

	let message = await negoUtil.mytest(task, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});*/

// CronTest
app.post('/schedule', async function(req, res) {
	logger.debug('==================== Schedule ==================');

	var role = req.role;
	if (role!="administrator") {
		res.json(getErrorRoleMessage(requesterName, "schedule"));
		return;
	}

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var taskId = req.body.taskId;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskId : ' + taskId);


	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peerName\''));
		return;
	}
	if (!taskId) {
		res.json(getErrorMessage('\'taskId\''));
		return;
	}

	await negoUtil.scheduledTransfer(taskId, peer, channelName, chaincodeName, req.username, req.orgname);

	//let i = 1;

	//var date = new Date("2018-04-11 15:07:00 GMT+8");
	//logger.debug(date);

	//var rule = new schedule.RecurrenceRule();
	//rule.second = 5;

	//schedule.scheduleJob(rule, async function(){
		//logger.debug(i);
		//i++;
		//let message = await negoUtil.mytest(task, peer, channelName, chaincodeName, req.username, req.orgname);
		//let message = await query.queryChaincode(peer, channelName, chaincodeName, "[]", "queryTask", req.username, req.orgname);
	//});

  res.send("Scheduled Job!\n");
});

app.post('/request_strategy', async function(req, res) {
	logger.debug('==================== request strategy ==================');

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer= req.peername;
	var taskNames = req.body.taskNames;
	var requesterName = req.username;
	//var requesterName = req.body.requesterName;
	//var roundIndex = req.body.roundIndex;
	//var strategyPath = req.body.strategyPath;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskNames : ' + taskNames);
	//logger.debug('roundIndex : ' + roundIndex);
	logger.debug('requesterName : ' + requesterName);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskNames) {
		res.json(getErrorMessage('\'taskNames\''));
		return;
	}
	//if (!roundIndex) {
	//	res.json(getErrorMessage('\'roundIndex\''));
	//	return;
	//}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}

	let message = await request.propose(taskNames, requesterName, peer, channelName, chaincodeName, req.username, req.orgname);
	res.send(message);
});

app.post('/response_strategy', async function(req, res) {
	logger.debug('==================== response strategy ==================');

	var channelName = req.body.channel;
	var chaincodeName = req.body.chaincode;
	var peer = req.body.peer;
	var taskName = req.body.taskName;
	var roundIndex = req.body.roundIndex;
	var requesterName = req.body.requesterName;
	var providerName = req.username;
	//var providerName = req.body.providerName;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);
	logger.debug('taskName : ' + taskName);
	logger.debug('roundIndex : ' + roundIndex);
	logger.debug('requesterName : ' + requesterName);
	logger.debug('providerName : ' + providerName);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!roundIndex) {
		res.json(getErrorMessage('\'roundIndex\''));
		return;
	}
	if (!requesterName) {
		res.json(getErrorMessage('\'requesterName\''));
		return;
	}
	if (!providerName) {
		res.json(getErrorMessage('\'providerName\''));
		return;
	}

	let message = await response.strategyByTaskNameRound(taskName, requesterName, roundIndex, peer, channelName, chaincodeName, providerName, req.orgname);
	res.send(message);
});

app.post('/add_listener', function(req, res) {
	logger.debug('==================== add listener ==================');

	var taskName = req.body.taskName;
	var providername = req.username;

	var channelName = req.channelname;
	var chaincodeName = req.body.chaincode;
	var peer = req.peername;
	//var providerName = req.body.providerName;

	logger.debug('taskName : ' + taskName);
	logger.debug('providername : ' + providername);
	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('peer : ' + peer);


	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!providername) {
		res.json(getErrorMessage('\'providername\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}

  let message = taskListener.add(taskName, peer, channelName, chaincodeName, providername, req.orgname);
	res.send(message);
});

app.post('/remove_listener', function(req, res) {
	logger.debug('==================== remove listener ==================');

	var taskName = req.body.taskName;
	var providerName = req.username;
	//var providerName = req.body.providerName;

	logger.debug('taskName : ' + taskName);
	logger.debug('providerName : ' + providerName);

	if (!taskName) {
		res.json(getErrorMessage('\'taskName\''));
		return;
	}
	if (!providerName) {
		res.json(getErrorMessage('\'providerName\''));
		return;
	}

  let message = taskListener.remove(taskName, providerName);
	res.send(message);
});

app.post('/set_strategy', function(req, res) {
	logger.debug('==================== set strategy ==================');

	//var channelName = req.body.channel;
	//var chaincodeName = req.body.chaincode;
	//var peer = req.body.peer;
	//var user = req.body.user;

	var user = req.username;
	var role = req.body.role;
  var strategyFile = req.body.strategyFile;

	//logger.debug('channelName : ' + channelName);
	//logger.debug('chaincodeName : ' + chaincodeName);
	//logger.debug('peer : ' + peer);
	logger.debug('user : ' + user);
	logger.debug('role : ' + role);
	logger.debug('strategyFile : ' + strategyFile);

	//if (!chaincodeName) {
	//	res.json(getErrorMessage('\'chaincodeName\''));
	//	return;
	//}
	//if (!channelName) {
	//	res.json(getErrorMessage('\'channelName\''));
	//	return;
	//}
	//if (!peer) {
	//	res.json(getErrorMessage('\'peer\''));
	//	return;
	//}
	if (!user) {
		res.json(getErrorMessage('\'user\''));
		return;
	}
	if (!role) {
		res.json(getErrorMessage('\'role\''));
		return;
	}
	if (!strategyFile) {
		res.json(getErrorMessage('\'strategyFile\''));
		return;
	}

	let message = strategy.set(user, role, strategyFile);
	res.send(message);
});

app.post('/set_strategy_file', function(req, res) {
	logger.debug('==================== set strategy file ==================');

	//var channelName = req.body.channel;
	//var chaincodeName = req.body.chaincode;
	//var peer = req.body.peer;
	//var user = req.body.user;

	var user = req.username;
	var role = req.body.role;
  var strategyFile = req.body.strategyFile;

	//logger.debug('channelName : ' + channelName);
	//logger.debug('chaincodeName : ' + chaincodeName);
	//logger.debug('peer : ' + peer);
	logger.debug('user : ' + user);
	logger.debug('role : ' + role);
	logger.debug('strategyFile : ' + strategyFile);

	//if (!chaincodeName) {
	//	res.json(getErrorMessage('\'chaincodeName\''));
	//	return;
	//}
	//if (!channelName) {
	//	res.json(getErrorMessage('\'channelName\''));
	//	return;
	//}
	//if (!peer) {
	//	res.json(getErrorMessage('\'peer\''));
	//	return;
	//}
	if (!user) {
		res.json(getErrorMessage('\'user\''));
		return;
	}
	if (!role) {
		res.json(getErrorMessage('\'role\''));
		return;
	}
	if (!strategyFile) {
		res.json(getErrorMessage('\'strategyFile\''));
		return;
	}

	let message = strategy.set_file(user, role, strategyFile);
	res.send(message);
});

app.get('/get_taskmap', function(req, res) {
	let message = negoUtil.getTaskMap();
	res.send(message);
});

app.get('/get_requestmap', function(req, res) {
	let message = negoUtil.getRequestMap();
	res.send(message);
});

app.get('/get_taskjsonmap', function(req, res) {
	let message = negoUtil.getTaskJsonMap();
	res.send(message);
});

app.get('/get_listenermap', function(req, res) {
	let message = negoUtil.getListenerMap();
	res.send(message);
});

app.get('/organizations', function(req, res) {
	logger.debug('==================== get orgs ==================');

	var channelName = req.query.channel;
	logger.debug('channelName : ' + channelName);

	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}

	var channel =  hfc.getConfigSetting(channelName);
	let message = channel['orgs'];
	res.send(message);
});
