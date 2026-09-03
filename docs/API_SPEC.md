# PayCycle AI API SPEC

## 1. 기본 정보

### Backend

- Spring Boot
- REST API
- JSON
- MySQL

### Base URL

```text
/api
```

### MVP 인증

회원가입/로그인은 구현하지 않는다.

모든 API는 Seed User를 사용한다.

```text
X-Demo-User-Id: 1
```

또는 개발 중에는 `userId=1`을 기본값으로 사용한다.

---

# 2. 공통 응답 형식

### 성공

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

### 실패

```json
{
  "success": false,
  "data": null,
  "message": "요청을 처리할 수 없습니다.",
  "code": "INVALID_REQUEST"
}
```

---

# 3. Profile API

## GET `/api/profile`

현재 데모 사용자의 프로필을 조회한다.

### Response

```json
{
  "userId": 1,
  "name": "민수",
  "phone": "01012345678",
  "nationality": "베트남",
  "visaType": "E-9",
  "entryDate": "2025-03-01",
  "employmentStatus": "WORKING",
  "companyName": "한국정밀",
  "workStartDate": "2025-03-10",
  "payday": 25,
  "expectedExitDate": "2027-03-01",
  "language": "ko"
}
```

## PATCH `/api/profile`

프로필을 수정한다.

### Request

```json
{
  "employmentStatus": "WORKING",
  "companyName": "한국정밀",
  "payday": 25,
  "expectedExitDate": "2027-04-01",
  "language": "ko"
}
```

### Side Effect

예상 출국일 변경 시 관련 `ExitCheck` 및 `CalendarEvent`의 재분석/갱신 상태를 표시한다.

---

# 4. Document API

## POST `/api/documents`

문서를 업로드한다.

### multipart

- `file`
- `documentType`

### documentType

```text
EMPLOYMENT_CONTRACT
PAYSLIP
BANK_RECEIPT
TAX_DOCUMENT
INSURANCE_DOCUMENT
PENSION_DOCUMENT
OTHER
```

### Response

```json
{
  "documentId": 3,
  "documentType": "PAYSLIP",
  "ocrStatus": "PENDING"
}
```

---

## POST `/api/documents/{documentId}/ocr`

OCR을 실행한다.

MVP에서는 실제 OCR API 또는 Mock OCR을 Service Layer에서 선택한다.

### Response

```json
{
  "documentId": 3,
  "ocrStatus": "SUCCESS",
  "extractedData": {
    "payPeriod": "2026-08",
    "baseSalary": 2200000,
    "overtimeAllowance": 180000,
    "deduction": 0,
    "netPay": 2380000
  }
}
```

---

## PATCH `/api/documents/{documentId}/extracted-data`

OCR 결과를 사용자가 확인/수정한다.

---

# 5. PayCheck API

## GET `/api/paychecks`

사용자의 급여 검증 기록을 조회한다.

### Query

```text
?from=2026-01-01&to=2026-12-31
```

---

## GET `/api/paychecks/{paycheckId}`

특정 급여 검증 결과를 조회한다.

### Response

```json
{
  "paycheckId": 2,
  "payPeriod": "2026-08",
  "contractAmount": 2300000,
  "payslipAmount": 2380000,
  "actualAmount": 2260000,
  "differenceAmount": -120000,
  "expectedPaymentDate": "2026-08-25",
  "paymentDate": "2026-08-25T09:14:00",
  "status": "EXPLANATION_REQUIRED",
  "analysisSummary": "임금명세서 실지급액과 실제 입금액에서 120,000원의 차이가 확인되었습니다.",
  "nextAction": "이번 달 임금명세서의 공제 및 별도 지급 여부를 확인하세요."
}
```

---

## POST `/api/paychecks/analyze`

문서 + 금융거래를 기반으로 PayCheck을 생성/재분석한다.

### Request

```json
{
  "payPeriod": "2026-08",
  "transactionId": 2,
  "contractDocumentId": 1,
  "payslipDocumentId": 3,
  "bankReceiptDocumentId": 4
}
```

### 처리

1. Document OCR 데이터 조회
2. BankTransaction 조회
3. 금액/날짜 비교
4. Rule Engine 실행
5. Case 분류
6. 필요한 경우 AI Agent 호출
7. Paycheck 저장
8. CalendarEvent 생성/갱신

---

## POST `/api/paychecks/{paycheckId}/explain`

기존 분석 결과를 AI Agent가 설명한다.

### Response

