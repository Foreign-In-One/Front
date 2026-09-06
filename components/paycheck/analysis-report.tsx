"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  FileCheck,
  FileText,
  Loader2,
  MessageSquareQuote,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { LevelCard, type Level } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { STATUS_LABEL, statusLabel } from "@/lib/paycycle/rule-engine";
import type { PayFinding } from "@/lib/paycycle/types";
import {
  fetchAiPaycheckAnalysis,
  generateLocalAiPaycheckAnalysis,
  type AiPaycheckReportDto,
} from "@/services/ai";

interface AnalysisReportProps {
  paycheckId?: number | string;
  finding?: PayFinding | null;
  period: string;
  workplace?: string;
}

export function AnalysisReport({
  paycheckId,
  finding,
  period,
  workplace,
}: AnalysisReportProps) {
  const { t, locale } = useT();
  const [aiReport, setAiReport] = useState<AiPaycheckReportDto | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const findingKey = finding ? JSON.stringify(finding) : "";

  useEffect(() => {
    let active = true;
    async function loadAiAnalysis() {
      if (!finding || finding.status === "MATCH") {
        setAiReport(null);
        return;
      }

      if (paycheckId) {
        setLoadingAi(true);
        try {
          const res = await fetchAiPaycheckAnalysis({
            paycheckId,
            finding,
            period,
            workplace,
            locale,
          });
          if (active && res.data) {
            setAiReport(res.data);
          }
        } catch (err) {
          console.warn("AI Analysis loading error:", err);
          if (active) {
            const localRes = generateLocalAiPaycheckAnalysis({
              finding,
              period,
              workplace,
              locale,
            });
            setAiReport(localRes.data);
          }
        } finally {
          if (active) setLoadingAi(false);
        }
      } else {
        const localRes = generateLocalAiPaycheckAnalysis({
          finding,
          period,
          workplace,
          locale,
        });
        if (active) {
          setAiReport(localRes.data);
        }
      }
    }
    void loadAiAnalysis();
    return () => {
      active = false;
    };
  }, [paycheckId, findingKey, period, workplace, locale]);

  if (!finding) return null;

  const isMatch = finding.status === "MATCH";
  const level: Level =
    finding.status === "MATCH"
      ? "SUCCESS"
      : finding.status === "INSUFFICIENT_DATA"
      ? "NEED_INFO"
      : finding.status === "EXPLANATION_REQUIRED"
      ? "WARNING"
      : "DANGER";

  // 다국어 환경에서 finding의 title 및 fact를 현재 locale에 맞게 로컬라이징
  const localizedFinding = (() => {
    if (locale === "ko") {
      return { title: finding.title, fact: finding.fact || finding.title };
    }

    const fid = finding.id;
    const titleKey = `rule.finding.${fid}.title`;
    const translatedTitle = t(titleKey);

    let translatedFact = finding.fact || finding.title;
    if (fid === "base") {
      translatedFact = t("rule.finding.base.fact", {
        contract: finding.left?.amount ? `${finding.left.amount.toLocaleString("ko-KR")}원` : "",
        statement: finding.right?.amount ? `${finding.right.amount.toLocaleString("ko-KR")}원` : "",
        diff: finding.difference ? `${Math.abs(finding.difference).toLocaleString("ko-KR")}원` : "",
      });
    } else if (fid === "net") {
      translatedFact = t("rule.finding.net.fact", {
        statement: finding.left?.amount ? `${finding.left.amount.toLocaleString("ko-KR")}원` : "",
        deposit: finding.right?.amount ? `${finding.right.amount.toLocaleString("ko-KR")}원` : "",
        diff: finding.difference ? `${Math.abs(finding.difference).toLocaleString("ko-KR")}원` : "",
      });
    } else if (fid === "contract-deposit") {
      translatedFact = t("rule.finding.contractDeposit.fact", {
        contract: finding.left?.amount ? `${finding.left.amount.toLocaleString("ko-KR")}원` : "",
        deposit: finding.right?.amount ? `${finding.right.amount.toLocaleString("ko-KR")}원` : "",
        diff: finding.difference ? `${Math.abs(finding.difference).toLocaleString("ko-KR")}원` : "",
      });
    } else if (fid === "deduction") {
      translatedFact = t("rule.finding.deduction.fact", {
        amount: finding.left?.amount ? `${finding.left.amount.toLocaleString("ko-KR")}원` : "",
        percent: 25,
      });
    } else if (translatedTitle && translatedTitle !== titleKey) {
      translatedFact = translatedTitle;
    }

    return {
      title: translatedTitle && translatedTitle !== titleKey ? translatedTitle : finding.title,
      fact: translatedFact || finding.fact || finding.title,
    };
  })();

  return (
    <div className="space-y-5 pc-rise">
      {/* 1. 기본 레벨 요약 카드 */}
      <LevelCard
        level={level}
        badge={statusLabel(finding.status)}
        title={localizedFinding.title}
        description={localizedFinding.fact}
      />

      {/* 2. 정상 일치 (MATCH) 상태일 때의 신뢰 브리핑 */}
      {isMatch && (
        <div className="rounded-3xl border border-primary/20 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <ShieldCheck className="size-5 text-primary" />
            <span>{t("pay.report.matchTitle")}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("pay.report.matchDesc")}
          </p>
          <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-primary">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" /> {t("pay.report.contractBaseMatch")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" /> {t("pay.report.statementNetMatch")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" /> {t("pay.report.depositNetMatch")}
            </span>
          </div>
        </div>
      )}

      {/* 3. 불일치 및 확인 필요 시 노출되는 AI 심층 진단 리포트 */}
      {!isMatch && (
        <div className="rounded-3xl border border-primary/25 bg-card p-6 shadow-md space-y-6 backdrop-blur-md">
          {/* AI 리포트 상단 헤더 */}
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-foreground">{t("pay.report.aiTitle")}</h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                    <Sparkles className="size-3" /> {t("pay.report.aiComplete")}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {t("pay.report.aiSubtitle")}
                </p>
              </div>
            </div>

            {loadingAi && <Loader2 className="size-4 animate-spin text-primary" />}
          </div>

          {/* AI 진단 헤드라인 & 요약 설명 */}
          {aiReport && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-primary/5 p-4 border border-primary/15 space-y-2">
                {aiReport.headline && aiReport.headline !== aiReport.summary && (
                  <p className="text-xs font-black text-primary flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-primary" />
                    {aiReport.headline}
                  </p>
                )}
                <p className="text-xs leading-relaxed font-medium text-foreground">{aiReport.summary}</p>
              </div>

              {/* 🌟 추천 서류 대조 가이드 (동적 문서 확인 안내) */}
              {aiReport.documentCheckGuide && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-800 dark:text-amber-400">
                    <FileText className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{t("pay.report.docCheckGuideTitle")}</span>
                  </div>
                  <p className="text-xs leading-relaxed font-medium text-foreground pl-6">
                    {aiReport.documentCheckGuide}
                  </p>
                </div>
              )}

              {/* 가설 및 원인 분석 */}
              {aiReport.causes && aiReport.causes.length > 0 && (
                <div className="space-y-2.5">
                  <h5 className="flex items-center gap-1.5 text-xs font-black text-foreground">
                    <AlertCircle className="size-3.5 text-warn" />
                    {t("pay.report.causesTitle")}
                  </h5>
                  <div className="space-y-2">
                    {aiReport.causes.map((cause, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-background/80 border border-border/70 p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{cause.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {cause.category === "BASE_PAY"
                              ? t("pay.field.basePay")
                              : cause.category === "DEDUCTION"
                              ? t("pay.field.deductions")
                              : cause.category === "NET_PAY"
                              ? t("pay.field.netPay")
                              : cause.category === "ALLOWANCE"
                              ? t("pay.field.allowances")
                              : cause.category}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {cause.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 법적 기준 및 권리 보호 안내 */}
              {aiReport.legalBasis && (
                <div className="rounded-2xl bg-info-soft/40 border border-info/20 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-info-foreground dark:text-info">
                    <Scale className="size-4" />
                    <span>{t("pay.report.lawBasisTitle")}: {aiReport.legalBasis.law}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground font-medium">
                    {aiReport.legalBasis.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    💡 <span className="font-bold">{t("pay.report.rightsNotice")}:</span> {aiReport.legalBasis.protectionNotice}
                  </p>
                </div>
              )}

              {/* 필수 확인 증빙 서류 */}
              {aiReport.requiredEvidence && aiReport.requiredEvidence.length > 0 && (
                <div className="space-y-2">
                  <h5 className="flex items-center gap-1.5 text-xs font-black text-foreground">
                    <FileCheck className="size-3.5 text-primary" />
                    {t("pay.report.evidenceTitle")}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {aiReport.requiredEvidence.map((ev, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs"
                      >
                        <FileText className="size-3 text-muted-foreground" />
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 단계별 추천 행동 체크리스트 */}
              {aiReport.nextActions && aiReport.nextActions.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <h5 className="flex items-center gap-1.5 text-xs font-black text-foreground">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    {t("pay.report.actionGuideTitle")}
                  </h5>
                  <div className="space-y-2">
                    {aiReport.nextActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-2xl bg-background border border-border/70 p-3.5"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                          {action.step}
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{action.title}</span>
                            {action.urgency === "HIGH" && (
                              <span className="text-[9px] font-black px-1.5 rounded-md bg-destructive/10 text-destructive">
                                {t("pay.report.urgentBadge")}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {action.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 다국어 사업주 질문 카드 */}
              {aiReport.messageForEmployer && (() => {
                const rawTranslated = aiReport.messageForEmployer.translated?.trim() || "";
                const rawKorean = aiReport.messageForEmployer.korean?.trim() || "";
                const isKoreanText = (s?: string) => /[가-힣]/.test(s || "");
                const diffAmt = finding?.difference ? Math.abs(finding.difference) : 0;
                const diffStr = diffAmt > 0
                  ? (locale === "en" ? `${diffAmt.toLocaleString("en-US")} KRW`
                    : locale === "vi" ? `${diffAmt.toLocaleString("vi-VN")} won`
                    : locale === "zh" ? `${diffAmt.toLocaleString("zh-CN")} 韩元`
                    : `${diffAmt.toLocaleString("ko-KR")}원`)
                  : "";
                const isBase = finding?.id === "base" || (finding?.title && finding.title.includes("기본급"));

                const isKoreanInsufficient =
                  !rawKorean ||
                  rawKorean.length < 35 ||
                  rawKorean === "급여 차이에 대한 문의" ||
                  rawKorean === "급여 차액에 대한 문의" ||
                  rawKorean === "급여 차액 확인 요청" ||
                  (rawKorean.startsWith("급여 차이") && rawKorean.length < 30);

                const safeKorean = isKoreanInsufficient
                  ? (isBase
                    ? `안녕하세요 사장님, 항상 현장에서 따뜻하게 배려해 주시고 챙겨주셔서 진심으로 감사드립니다. 다름이 아니라 이번 ${period || "이번 달"} 급여 내역을 확인하던 중, 체결한 근로계약서 제4조 상의 기본급과 교부받은 임금명세서 상의 기본급 사이에 약 ${diffStr || "차액"}의 차이가 확인되어 조심스럽게 연락드렸습니다. 혹시 소정근로시간 계산이나 기본급 산정 기준에 변동 사항이 있었는지, 바쁘시겠지만 편하신 시간에 확인해 주실 수 있으실까요? 늘 감사드리며, 항상 건강 유의하시기 바랍니다!`
                    : `안녕하세요 사장님, 이번 달에도 노고 많으셨고 급여 챙겨주셔서 진심으로 감사드립니다. 다름이 아니라 급여 내역을 확인하던 중, 교부받은 임금명세서 상의 실지급액과 실제 제 통장에 입금된 금액 사이에 약 ${diffStr || "차액"}의 차이가 확인되어 조심스럽게 문의드립니다. 혹시 기숙사비나 식대 등 명세서에 기재되지 않은 추가 공제 항목이 있었는지, 아니면 계좌 송금 과정에서 착오가 있었는지 시간 되실 때 확인해 주시면 감사하겠습니다. 바쁘신 업무 중에 번거롭게 해드려 죄송합니다. 늘 배려해 주셔서 감사합니다!`)
                  : rawKorean;

                let safeTranslated = rawTranslated;
                if (
                  locale !== "ko" &&
                  (!rawTranslated ||
                    isKoreanText(rawTranslated) ||
                    rawTranslated === rawKorean ||
                    rawTranslated.length < 35 ||
                    rawTranslated === "급여 차액에 대한 문의" ||
                    rawTranslated === "I would like to inquire about the discrepancy in my salary." ||
                    isKoreanInsufficient)
                ) {
                  if (locale === "en") {
                    safeTranslated = isBase
                      ? `Hello sir, thank you very much for always supporting and guiding me at work. While reviewing my salary details for ${period || "this period"}, I noticed a difference${diffStr ? ` of ${diffStr}` : ""} between the base salary specified in Article 4 of my employment contract and the base salary recorded on my payslip. Could you please check at your convenience whether there was any change to the contractual working hours or the base pay calculation criteria? I apologize for bothering you during your busy schedule, and thank you sincerely!`
                      : `Hello sir, thank you very much for all your hard work and for sending my salary for ${period || "this period"}. While checking my account, I noticed a discrepancy${diffStr ? ` of ${diffStr}` : ""} between the net pay stated on my payslip and the actual amount deposited into my bank account, so I am reaching out politely. Could you please check when you have a moment whether there were additional unlisted deductions—such as dormitory, meal expenses, or retroactive insurance adjustments—or perhaps a minor discrepancy during the bank transfer? I apologize for taking up your time during your busy schedule. Thank you sincerely for your continuous support and care!`;
                  } else if (locale === "vi") {
                    safeTranslated = isBase
                      ? `Xin chào giám đốc, em xin chân thành cảm ơn giám đốc đã luôn quan tâm và giúp đỡ em trong công việc. Khi đối chiếu chi tiết lương tháng ${period || "này"}, em nhận thấy có khoản chênh lệch${diffStr ? ` khoảng ${diffStr}` : ""} giữa mức lương cơ bản ghi trong Điều 4 của Hợp đồng lao động và mức lương cơ bản trên phiếu lương. Không biết có sự thay đổi nào về cách tính giờ làm việc quy định hay tiêu chuẩn lương cơ bản không ạ? Khi nào thuận tiện, nhờ giám đốc kiểm tra lại giúp em với ạ. Em xin cảm ơn rất nhiều!`
                      : `Xin chào giám đốc, em xin chân thành cảm ơn giám đốc đã vất vả và chuyển lương tháng ${period || "này"} cho em. Khi kiểm tra tài khoản, em thấy số tiền thực lĩnh ghi trên phiếu lương và số tiền thực tế nhận vào tài khoản ngân hàng có khoản chênh lệch${diffStr ? ` khoảng ${diffStr}` : ""}. Không biết công ty có khấu trừ thêm khoản nào ngoài phiếu lương như tiền ký túc xá, tiền ăn, bảo hiểm truy thu hay có nhầm lẫn trong quá trình chuyển khoản không ạ? Khi nào thuận tiện, nhờ giám đốc xem lại giúp em với ạ. Em xin lỗi vì đã làm phiền giám đốc trong lúc bận rộn. Em cảm ơn giám đốc rất nhiều!`;
                  } else if (locale === "zh") {
                    safeTranslated = isBase
                      ? `老板您好，非常感谢您在工作中一直以来对我的关照与支持。我在核对${period || "本月"}的工资明细时发现，劳动合同第四条约定的基本工资与本月收到的工资条上的基本工资之间存在${diffStr ? `约 ${diffStr}` : "一定"}的差额，因此想向您礼貌地请教一下。想请问是否因法定工作时间核算或基本工资计算标准有所调整呢？百忙之中打扰您十分抱歉，方便时请您帮忙确认一下。非常感谢您的指导与关怀！`
                      : `老板您好，辛苦您了，非常感谢您按时发放${period || "本月"}的工资。我在核对实到账目时注意到，工资条上载明的实发金额与我的银行账户实际到账金额之间存在${diffStr ? `约 ${diffStr}` : "一定"}的差额，因此想向您礼貌地咨询一下。想请问是否有未在明细中列出的扣款项目（如宿舍费、餐费、四大保险补扣等），或者是转账过程中出现了小差错？百忙之中给您添麻烦了，方便时请您帮忙查验一下。非常感谢老板一直以来的关照！`;
                  }
                }

                return (
                  <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-info/10 to-accent/20 border border-primary/20 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-primary">
                        <MessageSquareQuote className="size-4" />
                        <span>{t("pay.report.employerCardTitle")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-2xl bg-card text-xs font-bold text-primary hover:bg-accent hover:text-accent-foreground border border-border/60 shadow-xs h-8 px-3"
                          onClick={() => {
                            void navigator.clipboard.writeText(safeKorean);
                            toast.success(t("pay.report.copySuccess"));
                          }}
                        >
                          <Copy className="mr-1.5 size-3.5" />
                          {t("pay.report.copyKorean")}
                        </Button>
                        {locale !== "ko" && safeTranslated && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-2xl bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent border border-border/60 shadow-xs h-8 px-3"
                            onClick={() => {
                              void navigator.clipboard.writeText(safeTranslated);
                              toast.success(t("pay.report.copyTranslatedSuccess"));
                            }}
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            {t("pay.report.copyTranslated")}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-card p-4 border border-border/50 space-y-2.5">
                      <div>
                        <span className="text-[10px] font-black text-primary uppercase tracking-wider block mb-1">
                          {t("pay.report.employerKoreanLabel")}
                        </span>
                        <p className="text-xs leading-relaxed font-bold text-foreground bg-muted/40 rounded-xl p-2.5 whitespace-pre-line">
                          "{safeKorean}"
                        </p>
                      </div>

                      {locale !== "ko" && safeTranslated && (
                        <div className="border-t border-border/40 pt-2.5">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                            {t("pay.report.employerTranslatedLabel")}
                          </span>
                          <p className="text-xs leading-relaxed font-medium text-foreground bg-muted/40 rounded-xl p-2.5 whitespace-pre-line">
                            "{safeTranslated}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

