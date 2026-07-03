import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Crown,
  LayoutDashboard,
  Store,
  Users,
  Package,
  DollarSign,
  CheckSquare,
  Globe,
  MessageCircleWarning,
  Settings,
  Edit3,
  Check,
  X,
  FileBarChart2,
  Power,
} from "lucide-react";

// All configurable tabs (permissions tab itself is always super-admin only)
export const ALL_ADMIN_TABS: { key: string; label: string; icon: any }[] = [
  { key: "overview",      label: "Visão Geral",           icon: LayoutDashboard },
  { key: "desmanches",    label: "Desmanches",             icon: Store },
  { key: "users",         label: "Pessoas Cadastradas",    icon: Users },
  { key: "orders",        label: "Anúncios / Pedidos",     icon: Package },
  { key: "finance",       label: "Assinaturas & Receitas", icon: DollarSign },
  { key: "approvals",     label: "Aprovações",             icon: CheckSquare },
  { key: "reports",       label: "Relatórios",             icon: FileBarChart2 },
  { key: "site-content",  label: "Conteúdo do Site",       icon: Globe },
  { key: "moderation",    label: "Moderação",              icon: MessageCircleWarning },
  { key: "guinchos",      label: "Guinchos",               icon: Settings },
  { key: "complaints",    label: "Reclamações",            icon: MessageCircleWarning },
  { key: "settings",      label: "Configurações",          icon: Settings },
  { key: "activity-log",  label: "Log de Atividades",      icon: Settings },
];

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  permissions: string[] | null;
  status: "active" | "inactive";
  created_at: number;
}

