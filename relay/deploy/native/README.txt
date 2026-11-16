Ailo 云端中转服务（不包含电脑端 Ailo）

适用：Ubuntu + systemd，已安装 Node.js >=22。
1. 将 ailo-relay-deploy.tar.gz 上传到服务器 /root。
2. 运行：
   mkdir -p /root/ailo-relay-deploy
   tar -xzf /root/ailo-relay-deploy.tar.gz -C /root/ailo-relay-deploy
   bash /root/ailo-relay-deploy/install.sh
3. 查看：systemctl status ailo-relay --no-pager
   日志：journalctl -u ailo-relay -n 50 --no-pager

脚本仅管理 ailo-relay 服务；不停止或修改 OpenClaw，不开放防火墙端口，不配置公网HTTPS。
首次生成密钥保存 /etc/ailo-relay/relay.env，后续安装复用。
状态数据位于 /var/lib/ailo-relay；请保护、备份这些目录，不公开其中内容。
更新前应暂停新任务投递，备份专用数据目录及密钥；不要清空数据或重复注册电脑来解决连接错误。
停用：systemctl disable --now ailo-relay（保留数据和配置）。
正式公网使用仍需可信HTTPS反向代理。没有完成证书与外网验收前，不能算部署完成。
本包仅经过本地回归与脚本语法检查，尚未在你的服务器执行验收。
