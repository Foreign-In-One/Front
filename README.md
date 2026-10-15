## AI 상담 API 보안 강화 (`feature/ai-chat-guardrail`)

### 개요
- 대상: `app/api/agent/chat/route.ts` (OpenAI 호환 API 직접 호출 Next.js 라우트)
- 목적: 프롬프트 인젝션, 개인정보 노출, 시스템 프롬프트 유출 방어
- 구성: 입력 검사 → 프롬프트 구성 → 출력 검사 3단계

### 입력 검사
- 질문 길이 제한: 300자 초과 시 400 응답, 과도한 토큰 소비 방지
- 비가시 문자 제거: 제로폭 문자, BOM, 제어 문자 제거 후 검사
- 인젝션·탈옥 문구 차단: 영어·한국어 대표 문구 10종 부분 일치 시 400 응답 (`ignore previous instructions`, `system prompt`, `이전 지침 무시` 등)
- 컨텍스트 개인정보 비식별화: 주민·외국인등록번호, 휴대전화번호, 이메일 치환

### 프롬프트 구성
- 요청별 무작위 카나리아 토큰 생성, 시스템 프롬프트 삽입
- 데이터 영역(`<<<CONFIRMED_USER_INFO>>>`)과 질문 영역(`<<<USER_QUESTION>>>`) 구분자 분리
- 보안 식별자·시스템 프롬프트 출력 금지 규칙 추가

### 출력 검사
- 응답 내 카나리아 토큰(`CANARY_SEC_`) 포함 시 원문 차단, 안전 안내문 대체, 경고 로그 기록

### 한계
- 문구 목록 기반 차단: 표현 변형, 인코딩, 다국어 우회에 취약
- 분류기 기반 판정, 인코딩 페이로드 차단, garak 레드티밍 측정은 Backend `feature/ai-guardrail-baseline` 브랜치의 보안 서버 참조

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
