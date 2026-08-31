# PayCycle ERD (Backend)

git에는 올라가지 않는 로컬 참고용 문서 (`.gitignore`의 `/notes/`).

## ① USER

**역할:** 회원 정보 + 외국인 금융권리 프로필

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `user_id` | BIGINT | **PK** | 사용자 ID |
| `name` | VARCHAR(50) | | 이름 |
| `phone` | VARCHAR(20) | **UNIQUE** | 전화번호 |
| `password` | VARCHAR(255) | | 암호화 비밀번호 |
| `nationality` | VARCHAR(30) | | 국적 |
| `visa_type` | VARCHAR(20) | | 체류자격 |
| `entry_date` | DATE | | 입국일 |
| `employment_status` | VARCHAR(30) | | 취업 전 / 근무 중 / 퇴사 / 사업장 변경 |
| `company_name` | VARCHAR(100) | | 사업장명 |
| `work_start_date` | DATE | | 근무 시작일 |
| `payday` | TINYINT | | 계약상 급여일 `1~31` |
| `expected_exit_date` | DATE | | 예상 출국일 |
| `language` | VARCHAR(10) | | `ko / en / vi / zh` |
| `created_at` | DATETIME | | 생성일 |
| `updated_at` | DATETIME | | 수정일 |

**관계**

```
USER 1 ─── N BANK_TRANSACTION
USER 1 ─── N DOCUMENT
USER 1 ─── N PAYCHECK
USER 1 ─── N TAX_CHECK
USER 1 ─── N EXIT_CHECK
USER 1 ─── N CALENDAR_EVENT
```

---

## ② BANK_TRANSACTION

**역할:** 금융결제원 오픈뱅킹에서 가져온 거래 원본

> `res_list`의 거래 데이터를 저장하고, API 호출 메타데이터는 저장하지 않음.

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `transaction_id` | BIGINT | **PK** | 내부 거래 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `bank_name` | VARCHAR(50) | | 은행명 |
| `fintech_use_num` | VARCHAR(30) | | 핀테크이용번호 |
| `bank_tran_id` | VARCHAR(50) | **UNIQUE** | 금융기관 거래 ID |
| `bank_tran_date` | DATE | | 거래일 |
| `tran_time` | TIME | | 거래 시각 |
| `inout_type` | VARCHAR(10) | | 입금 / 출금 |
| `tran_type` | VARCHAR(30) | | 거래 유형 |
| `printed_content` | VARCHAR(255) | | 통장 인자내용 |
| `tran_amt` | DECIMAL(15,2) | | 거래금액 |
| `after_balance_amt` | DECIMAL(15,2) | | 거래 후 잔액 |
| `branch_name` | VARCHAR(100) | | 거래 지점 |
| `transaction_category` | VARCHAR(30) | | PayCycle 내부 분류 |
| `created_at` | DATETIME | | 저장일 |

### `transaction_category`

```
SALARY
SALARY_CANDIDATE
GENERAL_DEPOSIT
WITHDRAWAL
UNKNOWN
```

**관계**

```
USER 1 ─── N BANK_TRANSACTION
BANK_TRANSACTION 1 ─── N PAYCHECK
```

---

## ③ DOCUMENT

**역할:** 계약서·급여명세서·입금증빙·세금/출국 서류 관리

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `document_id` | BIGINT | **PK** | 문서 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `document_type` | VARCHAR(30) | | 문서 종류 |
| `original_filename` | VARCHAR(255) | | 원본 파일명 |
| `file_path` | VARCHAR(500) | | 저장 위치 |
| `mime_type` | VARCHAR(100) | | 파일 형식 |
| `file_size` | BIGINT | | 파일 크기 |
| `ocr_status` | VARCHAR(20) | | OCR 상태 |
| `extracted_data` | JSON | | OCR 구조화 결과 |
| `uploaded_at` | DATETIME | | 업로드일 |
| `updated_at` | DATETIME | | 수정일 |

### `document_type`

```
EMPLOYMENT_CONTRACT
PAYSLIP
BANK_RECEIPT
TAX_DOCUMENT
INSURANCE_DOCUMENT
PENSION_DOCUMENT
OTHER
```

**관계**

```
USER 1 ─── N DOCUMENT

PAYCHECK
 ├── contract_document_id   → DOCUMENT.document_id
 ├── payslip_document_id    → DOCUMENT.document_id
 └── bank_receipt_document_id → DOCUMENT.document_id

TAX_CHECK
 └── tax_document_id        → DOCUMENT.document_id

EXIT_CHECK
 └── exit_document_id       → DOCUMENT.document_id
```

---

## ④ PAYCHECK

