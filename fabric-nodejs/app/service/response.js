
var negoUtil = require('./negotiation-utils.js');
var helper = require('../helper.js');
var logger = helper.getLogger('Response-Strategy');
var util = require('util');
var fs = require('fs');
var query = require('../query.js');

var request = require('./request.js');
var profile = require('./strategy.js');

// write responses
var strategyByTaskNameRound = async function(taskName, requesterName, roundIndex, peer, channelName, chaincodeName, providerName, orgname) {
  try{

    var responseStrategyPath = profile.responseStrategyMap.get(providerName);
    if (!responseStrategyPath) {
      logger.error("no strategy file for provider: " + providerName);
      return "no strategy file for provider: " + providerName;
    }

    var responseJson = JSON.parse(fs.readFileSync(responseStrategyPath));

    var taskJson = responseJson[taskName];
    if (!taskJson) {
      logger.info("no responses for the task " + taskName);
      return "no responses for the task " + taskName;
    }

    var providerName = responseJson["provider"];

    // get taskId from taskMap
    var taskKey = taskName + "~" + requesterName;
    var taskId = request.taskMap.get(taskKey);

    if (taskId) {
        // get requestId from requestMap
        var responseLen = Object.keys(responseJson[taskName]["round"][roundIndex]).length;

        var responsesArray = [];
        for(j = 0; j < responseLen; j ++) {
          var url = responseJson[taskName]["round"][roundIndex][j]["url"];
          var expireTime = responseJson[taskName]["round"][roundIndex][j]["expireTime"];

          var requestIndex = responseJson[taskName]["round"][roundIndex][j]["request"];
          var key = taskName + "~" + requesterName + "~" + requestIndex + "~" + "round" + roundIndex;
          var requestId = request.requestMap.get(key);

          if (requestId) {
            var responseInfo = []
            responseInfo[0] = requestId;
            responseInfo[1] = requesterName;
            responseInfo[2] = providerName;
            responseInfo[3] = taskId;
            responseInfo[4] = url;
            responseInfo[5] = expireTime;

            var infoLen = Object.keys(responseJson[taskName]["round"][roundIndex][j]["response"]).length;

            for(k = 0; k < infoLen; k ++) {
              responseInfo[k + 6] = responseJson[taskName]["round"][roundIndex][j]["response"][k];
            }
            responsesArray[j] = negoUtil.writeResponse(responseInfo, peer, channelName, chaincodeName, providerName, orgname);
          }
        }

        await Promise.all(responsesArray);
        //logger.debug("responses done!");
        //return "responses done!\n";
        logger.debug("requester " + requesterName + ", responses " + responseStrategyPath + " for task " + taskName + " have been loaded!");
        return "requester " + requesterName + ", responses " + responseStrategyPath + " for task " + taskName + " have been loaded!\n";
    }
    return "no taskId " + taskId;

  } catch (err) {
    logger.error(err);
    return err.toString();
  }

}

exports.strategyByTaskNameRound = strategyByTaskNameRound;