```json
{
  "summary": "8월 실입금액이 지난달보다 120,000원 감소했습니다.",
  "reasons": [
    "기본급 변화 여부 확인 필요",
    "임금명세서의 공제 항목 확인 필요"
  ],
  "nextActions": [
    "8월 임금명세서 업로드",
    "명세서의 공제내역 확인"
  ]
}
```

---

# 6. 자동 급여 Batch API / 내부 Job

외부에서 호출하는 API가 아니라 Spring Scheduler Job으로 실행한다.

## Job

```text
SalaryMonitoringJob
```

### 실행

```text
매일 09:00
```

### 흐름

```text
Mock Bank API
→ 최근 거래 조회
→ 신규 거래 중복 확인
→ 급여 후보 탐지
→ 기존 급여와 비교
→ Case 분류
→ 필요 시 AI Agent
→ PayCheck 저장
→ CalendarEvent 생성/갱신
```

정상 사례에서는 AI 호출을 하지 않는다.

---

# 7. Mock Bank API

## GET `/api/mock/bank/transactions`

실제 금융결제원 오픈뱅킹 API 연동을 대신하는 MVP Mock API.

### Query

```text
?userId=1&from=2026-08-20&to=2026-08-31
```

### Response

```json
{
  "apiTranId": "mock-001",
  "rspCode": "A0000",
  "resList": [
    {
      "bankTranId": "F123456789U4BC34239Z002",
      "bankTranDate": "20260825",
      "tranTime": "091400",
      "inoutType": "입금",
      "tranType": "급여",
      "printedContent": "한국정밀 8월 급여",
      "tranAmt": "2260000",
      "afterBalanceAmt": "6760000",
      "branchName": "분당점",
      "bankName": "하나은행",
      "fintechUseNum": "123456789012345678901234"
    }
  ]
}
```

Mock 응답 구조는 실제 금융결제원 거래내역조회 응답과 유사하게 유지한다.

---

# 8. AI Agent API

## POST `/api/agent/paycheck`

PayCheck Case를 해결하기 위한 Agent 실행 API.

### Request

```json
{
  "paycheckId": 2,
  "caseType": "SALARY_DECREASE"
}
```

### Agent Tool 예시

내부 서비스 함수로 구현한다.

```text
getUserProfile(userId)
getRecentPaychecks(userId)
getBankTransactions(userId)
getRelatedDocuments(paycheckId)
getApplicableRule(caseType)
```

### Response

```json
{
  "caseType": "SALARY_DECREASE",
  "summary": "이번 달 실입금액이 지난달보다 120,000원 감소했습니다.",
  "requiredEvidence": [
    "2026년 8월 임금명세서"
  ],
  "nextActions": [
    "임금명세서 업로드",
    "공제 항목 확인"
  ],
  "messageForEmployer": "이번 급여의 실지급액과 실제 입금액 사이에 차이가 있어 확인 부탁드립니다."
}
```

---

# 9. TaxCheck API

이번 개발에서는 PayCheck/Calendar/Profile이 우선이지만 API 규격은 미리 맞춘다.

## GET `/api/tax-checks`

## GET `/api/tax-checks/{taxCheckId}`

## POST `/api/tax-checks/analyze`

## POST `/api/tax-checks/{taxCheckId}/simulate`

---

# 10. ExitCheck API

## GET `/api/exit-checks`

## GET `/api/exit-checks/{exitCheckId}`

## POST `/api/exit-checks/analyze`

---

# 11. Calendar API

## GET `/api/calendar/events`

### Query

```text
?from=2026-08-01&to=2026-08-31
```

### Response

```json
[
  {
    "eventId": 1,
    "eventType": "PAYDAY",
    "title": "8월 급여일",
    "description": "계약상 급여일",
    "startAt": "2026-08-25T09:00:00",
    "endAt": "2026-08-25T23:59:59",
    "sourceType": "PAYCHECK",
    "sourceId": 2,
    "status": "COMPLETED"
  }
]
```

---

## POST `/api/calendar/events`

사용자 직접 일정 생성.

### Request

```json
{
  "eventType": "PERSONAL",
  "title": "은행 방문",
  "description": "통장 관련 업무",
  "startAt": "2026-09-01T14:00:00",
  "endAt": "2026-09-01T15:00:00"
}
```

---

## PATCH `/api/calendar/events/{eventId}`

사용자 일정 수정.

---

## DELETE `/api/calendar/events/{eventId}`

사용자 직접 생성 일정 삭제.

시스템 생성 일정은 삭제보다는 원천 결과 상태 변화에 따라 갱신한다.

---

# 12. 외부 API / 설정

