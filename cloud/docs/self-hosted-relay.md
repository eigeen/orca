# 自建 Orca Relay

此模式把 director 和 cell 运行在同一个进程，默认用 SQLite。桌面和手机都主动连接同一个 HTTPS 地址，配对和端到端加密沿用 Orca 协议。服务器使用独立凭据签发短期桌面注册令牌。手机通过二维码取得自己的邀请凭据。

## 部署服务

在 Linux 服务器的 Orca checkout 中安装 Node.js 24 至 26、pnpm 12 和 OpenSSL，然后执行以下命令。示例目录只应由运行 Relay 的用户访问。保留其中的密钥和 SQLite 数据用于重启与备份。

```bash
cd cloud
pnpm install --frozen-lockfile
pnpm --filter '@orca-cloud/relay...' build

umask 077
relay_dir="$HOME/.local/share/orca-relay"
mkdir -p "$relay_dir"
test -f "$relay_dir/host-token.txt" || openssl rand -hex 32 > "$relay_dir/host-token.txt"
test -f "$relay_dir/assignment-key.txt" || openssl rand -hex 32 > "$relay_dir/assignment-key.txt"
test -f "$relay_dir/signing-key.pem" || openssl genpkey -algorithm EC \
  -pkeyopt ec_paramgen_curve:prime256v1 -out "$relay_dir/signing-key.pem"

export PORT=8080
export ORCA_SELF_HOSTED_RELAY_URL=https://relay.example.com
export ORCA_SELF_HOSTED_RELAY_TOKEN_FILE="$relay_dir/host-token.txt"
export ORCA_SELF_HOSTED_RELAY_KEY_FILE="$relay_dir/signing-key.pem"
export ORCA_RELAY_ASSIGNMENT_SIGNING_KEY="$(cat "$relay_dir/assignment-key.txt")"
export ORCA_RELAY_DATA_DIR="$relay_dir/data"
node apps/relay/dist/index.js
```

Relay 监听 `127.0.0.1:8080`。用同机的 HTTPS 反向代理转发 HTTP 和 WebSocket，保持 `ORCA_SELF_HOSTED_RELAY_URL` 与客户端访问的域名一致。例如 Caddy 的配置可以是

```caddyfile
relay.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

也可把域名和 HTTPS 入口限制在 VPN 内。桌面和 Android 都要能访问该地址，并信任证书。用 `/ready` 检查 SQLite 与签发密钥是否就绪。自建模式不开放 Relay 的运维 API。

## 连接桌面和 Android

1. 通过安全通道把 `host-token.txt` 复制到桌面。它可以注册桌面，按账户凭据保管。签名私钥和分配密钥只留在服务器。
2. 在桌面打开 **设置 → 手机 → 自建 Relay**，填写 HTTPS 地址，点击 **选择凭据并保存** 并选择 `host-token.txt`，然后重启 Orca。设置保存服务器地址和本机凭据文件路径。
3. 在桌面打开 **设置 → 手机 → 自建 Relay**，确认显示的域名，生成二维码。在 Android 扫码或粘贴配对码。更换 Relay 地址时，请重新配对。
4. Android 默认按每个配对码配置地址。需要把自用 Android 构建锁定到一个 Relay 时，在运行 Expo 构建之前设置 `EXPO_PUBLIC_ORCA_RELAY_ORIGIN=https://relay.example.com`。这个变量只包含公开地址。局域网直连仍可独立使用。

自建模式不需要 Orca Cloud 登录，桌面也不会启动官方推送网关客户端。Android 在前台可通过 Relay 使用实时连接。系统后台推送需要独立的推送网关与 FCM 配置。点击 **使用官方 Relay** 并重启可切回官方 Relay。没有保存界面设置时，桌面仍读取 `ORCA_SELF_HOSTED_RELAY_URL` 和 `ORCA_SELF_HOSTED_RELAY_TOKEN_FILE`。

## 在 GitHub Actions 构建

推送 `dev/self-hosted-relay` 分支后，`Self-hosted Relay client builds` 工作流分别上传 Windows 安装器和 Android APK 到该运行的 Artifacts。APK 使用 Expo 的测试签名，Windows 安装器未签名。需要在 Android 构建中固定域名时，设置仓库变量 `ORCA_ANDROID_RELAY_ORIGIN` 后重跑。服务端和桌面的凭据通过部署时的文件配置。
