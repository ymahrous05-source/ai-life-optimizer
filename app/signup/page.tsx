import Link from "next/link";
import AuthForm from "../../components/auth/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-deck-bg px-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">
          Life Optimizer
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink-primary">
          Create your account
        </h1>
      </div>
      <AuthForm mode="signup" />
      <p className="font-body text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-energy-peak hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
