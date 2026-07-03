import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Lightbulb, MessageSquare, CheckCircle2, Clock,
  Loader2, Plus, ChevronDown, ChevronUp,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "sugestao",   label: "Sugestão",   icon: Lightbulb,      desc: "Sugestões para melhorar a plataforma",   color: "border-blue-400 bg-blue-950/20 text-blue-300" },
  { value: "reclamacao", label: "Reclamação",  icon: AlertTriangle,  desc: "Relate um problema ou insatisfação",      color: "border-orange-400 bg-orange-950/20 text-orange-300" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pendente",   color: "bg-yellow-900/30 text-yellow-300 border-yellow-700", icon: Clock },
  reviewing: { label: "Em análise", color: "bg-blue-900/30 text-blue-300 border-blue-700",       icon: Clock },
  resolved:  { label: "Resolvido",  color: "bg-green-900/30 text-green-300 border-green-700",    icon: CheckCircle2 },
  dismissed: { label: "Descartado", color: "bg-gray-800 text-gray-400 border-gray-700",          icon: CheckCircle2 },
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function DesmancheFeedbackTab() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: myComplaints = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/complaints/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/complaints/my");
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/complaints", {
        type: selectedType,
        subject: subject.trim(),
        message: message.trim(),
        targetType: "general",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints/my"] });
      setSelectedType(null);
      setSubject("");
      setMessage("");
      toast({ title: "Enviado com sucesso!", description: "Nossa equipe analisará em breve." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = selectedType && subject.trim() && message.trim();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Sugestões & Reclamações</h1>
        <p className="text-slate-400 text-sm">Sua opinião é importante para evoluirmos a plataforma.</p>
      </div>

      {/* Formulário */}
      <Card data-tour="desmanche-feedback-form" className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MessageSquare className="h-5 w-5 text-primary" />
            Enviar Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-slate-300">O que você quer enviar? <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedType(opt.value)}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      isSelected ? opt.color : "border-slate-600 hover:border-primary/50 text-slate-400"
                    }`}
                    data-testid={`btn-type-d-${opt.value}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">{opt.label}</span>
                    </div>
                    <p className="text-xs opacity-70 leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Assunto <span className="text-destructive">*</span></Label>
            <Input
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
              placeholder={selectedType === "sugestao" ? "Ex: Notificações por WhatsApp" : "Ex: Problema ao responder proposta"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Mensagem <span className="text-destructive">*</span></Label>
            <Textarea
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
              placeholder="Descreva com detalhes..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full"
          >
            {submitMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
              : <><Plus className="h-4 w-4 mr-2" />Enviar</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <div className="space-y-3">
        <h2 className="font-semibold text-white">Meus Envios</h2>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
          </div>
        ) : myComplaints.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Você ainda não enviou nenhum item.
          </div>
        ) : (
          myComplaints.map((c: any) => {
            const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === c.id;
            const typeLabel = c.type === "sugestao" ? "Sugestão" : "Reclamação";

            return (
              <Card key={c.id} className="bg-slate-800 border-slate-700 overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs text-slate-300 border-slate-600">{typeLabel}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusConf.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="font-medium text-sm text-white truncate">{c.subject}</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-700 bg-slate-900/30">
                    <p className="text-sm text-slate-400 pt-3">{c.message}</p>
                    {c.admin_notes && (
                      <div className="bg-blue-900/30 border border-blue-700 rounded-lg px-3 py-2 text-sm text-blue-300">
                        <span className="font-semibold">Resposta da equipe:</span> {c.admin_notes}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
