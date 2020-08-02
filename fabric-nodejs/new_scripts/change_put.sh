FILE1=$1
CON1=key=$2
CON2=datum=$3
echo "$1"
echo "$2"
echo "$3"
sed -i "11c${CON1}" $FILE1
sed -i "12c${CON2}" $FILE1

