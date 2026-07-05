# 미러온 배포 가이드 — GitHub + Netlify + Firebase

> 목표: 누구든 어디서나 쓸 수 있는 인터넷 주소(`https://내이름.netlify.app`)로 배포하기.
> 세 곳 모두 **무료**입니다. 순서대로 따라 하면 30분이면 끝나요.

---

## 1단계. Firebase 만들기 (기기 연결 담당)

1. https://console.firebase.google.com 접속 → **프로젝트 만들기**
   - 이름: `mirroron` (아무거나) → Google 애널리틱스는 **꺼도 됨** → 만들기
2. 왼쪽 메뉴 **빌드 → Realtime Database** → **데이터베이스 만들기**
   - 위치: `싱가포르(asia-southeast1)` 권장 → **테스트 모드로 시작** 선택 → 사용 설정
   - ⚠️ "테스트 모드"는 30일 후 잠깁니다. 아래 3단계에서 규칙을 넣으면 계속 쓸 수 있어요.
3. 왼쪽 위 **⚙️ → 프로젝트 설정** → 아래로 스크롤 → **내 앱** → **웹 아이콘(`</>`)** 클릭
   - 앱 닉네임: `mirroron-web` → 등록
   - 나오는 `firebaseConfig` 값 7개를 복사해 둡니다 (아래 2단계에서 사용):
     ```
     apiKey, authDomain, databaseURL, projectId,
     storageBucket, messagingSenderId, appId
     ```
   - ⚠️ `databaseURL`이 안 보이면, Realtime Database를 먼저 만들어야 나옵니다.

### 보안 규칙 (Realtime Database → 규칙 탭에 붙여넣고 게시)
```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true
      }
    },
    "signals": {
      "$channel": {
        ".read": true,
        ".write": true,
        ".indexOn": ["at"]
      }
    }
  }
}
```
> 룸 코드(6자리)를 아는 사람만 접근하는 구조라 MVP엔 충분합니다.
> ⚠️ `signals`의 `.indexOn: ["at"]`는 **필수**입니다(없으면 시그널 조회가 느리고 경고가 떠요).
> 폰 앱은 로그인 없이 시그널을 쓰기 때문에 규칙을 `true`로 둡니다(웹은 구글 로그인으로 별도 게이트).

### 구글 로그인 켜기 (Authentication)
1. 콘솔 왼쪽 **빌드 → Authentication → 시작하기**
2. **Sign-in method** 탭 → **Google** 선택 → **사용 설정** → 지원 이메일 선택 → 저장
3. **Settings → 승인된 도메인**에 배포 주소 추가 (예: `mirroring-6f315.netlify.app`)
   - `localhost`는 기본 포함이라 로컬 테스트는 바로 됩니다.

---

## 2단계. GitHub에 올리기

```bash
cd /Users/heoujin/mirroring
git init
git add .
git commit -m "미러온 v3 - Firebase 시그널링"
```
그다음 https://github.com/new 에서 빈 저장소 `mirroron` 생성 → 안내대로:
```bash
git remote add origin https://github.com/<내계정>/mirroron.git
git branch -M main
git push -u origin main
```

---

## 3단계. Netlify 배포

1. https://app.netlify.com → **Add new site → Import an existing project** → GitHub 연결 → `mirroron` 선택
2. 빌드 설정은 `netlify.toml`이 자동 인식합니다. 그대로 **Deploy**.
3. **Site configuration → Environment variables** 에서 아래를 입력 (1단계 값):
   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | (firebaseConfig.apiKey) |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (authDomain) |
   | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | (databaseURL) |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | (projectId) |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (storageBucket) |
   | `NEXT_PUBLIC_FIREBASE_SENDER_ID` | (messagingSenderId) |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | (appId) |
   | `NEXT_PUBLIC_APP_URL` | `https://<사이트이름>.netlify.app` |
4. 값 입력 후 **Deploys → Trigger deploy → Deploy site** (환경변수 반영 위해 재배포).
5. 사이트 이름 바꾸기: **Site configuration → Change site name** → 예: `mirroron` → 주소가 `https://mirroron.netlify.app`

---

## 4단계. 확인

1. 컴퓨터 브라우저에서 `https://<사이트>.netlify.app` → **[다른 기기 화면 보기]** → 숫자 6개 표시
2. 폰: 미러온 **앱** → 숫자 6개 + 주소칸에 `<사이트>.netlify.app` (포트 없이!) → **[화면 보여주기 시작]**
3. 컴퓨터에 폰 화면이 뜨면 성공 🎉

> 앱은 입력한 주소에서 Firebase 설정을 자동으로 받아옵니다 — 앱을 다시 설치할 필요 없어요.

---

## 문제 해결
| 증상 | 원인/해결 |
|---|---|
| 폰 앱에서 "PC를 찾지 못했어요" | 주소칸 오타. `netlify.app`까지 정확히, 포트(`:3000`)는 빼세요 |
| 연결은 되는데 화면이 안 나옴 | Firebase 규칙 미게시 → 3단계 규칙 다시 게시 |
| "번호가 맞지 않아요" | 컴퓨터의 새 숫자로 다시. 코드는 10분 후 만료 |
| 빌드 실패 | Netlify 로그에서 Node 버전 확인 (`netlify.toml`이 20으로 지정) |

## 비용/한도 (무료 티어)
- **Firebase RTDB**: 동시접속 100, 저장 1GB, 다운로드 10GB/월 — 시그널링은 아주 작아 충분
- **Netlify**: 100GB/월 대역폭, 300분 빌드 — 충분
- **TURN(openrelay)**: 공개 무료. 트래픽 많아지면 전용 TURN 권장(`TURN_API_KEY`)
