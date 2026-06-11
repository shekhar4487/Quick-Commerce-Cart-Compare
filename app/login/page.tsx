"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const body = await res.json();
      if (res.ok) {
        setIdentifier(body.identifier); // normalized (+91…)
        setOtpSent(true);
        toast.success("OTP sent! Valid for 10 minutes.");
      } else {
        toast.error(body.error ?? "Could not send OTP.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const verifyAndSignIn = async () => {
    setBusy(true);
    const res = await signIn("otp", { identifier, code, redirect: false });
    setBusy(false);
    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      toast.error("Incorrect or expired OTP.");
    }
  };

  return (
    <div className="py-6">
      <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">Sign in to CartCompare</h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Your cards, lists aur comparison history — sab safe rahega.
      </p>

      <div className="flex flex-col gap-2.5">
        <Button variant="outline" className="h-12 text-foreground" onClick={() => signIn("google", { callbackUrl })}>
          <GoogleIcon /> Continue with Google
        </Button>
        <Button variant="outline" className="h-12 text-foreground" onClick={() => signIn("apple", { callbackUrl })}>
           Continue with Apple
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground/50">
        <div className="h-px flex-1 bg-border" />
        OR
        <div className="h-px flex-1 bg-border" />
      </div>

      {!otpSent ? (
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Email ya +91 mobile number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && identifier && sendOtp()}
            inputMode="email"
            autoComplete="email"
          />
          <Button onClick={sendOtp} disabled={!identifier.trim() || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP →"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            OTP sent to <span className="text-foreground">{identifier}</span>{" "}
            <button onClick={() => setOtpSent(false)} className="text-primary hover:underline">
              change
            </button>
          </p>
          <Input
            placeholder="6-digit OTP"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verifyAndSignIn()}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.5em]"
          />
          <Button onClick={verifyAndSignIn} disabled={code.length !== 6 || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign in"}
          </Button>
          <button onClick={sendOtp} disabled={busy} className="text-[13px] text-muted-foreground/60 hover:text-primary">
            Resend OTP
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
