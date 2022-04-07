# Server migration

First you will need to replicate the database, mirroring every change on the **source** to the **target** server. Follow the steps below for that part.

After that, you will redirect requests through dns. After dns propagation, you will see **source** database no longer receives updates. Then you can switch off the db replication.

You can use `source.sh` and `target.sh` scripts or you could follow the each step manually.

Note that if useing the automated scripts method, you should still manually update the `config.json` as in the *Turn on saveUpdates* and *Load app in the target server* sections.

## Turn on saveUpdates

Reload source app with `mysql.replicate.enabled` and `mysql.replicate.saveUpdates` to `true`.

Every request will now be saved.

## Backup old database

```
mysqldump owlracle_db > owlracle.sql
```

## Zip dump file (for faster file transfer)

```
zip owlracle.sql.zip owlracle.sql
```

## Transfer database

Copy zip file from source to target server.

```
scp owlracle.sql.zip root@191.252.191.90:/home/webserver
```

## Restore backup

```
unzip owlracle.sql.zip
```

Import back from file.

```
> mysql
> use owlracle_db
> source owlracle.sql
```

## Review Firewall rules

Make sure both **source** and **target** have each other allowed in their firewall rules.

CWP's Firewall section > Whitelist Configuration > Add an Entry.

## Load app in the target server

Must have `mysql.replicate.enabled` and `mysql.replicate.writeLocal` set to `true`.
```
pm2 restart owlracle
```

Target app will start to call endpoint and consume content from source array, and use those queries to bring the database up to date.

## Redirect requests

Have the **target** server nginx setup for the coming requests.

Go to the domain provider, and update nameserver **A** entry to reflect the **target** server ip.

Create SSL certif on **target** CWP.

Requests will be redirected as DNS propagates.

When no more updates are noticed on **source** database, you can switch off migration.