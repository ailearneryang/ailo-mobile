#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo '请使用 root 或 sudo 运行此脚本'; exit 1; fi
bundle_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
node_bin="$(command -v node || true)"
if [ -z "$node_bin" ]; then echo '需要先安装 Node.js 22 或更高版本'; exit 1; fi
"$node_bin" -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo '需要 Node.js 22 或更高版本'; exit 1; }
command -v systemctl >/dev/null
if ! systemctl is-active --quiet ailo-relay; then
 if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)8787$'; then echo '8787 已被其他服务占用，未安装或停止其他服务'; exit 1; fi
fi
if ! id ailo-relay >/dev/null 2>&1; then useradd --system --home-dir /var/lib/ailo-relay --shell /usr/sbin/nologin ailo-relay; fi
install -d -m 0755 /opt/ailo-relay /opt/ailo-relay/bin
install -d -m 0700 /etc/ailo-relay
install -d -m 0700 -o ailo-relay -g ailo-relay /var/lib/ailo-relay
# Copy the installed trusted runtime out of /root/.nvm; the service cannot access /root.
install -m 0755 "$node_bin" /opt/ailo-relay/bin/node.new
mv /opt/ailo-relay/bin/node.new /opt/ailo-relay/bin/node
if [ -f /opt/ailo-relay/server.cjs ]; then cp -p /opt/ailo-relay/server.cjs "/opt/ailo-relay/server.cjs.backup-$(date +%Y%m%d%H%M%S)"; fi
install -m 0644 "$bundle_dir/server.cjs" /opt/ailo-relay/server.cjs
if [ ! -f /etc/ailo-relay/relay.env ]; then
 umask 077
 /opt/ailo-relay/bin/node -e 'const fs=require("fs"),crypto=require("crypto");fs.writeFileSync("/etc/ailo-relay/relay.env","AILO_RELAY_BOOTSTRAP="+crypto.randomBytes(32).toString("hex")+"\n",{mode:0o600,flag:"wx"})'
fi
cat > /etc/systemd/system/ailo-relay.service <<'UNIT'
[Unit]
Description=Ailo cloud connection relay
After=network.target
[Service]
Type=simple
User=ailo-relay
Group=ailo-relay
WorkingDirectory=/opt/ailo-relay
EnvironmentFile=/etc/ailo-relay/relay.env
Environment=HOST=127.0.0.1 PORT=8787 AILO_RELAY_DATA=/var/lib/ailo-relay
ExecStart=/opt/ailo-relay/bin/node /opt/ailo-relay/server.cjs
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/ailo-relay
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable ailo-relay
systemctl restart ailo-relay
sleep 2
systemctl is-active --quiet ailo-relay || { journalctl -u ailo-relay -n 20 --no-pager; exit 1; }
/opt/ailo-relay/bin/node -e 'fetch("http://127.0.0.1:8787/v1/status",{signal:AbortSignal.timeout(5000)}).then(r=>{if(r.status!==401)throw Error("unexpected health response");console.log("Ailo 云端中转已运行，仅监听 127.0.0.1:8787；HTTPS 尚未配置，尚不能从手机公网连接。")}).catch(e=>{console.error(e.message);process.exitCode=1})'
