"use client";

import { FileText, Loader2, Landmark, Receipt, Sparkles, Upload } from "lucide-react";
import { WizardStep } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { won } from "@/lib/paycycle/format";
import type { DocKind, PayDocument } from "@/lib/paycycle/types";

const DOC_META: Record<
  DocKind,
  { label: any; hint: any; step: any; icon: typeof FileText }
> = {
  contract: {
    label: "pay.doc.contract",
    hint: "pay.doc.contract.h",
    step: "pay.step1",
    icon: FileText,
  },
  statement: {
    label: "pay.doc.statement",
    hint: "pay.doc.statement.h",
    step: "pay.step2",
    icon: Receipt,
  },
  deposit: {
    label: "pay.doc.deposit",
    hint: "pay.doc.deposit.h",
    step: "pay.step3",
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
  doc,
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
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm backdrop-blur space-y-4">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Icon className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">{t(meta.label)}</h3>
            <p className="text-xs text-muted-foreground">{t(meta.hint)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] px-5 py-3 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
            <Upload className="size-4" />
            {t("common.upload")}
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
            className="h-11 rounded-2xl border-border/80 px-4 text-xs font-bold shadow-xs hover:bg-accent hover:text-accent-foreground"
            onClick={onMock}
          >
            <Sparkles className="mr-1.5 size-4 text-info" />
            {t("common.mockBadge")}
          </Button>

          <Button
            variant="ghost"
            className="h-11 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            {t("common.manualInput")}
          </Button>
        </div>

        {isReading && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 p-4 text-xs font-bold text-primary border border-primary/20">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t("common.reading")}
          </div>
        )}
      </div>
    </WizardStep>
  );
}
