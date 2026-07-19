import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppAndNotificationsCard } from "@/components/PwaExperience";
import {
  User,
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

function validateBrPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    return ddd >= 11 && ddd <= 99 && digits[2] === "9";
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits[4] === "9";
  }
  return false;
}

function formatWhatsappLink(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `https://wa.me/55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `https://wa.me/${digits}`;
  return null;
}

export function ProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || "");
  const [whatsappContactPreference, setWhatsappContactPreference] = useState<"whatsapp" | "chat_only">(
    (user as any)?.whatsappContactPreference || "whatsapp"
  );

  const [zipCode, setZipCode] = useState(user?.address?.zipCode || "");
  const [street, setStreet] = useState(user?.address?.street || "");
  const [number, setNumber] = useState(user?.address?.number || "");
  const [complement, setComplement] = useState(user?.address?.complement || "");
  const [city, setCity] = useState(user?.address?.city || "");
  const [state, setState] = useState(user?.address?.state || "");
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setWhatsapp(user.whatsapp || "");
      setWhatsappContactPreference((user as any)?.whatsappContactPreference || "whatsapp");
      setZipCode(user.address?.zipCode || "");
      setStreet(user.address?.street || "");
      setNumber(user.address?.number || "");
      setComplement(user.address?.complement || "");
      setCity(user.address?.city || "");
      setState(user.address?.state || "");
    }
  }, [user?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!zipCode || !street || !city || !state) {
        throw new Error("Preencha CEP, rua, cidade e estado.");
      }
      const [profileRes, addressRes] = await Promise.all([
        apiRequest("PATCH", "/api/users/me", { name, email, phone, whatsapp, whatsappContactPreference }),
        apiRequest("PUT", "/api/users/me/address", { zipCode, street, number, complement, city, state }),
      ]);
      return Promise.all([profileRes.json(), addressRes.json()]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({ title: "Perfil salvo", description: "Seus dados foram atualizados com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente.", variant: "destructive" });
    },
  });

  const fetchCep = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || "");
        setCity(data.localidade || "");
        setState(data.uf || "");
        setComplement(data.complemento || "");
      }
    } catch {}
    finally { setCepLoading(false); }
  };

  const whatsappValid = validateBrPhone(whatsapp);
  const whatsappLink = formatWhatsappLink(whatsapp);
  const isProfileComplete = user?.profileComplete;

  return (
    <div className="space-y-6">
      {!isProfileComplete && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Complete seu perfil para negociar peças
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Informe seu WhatsApp e endereço completo para criar pedidos e receber propostas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isProfileComplete && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-green-800 dark:text-green-200">
                Perfil completo! Você pode criar pedidos e negociar peças.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefone
              </Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                {!whatsapp && <Badge variant="destructive" className="ml-1 text-xs">Obrigatório</Badge>}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={whatsapp ? (whatsappValid ? "border-green-500 pr-8" : "border-destructive pr-8") : ""}
                  />
                  {whatsapp && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {whatsappValid
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <AlertCircle className="h-4 w-4 text-destructive" />
                      }
                    </div>
                  )}
                </div>
                {whatsappLink && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Testar número no WhatsApp"
                    onClick={() => window.open(whatsappLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 text-green-600" />
                  </Button>
                )}
              </div>
              {whatsapp && !whatsappValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Número inválido. Use o formato (DDD) 9XXXX-XXXX
                </p>
              )}
              {whatsapp && whatsappValid && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Formato válido. Clique no botão para testar no WhatsApp.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-muted-foreground" /> Preferência de contato pelos desmanches
            </Label>
            <p className="text-xs text-muted-foreground">
              Escolha como os desmanches interessados poderão entrar em contato com você após aceitar uma proposta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                data-testid="preference-whatsapp"
                onClick={() => setWhatsappContactPreference("whatsapp")}
                className={`flex-1 flex items-start gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  whatsappContactPreference === "whatsapp"
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  whatsappContactPreference === "whatsapp" ? "border-green-600" : "border-muted-foreground"
                }`}>
                  {whatsappContactPreference === "whatsapp" && (
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" /> Permitir contato via WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O desmanche poderá ver e usar seu número de WhatsApp para negociar diretamente.
                  </p>
                </div>
              </button>

              <button
                type="button"
                data-testid="preference-chat-only"
                onClick={() => setWhatsappContactPreference("chat_only")}
                className={`flex-1 flex items-start gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  whatsappContactPreference === "chat_only"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  whatsappContactPreference === "chat_only" ? "border-blue-600" : "border-muted-foreground"
                }`}>
                  {whatsappContactPreference === "chat_only" && (
                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Somente pelo chat da plataforma
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Seu WhatsApp não será compartilhado. A comunicação acontece apenas pelo chat interno.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço
            {!user?.address && <Badge variant="destructive" className="ml-2 text-xs">Obrigatório</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zipCode">CEP</Label>
              <div className="relative">
                <Input
                  id="zipCode"
                  value={zipCode}
                  onChange={(e) => {
                    setZipCode(e.target.value);
                    fetchCep(e.target.value);
                  }}
                  placeholder="00000-000"
                  className="pr-8"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="street">Rua / Avenida</Label>
              <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, Bloco..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="SP" maxLength={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <AppAndNotificationsCard />

      <Button
        size="lg"
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
          : <><Save className="h-4 w-4 mr-2" /> Salvar Perfil Completo</>
        }
      </Button>
    </div>
  );
}
