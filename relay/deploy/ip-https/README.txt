Ailo IP HTTPS安装包

先在腾讯云控制台防火墙放行TCP 80和443，保持8787不对公网开放。
将压缩包上传到服务器/root，然后运行：
 mkdir -p /root/ailo-ip-https
 tar -xzf /root/ailo-ip-https.tar.gz -C /root/ailo-ip-https
 bash /root/ailo-ip-https/install-https.sh 175.24.135.20

脚本安装Nginx与独立Certbot，IP证书采用Let's Encrypt shortlived配置，有效约6天，systemd每6小时检查续期。
申请时请自行阅读并确认Certbot的服务条款与邮箱提示；脚本不自动代为接受条款。
不停止或修改OpenClaw，不自动改云防火墙。发现已有80/443服务会停止，避免覆盖。
证书或网络失败时会报错；不会使用自签证书或跳过TLS验证来冒充成功。
独立ACME配置：/etc/ailo-relay/acme；续期日志：journalctl -u ailo-cert-renew。
部署后从电脑执行：curl -i https://175.24.135.20/v1/status，预期401。
服务器续期演练：
 /opt/ailo-certbot/bin/certbot renew --dry-run --config-dir /etc/ailo-relay/acme --work-dir /var/lib/ailo-certbot --logs-dir /var/log/ailo-certbot
这一步不会替代真实续期后的Nginx加载检查。
本包经过脚本语法和本地回归检查，未在你的服务器上执行或获得证书。
