export const dynamic = 'force-dynamic';
import Link from "next/link";
import AuthForm from "../../components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-deck-bg px-4">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">
          Life Optimizer
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink-primary">Welcome back</h1>
      </div>
      <AuthForm mode="login" />
      <p className="font-body text-xs text-ink-muted">
        No account?{" "}
        <Link href="/signup" className="text-energy-peak hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
