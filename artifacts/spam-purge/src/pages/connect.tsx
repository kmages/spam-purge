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

        <a
          href="/api/auth/google"
          className="group relative inline-flex items-center justify-center h-14 px-8 rounded-lg bg-primary text-primary-foreground font-semibold text-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] pulse-primary"
        >
          <span className="relative z-10">Connect Gmail</span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </a>

        <p className="mt-6 text-sm text-muted-foreground/60">
          Google will ask for full Gmail access, because permanent deletion requires it. SPAM Purge only counts, reads sender and subject in Spam, and deletes. It never reads message bodies.
        </p>
        <p className="mt-4 text-sm">
          <a href="/privacy" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Privacy policy</a>
        </p>
      </div>
    </div>
  );
}
