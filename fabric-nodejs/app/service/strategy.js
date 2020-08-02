/**
 * 2018 ruc SCAS 0.1
 *
 */

var path = require('path');
var helper = require('../helper.js');
var hfc = require('fabric-client');
var fs = require('fs');
var logger = helper.getLogger('Strategy-File');

var requestStrategyMap = new Map();
var responseStrategyMap = new Map();

var set = function(user, role, strategyFile){
  try{
    let config = '-connection-profile-path';
    var strategyPath = path.join(hfc.getConfigSetting('strategy'+config), strategyFile);

    var json = JSON.parse(fs.readFileSync(strategyPath));

    if (role == "requester") {
      requestStrategyMap.set(user, strategyPath);
      logger.debug("requester: " + user + ", strategyFile: " + strategyPath);

      return "requester: " + user + ", strategyFile: " + strategyPath
    } else if (role == "provider") {
      responseStrategyMap.set(user, strategyPath);
      logger.debug("provider: " + user + ", strategyFile: " + strategyPath);

      return "provider: " + user + ", strategyFile: " + strategyPath
    } else {
      logger.error("role must be requester or provider");
      return "Error: role must be requester or provider";
    }

  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}

var set_file = function(user, role, strategyFile){
  try{
    let config = '-connection-profile-path';

    if (role == "requester") {
      var fileName = "request-strategy-" + user + ".json";
    } else if (role == "provider") {
      var fileName = "response-strategy-" + user + ".json";
    }

    var strategyPath = path.join(hfc.getConfigSetting('strategy'+config), fileName);

    fs.writeFile(strategyPath, JSON.stringify(strategyFile, null, 2), function(err) {
      if(err) {
        logger.error(err);
        return err.toString();
      } else {
        logger.debug("JSON saved to " + strategyPath);
      }
    });

    if (role == "requester") {
      requestStrategyMap.set(user, strategyPath);
      logger.debug("requester: " + user + ", strategyFile: " + strategyPath);

      return "requester: " + user + ", strategyFile: " + strategyPath
    } else if (role == "provider") {
      responseStrategyMap.set(user, strategyPath);
      logger.debug("provider: " + user + ", strategyFile: " + strategyPath);

      return "provider: " + user + ", strategyFile: " + strategyPath
    } else {
      logger.error("role must be requester or provider");
      return "Error: role must be requester or provider";
    }

  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}


module.exports.requestStrategyMap = requestStrategyMap;
module.exports.responseStrategyMap = responseStrategyMap;
exports.set = set;
exports.set_file = set_file;