**역할:** 월별 급여 검증 결과 — 🔥 PayCycle 핵심 엔티티

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `paycheck_id` | BIGINT | **PK** | 급여 검증 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `transaction_id` | BIGINT | **FK** | 실제 급여 입금 거래 |
| `contract_document_id` | BIGINT | **FK** | 근로계약서 |
| `payslip_document_id` | BIGINT | **FK** | 임금명세서 |
| `bank_receipt_document_id` | BIGINT | **FK** | 입금증빙 |
| `pay_period` | VARCHAR(7) | | 급여 대상 월 |
| `contract_amount` | DECIMAL(15,2) | | 계약상 급여 |
| `payslip_amount` | DECIMAL(15,2) | | 명세서 실지급액 |
| `actual_amount` | DECIMAL(15,2) | | 실제 입금액 |
| `difference_amount` | DECIMAL(15,2) | | 차액 |
| `expected_payment_date` | DATE | | 계약상 급여일 |
| `payment_date` | DATETIME | | 실제 입금일 |
| `status` | VARCHAR(30) | | 검증 상태 |
| `analysis_summary` | TEXT | | AI/Rule 분석 요약 |
| `next_action` | TEXT | | 사용자 다음 행동 |
| `analyzed_at` | DATETIME | | 분석 시각 |
| `created_at` | DATETIME | | 생성일 |
| `updated_at` | DATETIME | | 수정일 |

### `status`

```
NORMAL
EXPLANATION_REQUIRED
INSUFFICIENT_DATA
CONFIRMATION_REQUIRED
NOT_RECEIVED
```

### 데이터 흐름

```
BANK_TRANSACTION
      ↓
급여 후보 감지
      ↓
PAYCHECK
      ↑
DOCUMENT
      ↓
Rule Engine
      ↓
AI Agent
```

---

## ⑤ TAX_CHECK

**역할:** 외국인 근로자의 연말정산·세금 분석 결과

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `tax_check_id` | BIGINT | **PK** | 세금 분석 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `tax_document_id` | BIGINT | **FK** | 세금 관련 문서 |
| `tax_year` | INT | | 귀속연도 |
| `resident_status` | VARCHAR(20) | | 거주자 / 비거주자 |
| `annual_income` | DECIMAL(15,2) | | 연간 총급여 |
| `flat_tax_estimate` | DECIMAL(15,2) | | 19% 단일세율 예상 |
| `general_tax_estimate` | DECIMAL(15,2) | | 일반세율 예상 |
| `tax_difference` | DECIMAL(15,2) | | 예상 차이 |
| `benefit_summary` | JSON | | 적용 가능 혜택 |
| `required_documents` | JSON | | 필요 증빙 |
| `status` | VARCHAR(30) | | 분석 상태 |
| `next_action` | TEXT | | 다음 행동 |
| `analysis_summary` | TEXT | | 분석 요약 |
| `analyzed_at` | DATETIME | | 분석일 |
| `created_at` | DATETIME | | 생성일 |
| `updated_at` | DATETIME | | 수정일 |

### `status`

```
POSSIBLE
NOT_APPLICABLE
REVIEW_REQUIRED
UNKNOWN
```

**관계**

```
USER 1 ─── N TAX_CHECK
DOCUMENT 1 ─── N TAX_CHECK
```

---

## ⑥ EXIT_CHECK

**역할:** 출국 전 금융권리·준비사항 분석

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `exit_check_id` | BIGINT | **PK** | 출국 분석 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `exit_document_id` | BIGINT | **FK** | 출국 관련 문서 |
| `expected_exit_date` | DATE | | 예상 출국일 |
| `work_duration_months` | INT | | 근무기간 |
| `insurance_status` | VARCHAR(30) | | 보험 상태 |
| `pension_status` | VARCHAR(30) | | 연금 상태 |
| `retirement_status` | VARCHAR(30) | | 퇴직정산 상태 |
| `missing_documents` | JSON | | 부족 서류 |
| `checklist` | JSON | | 준비 목록 |
| `readiness_score` | INT | | 준비도 `0~100` |
| `status` | VARCHAR(30) | | 전체 상태 |
| `next_action` | TEXT | | 다음 행동 |
| `analysis_summary` | TEXT | | 분석 요약 |
| `analyzed_at` | DATETIME | | 분석일 |
| `created_at` | DATETIME | | 생성일 |
| `updated_at` | DATETIME | | 수정일 |

### `status`

```
CHECK_REQUIRED
IN_PROGRESS
MISSING_DOCUMENT
READY
UNKNOWN
```

> `readiness_score`는 **수급 가능성 점수**가 아니라 준비사항 완료도를 의미.

**관계**

```
USER 1 ─── N EXIT_CHECK
DOCUMENT 1 ─── N EXIT_CHECK
```

---

## ⑦ CALENDAR_EVENT

**역할:** 급여·세금·출국·개인 일정을 하나의 캘린더로 통합

| 컬럼 | 타입 | KEY | 설명 |
| --- | --- | --- | --- |
| `event_id` | BIGINT | **PK** | 일정 ID |
| `user_id` | BIGINT | **FK** | `USER.user_id` |
| `event_type` | VARCHAR(30) | | 일정 종류 |
| `title` | VARCHAR(100) | | 일정 제목 |
| `description` | TEXT | | 설명 |
| `start_at` | DATETIME | | 시작일시 |
| `end_at` | DATETIME | | 종료일시 |
| `source_type` | VARCHAR(30) | | 생성 출처 |
| `source_id` | BIGINT | | 원본 ID |
| `status` | VARCHAR(20) | | 일정 상태 |
| `created_at` | DATETIME | | 생성일 |
| `updated_at` | DATETIME | | 수정일 |

