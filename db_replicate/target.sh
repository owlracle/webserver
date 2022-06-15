# ONLY RUN THIS SCRIPT ON THE TARGET SERVER, AND AFTER RUNNING source.sh ON THE SOURCE SERVER

# Before start this, make sure to set this fields in config.json:
# mysql.replicate.enabled = true
# mysql.replicate.saveUpdates = false
# mysql.replicate.writeLocal = true

echo "Unzipping zip file"
unzip owlracle.sql.zip

echo "Importing sql dump file to local database"
mysql -u root --database owlracle_db < owlracle.sql
rm -f owlracle.sql*

echo "Restarting target app"
pm2 restart owlracle