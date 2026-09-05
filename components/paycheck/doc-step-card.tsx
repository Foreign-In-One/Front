'use client';

import {
  FileText,
  Landmark,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WizardStep } from '@/components/wizard';
import { type TKey, useT } from '@/i18n';
import type { DocKind, PayDocument } from '@/lib/paycycle/types';

const DOC_META: Record<
  DocKind,
  { label: TKey; hint: TKey; step: TKey; icon: typeof FileText }
> = {
  contract: {
    label: 'pay.doc.contract',
    hint: 'pay.doc.contract.h',
    step: 'pay.step1',
    icon: FileText,
  },
  statement: {
    label: 'pay.doc.statement',
    hint: 'pay.doc.statement.h',
    step: 'pay.step2',
    icon: Receipt,
  },
  deposit: {
    label: 'pay.doc.deposit',
    hint: 'pay.doc.deposit.h',
    step: 'pay.step3',
    icon: Landmark,
  },
};

interface DocStepCardProps {
  kind: DocKind;
  stepIndex: number;
  doc?: PayDocument;
  isReading: boolean;
  onUpload: (file: File) => void;
  onMock: () => void;
  onEdit: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function DocStepCard({
  kind,
  stepIndex,
  isReading,
  onUpload,
  onMock,
  onEdit,
  onPrev,
  onNext,
}: DocStepCardProps) {
  const { t } = useT();
  const meta = DOC_META[kind];
  const Icon = meta.icon;

  return (
    <WizardStep
      index={stepIndex}
      total={6}
      title={t(meta.step)}
      hint={t(meta.hint)}
      onPrev={onPrev}
      onNext={onNext}
    >
      <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3 border-border/50 border-b pb-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Icon className="size-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {t(meta.label)}
            </h3>
            <p className="text-muted-foreground text-xs">{t(meta.hint)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground text-xs transition-colors hover:bg-primary/90">
            <Upload className="size-4" />
            {t('common.upload')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>

          <Button
            variant="outline"
            className="h-11 rounded-2xl border-border/80 px-4 font-bold text-xs shadow-xs hover:bg-accent hover:text-accent-foreground"
            onClick={onMock}
          >
            <Sparkles className="mr-1.5 size-4 text-info" />
            {t('common.mockBadge')}
          </Button>

          <Button
            variant="ghost"
            className="h-11 rounded-2xl font-bold text-muted-foreground text-xs hover:text-foreground"
            onClick={onEdit}
          >
            {t('common.manualInput')}
          </Button>
        </div>

        {isReading && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/10 p-4 font-bold text-primary text-xs">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t('common.reading')}
          </div>
        )}
      </div>
    </WizardStep>
  );
}
