/**
 * 2018 ruc SCAS 0.1
 *
 */

var path = require('path');
var helper = require('../helper.js');
var hfc = require('fabric-client');
var logger = helper.getLogger('Task-Listener');
var response = require('./response.js');
var request = require('./request.js');
var strategy = require('./strategy.js');
var fs = require('fs');

var events = require('events');
var event = new events.EventEmitter();

var listenerMap = new Map();
var eventMap = new Map();

var add = function(taskName, peer, channelName, chaincodeName, providerName, orgname){
  try{
    //logger.debug(strategy.responseStrategyMap);
    var responseStrategyPath = strategy.responseStrategyMap.get(providerName);
    if (!responseStrategyPath) {
      logger.error("no strategy file for provider: " + providerName);
      return "Error: no strategy file for provider: " + providerName;
    }

    var key = taskName + "~" + providerName;
    var listenerIndex = listenerMap.get(key);
    //logger.debug(listenerIndex);
    //return "0";

    if (!listenerIndex) {
      event.on(taskName, function(requesterName, roundIndex){
        try{
          //logger.debug(requesterName);
          response.strategyByTaskNameRound(taskName, requesterName, roundIndex, peer, channelName, chaincodeName, providerName, orgname);
        } catch (err) {
          logger.error(err);
          return err.toString();
        }
      });

      listenerIndex = event.listenerCount(taskName); //index是从1开始的
      listenerMap.set(key, listenerIndex);

      logger.debug("add response " + responseStrategyPath + " for task " + taskName);
      responseString = "add response " + responseStrategyPath + " for task " + taskName;
      return responseString;
    } else {
      logger.debug("key: " + key + ", index: " + listenerIndex + " has already beend added!");
      return  "listener: response " + responseStrategyPath + " for task " + taskName + " has already been added!";
    }

  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}


var remove = function(taskName, providerName){
  try{
    var key = taskName + "~" + providerName;
    var listenerIndex = listenerMap.get(key);

    //.logger.error(listenerIndex);

    if (listenerIndex) {
      listeners = event.listeners(taskName);
      listener = listeners[listenerIndex-1];
      //logger.error(listener);

      event.removeListener(taskName, listener);
      listenerMap.delete(key);

      for (var key of listenerMap.keys()) {
        var index = listenerMap.get(key);
        if (key.includes(taskName) && index > listenerIndex) {
          listenerMap.set(key, index-1);
        }
      }

      logger.debug("remove listener: provider " + providerName + " for task " + taskName);
      return "remove listener: provider " + providerName + " for task " + taskName;
    } else {
      logger.debug("no listener: key " + key + " , " + listenerIndex);
      return  "no listener: provider " + providerName + " for task " + taskName;
    }

  } catch (err) {
		logger.error(err);
		return err.toString();
	}
}

module.exports.event = event;
module.exports.listenerMap = listenerMap;

exports.add = add;
exports.remove = remove;
