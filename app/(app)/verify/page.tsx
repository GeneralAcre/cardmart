import { VerifyFlow } from "@/components/verify/verify-flow";

export default function VerifyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Verify &amp; List an Item</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Choose how you want to get on the platform: verify a certificate
          you already hold, or let us send a raw item out for grading.
        </p>
      </div>
      <VerifyFlow />
    </div>
  );
}