function PermissionToggles({
  permissions,
  onChange,
}: {
  permissions: string[];
  onChange: (perms: string[]) => void;
}) {
  const toggle = (key: string) => {
    if (permissions.includes(key)) {
      onChange(permissions.filter((p) => p !== key));
    } else {
      onChange([...permissions, key]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      {ALL_ADMIN_TABS.map((tab) => {
        const Icon = tab.icon;
        const enabled = permissions.includes(tab.key);
        return (
          <div
            key={tab.key}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
              enabled ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-muted"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`h-4 w-4 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={() => toggle(tab.key)}
              data-testid={`toggle-perm-${tab.key}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function PermissionsTab() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPerms, setEditingPerms] = useState<{ id: string; perms: string[] } | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsSuperAdmin, setNewIsSuperAdmin] = useState(false);
  const [newPerms, setNewPerms] = useState<string[]>(ALL_ADMIN_TABS.map((t) => t.key));

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/admin-users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/admin-users");
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/admin-users", {
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        password: newPassword,
        permissions: newIsSuperAdmin ? null : newPerms,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
      setNewIsSuperAdmin(false);
      setNewPerms(ALL_ADMIN_TABS.map((t) => t.key));
      toast({ title: "Admin criado com sucesso" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updatePermsMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] | null }) => {
      const res = await apiRequest("PATCH", `/api/admin/admin-users/${id}`, { permissions });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      setEditingPerms(null);
      toast({ title: "Permissões salvas" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/admin-users/${id}`);
      if (!res.ok) throw new Error("Erro ao remover");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      setDeleteTarget(null);
      toast({ title: "Admin removido" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const res = await apiRequest("PATCH", `/api/admin/admin-users/${id}/status`, { status });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao alterar status");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      toast({ title: vars.status === "active" ? "Admin ativado" : "Admin desativado" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const canCreate = newName.trim() && newEmail.trim() && newPassword.trim();

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Permissões</h1>
          <p className="text-muted-foreground">
            Cadastre usuários do painel admin e controle o que cada um pode acessar.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-new-admin">
          <UserPlus className="h-4 w-4 mr-2" /> Novo Admin
        </Button>
      </div>

      {/* Info card */}
      <div className="flex items-start gap-3 rounded-xl border bg-blue-50 border-blue-200 p-4 text-sm text-blue-800">
        <Crown className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-semibold">Super Admin</p>
          <p>Usuários marcados como super-admin têm acesso irrestrito a todas as seções, inclusive esta tela de permissões. Sub-admins só visualizam as seções liberadas.</p>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Nenhum admin cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => {
            const isSuperAdmin = admin.permissions === null;
            const isExpanded = expandedId === admin.id;
            const isEditing = editingPerms?.id === admin.id;
            const enabledCount = admin.permissions?.length ?? 0;

            const isActive = (admin.status ?? "active") === "active";
            return (
              <Card key={admin.id} className={`overflow-hidden ${!isActive ? "opacity-60" : ""}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : admin.id)}
                >
                  <div className={`p-2 rounded-lg ${isSuperAdmin ? "bg-yellow-100" : "bg-muted"}`}>
                    {isSuperAdmin
                      ? <Crown className="h-5 w-5 text-yellow-600" />
                      : <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{admin.name}</span>
                      {isSuperAdmin
                        ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Super Admin</Badge>
                        : <Badge variant="outline" className="text-xs">{enabledCount} / {ALL_ADMIN_TABS.length} seções</Badge>
                      }
                      {!isActive && (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200">Desativado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={isActive ? "text-muted-foreground hover:text-amber-600" : "text-muted-foreground hover:text-green-600"}
                      title={isActive ? "Desativar admin" : "Ativar admin"}
                      onClick={() => toggleStatusMutation.mutate({ id: admin.id, status: isActive ? "inactive" : "active" })}
                      disabled={toggleStatusMutation.isPending}
                      data-testid={`button-toggle-status-${admin.id}`}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setExpandedId(admin.id);
                        setEditingPerms({
                          id: admin.id,
                          perms: admin.permissions ?? ALL_ADMIN_TABS.map((t) => t.key),
                        });
                      }}
                      data-testid={`button-edit-${admin.id}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(admin)}
                      data-testid={`button-delete-${admin.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 space-y-4 bg-muted/10">
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm font-semibold">Controle de acesso</p>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPerms(null)}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updatePermsMutation.mutate({
                              id: admin.id,
                              permissions: isSuperAdmin ? null : editingPerms!.perms,
                            })}
                            disabled={updatePermsMutation.isPending}
                          >
                            {updatePermsMutation.isPending
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              : <Check className="h-3.5 w-3.5 mr-1" />
                            }
                            Salvar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPerms({
                            id: admin.id,
                            perms: admin.permissions ?? ALL_ADMIN_TABS.map((t) => t.key),
                          })}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      )}
                    </div>

                    {isSuperAdmin && !isEditing ? (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800 flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-600 shrink-0" />
                        Este admin tem acesso total a todas as seções (Super Admin).
                      </div>
                    ) : (
                      <PermissionToggles
                        permissions={isEditing ? editingPerms!.perms : (admin.permissions ?? [])}
                        onChange={isEditing
                          ? (perms) => setEditingPerms({ id: admin.id, perms })
                          : () => {}
                        }
                      />
                    )}

                    {isEditing && (
                      <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">Tornar Super Admin (acesso total)</span>
                        </div>
                        <Switch
                          checked={isSuperAdmin}
                          onCheckedChange={(checked) => {
                            updatePermsMutation.mutate({ id: admin.id, permissions: checked ? null : editingPerms!.perms });
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Novo Usuário Admin
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-new-admin-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  data-testid="input-new-admin-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha <span className="text-destructive">*</span></Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-admin-password"
                />
              </div>
            </div>

            {/* Super admin toggle */}
            <div className="flex items-center justify-between rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Super Admin</p>
                  <p className="text-xs text-yellow-700">Acesso irrestrito a todas as seções</p>
                </div>
              </div>
              <Switch
                checked={newIsSuperAdmin}
                onCheckedChange={setNewIsSuperAdmin}
                data-testid="toggle-new-super-admin"
              />
            </div>

            {/* Permission toggles */}
            {!newIsSuperAdmin && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Seções liberadas</Label>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-primary underline"
                      onClick={() => setNewPerms(ALL_ADMIN_TABS.map((t) => t.key))}
                    >
                      Todas
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      className="text-xs text-primary underline"
                      onClick={() => setNewPerms([])}
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>
                <PermissionToggles permissions={newPerms} onChange={setNewPerms} />
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
              data-testid="button-create-admin-submit"
            >
              {createMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</>
                : <><UserPlus className="h-4 w-4 mr-2" />Criar Admin</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover admin?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) será removido permanentemente do painel admin. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
