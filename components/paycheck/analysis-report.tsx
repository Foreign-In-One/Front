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
  HelpCircle,
  Loader2,
  MessageCircle,
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
  onOpenChat?: (promptText?: string) => void;
}

export function AnalysisReport({
  paycheckId,
  finding,
  period,
  workplace,
  onOpenChat,
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

  const handleTriggerChat = (customText?: string) => {
    const questionText =
      customText ||
      t("pay.report.askAiPrompt", {
        period,
        title: finding.title,
        fact: finding.fact || "",
      });

    if (onOpenChat) {
      onOpenChat(questionText);
    } else {
      window.dispatchEvent(
        new CustomEvent("open-paycycle-chat", {
          detail: { text: questionText },
        })
      );
    }
  };

  return (
    <div className="space-y-5 pc-rise">
      {/* 1. 기본 레벨 요약 카드 */}
      <LevelCard
        level={level}
        badge={statusLabel(finding.status)}
        title={finding.title}
        description={finding.fact || finding.title}
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
                <p className="text-xs font-black text-primary">{aiReport.headline}</p>
                <p className="text-xs leading-relaxed font-medium text-foreground">{aiReport.summary}</p>
              </div>

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
                            {cause.category}
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
              {aiReport.messageForEmployer && (
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
                          void navigator.clipboard.writeText(aiReport.messageForEmployer.korean);
                          toast.success(t("pay.report.copySuccess"));
                        }}
                      >
                        <Copy className="mr-1.5 size-3.5" />
                        {t("pay.report.copyKorean")}
                      </Button>
                      {locale !== "ko" && aiReport.messageForEmployer.translated && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-2xl bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent border border-border/60 shadow-xs h-8 px-3"
                          onClick={() => {
                            void navigator.clipboard.writeText(aiReport.messageForEmployer.translated);
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
                        🇰🇷 한국어 (사업주 전달용)
                      </span>
                      <p className="text-xs leading-relaxed font-bold text-foreground bg-muted/40 rounded-xl p-2.5">
                        "{aiReport.messageForEmployer.korean}"
                      </p>
                    </div>

                    {locale !== "ko" && aiReport.messageForEmployer.translated && (
                      <div className="border-t border-border/40 pt-2.5">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                          🌐 모국어 번역 (내용 확인용)
                        </span>
                        <p className="text-xs leading-relaxed font-medium text-foreground bg-muted/40 rounded-xl p-2.5">
                          "{aiReport.messageForEmployer.translated}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI 어시스턴트 추가 질문하기 버튼 */}
              <div className="pt-2">
                <Button
                  onClick={() => handleTriggerChat()}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="size-4" />
                  {t("pay.report.askAiButton")}
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

