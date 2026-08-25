# TaxCheck 상세 구현 적용 안내

## 이번에 반영한 내용

- 시작 화면 + 4개 내부 단계로 구성한 총 5개 화면 상태
- 현재 급여·급여 기록 수·체류일 요약
- 거주자 여부, 주택청약저축, 19% 단일세율 규칙 기반 판정
- 질문 미응답 시 다음 단계 비활성화
- 적용 가능성·추가 자료·판단 보류 결과 집계
- 항목별 다음 행동, 판정 이유, 부족 자료, 공식 법령 링크
- 결과 복사와 완료 알림
- `paycycle-results-v1` 브라우저 저장소에 TaxCheck 결과 자동 저장
- `/records`와 `/dashboard`에서 재사용 가능한 결과 스냅샷 형식
- 모바일 하단 내비게이션, 접근성 속성, 반응형 UI

## 변경 파일

```text
app/taxcheck/layout.tsx
app/taxcheck/page.tsx
app/taxcheck/page.module.css
lib/paycycle/taxcheck.ts
lib/paycycle/result-storage.ts
```

기존 프로젝트에 적용할 때는 위 파일과 폴더를 같은 경로에 복사하면 됩니다.

## 실행 확인

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000/taxcheck`를 열고 다음 흐름을 확인합니다.

1. 시작 화면에서 `TaxCheck 시작하기`
2. 현재 정보와 거주자 판정 근거 확인
3. 주택청약저축 질문에 모두 답변
4. 다른 소득공제 사용 여부 답변
5. 결과 카드 펼치기·복사·공식 근거 링크 확인
6. 개발자 도구의 Application → Local Storage에서 `paycycle-results-v1` 확인

## 백엔드 연결 지점

현재 시연값은 `lib/paycycle/taxcheck.ts`의 `TAXCHECK_DEMO_INPUT`에 있습니다.
Spring API가 준비되면 `app/taxcheck/page.tsx`에서 이 값을 아래 데이터로 교체합니다.

- 대상 연도
- 올해 누적 급여
- 급여 기록 개월 수
- 입국일

결과 저장도 현재는 `saveTaxCheckResult()`가 `localStorage`를 사용합니다. API가 준비되면 같은 입력을 `POST /api/tax-checks`로 전송하도록 저장 함수 내부만 교체하면 화면 코드는 유지할 수 있습니다.

## 협업 주의

- 현재 작업 브랜치 `feature/taxcheck#10`에서만 반영합니다.
- 공통 `app/layout.tsx`, `app/globals.css`, 패키지 설정은 수정하지 않았습니다.
- 팀원의 `/records`, `/dashboard`, 공통 셸 작업과 충돌을 줄이기 위해 TaxCheck 전용 경로에 대부분의 코드를 두었습니다.
- 공통 AppShell이 병합되면 `page.tsx`의 상단 헤더와 하단 내비게이션만 팀 공통 컴포넌트로 교체하면 됩니다.
