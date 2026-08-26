import type { DocKind } from "./types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

async function callGateway(
  messages: { role: string; content: string | ContentBlock[] }[]
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "AI 기능이 설정되지 않았습니다. 직접 입력해 주세요." };

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (res.status === 429) {
    return { ok: false, error: "요청이 많아 잠시 후 다시 시도해 주세요." };
  }
  if (res.status === 402) {
    return { ok: false, error: "AI 사용 한도가 소진되었습니다. 값을 직접 입력해 주세요." };
  }
  if (!res.ok) {
    return { ok: false, error: `AI 판독에 실패했습니다 (${res.status}). 값을 직접 입력해 주세요.` };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false, error: "AI 응답이 비어 있습니다. 값을 직접 입력해 주세요." };
  return { ok: true, text };
}

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const digits = v.replace(/[^0-9-]/g, "");
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^0-9]/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

const DOC_PROMPT: Record<DocKind, string> = {
  contract:
    "이 이미지는 대한민국 근로계약서입니다. 월 기본급(basePay), 고정수당 합계(allowances), 계약상 급여지급일(payDay, 1~31 숫자)을 찾으세요. 없으면 null.",
  statement:
    "이 이미지는 대한민국 임금명세서입니다. 기본급(basePay), 수당 합계(allowances), 공제 합계(deductions), 실지급액(netPay), 지급일(payDate, YYYY-MM-DD), 급여귀속월(period, YYYY-MM)을 찾으세요. 없으면 null.",
  deposit:
    "이 이미지는 은행 입출금 내역입니다. 급여로 보이는 입금액(netPay)과 그 입금일(payDate, YYYY-MM-DD)을 찾으세요. 없으면 null.",
};

export async function extractDocumentFields(data: { kind: DocKind; dataUrl: string; period: string }) {
  const { kind, dataUrl, period } = data;
  if (!dataUrl.startsWith("data:image/")) {
    return {
      ok: false as const,
      error: "이미지 파일(JPG, PNG)만 자동 판독할 수 있습니다. 값을 직접 입력해 주세요.",
      fields: null,
    };
  }

  const result = await callGateway([
    {
      role: "system",
      content:
        "당신은 한국 근로 문서에서 금액과 날짜만 추출하는 도구입니다. 반드시 JSON 객체 하나만 출력하세요. 금액은 원 단위 숫자, 확인할 수 없는 값은 null.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${DOC_PROMPT[kind]}\n기준 급여월은 ${period}입니다.\n출력 형식: {"basePay":숫자|null,"allowances":숫자|null,"deductions":숫자|null,"netPay":숫자|null,"payDay":숫자|null,"payDate":"YYYY-MM-DD"|null,"period":"YYYY-MM"|null,"confidence":"high"|"low"}`,
        },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);

  if (!result.ok) return { ok: false as const, error: result.error, fields: null };

  const parsed = parseJson(result.text);
  if (!parsed) {
    return {
      ok: false as const,
      error: "문서에서 값을 읽지 못했습니다. 값을 직접 입력해 주세요.",
      fields: null,
    };
  }

  const parsedPeriod = typeof parsed["period"] === "string" ? parsed["period"] : null;
  return {
    ok: true as const,
    error: null,
    fields: {
      basePay: toNumber(parsed["basePay"]),
      allowances: toNumber(parsed["allowances"]),
      deductions: toNumber(parsed["deductions"]),
      netPay: toNumber(parsed["netPay"]),
      payDay: toNumber(parsed["payDay"]),
      payDate: toIsoDate(parsed["payDate"]),
      period: parsedPeriod && /^\d{4}-\d{2}$/.test(parsedPeriod) ? parsedPeriod : period,
    },
    confidence: parsed["confidence"] === "low" ? ("low" as const) : ("high" as const),
  };
}

export async function translateMessage(data: { korean: string; languageName: string }) {
  const result = await callGateway([
    {
      role: "system",
      content:
        "당신은 번역가입니다. 정중하고 공손한 존댓말 톤을 유지하며 번역문만 출력하세요. 설명이나 따옴표를 덧붙이지 마세요.",
    },
    {
      role: "user",
      content: `다음 한국어 문장을 ${data.languageName}로 번역하세요.\n\n${data.korean}`,
    },
  ]);
  if (!result.ok) return { ok: false as const, text: null, error: result.error };
  return { ok: true as const, text: result.text.trim(), error: null };
}

export async function answerWithContext(data: { question: string; context: string }) {
  const result = await callGateway([
    {
      role: "system",
      content:
        "당신은 한국에서 일하는 외국인 근로자의 금융권리 도우미입니다. 아래에 주어진 사용자 데이터에 있는 사실만 사용해 한국어로 3~5문장으로 답하세요. 데이터에 없는 금액이나 날짜를 지어내지 말고, 없으면 무엇을 등록해야 하는지 안내하세요. 위법 여부를 단정하지 말고 '확인이 필요합니다' 같은 표현을 사용하세요.",
    },
    {
      role: "user",
      content: `[사용자 데이터]\n${data.context}\n\n[질문]\n${data.question}`,
    },
  ]);
  if (!result.ok) return { ok: false as const, text: null, error: result.error };
  return { ok: true as const, text: result.text.trim(), error: null };
}