### `event_type`

```
PAYDAY
PAYCHECK
TAX
EXIT
PERSONAL
```

### `source_type`

```
PAYCHECK
TAX_CHECK
EXIT_CHECK
SYSTEM
USER
```

### 일정 생성 출처

```
USER.payday
        ↓
   PAYDAY Event

BANK_TRANSACTION
        ↓
   PAYCHECK Event

TAX_CHECK
        ↓
     TAX Event

EXIT_CHECK
        ↓
     EXIT Event

국세청 세무일정
        ↓
     TAX Event
```

> `source_type + source_id`는 **논리적 참조**이며, 특정 테이블 하나에 대한 실제 FK는 걸지 않음.

---

## 🔗 전체 관계 한눈에 보기

```
                          ┌──────────────┐
                          │     USER     │
                          └──────┬───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │            │           │            │            │
        ▼            ▼           ▼            ▼            ▼
BANK_TRANSACTION  DOCUMENT   PAYCHECK    TAX_CHECK    EXIT_CHECK
        │            │           │            │            │
        │            │           └────────────┼────────────┘
        │            │                        │
        │            └──── 문서 FK ───────────┘
        │
        └────────── 급여 분석

                                 │
                                 ▼
                         CALENDAR_EVENT
```

---

## 프론트 매핑 현황 (2026-08-24 기준)

지금 프론트에서 만들어진 화면은 브랜치별로 나뉘어 있음 (`dev`에는 아직 반영 안 됨):
- `feature/onboarding-#4`: `home-flow.tsx`(언어 선택 + 랜딩), `onboarding-flow.tsx`(위저드)
- `feature/chatbot#5`: `chat-dock.tsx`(챗봇 UI 셸, 로직은 임시)

### USER — 온보딩 위저드가 거의 1:1로 커버

| USER 컬럼 | 프론트 소스 | 비고 |
| --- | --- | --- |
| `nationality` | `onboarding-flow.tsx` values.nationality | 베트남/캄보디아/태국/인도네시아/네팔/필리핀 중 선택 |
| `visa_type` | values.visa | E-9/E-7/H-2/F-2/F-4/D-2 |
| `entry_date` | values.entry | date field |
| `employment_status` | values.status | `PRE_EMPLOYMENT`/`EMPLOYED`/`SEPARATED`/`CHANGING` — ERD 설명과 값까지 동일 |
| `company_name` | values.workplace | |
| `work_start_date` | values.workStart | |
| `payday` | values.payday | |
| `expected_exit_date` | values.exit | |
| `language` | `home-flow.tsx` language state | 한국어/English/Tiếng Việt/中文 |
| `name` | values.name | 온보딩에서 받지만 회원가입용 `name`인지 닉네임인지는 백엔드와 확인 필요 |

**갭:**
- `phone`, `password` — 로그인/회원가입 화면이 아직 없음. 온보딩은 지금 로컬 state로만 끝나고 어디에도 저장(제출)하지 않음 — 백엔드 연동 시 회원가입 API와 온보딩 제출 API를 어떻게 나눌지 정해야 함.
- `currentStart`(현 사업장 입사일, `DateKey`에 있음) — USER 테이블엔 대응 컬럼이 없음. `work_start_date`(최초 근무 시작일)와 별개로 "사업장 변경" 시나리오에서만 쓰는 값인데, ERD엔 반영 안 돼 있음. 백엔드 쪽과 컬럼 추가 여부 확인 필요.

### BANK_TRANSACTION / DOCUMENT / PAYCHECK / TAX_CHECK / EXIT_CHECK — 프론트 미구현

이 5개 엔티티를 다루는 화면은 아직 없음. `chat-dock.tsx`의 추천 질문·액션 버튼이 `/paycheck`, `/taxcheck`, `/exitcheck`, `/calendar` 경로를 참조하고 있지만, 실제로는 존재하지 않는 라우트(placeholder)이고 로직도 로컬 키워드 매칭용 예시 텍스트일 뿐 실제 데이터 연동은 없음.

### CALENDAR_EVENT — 미구현

챗봇 추천 질문에 "일정" 관련 문구만 있고 실제 캘린더 화면 없음.

### 결론

지금 프론트가 실제로 다루는 건 **USER 테이블 하나**(그것도 저장 없이 로컬 state)뿐이고, 나머지 6개 엔티티(BANK_TRANSACTION/DOCUMENT/PAYCHECK/TAX_CHECK/EXIT_CHECK/CALENDAR_EVENT)는 화면이 전혀 없는 상태. 다음 우선순위를 잡는다면:
1. 온보딩 제출 → 회원가입/프로필 저장 API 연동 (USER)
2. PAYCHECK 확인 화면 (핵심 엔티티로 표시돼 있음)
3. 그 다음 TAX_CHECK / EXIT_CHECK / CALENDAR_EVENT
