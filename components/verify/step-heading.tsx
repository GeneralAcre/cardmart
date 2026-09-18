export function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {step}
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}
