##!/bin/bash

DATA=`date +%Y-%m-%d-%H-%M`

mysqldump owlracle_db price_history > history-$DATA.sql
gzip history-$DATA.sql
rclone copy history-$DATA.sql.gz gdrive:/1NOSYNC/owlracle_backup/
rm -rf history-$DATA.sql.gz

