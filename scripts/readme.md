# Install git v2+

https://computingforgeeks.com/how-to-install-latest-version-of-git-git-2-x-on-centos-7/

```
yum -y install https://packages.endpointdev.com/rhel/7/os/x86_64/endpoint-repo.x86_64.rpm

sudo yum install git
```

# CWP connection refused to enter admin panel

```
sh /usr/local/cwpsrv/htdocs/resources/scripts/generate_hostname_ssl
```

# CONJOBS

```
export VISUAL=nano

0 */6 * * * /home/owlracle/scripts/backup_database_keys.sh
0 3 * * 1 /home/owlracle/scripts/backup_database_requests.sh
0 2 * * * /home/owlracle/scripts/backup_database_history.sh
```

# Make Nginx listen to node port

* Webserver settings -> Webserver Domain Conf
* Domains -> owlracle.info -> Edit
* Select 'nginx -> proxy (custom port)'
* On 'Nginx default vhost template' choose 'force-https-https2'
* Select port
* Check 'Rebuild vhosts'
* Save

Now use pm2 to start server. Dont forget to make pm2 restart on boot.

# Remove www from url

* Webserver settings -> Webserver Conf Editor
* /etc/nginx/conf.d/vhosts -> choose ssl version of the domain -> Edit

```
server {
    listen 45.77.118.47:443 ssl http2;
    server_name         www.example.com;
    ssl_certificate      path to ssl cert (can copy from existing config);
    ssl_certificate_key  path to ssl cert (can copy from existing config);
    ssl_protocols TLSv1.2;
    return              301 https://example.com$request_uri;
}
```
# Backup and restore database

## Backup 

```
mysqldump [database_name] > [filename].sql
```

## Restore

* Create database

```
mysql
> use [db_name]
> source [filename.sql]
```

## Change timezone to UTC

```
sudo timedatectl set-timezone UTC
```

## Fetch old blocks

* Run `history.js` from oracle workspace. Check file to see args. It will build files for blocks.

```
node history.js -n ethereum -s 4 -t 35 -b 8787668
```

* Run app.js with `-o NETWORK FROMBLOCK` args. It will request oracle files and insert into db.

```
node app.js -o eth 8787668
```