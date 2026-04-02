import { useState } from "react";

/**
 * Login Page (/auth/login)
 * Magic link email auth — no passwords
 */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to send");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to send. Please try again.",
      );
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[var(--green-primary)]">
            🌿 GutLog
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            Track food & symptoms. Find your triggers.
          </p>
        </div>

        {status === "sent" ? (
          <div className="bg-[var(--green-light)] border border-[var(--green-primary)]/30 rounded-[10px] p-4 text-center">
            <p className="text-2xl mb-2">📬</p>
            <p className="text-[13px] font-semibold text-[var(--green-primary)]">
              Check your email
            </p>
            <p className="text-xs text-[var(--green-primary)] mt-1">
              We sent a login link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold text-[var(--text-label)] block mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-2.5 py-2.5 rounded-md border border-[var(--border-default)] focus:border-[var(--green-primary)] focus:ring-2 focus:ring-[var(--green-primary)]/15 outline-none transition-colors text-[13px] bg-[var(--bg-input)] text-[var(--text-primary)]"
                aria-describedby={status === "error" ? "error-msg" : undefined}
              />
            </div>

            {status === "error" && (
              <p id="error-msg" className="text-xs text-red-600" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-2.5 bg-[var(--green-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--green-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>

            <p className="text-[11px] text-[var(--text-muted)] text-center">
              No password needed — we'll email you a login link
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
