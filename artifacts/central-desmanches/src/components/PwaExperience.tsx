import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Download, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferredInstallPrompt: InstallPrompt | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as InstallPrompt;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener());
  });
}

function isInstalled() { return typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches; }
function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function urlBase64ToUint8Array(value: string) {
  const padded = value.padEnd(value.length + (4 - value.length % 4) % 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(padded), (char) => char.charCodeAt(0));
}
async function pushRequest(method: string, url: string, token: string | null, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Não foi possível atualizar as notificações.");
  return payload;
}

export function AppAndNotificationsCard({ authToken }: { authToken?: string | null }) {
  const { toast } = useToast();
  const [installAvailable, setInstallAvailable] = useState(Boolean(deferredInstallPrompt));
  const [installed, setInstalled] = useState(isInstalled);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<"install" | "notifications" | "test" | "disable" | null>(null);
  const token = authToken ?? getToken();

  useEffect(() => {
    const update = () => { setInstallAvailable(Boolean(deferredInstallPrompt)); setInstalled(isInstalled()); };
    installListeners.add(update); update();
    return () => { installListeners.delete(update); };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setSubscribed(Boolean(subscription))).catch(() => setSubscribed(false));
  }, []);

  const install = async () => {
    if (deferredInstallPrompt) {
      setBusy("install");
      try { await deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; } finally { setBusy(null); setInstallAvailable(Boolean(deferredInstallPrompt)); }
    } else if (isIos()) {
      toast({ title: "Adicionar à tela inicial", description: "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”." });
    } else {
      toast({ title: "Instalação disponível no navegador", description: "Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”." });
    }
  };
  const enableNotifications = async () => {
    if (!("serviceWorker" in navigator) || typeof Notification === "undefined" || !("PushManager" in window)) { toast({ title: "Recurso indisponível", description: "Este navegador não oferece notificações push.", variant: "destructive" }); return; }
    setBusy("notifications");
    try {
      const permission = await Notification.requestPermission(); setNotificationStatus(permission);
      if (permission !== "granted") { toast({ title: "Notificações não ativadas", description: "Você pode permitir quando quiser nas configurações do navegador." }); return; }
      const { publicKey } = await pushRequest("GET", "/api/push/public-key", token);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await pushRequest("POST", "/api/push/subscriptions", token, subscription.toJSON());
      setSubscribed(true); toast({ title: "Notificações ativadas", description: "Enviaremos uma notificação de teste agora." });
      await pushRequest("POST", "/api/push/test", token);
    } catch (error: any) { toast({ title: "Não foi possível ativar", description: error?.message || "Tente novamente.", variant: "destructive" }); }
    finally { setBusy(null); }
  };
  const disableNotifications = async () => {
    setBusy("disable");
    try {
      const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription();
      if (subscription) { await pushRequest("DELETE", "/api/push/subscriptions", token, { endpoint: subscription.endpoint }); await subscription.unsubscribe(); }
      setSubscribed(false); toast({ title: "Notificações desativadas" });
    } catch (error: any) { toast({ title: "Não foi possível desativar", description: error?.message || "Tente novamente.", variant: "destructive" }); }
    finally { setBusy(null); }
  };
  const sendTest = async () => {
    setBusy("test");
    try { const result = await pushRequest("POST", "/api/push/test", token); toast({ title: result.sent ? "Notificação enviada" : "Nenhum dispositivo ativo", description: result.sent ? "Verifique a notificação neste aparelho." : "Ative as notificações neste navegador primeiro." }); }
    catch (error: any) { toast({ title: "Não foi possível enviar o teste", description: error?.message || "Tente novamente.", variant: "destructive" }); }
    finally { setBusy(null); }
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5" /> Aplicativo e notificações</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Atalho na tela inicial</p><p className="text-sm text-muted-foreground">Use a Central como um aplicativo, sem precisar procurar no navegador.</p></div>{installed ? <span className="flex items-center gap-1 text-sm font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Instalado</span> : <Button variant="outline" onClick={install} disabled={busy === "install"}><Download className="mr-2 h-4 w-4" />{busy === "install" ? "Abrindo..." : installAvailable ? "Instalar app" : "Como adicionar"}</Button>}</div>
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Notificações</p><p className="text-sm text-muted-foreground">Receba avisos de propostas, mensagens e atualizações importantes.</p></div><div className="flex gap-2">{subscribed ? <><Button variant="outline" onClick={sendTest} disabled={busy !== null}><Send className="mr-2 h-4 w-4" /> Testar</Button><Button variant="outline" onClick={disableNotifications} disabled={busy !== null}><BellOff className="mr-2 h-4 w-4" /> Desativar</Button></> : <Button onClick={enableNotifications} disabled={busy !== null || notificationStatus === "unsupported"}><Bell className="mr-2 h-4 w-4" /> {busy === "notifications" ? "Ativando..." : notificationStatus === "denied" ? "Bloqueadas no navegador" : "Ativar"}</Button>}</div></div>
  </CardContent></Card>;
}

export function PwaSuggestion() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [installed] = useState(isInstalled);
  useEffect(() => {
    if (!user || installed) return;
    const key = `pwa-suggestion-dismissed:${user.id}`; if (localStorage.getItem(key)) return;
    const timer = window.setTimeout(() => setVisible(true), 45000); return () => window.clearTimeout(timer);
  }, [user?.id, installed]);
  if (!user || !visible || installed) return null;
  const dismiss = () => { localStorage.setItem(`pwa-suggestion-dismissed:${user.id}`, "1"); setVisible(false); };
  return <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-background p-4 shadow-xl"><div className="flex gap-3"><Smartphone className="mt-0.5 h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">Use como aplicativo</p><p className="mt-1 text-sm text-muted-foreground">Adicione um atalho e ative avisos importantes quando desejar.</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { dismiss(); window.location.assign(user.type === "desmanche" ? "/desmanche" : user.type === "admin" ? "/admin" : "/cliente"); }}>Ver opções</Button><Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button></div></div></div></div>;
}
