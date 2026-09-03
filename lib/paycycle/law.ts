import { translate as tr } from "@/i18n";
import type { EvidenceSource } from "./types";

/** 화면에 노출되는 근거는 항상 조문 이름과 원문 링크를 함께 제시한다. */
function entry(name: string, key: string, url: string): EvidenceSource {
  return {
    get title() {
      return `${name} — ${tr(key)}`;
    },
    url,
  };
}

export const LAW = {
  wageFull: entry(
    "근로기준법 제43조 (Labor Standards Act art. 43)",
    "rule.law.wageFull",
    "https://www.law.go.kr/법령/근로기준법/제43조",
  ),
  contractTerms: entry(
    "근로기준법 제17조 (Labor Standards Act art. 17)",
    "rule.law.contractTerms",
    "https://www.law.go.kr/법령/근로기준법/제17조",
  ),
  payslip: entry(
    "근로기준법 제48조 (Labor Standards Act art. 48)",
    "rule.law.payslip",
    "https://www.law.go.kr/법령/근로기준법/제48조",
  ),
  minWage: entry(
    "최저임금법 제6조 (Minimum Wage Act art. 6)",
    "rule.law.minWage",
    "https://www.law.go.kr/법령/최저임금법/제6조",
  ),
  severance: entry(
    "근로자퇴직급여 보장법 제8조 (Employee Retirement Benefit Security Act art. 8)",
    "rule.law.severance",
    "https://www.law.go.kr/법령/근로자퇴직급여보장법/제8조",
  ),
  departureInsurance: entry(
    "외국인근로자의 고용 등에 관한 법률 제13조 (Act on Foreign Workers' Employment art. 13)",
    "rule.law.departureInsurance",
    "https://www.law.go.kr/법령/외국인근로자의고용등에관한법률/제13조",
  ),
  returnCostInsurance: entry(
    "외국인근로자의 고용 등에 관한 법률 제15조 (Act on Foreign Workers' Employment art. 15)",
    "rule.law.returnCostInsurance",
    "https://www.law.go.kr/법령/외국인근로자의고용등에관한법률/제15조",
  ),
  pensionLumpSum: entry(
    "국민연금법 제77조 (National Pension Act art. 77)",
    "rule.law.pensionLumpSum",
    "https://www.law.go.kr/법령/국민연금법/제77조",
  ),
  housingSaving: entry(
    "조세특례제한법 제87조 (Restriction of Special Taxation Act art. 87)",
    "rule.law.housingSaving",
    "https://www.law.go.kr/법령/조세특례제한법/제87조",
  ),
  flatRate: entry(
    "조세특례제한법 제18조의2 (Restriction of Special Taxation Act art. 18-2)",
    "rule.law.flatRate",
    "https://www.law.go.kr/법령/조세특례제한법/제18조의2",
  ),
  yearEndSettlement: entry(
    "소득세법 제137조 (Income Tax Act art. 137)",
    "rule.law.yearEndSettlement",
    "https://www.law.go.kr/법령/소득세법/제137조",
  ),
} satisfies Record<string, EvidenceSource>;

/** 2026년 기준 최저임금(시급). 표시할 때는 항상 기준연도를 함께 밝힌다. */
export const MIN_WAGE = { year: 2026, hourly: 10320, monthly209: 2156880 };
