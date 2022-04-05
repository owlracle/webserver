# Turn on saveUpdates

Reload source app with ```mysql.replicate.enabled``` and ```mysql.replicate.saveUpdates``` to ```true```.

Every request will now be saved.

# Backup old database

```
mysqldump owlracle_db > owlracle.sql
```

# Zip dump file (for faster ftp transport)

```
zip owlracle.sql.zip owlracle.sql
```

# Transfer database

Download form source, then upload zip to target server.

Use an ftp server, for time saving.

# Restore backup

```
unzip owlracle.sql.zip ./
```

Import back from file.

```
> mysql
> use owlracle_db
> source owlracle.sql
```

# Load app in the target server

Must have ```mysql.replicate.enabled``` and ```mysql.replicate.writeLocal``` set to ```true```.
```
pm2 restart owlracle
```

Target app will start to call endpoint and consume content from source array, and use those queries to bring the database up to date.