## 현재 MVP

- Bank API: Mock
- OCR: Mock 또는 실제 OCR API 교체 가능
- LLM: 실제 API 연동 예정
- 법령 API: 필요 시 Rule 기반 조회
- 국세청 세무일정: 연 1회 Seed/캐시 가능

모든 외부 의존성은 Service Layer를 통해 분리한다.

```text
controller
  ↓
service
  ↓
external client / adapter
```

실제 API를 Mock으로 변경할 때 Controller/Business Logic을 수정하지 않는다.

---

# 13. Records 조회 연동 (Backend PR #9 / #7)

이 절은 Backend의 `feature/dashboard-records` 조회 계약과
`feature/taxcheck#5` 저장 상세 계약을 기준으로 추가한다.
통합 테스트용 백엔드에는 두 기능과 ExitCheck 테이블이 모두 필요하다.

- `GET /api/records?userId=1`: 서버 저장 기록 전체.
- `GET /api/records?userId=1&type=PAYCHECK|TAX_CHECK|EXIT_CHECK`: 종류별 목록.
- `GET /api/tax-checks/{sourceId}?userId=1`: 저장된 TaxCheck 상세. 새 분석이 아니다.

응답은 `{ success, data, message }`이며, Records의 `data`는 `{ items, counts }`이다.
`counts`는 필터와 관계없이 사용자의 전체 `all`, `paycheck`, `taxCheck`,
`exitCheck` 건수를 포함한다. 현재 계약에는 페이지네이션이 없다.

`items`의 필드는 `recordKey`, `type`, `sourceId`, `recordedAt`, `analyzedAt`,
`status`, `analysisSummary`, `nextAction`, `payPeriod`, `taxYear`,
`expectedExitDate`, `actualAmount`, `readinessScore`이다.
출처 ID가 같아도 종류가 다르면 별도 기록이며 `recordKey`를 키로 쓴다.
서버 정렬 순서와 `null`을 보존하고, 금액 미상과 0원을 구분한다.

프론트는 `services/records-api.ts`에서 성공 여부와 사용 필드를 검증한다.
이 조회에는 공통 API의 목업 폴백을 적용하지 않는다.
서버 기록 삭제 API는 아직 정의하지 않았으며 브라우저 기록을 삭제하는 방식으로
서버 삭제를 대신하지 않는다. `userId=1`은 공유 데모 규칙이지 인증이 아니다.

설정·테스트·현재 단계의 제한은 `docs/RECORDS_API_INTEGRATION.md`를 참고한다.

---

# 14. Dashboard 조회 연동 (Backend PR #9)

`GET /api/dashboard?userId=1`을 사용한다. `year`를 생략하여 백엔드의
Asia/Seoul 현재 연도를 사용하고, 응답의 `data.year`를 화면에 표시한다.
기존 백엔드의 선택적 `year` query 계약은 변경하지 않는다.

성공 응답의 `data` 필드:

- `year`: 급여 집계 연도.
- `paySummary`: `totalReceivedPay`, `recordedMonths`, `amountKnownMonths`,
  `recordedPeriods`, `missingAmountPeriods`.
- `latestPaycheck`, `latestTaxCheck`, `latestExitCheck`: RecordSummary 또는 null.
- `recentRecords`: 전체 이력의 최근 RecordSummary 최대 3건.

급여 집계는 급여월의 연도를 기준으로 서버에서 계산한다. 프론트에서 최근 3건을
합산하거나 연환산하지 않고, 세전 연간 소득이나 세액으로 표시하지 않는다.
금액 미상은 null, 확인된 실제 0원은 0이다. 일부 월만 확인됐으면 등록 월 수,
금액 확인 월 수, 금액 미확인 월 목록을 함께 표시한다.

연도 필터는 `paySummary`에만 적용된다. 최신 결과와 최근 기록은 전체 연도
기준이며 각 기록의 `payPeriod`, `taxYear`, `expectedExitDate`를 별도로 표시한다.
요약·다음 행동은 저장된 원문이다. API에 없는 세금 적용 가능 항목 수나
출국 준비 완료 항목 수는 만들지 않는다.

`services/records-api.ts`의 기존 GET·취소·15초 제한·응답 검증을 공유한다.
Dashboard 분석 결과는 목업/브라우저 저장소로 대체하지 않는다.
프로필·캘린더와 공통 API의 기존 동작은 이번 단계에서 변경하지 않는다.
상세 절차와 제한은 `docs/DASHBOARD_API_INTEGRATION.md`를 참고한다.
