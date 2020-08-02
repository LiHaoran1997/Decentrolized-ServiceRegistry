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
log4js.configure({
  appenders:[
		{
			//控制台输出
			type: 'console'
		},
		{
      //日志文件输出
		  type: 'logLevelFilter',
		  level: 'INFO',
		  appender: {
				type: 'dateFile',
		    filename: 'logs/scas',
        alwaysIncludePattern: true,
        pattern: "-yyyy-MM-dd.log"
		  }
		 }
	]
})


var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');
//logger.setLevel('INFO');

var path = require('path');
var util = require('util');
var copService = require('fabric-ca-client');
var fs = require('fs');

var hfc = require('fabric-client');
hfc.setLogger(logger);
var ORGS = hfc.getConfigSetting('network-config');

var clients = {};
var channels = {};
var caClients = {};

var sleep = async function (sleep_time_ms) {
	return new Promise(resolve => setTimeout(resolve, sleep_time_ms));
}

async function getClientForOrg (userorg, username) {
	logger.debug('getClientForOrg - ****** START %s %s', userorg, username)
	// get a fabric client loaded with a connection profile for this org
	let config = '-connection-profile-path';

	// build a client context and load it with a connection profile
	// lets only load the network settings and save the client for later
	let client = hfc.loadFromConfig(hfc.getConfigSetting('network'+config));

	// This will load a connection profile over the top of the current one one
	// since the first one did not have a client section and the following one does
	// nothing will actually be replaced.
	// This will also set an admin identity because the organization defined in the
	// client section has one defined
  //logger.error(userorg+config);
  //logger.error(hfc.getConfigSetting(userorg+config));
	client.loadFromConfig(hfc.getConfigSetting(userorg+config));

	//logger.debug("test: " + userorg+config + "  " + hfc.getConfigSetting(userorg+config));

	// this will create both the state store and the crypto store based
	// on the settings in the client section of the connection profile
	await client.initCredentialStores();

	// The getUserContext call tries to get the user from persistence.
	// If the user has been saved to persistence then that means the user has
	// been registered and enrolled. If the user is found in persistence
	// the call will then assign the user to the client object.
	if(username) {
		let user = await client.getUserContext(username, true);
		if(!user) {
			throw new Error(util.format('User was not found :', username));
		} else {
			logger.debug('User %s was found to be registered and enrolled', username);
		}
	}
	logger.debug('getClientForOrg - ****** END %s %s \n\n', userorg, username)

	return client;
}

var getRegisteredUser = async function(username, userOrg, isJson) {

	try {
		var client = await getClientForOrg(userOrg);
		logger.debug('Successfully initialized the credential stores');
			// client can now act as an agent for organization Org1
			// first check to see if the user is already enrolled
		var user = await client.getUserContext(username, true);
    var isLoaded = false;
		if (user && user.isEnrolled()) {
      isLoaded = true;
			logger.info('Successfully loaded member from persistence');
		} else {
			// user was not enrolled, so we will need an admin user object to register
			logger.info('User %s was not enrolled, so we will need an admin user object to register',username);
			var admins = hfc.getConfigSetting('admins');
			let adminUserObj = await client.setUserContext({username: admins[0].username, password: admins[0].secret});
			let caClient = client.getCertificateAuthority();
      //logger.error(userOrg.toLowerCase() + '.department1');
			let secret = await caClient.register({
				enrollmentID: username,
        affiliation: 'org1.department1'
			}, adminUserObj);

			logger.debug('Successfully got the secret for user %s',username);
			user = await client.setUserContext({username:username, password:secret});
			logger.debug('Successfully enrolled username %s  and setUserContext on the client object', username);
		}
		if(user && user.isEnrolled) {
			if (isJson && isJson === true) {
				var response = {
					success: true,
					secret: user._enrollmentSecret,
					message: username + ' enrolled Successfully',
          load: isLoaded
				};
				return response;
			}
		} else {
			throw new Error('User was not enrolled ');
		}
	} catch(error) {
		logger.error('Failed to get registered user: %s with error: %s', username, error.toString());
		return 'failed '+error.toString();
	}
};

var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting('CC_SRC_PATH'));
};

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('DEBUG');
	return logger;
};

var getKey = function(username, userOrg)  {
  var org = userOrg;
	var file = "./fabric-client-kv-"+org+"\/"+username;
  var user = JSON.parse(fs.readFileSync( file));
	var signingIdentity = user.enrollment.signingIdentity;
	var certPEM = user.enrollment.identity.certificate.toString();
	var privateKeyPath = "/tmp/fabric-client-kv-"+org+"\/"+signingIdentity+'-priv';
	var keyPEM = fs.readFileSync(privateKeyPath).toString();  // privateKey
	var cryptoContent = {
		privateKeyPEM: keyPEM,
		signedCertPEM: certPEM,
	};
	return cryptoContent;
};

exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getRegisteredUser = getRegisteredUser;
exports.getKey = getKey;
