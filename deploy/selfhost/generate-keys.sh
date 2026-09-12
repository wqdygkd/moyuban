#!/bin/sh
#
# 为自托管 Supabase（裁剪版）生成密钥与传统 HS256 API Key。
# 生成：JWT_SECRET、ANON_KEY、SERVICE_ROLE_KEY、POSTGRES_PASSWORD、
#       DASHBOARD_PASSWORD、PG_META_CRYPTO_KEY，并写入当前目录 .env
#
# 用法：
#   sh generate-keys.sh              # 只打印密钥
#   sh generate-keys.sh --update-env # 打印并写入 .env（已有值会被覆盖，原文件备份为 .env.old）
#
# 依赖：openssl
#
# 生成逻辑改编自官方 docker/utils/generate-keys.sh，
# 官方脚本部分代码源自 Inder Singh 的 setup.sh（Apache License 2.0）：
# https://github.com/singh-inder/supabase-automated-self-host/blob/main/setup.sh
#

set -e

gen_hex() {
    openssl rand -hex "$1"
}

gen_base64() {
    openssl rand -base64 "$1"
}

base64_url_encode() {
    openssl enc -base64 -A | tr '+/' '-_' | tr -d '='
}

gen_token() {
    payload=$1
    payload_base64=$(printf %s "$payload" | base64_url_encode)
    header_base64=$(printf %s "$header" | base64_url_encode)
    signed_content="${header_base64}.${payload_base64}"
    signature=$(printf %s "$signed_content" | openssl dgst -binary -sha256 -hmac "$jwt_secret" | base64_url_encode)
    printf '%s' "${signed_content}.${signature}"
}

if ! command -v openssl >/dev/null 2>&1; then
    echo "错误：需要 openssl。"
    exit 1
fi

update_env=false
for arg in "$@"; do
    case $arg in
        --update-env) update_env=true ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

jwt_secret="$(gen_base64 30)"
postgres_password="$(gen_hex 16)"
dashboard_password="$(gen_base64 18 | tr -d '/+=' )"
pg_meta_crypto_key="$(gen_base64 24 | tr -d '/=')"

# 用于 gen_token()
header='{"alg":"HS256","typ":"JWT"}'
iat=$(date +%s)
exp=$((iat + 5 * 3600 * 24 * 365)) # 5 年

anon_key=$(gen_token "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")
service_role_key=$(gen_token "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")

echo "================================================================="
echo "JWT_SECRET=${jwt_secret}"
echo ""
echo "ANON_KEY=${anon_key}"
echo ""
echo "SERVICE_ROLE_KEY=${service_role_key}"
echo ""
echo "POSTGRES_PASSWORD=${postgres_password}"
echo ""
echo "DASHBOARD_PASSWORD=${dashboard_password}"
echo ""
echo "PG_META_CRYPTO_KEY=${pg_meta_crypto_key}"
echo "================================================================="

if [ "$update_env" != "true" ]; then
    exit 0
fi

if [ ! -f .env ]; then
    echo "错误：当前目录没有 .env，请先执行: cp .env.example .env"
    exit 1
fi

echo "正在写入 .env ..."

sed \
    -i.old \
    -e "s|^JWT_SECRET=.*$|JWT_SECRET=${jwt_secret}|" \
    -e "s|^ANON_KEY=.*$|ANON_KEY=${anon_key}|" \
    -e "s|^SERVICE_ROLE_KEY=.*$|SERVICE_ROLE_KEY=${service_role_key}|" \
    -e "s|^POSTGRES_PASSWORD=.*$|POSTGRES_PASSWORD=${postgres_password}|" \
    -e "s|^DASHBOARD_PASSWORD=.*$|DASHBOARD_PASSWORD=${dashboard_password}|" \
    -e "s|^PG_META_CRYPTO_KEY=.*$|PG_META_CRYPTO_KEY=${pg_meta_crypto_key}|" \
    .env

echo "完成。原文件已备份为 .env.old"
