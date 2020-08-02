#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
LANGUAGE=go
CC_SRC_PATH=github.com/business/nacos
CC_NAME=nacos
port=4000
key=com.alibaba.nacos.naming.iqwerlist.test-namespace##test-service
datum={"key":"com.alibaba.nacos.naming.iplist.test-namespace##test-service","timestamp":1,"value":{"instanceList":[{"app":"","clusterName":"test-cluster","enabled":true,"ephemeral":true,"healthy":true,"instanceHeartBeatInterval":5000,"instanceHeartBeatTimeOut":15000,"instanceId":"","instanceIdGenerator":"simple","ip":"1.1.1.1","ipDeleteTimeout":30000,"lastBeat":1583143809481,"marked":false,"metadata":{},"port":1,"serviceName":"","tenant":"","weight":1.0},{"app":"","clusterName":"test-cluster","enabled":true,"ephemeral":true,"healthy":true,"instanceHeartBeatInterval":5000,"instanceHeartBeatTimeOut":15000,"instanceId":"","instanceIdGenerator":"simple","ip":"2.2.2.2","ipDeleteTimeout":30000,"lastBeat":1583143809481,"marked":false,"metadata":{},"port":2,"serviceName":"","tenant":"","weight":1.0}]}}

ADMIN_GFE_TOKEN=$(curl -s -X POST \
  http://localhost:4000/admins \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=admin_cc_gfe&orgname=Gfe')


ADMIN_GFE_TOKEN=$(echo $ADMIN_GFE_TOKEN | jq ".token" | sed "s/\"//g")


TRX_ID=$(curl -s -X POST \
  http://localhost:$port/channels/softwarechannel/chaincodes/$CC_NAME \
  -H "authorization: Bearer $ADMIN_GFE_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.fabric.gfe.com\"],
	\"chaincodeName\":\"$CC_NAME\",
	\"chaincodeVersion\":\"v0\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"fcn\":\"Put\",
	\"args\":[\"$key\",\"$datum\"]
}")
echo "$TRX_ID"

