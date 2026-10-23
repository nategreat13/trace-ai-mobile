"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Chip, Icon, ICONS, PrimaryButton } from "@/components/ui";
import { track } from "@/lib/analytics";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/contact";
import { useDeck, usePoints } from "@/lib/store";

/**
 * Contact us. Open to everyone, members or not. The email is prefilled from
 * what they gave us, and the message carries their airport, points and plan
 * so we can answer without asking.
 */
export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Contact />
    </Suspense>
  );
}

function Contact() {
  const { state, update, ready } = usePoints();
  const { values } = useDeck();
  const router = useRouter();
  const from = useSearchParams().get("from") ?? "";
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("Question");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (ready) setEmail((e) => e || state.email);
  }, [ready, state.email]);

  const valid = /.+@.+\..+/.test(email) && message.trim().length >= 2;

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(state.member ? "/discover" : "/");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          topic,
          message,
          website,
          context: { member: !!state.member, plan: state.member?.plan, airport: state.airport, points: values.total, page: from },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "We couldn't send that. Try again in a minute.");
      if (!state.email) update({ email });
      track("contact_sent", { topic });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-3 pb-10">
      <button type="button" aria-label="Back" onClick={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl">
        <Icon d={ICONS.back} size={22} stroke={2.4} />
      </button>

      {sent ? (
        <div className="rise flex flex-1 flex-col items-center justify-center gap-4 pb-20 text-center">
          <span className="check-in bg-trace flex h-16 w-16 items-center justify-center rounded-3xl text-white">
            <Check size={28} />
          </span>
          <h1 className="text-[28px] font-black">Got it, thanks</h1>
          <p className="max-w-[300px] text-[15.5px] leading-snug text-muted">
            A real person on the Trace team reads every message. We&apos;ll reply to <span className="font-bold text-ink">{email}</span>.
          </p>
          <PrimaryButton onClick={back} className="mt-2 w-full max-w-[300px]">
            Back to Trace
          </PrimaryButton>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5 pt-2">
          <div className="flex flex-col gap-1">
            <span className="bg-trace mb-2 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
              <Icon d={ICONS.mail} size={22} stroke={2.2} />
            </span>
            <h1 className="text-[30px] leading-tight font-black">Contact us</h1>
            <p className="text-[15px] leading-snug text-muted">Questions, bugs, ideas, a trip we should price. A real person reads every message.</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">What&apos;s it about?</span>
            <div className="flex flex-wrap gap-2">
              {CONTACT_TOPICS.map((t) => (
                <Chip key={t} on={topic === t} onClick={() => setTopic(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">Your email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-trace-red"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Tell us what's on your mind"
              className="rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] leading-snug outline-none focus:border-trace-red"
            />
          </label>

          {/* Honeypot: hidden from people, filled in by bots. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {error && <p role="alert" className="text-[14px] font-semibold text-trace-red">{error}</p>}

          <PrimaryButton type="submit" disabled={!valid || busy}>
            {busy ? "Sending…" : "Send message"}
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}
