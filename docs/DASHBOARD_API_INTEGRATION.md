# Dashboard 서버 조회 연결 — 2단계

## 적용 기준과 범위

- Front `099fba0ad26bbac29896d88b1ffc9d3273f581ab`의 Records 연동 다음 단계다.
- 브랜치: `feature/taxcheck-dashboard-records-api`.
- `/dashboard`의 실입금 합계, 최신 PayCheck/TaxCheck/ExitCheck, 최근 기록을 연결한다.
- 기존 카드 배치, Navbar, 프로필·캘린더 연동은 유지한다.
- Records 화면이나 기존 저장 상세 동작은 바꾸지 않는다.
- 공통 `services/api.ts`, 전역 상태, TaxCheck 입력 화면, OCR, 백엔드는 수정하지 않는다.
- `GET /api/dashboard?userId=1`만 추가한다. 분석·저장·초기화 API를 호출하지 않는다.

계약 근거:
[Backend Dashboard/Records 구현 문서](https://github.com/Foreign-In-One/Backend/blob/a9ff1aa4cba36974941b7edf7943a48ef1f88a26/docs/DASHBOARD_RECORDS_IMPLEMENTATION.md).

## 데이터 표시 규칙

1. 서버가 현재 한국 연도를 선택하며 화면은 응답 `year`를 사용한다.
2. `paySummary.totalReceivedPay`는 해당 급여 연도에 **기록된 실입금 합계**다.
   모든 근무 월을 수집했다는 의미가 아니며 세전 소득·세액·예상 연봉으로 표시하지 않는다.
3. 등록된 월 수와 금액 확인된 월 수를 구분한다. 등록은 됐지만 금액이 없는 월만
   미확인 목록에 표시한다. 미등록 월을 임의로 채우지 않는다.
4. 데이터 없음과 금액 미확인은 구분하며 확인된 0원과 소수점 금액을 보존한다.
5. 최신 결과·최근 3건은 전체 연도 기준이다. 서버 순서를 바꾸지 않고 각 기록의
   급여월/귀속연도/예상 출국일을 표시한다. 날짜에 임의 UTC 변환을 적용하지 않는다.
6. 세금 적용 항목 수, 출국 준비 완료 개수, 새로운 AI 조언은 생성하지 않는다.
   API가 제공한 저장 요약과 다음 행동만 표시한다.
7. 로딩·API 오류·진짜 빈 데이터는 별도 화면이다. 오류에는 재시도가 있고,
   갱신 중에는 이전 응답을 최신 응답인 것처럼 보여주지 않는다.
8. 한국어·영어·베트남어·중국어 UI를 지원한다. 저장된 분석 원문은 자동 번역하지 않는다.

조회 서비스는 Records와 같은 응답 계약을 쓰므로 `services/records-api.ts`에
타입, Dashboard 검증, `getDashboardApi`만 추가했다. 기존 Records 조회 함수는 유지한다.

## 실행·검사

Front `.env.local`의 기존 설정을 유지한다. 다른 키를 지우거나 파일을 커밋하지 않는다.

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18080
```

```text
pnpm exec biome check app/dashboard/page.tsx app/dashboard/dashboard-copy.ts services/records-api.ts tests/dashboard-api.test.mjs tests/dashboard-page.test.mjs
node --test tests/records-api.test.mjs tests/dashboard-api.test.mjs tests/dashboard-page.test.mjs
pnpm build
```

Windows에서 CRLF 포맷 오류가 나면 위 5개 파일에만
`pnpm exec biome format --write`를 실행한 뒤 다시 검사한다. 전체 저장소 포맷,
Husky 우회, 전역 Git 설정 변경은 필요하지 않다.

테스트는 기존 Records 38개, Dashboard API·표시 함수 51개,
Dashboard 격리 렌더링 7개로 총 96개다. 새 패키지를 설치하지 않는다.
격리 렌더링 검사는 실제 페이지 소스에 준비된 상태와 공통 컴포넌트 대역을 넣어
HTML을 검사한다. 브라우저 클릭·CSS 배치·실제 API 통신을 검증하는 E2E는 아니다.

## 노트북에서 확인

1. 기존 `Backend-integration-check` 서버(18080)를 계속 실행한다.
2. Front에서 `pnpm dev`를 실행하고 터미널의 Local 주소에 `/dashboard`를 붙인다.
   3000과 3001을 모두 띄울 필요는 없다.
3. 앞서 확인한 가상 데이터가 그대로라면 2026년 합계 2,380,000원,
   등록 1개월·금액 확인 1개월이 표시돼야 한다.
4. 최신 급여는 2026-07, 최신 세금은 귀속연도 2026이며 저장된 설명이 나와야 한다.
5. ExitCheck 기록이 없으면 없다는 안내가 나와야 한다. 프로필에 출국일이 있다면
   기존 출국일 배지는 남을 수 있으며, 이는 ExitCheck 분석 기록 존재 여부와 별개다.
6. 최근 기록은 `TAX_CHECK:1`, `PAYCHECK:1` 순서의 2건이어야 한다.
7. 페이지 새로고침과 화면 새로고침 버튼 후에도 서버 데이터가 표시돼야 한다.
8. `/records`의 목록, 필터, 저장 세금 상세도 그대로 작동하는지 확인한다.

데이터가 그동안 추가/변경됐다면 실제 값은 달라질 수 있다. 테스트를 위해
데모 초기화 버튼, DB 삭제, 실제 문서 업로드를 사용하지 않는다.

## 남은 범위

- TaxCheck 입력/분석 화면의 서버 저장 연결은 다음 단계다. 브라우저 전용 TaxCheck
  결과는 이번 Dashboard나 Records에 자동 업로드되지 않는다.
- 프로필·캘린더는 기존 전역 상태와 API를 사용하며 그 경로의 목업 정책은 그대로다.
  대시보드 급여·분석 결과의 무폴백 정책과 구분해야 한다.
- 기본 신원은 공유 데모 사용자 1이다. 로그인·개인 데이터 보호 기능이 아니다.
- 공개 서버의 백엔드 PR 반영, 배포 환경 DB 호환성, 실제 URL 연결은 별도 확인한다.
- Front 최신 dev의 변경도 PR 전 별도로 통합하고 재검사해야 한다.
  이 패치는 Records 커밋 위에 적용하는 변경이며 dev 병합을 수행하지 않는다.

작성 환경에서는 변경 파일 Biome, TypeScript/프로덕션 빌드, 96개 테스트를 검사한다.
사용자 노트북의 MySQL 서버와 브라우저에는 직접 접근할 수 없으므로 위 수동
확인은 패치 적용 뒤 사용자가 진행해야 한다. GitHub PR 생성·머지·배포는 수행하지 않는다.
