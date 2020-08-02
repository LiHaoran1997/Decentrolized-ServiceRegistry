#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
LANGUAGE=go
CC_SRC_PATH=github.com/business/run
CC_NAME=run
port=4000

admin_gfe_token=$(cat ../token/admin_gfe.token)
admin_deke_token=$(cat ../token/admin_deke.token)
jim_gfe_token=$(cat ../token/jim_gfe.token)
tim_deke_token=$(cat ../token/tim_deke.token)
perry_deke_token=$(cat ../token/perry_deke.token)

qunar_gfe_token=$(cat ../token/qunar_gfe.token)
ali_deke_token=$(cat ../token/ali_deke.token)
ctrip_deke_token=$(cat ../token/ctrip_deke.token)
dbiir_deke_token=$(cat ../token/dbiir_deke.token)

starttime=$(date +%s)

echo "export port=$port;"
echo "export cc_name=$CC_NAME"

:<<!
echo
echo "============ write task ============"
echo
taskJson=$(curl -s -X POST \
  "http://202.112.114.22:$port/writetask" \
  -H "authorization: Bearer $admin_gfe_token" \
  -H "content-type: application/json" \
  -d "{
        \"chaincode\":\"$cc_name\",
        \"name\":\"Sat\",
        \"description\":\"000\"
	\"args\":[\"EXP1\",\"A\",\"Term1\"]
}")
echo $taskJson
taskId=$(echo $taskJson | jq ".id" | sed "s/\"//g")
echo "taskId is $taskId"
!


echo "POST invoke chaincode on peers of Org1"
echo
TRX_ID="c031ce750c98f992de4c8f3a30c170693aee2c8077ba5e4bef3b58ab5e3b97aa"
echo " $TRX_ID"
echo
echo
echo "GET query Transaction by TransactionID"
echo
curl -s -X GET\
   "http://202.112.114.22:$port/channels/softwarechannel/transactions/$TRX_ID?\peer=peer0.org1.example.com" \
  -H "authorization: Bearer $admin_gfe_token" \
  -H "content-type: application/json"
echo
echo



echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
