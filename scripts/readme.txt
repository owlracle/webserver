--- CONJOBS ---

export VISUAL=nano

0 */6 * * * /home/owlracle/scripts/backup_database_keys.sh
0 3 * * 1 /home/owlracle/scripts/backup_database_requests.sh
0 2 * * * /home/owlracle/scripts/backup_database_history.sh


--- Make Nginx listen to node port ---

Webserver settings -> Webserver Domain Conf
Domains -> owlracle.info -> Edit
Select 'nginx -> proxy (custom port)'
On 'Nginx default vhost template' choose 'force-https-https2'
Select port
Check 'Rebuild vhosts'
Save

Now use pm2 to start server
Dont forget to make pm2 restart on boot


--- Remove www from url ---

Webserver settings -> Webserver Conf Editor
/etc/nginx/conf.d/vhosts -> choose ssl version of the domain -> Edit

server {
	listen 45.77.118.47:443 ssl http2;
	server_name         www.example.com;
	ssl_certificate      path to ssl cert (can copy from existing config);
	ssl_certificate_key  path to ssl cert (can copy from existing config);
	ssl_protocols TLSv1.2;
	return              301 https://example.com$request_uri;
}
