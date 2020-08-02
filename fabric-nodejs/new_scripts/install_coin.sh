#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#


jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
	echo
	exit 1
fi

starttime=$(date +%s)

LANGUAGE=go
CC_SRC_PATH=github.com/ERC20
CC_NAME=coin

echo "The source path of chaincode is: $CC_SRC_PATH"
echo "The name of chaincode is: $CC_NAME"
echo
echo
echo "POST request Enroll on Org Gfe  ..."
echo
ADMIN_GFE_TOKEN=$(curl -s -X POST \
  http://localhost:4000/admins \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=admin_cc_gfe&orgname=Gfe')
echo $ADMIN_GFE_TOKEN
ADMIN_GFE_TOKEN=$(echo $ADMIN_GFE_TOKEN | jq ".token" | sed "s/\"//g")
echo $ADMIN_GFE_TOKEN>../token/admin_gfe.token
echo
echo "GFE token is $ADMIN_GFE_TOKEN"
echo
echo



echo "POST Install chaincode on Org Gfe"
echo
curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer $ADMIN_GFE_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.fabric.gfe.com\",\"peer1.fabric.gfe.com\"],
	\"chaincodeName\":\"$CC_NAME\",
	\"chaincodePath\":\"$CC_SRC_PATH\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"chaincodeVersion\":\"v0\"
}"
echo
echo

echo "POST instantiate chaincode of Org Gfe"
echo
curl -s -X POST \
  http://localhost:4000/channels/softwarechannel/chaincodes \
  -H "authorization: Bearer $ADMIN_GFE_TOKEN" \
  -H "content-type: application/json" \
  -d "{
	\"peers\": [\"peer0.fabric.gfe.com\"],
	\"chaincodeName\":\"$CC_NAME\",
	\"chaincodeVersion\":\"v0\",
	\"chaincodeType\": \"$LANGUAGE\",
	\"args\":[]
}"
echo
echo


echo "GET query Installed chaincodes"
echo
curl -s -X GET \
  "http://localhost:4000/chaincodes?peer=peer0.fabric.gfe.com" \
  -H "authorization: Bearer $ADMIN_GFE_TOKEN" \
  -H "content-type: application/json"
echo
echo

echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
