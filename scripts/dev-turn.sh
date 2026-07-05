#!/bin/bash
# 개발용 로컬 TURN 릴레이 (coturn)
# 같은 Wi-Fi인데도 P2P가 막히는 환경(VPN, 공유기 클라이언트 격리, 회사망)에서
# 미디어를 PC(개발서버 머신) 경유로 릴레이해 연결을 보장한다.
# 폰이 이 PC의 3000 포트(개발서버)에 접속된다면 3478 릴레이도 동일하게 도달 가능.
set -e

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
TURNSERVER=$(which turnserver || echo /opt/homebrew/bin/turnserver)

if [ ! -x "$TURNSERVER" ]; then
  echo "coturn이 없어요 → brew install coturn"
  exit 1
fi

echo "🔁 로컬 TURN 릴레이 시작: turn:$IP:3478 (udp/tcp) — user: mirroron"

exec "$TURNSERVER" \
  --listening-ip 0.0.0.0 \
  --relay-ip "$IP" \
  --external-ip "$IP" \
  --listening-port 3478 \
  --min-port 49160 --max-port 49260 \
  --lt-cred-mech \
  --user mirroron:mirroron-dev-2026 \
  --realm mirroron.local \
  --no-tls --no-dtls \
  --no-cli \
  --fingerprint \
  --log-file stdout \
  --simple-log
