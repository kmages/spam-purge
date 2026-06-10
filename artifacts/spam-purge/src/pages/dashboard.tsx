import { useGetAuthStatus, useGetSpamCount, usePurgeSpam, useGetPurgeHistory, useDisconnectAuth, useGetSettings, useUpdateSettings, getGetSpamCountQueryKey, getGetPurgeHistoryQueryKey, getGetAuthStatusQueryKey, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { ShieldAlert, Trash2, LogOut, CheckCircle2, History, Loader2, AlertCircle, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: auth } = useGetAuthStatus();
  const { data: spamCount, isLoading: isSpamCountLoading } = useGetSpamCount();
  const { data: history, isLoading: isHistoryLoading } = useGetPurgeHistory();
  
  const { data: settings } = useGetSettings();
  const purgeSpam = usePurgeSpam();
  const disconnectAuth = useDisconnectAuth();
  const updateSettings = useUpdateSettings();

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalValue, setIntervalValue] = useState("60");

  useEffect(() => {
    if (settings) {
      setAutoEnabled(settings.autoPurgeEnabled);
      setIntervalValue(String(settings.autoPurgeIntervalMinutes));
    }
  }, [settings]);

  const minInterval = settings?.minIntervalMinutes ?? 1;
  const maxInterval = settings?.maxIntervalMinutes ?? 1440;

  const saveSettings = (enabled: boolean, minutes: number) => {
    const clamped = Math.min(maxInterval, Math.max(minInterval, Math.round(minutes) || minInterval));
    updateSettings.mutate(
      { data: { autoPurgeEnabled: enabled, autoPurgeIntervalMinutes: clamped } },
      {
        onSuccess: (result) => {
          setAutoEnabled(result.autoPurgeEnabled);
          setIntervalValue(String(result.autoPurgeIntervalMinutes));
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({
            title: result.autoPurgeEnabled ? "Auto-purge enabled" : "Auto-purge updated",
            description: result.autoPurgeEnabled
              ? `Spam will be purged automatically every ${result.autoPurgeIntervalMinutes} minute${result.autoPurgeIntervalMinutes !== 1 ? "s" : ""}.`
              : "Automatic purging is turned off.",
          });
        },
        onError: async (err: any) => {
          setAutoEnabled(settings?.autoPurgeEnabled ?? false);
          let description = "Could not update settings. Please try again.";
          try {
            const body = await err?.response?.json?.();
            if (body?.message) description = body.message;
          } catch {
            // ignore parse errors
          }
          toast({ variant: "destructive", title: "Update failed", description });
        },
      },
    );
  };

  const handleToggleAuto = (checked: boolean) => {
    setAutoEnabled(checked);
    saveSettings(checked, Number(intervalValue));
  };

  const handleIntervalCommit = () => {
    const minutes = Number(intervalValue);
    if (!Number.isFinite(minutes)) {
      setIntervalValue(String(settings?.autoPurgeIntervalMinutes ?? 60));
      return;
    }
    saveSettings(autoEnabled, minutes);
  };

  const handlePurge = () => {
    if (!spamCount || spamCount.count === 0) return;

    purgeSpam.mutate(undefined, {
      onSuccess: (result) => {
        if (result.success) {
          toast({
            title: "Purge Complete",
            description: `Permanently deleted ${result.deleted} spam messages.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetSpamCountQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPurgeHistoryQueryKey() });
        } else {
          toast({
            variant: "destructive",
            title: "Purge Failed",
            description: result.message || "An error occurred during the purge.",
          });
        }
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Purge Failed",
          description: "A network error occurred. Please try again.",
        });
      }
    });
  };

  const handleDisconnect = () => {
    disconnectAuth.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuthStatusQueryKey() });
        setLocation("/");
      }
    });
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">SPAM Purge</span>
          </div>
          
          <div className="flex items-center gap-4">
            {auth && (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-medium leading-none">{auth.name}</span>
                  <span className="text-xs text-muted-foreground">{auth.email}</span>
                </div>
                <Avatar className="h-9 w-9 border border-border">
                  {auth.picture && <AvatarImage src={auth.picture} alt={auth.name || "User"} />}
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {auth.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectAuth.isPending} title="Disconnect" className="gap-2 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-12">
        {/* Main Action Section */}
        <section className="flex flex-col items-center justify-center py-12">
          {isSpamCountLoading ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-mono">Scanning inbox...</p>
            </div>
          ) : spamCount?.count === 0 ? (
            <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">Your inbox is clean</h2>
                <p className="text-muted-foreground">No spam messages detected.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 w-full max-w-md animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground text-sm uppercase tracking-widest font-mono">Target Acquired</p>
                <div className="text-6xl md:text-8xl font-black text-white tracking-tighter">
                  {spamCount?.count.toLocaleString()}
                </div>
                <p className="text-muted-foreground text-lg">
                  spam messages • {formatBytes(spamCount?.sizeBytes)}
                </p>
              </div>

              <button
                onClick={handlePurge}
                disabled={purgeSpam.isPending}
                className="w-full relative group h-20 rounded-xl bg-destructive text-destructive-foreground font-bold text-xl md:text-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_40px_-10px_rgba(255,0,0,0.5)] hover:shadow-[0_0_60px_-15px_rgba(255,0,0,0.7)]"
              >
                <div className="absolute inset-0 bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {purgeSpam.isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Purging...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-6 h-6" />
                      Purge All Spam
                    </>
                  )}
                </span>
              </button>
            </div>
          )}
        </section>

        {/* Auto-purge Settings */}
        <section className="animate-in fade-in delay-100 fill-mode-both">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-primary" />
                <CardTitle>Automatic Purge</CardTitle>
              </div>
              <CardDescription>Let SPAM Purge delete spam on a schedule, even when you're away.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="auto-toggle" className="text-base">Enable auto-purge</Label>
                  <p className="text-sm text-muted-foreground">
                    {autoEnabled ? "Running automatically" : "Currently off"}
                  </p>
                </div>
                <Switch
                  id="auto-toggle"
                  checked={autoEnabled}
                  onCheckedChange={handleToggleAuto}
                  disabled={updateSettings.isPending}
                />
              </div>

              <Separator className="bg-border/50" />

              <div className="flex flex-col gap-2">
                <Label htmlFor="interval" className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Purge every
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="interval"
                    type="number"
                    min={minInterval}
                    max={maxInterval}
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(e.target.value)}
                    onBlur={handleIntervalCommit}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    disabled={updateSettings.isPending}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum {minInterval} minute{minInterval !== 1 ? "s" : ""} — the shortest interval Gmail's limits allow.
                  {settings?.lastRunAt && (
                    <> Last automatic purge: {format(new Date(settings.lastRunAt), "MMM dd, yyyy HH:mm")}.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* History Section */}
        <section className="mt-auto animate-in fade-in delay-200 fill-mode-both">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <CardTitle>Purge History</CardTitle>
              </div>
              <CardDescription>Recent annihilation records</CardDescription>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !history || history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 opacity-20" />
                  <p>No previous purges recorded.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.slice(0, 5).map((record, i) => (
                    <div key={record.id}>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary/50" />
                          <span className="text-sm text-muted-foreground font-mono">
                            {format(new Date(record.purgedAt), "MMM dd, yyyy HH:mm")}
                          </span>
                          {record.source === "auto" && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Auto
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-white">{record.deletedCount}</span>
                          <span className="text-muted-foreground">deleted</span>
                        </div>
                      </div>
                      {i < Math.min(history.length - 1, 4) && <Separator className="bg-border/50" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
