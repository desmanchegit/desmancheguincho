import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  proposalLimit: number;
  exclusivitySlots: number;
  description?: string;
  active: boolean;
  createdAt: any;
}

const empty = (): Partial<Plan> => ({
  name: "",
  price: 0,
  proposalLimit: 20,
  exclusivitySlots: 0,
  description: "",
  active: true,
});

export default function PlansTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Plan }>({ open: false });
  const [form, setForm] = useState<Partial<Plan>>(empty());

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription-plans");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Plan>) => {
      if (dialog.editing) {
        const res = await apiRequest("PATCH", `/api/subscription-plans/${dialog.editing.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/subscription-plans", data);
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      setDialog({ open: false });
      toast({ title: dialog.editing ? "Plano atualizado!" : "Plano criado!" });
    },
    onError: () => toast({ title: "Erro ao salvar plano", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/subscription-plans/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plano removido" });
    },
    onError: () => toast({ title: "Erro ao remover plano", variant: "destructive" }),
  });

  const openCreate = () => {
    setForm(empty());
    setDialog({ open: true });
  };

  const openEdit = (plan: Plan) => {
    setForm({ ...plan });
    setDialog({ open: true, editing: plan });
  };

  const handleSave = () => {
    if (!form.name || !form.price) {
      toast({ title: "Nome e preço são obrigatórios", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const fmt = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Planos de Assinatura</h1>
          <p className="text-slate-500 mt-1">Crie e gerencie os pacotes disponíveis para os desmanches.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p>Nenhum plano cadastrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Preço/mês</TableHead>
                  <TableHead className="text-center">Limite Propostas</TableHead>
                  <TableHead className="text-center">Slots Exclusivos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{plan.name}</div>
                      {plan.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{plan.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {fmt(plan.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      {plan.proposalLimit >= 999 ? "Ilimitado" : plan.proposalLimit}
                    </TableCell>
                    <TableCell className="text-center">{plan.exclusivitySlots}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={plan.active
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"}
                      >
                        {plan.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:border-red-200"
                          onClick={() => deleteMutation.mutate(plan.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Nome do Plano</Label>
              <Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Plano Plus" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Preço Mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.price || 0} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label>Limite de Propostas</Label>
                <Input type="number" min={1} value={form.proposalLimit || 10} onChange={(e) => setForm((f) => ({ ...f, proposalLimit: parseInt(e.target.value) || 10 }))} />
                <p className="text-xs text-slate-400">999 = ilimitado</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Slots de Exclusividade</Label>
              <Input type="number" min={0} value={form.exclusivitySlots || 0} onChange={(e) => setForm((f) => ({ ...f, exclusivitySlots: parseInt(e.target.value) || 0 }))} />
              <p className="text-xs text-slate-400">Quantidade de clientes que só você pode responder por mês</p>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Descreva o plano brevemente" />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>Plano ativo (visível para desmanches)</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialog({ open: false })}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {dialog.editing ? "Salvar" : "Criar Plano"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
