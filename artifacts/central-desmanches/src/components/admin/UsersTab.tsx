import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Mail, Phone, Calendar, ChevronRight, UserPlus, Loader2, Eye, EyeOff, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatMemberSince(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Há 1 dia";
  if (diffDays < 30) return `Há ${diffDays} dias`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "Há 1 mês";
  if (diffMonths < 12) return `Há ${diffMonths} meses`;
  const diffYears = Math.floor(diffMonths / 12);
  if (diffYears === 1) return "Há 1 ano";
  return `Há ${diffYears} anos`;
}

function typeBadge(type: string) {
  switch (type) {
    case "admin":
      return <Badge variant="destructive">Admin</Badge>;
    case "desmanche":
      return <Badge variant="secondary">Desmanche</Badge>;
    default:
      return <Badge variant="outline">Cliente</Badge>;
  }
}

const EMPTY_FORM = { name: "", email: "", phone: "", password: "" };

export default function UsersTab({ onSelectUser }: { onSelectUser?: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const res = await apiRequest("POST", "/api/admin/create-client", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar cliente");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Cliente cadastrado!", description: "O acesso foi criado e já está validado." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao alterar status");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: vars.status === "active" ? "Usuário ativado" : "Usuário desativado" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const set = (field: keyof typeof EMPTY_FORM, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const canSubmit = form.name && form.email && form.phone && form.password.length >= 6;

  const filtered = users.filter((user: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (user.name || "").toLowerCase().includes(q) ||
      (user.email || "").toLowerCase().includes(q) ||
      (user.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div data-tour="admin-users-content" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Pessoas Cadastradas</h1>
          <p className="text-muted-foreground">Compradores e mecânicos que buscam peças na plataforma.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2" data-testid="button-novo-cliente">
          <UserPlus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário por nome, email ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando usuários...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map((user: any) => {
            const isActive = (user.status ?? "active") === "active";
            return (
            <Card
              key={user.id}
              className={`transition-colors hover:shadow-sm ${isActive ? "hover:border-primary/50" : "opacity-60 border-dashed"}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/10 cursor-pointer" onClick={() => onSelectUser?.(user.id)}>
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                      {(user.name || "U")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    {typeBadge(user.type)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${isActive ? "text-muted-foreground hover:text-amber-600" : "text-muted-foreground hover:text-green-600"}`}
                      title={isActive ? "Desativar usuário" : "Ativar usuário"}
                      onClick={(e) => { e.stopPropagation(); toggleStatusMutation.mutate({ id: user.id, status: isActive ? "inactive" : "active" }); }}
                      disabled={toggleStatusMutation.isPending}
                      data-testid={`button-toggle-user-${user.id}`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => onSelectUser?.(user.id)} />
                  </div>
                </div>

                <h3 className="font-bold text-lg leading-none mb-1 cursor-pointer" onClick={() => onSelectUser?.(user.id)}>{user.name}</h3>
                {!isActive && <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200 mb-2">Desativado</Badge>}

                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  {user.createdAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Membro: {formatMemberSince(user.createdAt)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Modal Novo Cliente */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
            <DialogDescription>
              O cliente será criado já validado e poderá fazer login imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cli-name">Nome completo <span className="text-destructive">*</span></Label>
              <Input id="cli-name" placeholder="João da Silva" value={form.name}
                onChange={(e) => set("name", e.target.value)} data-testid="input-cli-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-email">E-mail <span className="text-destructive">*</span></Label>
              <Input id="cli-email" type="email" placeholder="joao@email.com" value={form.email}
                onChange={(e) => set("email", e.target.value)} data-testid="input-cli-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-phone">Telefone <span className="text-destructive">*</span></Label>
              <Input id="cli-phone" placeholder="(51) 9 9999-9999" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} data-testid="input-cli-phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-pw">Senha <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input id="cli-pw" type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                  value={form.password} onChange={(e) => set("password", e.target.value)}
                  data-testid="input-cli-password" className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw((p) => !p)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!canSubmit || createMutation.isPending}
                data-testid="button-cli-submit"
              >
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
