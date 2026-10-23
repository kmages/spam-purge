import { ShieldAlert } from "lucide-react";

export default function ConnectPage() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 flex flex-col items-center text-center max-w-md px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-2xl">
          <ShieldAlert className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
          SPAM Purge
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Hate seeing spam? Gmail keeps spam and trash for 30 days. SPAM Purge deletes them permanently as they arrive, around the clock, on a schedule you choose.
        </p>
        <p className="text-base text-foreground/80 mb-10 border border-destructive/40 rounded-lg p-4 text-left">
          Be honest with yourself before you turn it on. Gmail's filter sometimes gets it wrong. If something you need lands in Spam, SPAM Purge deletes it, and it is gone forever. There is no undo.
        </p>

        <section className="w-full mb-10 text-left border border-border rounded-lg p-4 bg-card/60">
          <h2 className="text-lg font-semibold mb-2">Google will show a warning. Here's why.</h2>
          <p className="text-sm text-foreground/80 mb-3">
            Google shows "Google hasn't verified this app" for small independent apps that haven't paid for its yearly security audit. SPAM Purge is one person's app, not a big company. To continue, tap <strong>Advanced</strong>, then <strong>Go to spam-purge.com (unsafe)</strong>.
          </p>
          <img
            src="/google-warning.svg"
            alt="Illustration of Google's warning screen: tap Advanced, then Go to spam-purge.com (unsafe)"
            width={360}
            height={400}
            className="w-full max-w-[280px] h-auto mx-auto my-4 rounded-xl"
          />
          <p className="text-sm text-foreground/80">
            What SPAM Purge does with your Gmail: counts Spam and Trash, reads the sender and subject of spam, and deletes. It never reads message bodies, never reads your Inbox, and never sends anything.
          </p>
        </section>

        <a
          href="/api/auth/google"
          className="group relative inline-flex items-center justify-center h-14 px-8 rounded-lg bg-primary text-primary-foreground font-semibold text-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] pulse-primary"
        >
          <span className="relative z-10">Connect Gmail</span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </a>

        <p className="mt-6 text-sm text-muted-foreground/60">
          Google asks for full Gmail access because permanent deletion requires it.
        </p>
        <p className="mt-4 text-sm">
          <a href="/privacy" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Privacy policy</a>
        </p>
      </div>
    </div>
  );
}
