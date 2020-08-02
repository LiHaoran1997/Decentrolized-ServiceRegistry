echo "POST request Enroll on Org Gfe  ..."
echo
ADMIN_GFE_TOKEN=$(curl -s -X POST \
  http://localhost:4000/admins \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=admin_cc_gfe&orgname=Gfe')
echo $ADMIN_GFE_TOKEN
ADMIN_GFE_TOKEN=$(echo $ADMIN_GFE_TOKEN)
echo $ADMIN_GFE_TOKEN>../token/admin_gfe.token
echo
echo "GFE token is $ADMIN_GFE_TOKEN"
echo
echo

