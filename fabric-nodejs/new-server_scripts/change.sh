num=run
FILE1=channel.sh
FILE2=install.sh
FILE3=regist.sh
FILE4=task.sh
FILE5=QueryById.sh

CON1=CC_SRC_PATH=github.com/business/${num}
CON2=CC_NAME=${num}
sed -i "21c${CON1}" $FILE1
sed -i "22c${CON2}" $FILE1
sed -i "19c${CON1}" $FILE2
sed -i "20c${CON2}" $FILE2
sed -i "3c${CON2}" $FILE3
sed -i "8c${CON1}" $FILE4
sed -i "9c${CON2}" $FILE4
sed -i "8c${CON1}" $FILE5
sed -i "9c${CON2}" $FILE5
