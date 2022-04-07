# ONLY RUN THIS SCRIPT ON THE SOURCE SERVER

# Before start this, make sure to set this fields in config.json:
# mysql.replicate.enabled = true
# mysql.replicate.saveUpdates = true
# mysql.replicate.writeLocal = false

echo "Restarting source app"
pm2 restart owlracle

echo "Dumping database"
mysqldump owlracle_db > owlracle.sql

echo "Zipping sql file"
zip owlracle.sql.zip owlracle.sql

echo "Copying zip to target server"
scp owlracle.sql.zip root@191.252.191.90:/home/webserver
rm -f owlracle.sql*

echo "DONE! Now run target.sh on the target server."