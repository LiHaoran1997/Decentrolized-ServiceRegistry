FILE1=$1
CON1=key=$2
echo "$1"
echo "$2"
sed -i "11c${CON1}" $FILE1


