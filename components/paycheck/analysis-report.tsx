'use client';

import {
  AlertCircle,
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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type Level, LevelCard } from '@/components/wizard';
import { useT } from '@/i18n';
import { statusLabel } from '@/lib/paycycle/rule-engine';
import type { PayFinding } from '@/lib/paycycle/types';
import {
  type AiPaycheckReportDto,
  fetchAiPaycheckAnalysis,
  generateLocalAiPaycheckAnalysis,
} from '@/services/ai';

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

  const _findingKey = finding ? JSON.stringify(finding) : '';

  useEffect(() => {
    let active = true;
    async function loadAiAnalysis() {
      if (!finding || finding.status === 'MATCH') {
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
          console.warn('AI Analysis loading error:', err);
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
  }, [paycheckId, period, workplace, locale, finding]);

  if (!finding) return null;

  const isMatch = finding.status === 'MATCH';
  const level: Level =
    finding.status === 'MATCH'
      ? 'SUCCESS'
      : finding.status === 'INSUFFICIENT_DATA'
        ? 'NEED_INFO'
        : finding.status === 'EXPLANATION_REQUIRED'
          ? 'WARNING'
          : 'DANGER';

  return (
    <div className="pc-rise space-y-5">
      {/* 1. 기본 레벨 요약 카드 */}
      <LevelCard
        level={level}
        badge={statusLabel(finding.status)}
        title={finding.title}
        description={finding.fact || finding.title}
      />

      {/* 2. 정상 일치 (MATCH) 상태일 때의 신뢰 브리핑 */}
      {isMatch && (
        <div className="space-y-3 rounded-3xl border border-primary/20 bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-primary text-xs">
            <ShieldCheck className="size-5 text-primary" />
            <span>{t('pay.report.matchTitle')}</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('pay.report.matchDesc')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1 font-semibold text-[11px] text-primary">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" />{' '}
              {t('pay.report.contractBaseMatch')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" />{' '}
              {t('pay.report.statementNetMatch')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <CheckCircle2 className="size-3.5" />{' '}
              {t('pay.report.depositNetMatch')}
            </span>
          </div>
        </div>
      )}

      {/* 3. 불일치 및 확인 필요 시 노출되는 AI 심층 진단 리포트 */}
      {!isMatch && (
        <div className="space-y-6 rounded-3xl border border-primary/25 bg-card p-6 shadow-md backdrop-blur-md">
          {/* AI 리포트 상단 헤더 */}
          <div className="flex items-center justify-between border-border/50 border-b pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground text-sm">
                    {t('pay.report.aiTitle')}
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-[10px] text-primary">
                    <Sparkles className="size-3" /> {t('pay.report.aiComplete')}
                  </span>
                </div>
                <p className="mt-0.5 font-medium text-[11px] text-muted-foreground">
                  {t('pay.report.aiSubtitle')}
                </p>
              </div>
            </div>

            {loadingAi && (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
          </div>

          {/* AI 진단 헤드라인 & 요약 설명 */}
          {aiReport && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="font-bold text-primary text-xs">
                  {aiReport.headline}
                </p>
                <p className="font-medium text-foreground text-xs leading-relaxed">
                  {aiReport.summary}
                </p>
              </div>

              {/* 가설 및 원인 분석 */}
              {aiReport.causes && aiReport.causes.length > 0 && (
                <div className="space-y-2.5">
                  <h5 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                    <AlertCircle className="size-3.5 text-warn" />
                    {t('pay.report.causesTitle')}
                  </h5>
                  <div className="space-y-2">
                    {aiReport.causes.map((cause) => (
                      <div
                        key={cause.title}
                        className="space-y-1 rounded-2xl border border-border/70 bg-background/80 p-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-xs">
                            {cause.title}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-[10px] text-muted-foreground">
                            {cause.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {cause.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 법적 기준 및 권리 보호 안내 */}
              {aiReport.legalBasis && (
                <div className="space-y-2 rounded-2xl border border-info/20 bg-info-soft/40 p-4">
                  <div className="flex items-center gap-1.5 font-bold text-info-foreground text-xs dark:text-info">
                    <Scale className="size-4" />
                    <span>
                      {t('pay.report.lawBasisTitle')}: {aiReport.legalBasis.law}
                    </span>
                  </div>
                  <p className="font-medium text-foreground text-xs leading-relaxed">
                    {aiReport.legalBasis.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    💡{' '}
                    <span className="font-bold">
                      {t('pay.report.rightsNotice')}:
                    </span>{' '}
                    {aiReport.legalBasis.protectionNotice}
                  </p>
                </div>
              )}

              {/* 필수 확인 증빙 서류 */}
              {aiReport.requiredEvidence &&
                aiReport.requiredEvidence.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                      <FileCheck className="size-3.5 text-primary" />
                      {t('pay.report.evidenceTitle')}
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {aiReport.requiredEvidence.map((ev) => (
                        <span
                          key={ev}
                          className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-card px-3 py-1.5 font-semibold text-foreground text-xs shadow-2xs"
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
                  <h5 className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    {t('pay.report.actionGuideTitle')}
                  </h5>
                  <div className="space-y-2">
                    {aiReport.nextActions.map((action) => (
                      <div
                        key={action.step}
                        className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background p-3.5"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
                          {action.step}
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-xs">
                              {action.title}
                            </span>
                            {action.urgency === 'HIGH' && (
                              <span className="rounded-md bg-destructive/10 px-1.5 font-bold text-[9px] text-destructive">
                                {t('pay.report.urgentBadge')}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                <div className="space-y-3 rounded-3xl bg-secondary p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-primary text-xs">
                      <MessageSquareQuote className="size-4" />
                      <span>{t('pay.report.employerCardTitle')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-2xl border border-border/60 bg-card px-3 font-bold text-primary text-xs shadow-xs hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            aiReport.messageForEmployer.korean,
                          );
                          toast.success(t('pay.report.copySuccess'));
                        }}
                      >
                        <Copy className="mr-1.5 size-3.5" />
                        {t('pay.report.copyKorean')}
                      </Button>
                      {locale !== 'ko' &&
                        aiReport.messageForEmployer.translated && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-2xl border border-border/60 bg-card px-3 font-bold text-muted-foreground text-xs shadow-xs hover:bg-accent hover:text-foreground"
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                aiReport.messageForEmployer.translated,
                              );
                              toast.success(
                                t('pay.report.copyTranslatedSuccess'),
                              );
                            }}
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            {t('pay.report.copyTranslated')}
                          </Button>
                        )}
                    </div>
                  </div>

                  <div className="space-y-2.5 rounded-2xl border border-border/50 bg-card p-4">
                    <div>
                      <span className="mb-1 block font-bold text-[10px] text-primary uppercase tracking-wider">
                        🇰🇷 한국어 (사업주 전달용)
                      </span>
                      <p className="rounded-xl bg-muted/40 p-2.5 font-bold text-foreground text-xs leading-relaxed">
                        "{aiReport.messageForEmployer.korean}"
                      </p>
                    </div>

                    {locale !== 'ko' &&
                      aiReport.messageForEmployer.translated && (
                        <div className="border-border/40 border-t pt-2.5">
                          <span className="mb-1 block font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                            🌐 모국어 번역 (내용 확인용)
                          </span>
                          <p className="rounded-xl bg-muted/40 p-2.5 font-medium text-foreground text-xs leading-relaxed">
                            "{aiReport.messageForEmployer.translated}"
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
