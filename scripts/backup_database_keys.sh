##!/bin/bash

DATA=`date +%Y-%m-%d-%H-%M`

mysqldump owlracle_db api_keys networks credit_recharges > keys-$DATA.sql
gzip keys-$DATA.sql
rclone copy keys-$DATA.sql.gz gdrive:/1NOSYNC/owlracle_backup/
rm -rf keys-$DATA.sql.gz

