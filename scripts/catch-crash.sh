#!/bin/bash
# 폰 USB 연결 + USB 디버깅 ON 상태에서 실행 → 앱 크래시 네이티브 스택 캡처
ADB=$HOME/Library/Android/sdk/platform-tools/adb
echo "폰 연결을 기다리는 중… (USB 디버깅 허용 팝업이 폰에 뜨면 [허용])"
$ADB wait-for-device
echo "연결됨: $($ADB devices | tail -n +2)"
$ADB logcat -c   # 기존 로그 비우기
echo ""
echo ">>> 이제 폰에서 미러온 앱을 열고 [화면 보여주기 시작]을 눌러 크래시를 재현하세요 <<<"
echo ">>> 크래시 후 이 창의 로그를 복사해서 붙여넣어 주세요 (Ctrl+C로 종료) <<<"
echo ""
$ADB logcat -v time \
  AndroidRuntime:E libc:F DEBUG:F \
  org.webrtc:V MirrorOn:V ScreenCastService:V mirroron:V \
  System.err:W *:F
