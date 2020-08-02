#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
LANGUAGE=go
CC_SRC_PATH=github.com/business/monitor
CC_NAME=monitor
port=4000
ADMIN_GFE_TOKEN=$(curl -s -X POST \
  http://localhost:4000/admins \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=admin_cc_gfe&orgname=Gfe')

ADMIN_GFE_TOKEN=$(echo $ADMIN_GFE_TOKEN | jq ".token" | sed "s/\"//g")

TRX_ID=$(curl -s -X POST \
  http://127.0.0.1:$port/channels/softwarechannel/chaincodes/$CC_NAME \
  -H "authorization: Bearer $ADMIN_GFE_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.fabric.gfe.com\"],
	\"chaincodeName\":\"$CC_NAME\",
	\"chaincodeVersion\":\"v0\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"fcn\":\"RangeQuery\",
	\"args\":[\"springcloud.monitor.provider.http://127.0.0.1:8088/hi@@\",\"springcloud.monitor.provider.http://127.0.0.1:8088/hi@A\"]
}")
echo "$TRX_ID"

