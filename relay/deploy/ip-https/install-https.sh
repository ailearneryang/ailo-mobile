#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo '请使用root运行'; exit 1; }
ip="${1:-175.24.135.20}"
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo '请输入IPv4地址'; exit 1; }
/opt/ailo-relay/bin/node -e 'if(require("net").isIP(process.argv[1])!==4)process.exit(1)' "$ip"
systemctl is-active --quiet ailo-relay || { echo '中转服务尚未运行'; exit 1; }
conf=/etc/nginx/conf.d/ailo-relay-ip.conf
if [ ! -f "$conf" ] && ss -lntH | awk '{print $4}' | grep -Eq '(^|:)(80|443)$'; then
 echo '80或443已被现有服务占用，未做修改，请先检查'; exit 1
fi
echo '请确认腾讯云防火墙已放行TCP 80和443；8787保持不开放。'
echo '证书申请过程中请自行阅读并回答Certbot条款和邮箱提示。'
apt-get update
apt-get install -y nginx python3-venv ca-certificates
install -d -m 0755 /var/www/ailo-acme /opt/ailo-certbot
install -d -m 0700 /etc/ailo-relay/acme /var/lib/ailo-certbot /var/log/ailo-certbot
if [ ! -x /opt/ailo-certbot/bin/certbot ]; then
 python3 -m venv /opt/ailo-certbot
 /opt/ailo-certbot/bin/pip install --upgrade pip
 /opt/ailo-certbot/bin/pip install 'certbot>=5.4,<6'
fi
help_text="$(/opt/ailo-certbot/bin/certbot --help all)"
grep -q -- '--ip-address' <<< "$help_text" || { echo 'Certbot不支持IP证书，请检查版本'; exit 1; }
if [ -f "$conf" ]; then cp -p "$conf" "$conf.backup-$(date +%Y%m%d%H%M%S)"; fi
# For first issue, expose only the ACME webroot. Never proxy private traffic over HTTP.
if [ ! -f "/etc/ailo-relay/acme/live/$ip/fullchain.pem" ]; then
 cat > "$conf" <<NGINX
server {
 listen 80;
 server_name $ip;
 location ^~ /.well-known/acme-challenge/ { root /var/www/ailo-acme; }
 location / { return 404; }
}
NGINX
 nginx -t
 systemctl enable --now nginx
 systemctl reload nginx
fi
/opt/ailo-certbot/bin/certbot certonly --config-dir /etc/ailo-relay/acme --work-dir /var/lib/ailo-certbot --logs-dir /var/log/ailo-certbot --preferred-profile shortlived --webroot --webroot-path /var/www/ailo-acme --ip-address "$ip" --cert-name "$ip"
cat > "$conf" <<NGINX
server {
 listen 80;
 server_name $ip;
 location ^~ /.well-known/acme-challenge/ { root /var/www/ailo-acme; }
 location / { return 301 https://$ip\$request_uri; }
}
server {
 listen 443 ssl;
 server_name $ip;
 ssl_certificate /etc/ailo-relay/acme/live/$ip/fullchain.pem;
 ssl_certificate_key /etc/ailo-relay/acme/live/$ip/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 client_max_body_size 6m;
 location / {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-Proto https;
  proxy_connect_timeout 10s;
  proxy_read_timeout 30s;
 }
}
NGINX
nginx -t
systemctl enable --now nginx
systemctl reload nginx
cat > /opt/ailo-certbot/reload-nginx.sh <<'HOOK'
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/bin/systemctl reload nginx
HOOK
chmod 0755 /opt/ailo-certbot/reload-nginx.sh
cat > /etc/systemd/system/ailo-cert-renew.service <<'UNIT'
[Unit]
Description=Renew Ailo IP HTTPS certificate
After=network-online.target nginx.service
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/ailo-certbot/bin/certbot renew --non-interactive --quiet --config-dir /etc/ailo-relay/acme --work-dir /var/lib/ailo-certbot --logs-dir /var/log/ailo-certbot --deploy-hook /opt/ailo-certbot/reload-nginx.sh
UNIT
cat > /etc/systemd/system/ailo-cert-renew.timer <<'UNIT'
[Unit]
Description=Check Ailo certificate renewal every 6 hours
[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now ailo-cert-renew.timer
# Validate against the public trust store; never use curl -k.
status="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' --resolve "$ip:443:127.0.0.1" "https://$ip/v1/status")"
[ "$status" = 401 ] || { echo "HTTPS检查未通过，响应码：$status"; exit 1; }
echo "服务器本机HTTPS检查通过：https://$ip/v1/status 返回401（未配对）。"
echo '自动续期已配置。仍需从电脑外网检查HTTPS及续期演练，不能仅凭本机检查认定公网已通。'
echo '请勿公开/etc/ailo-relay或/var/lib/ailo-relay中的密钥与数据。'
