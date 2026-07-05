#!/bin/bash
# HTTPS 개발서버 — 폰(모바일 브라우저)은 HTTPS가 아니면 카메라/화면공유를 차단하므로 필수.
# 현재 Wi-Fi IP를 SAN에 포함한 자체 서명 인증서를 만들어 next dev에 물린다.
# (mkcert -install과 달리 sudo 불필요. 폰에서는 최초 1회 "고급 → 계속" 승인만 하면 됨)
set -e
cd "$(dirname "$0")/.."

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
CERT_DIR=certificates
CERT="$CERT_DIR/dev-cert.pem"
KEY="$CERT_DIR/dev-key.pem"
IP_MARKER="$CERT_DIR/.last-ip"

mkdir -p "$CERT_DIR"

# IP가 바뀌었거나 인증서가 없으면 재생성
if [ ! -f "$CERT" ] || [ "$(cat "$IP_MARKER" 2>/dev/null)" != "$IP" ]; then
  echo "🔐 인증서 생성 중 (SAN: localhost, 127.0.0.1, $IP)"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
    -keyout "$KEY" -out "$CERT" \
    -subj "/CN=mirroron-dev" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP" 2>/dev/null
  echo "$IP" > "$IP_MARKER"
fi

echo ""
echo "  PC:  https://localhost:3000"
echo "  폰:  https://$IP:3000   ← 같은 Wi-Fi에서 접속 (최초 1회 인증서 경고 → 고급 → 계속)"
echo ""

exec npx next dev --experimental-https \
  --experimental-https-key "$KEY" \
  --experimental-https-cert "$CERT"
