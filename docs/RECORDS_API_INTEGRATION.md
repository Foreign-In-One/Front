# Records 서버 조회 연결 — 1단계

## 범위

- `/records` 목록과 탭별 건수를 Backend에서 조회한다.
- TaxCheck 카드를 펼치면 이미 저장된 상세만 조회한다.
- 로딩, 진짜 빈 목록, 연결/HTTP/응답 오류를 분리한다. 오류에는 재시도를 제공한다.
- 15초 요청 제한과 취소 처리를 적용한다. 이전 탭 응답이 새 탭을 덮어쓰지 않는다.
- 화면 추가 문구는 기존 언어 설정(한국어·영어·베트남어·중국어)을 따른다.
  분석 문구 자체는 서버에 저장된 원문이며 자동 번역하지 않는다.
- 금액 미상은 0원으로 만들지 않는다. 서버의 기록 순서와 날짜를 보존한다.

이번 단계는 Dashboard·TaxCheck 입력 화면의 API 전환을 포함하지 않는다.
해당 화면이 아직 localStorage에 저장하는 결과는 서버 Records에 나타나지 않는다.
기존 브라우저 기록은 삭제하거나 자동으로 이전하지 않는다.
서버 삭제 API가 없으므로 Records의 로컬 삭제 버튼과 삭제 토스트는 제거했다.
목록 카드의 다시 확인 링크는 해당 기능 화면으로 이동하며 새 분석을 자동 실행하지 않는다.

## API / 의존성

- 목록: `GET /api/records?userId=1` 또는 `&type=PAYCHECK|TAX_CHECK|EXIT_CHECK`.
- 상세: `GET /api/tax-checks/{sourceId}?userId=1`.
- 요청은 GET뿐이며 쿠키 없이 전송한다. 캐시·목업·브라우저 저장소로 대체하지 않는다.
- `counts`는 필터를 바꿔도 전체 사용자 기준이다. 상세 API는 카드를 펼칠 때만 호출한다.
- API의 추가 필드는 무시하지만 사용 필드의 잘못된 타입, 모순된 건수,
  중복 키, 상세 ID 불일치, 시뮬레이션 응답은 거부한다.
- 공통 `services/api.ts`, 전역 상태, Navbar, ChatDock, OCR 코드는 수정하지 않는다.
  기존 전역 상태가 호출하는 다른 API의 목업 동작은 이번 변경 범위가 아니다.

계약 근거:

- [Backend Dashboard/Records 구현 문서](https://github.com/Foreign-In-One/Backend/blob/feature/dashboard-records/docs/DASHBOARD_RECORDS_IMPLEMENTATION.md)
- [Backend TaxCheck PR #7](https://github.com/Foreign-In-One/Backend/pull/7)

Backend PR #6·#7·#9를 합친 **로컬 통합 worktree**에서 테스트한다.
GitHub PR이 머지됐거나 공개 배포가 가능하다고 가정하지 않는다.
`userId=1`은 공용 데모 식별자이며 데이터 접근 통제를 제공하지 않는다.
실제 개인정보·문서의 공개 업로드 허용과 보안 조치는 별도 과제다.

## 로컬 연결 설정

Front 루트의 `.env.local`에서 아래 키만 추가하거나 기존 값을 수정한다.
다른 키·API 키·설정은 지우지 않는다. 파일을 커밋하지 않는다.

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18080
```

이미 존재하는 프로젝트 공통 설정 키를 재사용하므로 다른 화면의 공통 API도
같은 로컬 서버를 보게 된다. 설정 전환은 이 통합 테스트 세션에만 적용한다.
주소에 비밀정보를 넣지 않는다.

Backend는 `Backend-integration-check`에서 18080로 계속 실행한다.
Front는 `pnpm dev`로 실행하고 3000 또는 3001 포트를 사용한다.
현재 Backend CORS는 localhost/127.0.0.1의 이 두 프론트 포트를 허용한다.
다른 포트로 자동 전환되면 해당 포트에서 진행하지 말고 먼저 확인한다.

환경변수를 변경한 후 개발 서버를 재시작한다.
프로덕션 실행은 변경한 환경으로 다시 빌드한다.
[Next.js 환경변수 공식 문서](https://nextjs.org/docs/app/guides/environment-variables)

## 자동 검사

프로젝트에 이미 설치된 TypeScript와 Node 내장 테스트 러너를 사용한다.
새 패키지나 lockfile 변경은 없다.

```text
pnpm exec biome check app/records/page.tsx app/records/records-copy.ts services/records-api.ts tests/records-api.test.mjs
node --test tests/records-api.test.mjs
pnpm build
```

테스트는 외부 서버에 연결하지 않고 38개 사례를 검사한다:
종류별 조회와 전체 건수, 빈 기록, 금액 null/0, HTTP/네트워크/잘못된 JSON,
모순된 응답, 취소·시간 제한, 저장 상세 조회·형식 검증.

## 사용자 MySQL 브라우저 확인

2026-09-02에 별도 통합 DB로 확인한 가상 데이터 기준:

1. `/records`에서 전체 2 / 급여 1 / 세금 1 / 출국 0을 확인한다.
2. `TAX_CHECK:1`과 `PAYCHECK:1`에 해당하는 두 카드가 표시돼야 한다.
3. 급여는 2026-07, 실제 입금액 2,380,000원이어야 한다.
4. 세금 카드의 저장된 세금 상세 카드를 펼치면 저장된 요약이 표시돼야 한다.
5. 출국 탭은 오류가 아닌 빈 목록이며 전체 건수는 2로 유지돼야 한다.
6. 브라우저 새로고침 후에도 같은 서버 기록을 읽어야 한다.

그동안 서버 데이터를 추가했다면 실제 건수는 달라질 수 있다.
이 과정에서 시드 초기화, 기존 DB 삭제, 실제 문서 업로드는 하지 않는다.

## 작성 환경 검증 범위

Front `dev`의 `90c15b4317a972b385f944ce673d8d8fc9273995` 소스 기준으로 작성했다.
검증용 스냅샷은 바이너리 favicon만 제외했으며 패치는 favicon을 변경하지 않는다.
변경 파일 Biome, TypeScript, 38개 테스트 및 프로덕션 빌드가 통과했다.
작성 환경의 브라우저 실행 파일 다운로드가 시간 초과되어 브라우저 자동 검사는
실행하지 못했다. 모바일 레이아웃·클릭 동작 검증까지 통과했다고 간주하지 않는다.
작성 환경은 사용자 노트북의 18080 서버에 접근할 수 없으므로
사용자 MySQL과 실제 브라우저의 연결 확인은 위 수동 절차로 마무리한다.
