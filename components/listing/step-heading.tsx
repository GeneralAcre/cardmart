/** `tour` marks it for the Sell page tour (lib/tours.ts). */
export function StepHeading({ step, title, tour }: { step: number; title: string; tour?: string }) {
  return (
    <div className="flex items-center gap-2.5" data-tour={tour}>
      <span className="bg-success text-success-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {step}
      </span>
      <span className="text-success text-sm font-semibold">{title}</span>
    </div>
  );
}
