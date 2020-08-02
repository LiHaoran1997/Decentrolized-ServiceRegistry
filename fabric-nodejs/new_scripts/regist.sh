
port=4000
CC_NAME=test
#org_token=$(cat gfe.token)

starttime=$(date +%s)

echo "export port=$port;"
#echo "export org_token=$org_token;"

echo
echo "================ regist ================="
echo
JIM_GFE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer0.fabric.gfe.com\",
       \"userName\":\"Jim\",
	     \"orgName\":\"Gfe\",
		   \"description\":\"travel agent\"
     }");
echo $JIM_GFE_TOKEN
JIM_GFE_TOKEN=$(echo $JIM_GFE_TOKEN | jq ".token" | sed "s/\"//g")
echo $JIM_GFE_TOKEN>../token/jim_gfe.token
echo
echo
echo "================ regist ================="
echo
TIM_DEKE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer0.fabric.deke.com\",
       \"userName\":\"Tim\",
	     \"orgName\":\"Deke\",
		   \"description\":\"travel agent\"
     }");
echo $TIM_DEKE_TOKEN
TIM_DEKE_TOKEN=$(echo $TIM_DEKE_TOKEN | jq ".token" | sed "s/\"//g")
echo $TIM_DEKE_TOKEN>../token/tim_deke.token
echo
echo
echo "================ regist ================="
echo
PERRY_DEKE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer1.fabric.deke.com\",
       \"userName\":\"Perry\",
	     \"orgName\":\"Deke\",
		   \"description\":\"travel agent\"
     }");
echo $PERRY_DEKE_TOKEN
PERRY_DEKE_TOKEN=$(echo $PERRY_DEKE_TOKEN | jq ".token" | sed "s/\"//g")
echo $PERRY_DEKE_TOKEN>../token/perry_deke.token
echo
echo
echo "================ regist ================="
echo
QUNAR_GFE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer0.fabric.gfe.com\",
       \"userName\":\"Qunar\",
	     \"orgName\":\"Gfe\",
		   \"description\":\"qunar service\"
     }");
echo $QUNAR_GFE_TOKEN
QUNAR_GFE_TOKEN=$(echo $QUNAR_GFE_TOKEN | jq ".token" | sed "s/\"//g")
echo $QUNAR_GFE_TOKEN>../token/qunar_gfe.token
echo
echo
echo "================ regist ================="
echo
CTRIP_DEKE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer1.fabric.deke.com\",
       \"userName\":\"Ctrip\",
	     \"orgName\":\"Deke\",
		   \"description\":\"ctrip service\"
     }");
echo $CTRIP_DEKE_TOKEN
CTRIP_DEKE_TOKEN=$(echo $CTRIP_DEKE_TOKEN | jq ".token" | sed "s/\"//g")
echo $CTRIP_DEKE_TOKEN>../token/ctrip_deke.token
echo
echo
echo
echo "================ regist ================="
echo
ALI_DEKE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer0.fabric.deke.com\",
       \"userName\":\"Ali\",
	     \"orgName\":\"Deke\",
		   \"description\":\"ali service\"
     }");
echo $ALI_DEKE_TOKEN
ALI_DEKE_TOKEN=$(echo $ALI_DEKE_TOKEN | jq ".token" | sed "s/\"//g")
echo $ALI_DEKE_TOKEN>../token/ali_deke.token
echo
echo
echo "================ regist ================="
echo
DBIIR_DEKE_TOKEN=$(curl -s -X POST \
  "http://localhost:$port/users" \
  -H "content-type: application/json" \
  -d "{
		   \"channel\":\"softwarechannel\",
		   \"peer\":\"peer1.fabric.deke.com\",
       \"userName\":\"Dbiir\",
	     \"orgName\":\"Deke\",
		   \"description\":\"dbiir service\"
     }");
echo $DBIIR_DEKE_TOKEN
DBIIR_DEKE_TOKEN=$(echo $DBIIR_DEKE_TOKEN | jq ".token" | sed "s/\"//g")
echo $DBIIR_DEKE_TOKEN>../token/dbiir_deke.token
echo
echo


echo
echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
