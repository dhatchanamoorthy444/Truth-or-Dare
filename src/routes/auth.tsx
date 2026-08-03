import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthUser } from "@/lib/multiplayer";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Truth or Dare Online Multiplayer" },
      {
        name: "description",
        content:
          "Create a free player account to join live Truth or Dare parties, keep your XP, coins, rank and friends across every device.",
      },
      { property: "og:title", content: "Sign in to Truth or Dare Online" },
      {
        property: "og:description",
        content: "Save your rank, coins and party history across devices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/lobby" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password needs at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/lobby` },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      toast.success("Check your inbox to confirm your email, then sign in.");
      setMode("signin");
      return;
    }
    toast.success(mode === "signup" ? "Account created — you're in!" : "Welcome back!");
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Try again.");
  };

  return (
    <Shell>
      <h1 className="font-display text-3xl font-black">
        Play <span className="gradient-text">online</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        An account keeps your XP, coins, rank, friends and party history on every device. Solo mode
        still works without one.
      </p>

      <div className="glass mt-6 rounded-3xl p-5">
        <div className="mb-4 flex gap-1 rounded-2xl bg-secondary/50 p-1 text-xs font-bold">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl py-2 transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-secondary/60 px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl bg-secondary/60 px-4 py-3 text-sm outline-none"
          />
          <button
            disabled={busy}
            className="press-3d neon-glow w-full rounded-2xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          className="glass press-3d w-full rounded-2xl py-3 text-sm font-bold"
        >
          Continue with Google
        </button>
      </div>

      <button
        onClick={() => void navigate({ to: "/play" })}
        className="mt-4 w-full text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        Skip — play solo as a guest
      </button>
    </Shell>
  );
}