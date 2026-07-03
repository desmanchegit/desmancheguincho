import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gavel, Clock, ExternalLink, RefreshCw } from "lucide-react";

const auctions = [
  { id: "LEI-2024-89", name: "Leilão Detran/SP - Lote Veículos Inteiros", items: 450, end: "Encerra em 02:15:00", value: "R$ 1.2M estimado", status: "Ao Vivo", source: "Detran SP" },
  { id: "LEI-2024-90", name: "Sucatas e Peças Aproveitáveis - Seguradora", items: 120, end: "Encerra amanhã", value: "R$ 450k estimado", status: "Agendado", source: "Porto Seguro" },
  { id: "LEI-2024-88", name: "Leilão de Frota Renovada - Motos", items: 85, end: "Encerrado", value: "R$ 320k realizado", status: "Finalizado", source: "Prefeitura RJ" },
];

export default function AuctionsTab() {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <Badge className="bg-blue-500 hover:bg-blue-600 mb-2">Módulo de Scraping Ativo</Badge>
          <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Gavel className="h-8 w-8 text-blue-400" />
            Central de Leilões
          </h1>
          <p className="text-slate-300 max-w-xl mt-2">O sistema está varrendo automaticamente leilões credenciados do Brasil e os consolidando aqui para os desmanches assinantes.</p>
        </div>
        <Button variant="secondary" className="relative z-10">
          <RefreshCw className="mr-2 h-4 w-4" /> Forçar Varredura Agora
        </Button>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Gavel className="w-64 h-64 -translate-y-12 translate-x-12" />
        </div>
      </div>

      <div className="grid gap-6">
        {auctions.map((auction) => (
          <Card key={auction.id} className="border-2 overflow-hidden">
            <div className={`h-2 w-full ${auction.status === 'Ao Vivo' ? 'bg-red-500 animate-pulse' : auction.status === 'Agendado' ? 'bg-blue-500' : 'bg-slate-300'}`} />
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono">{auction.id}</Badge>
                    <Badge variant="secondary" className="bg-muted">{auction.source}</Badge>
                    {auction.status === 'Ao Vivo' && (
                      <Badge className="bg-red-500 hover:bg-red-600">AO VIVO</Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-bold">{auction.name}</h3>
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><PackageSearch className="h-4 w-4" /> {auction.items} lotes/itens</span>
                    <span className="flex items-center gap-1 font-medium text-foreground"><DollarSign className="h-4 w-4" /> {auction.value}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-start md:items-end justify-between">
                  <div className={`flex items-center gap-2 font-mono ${auction.status === 'Ao Vivo' ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                    <Clock className="h-4 w-4" />
                    {auction.end}
                  </div>
                  <Button className="mt-4" variant={auction.status === 'Finalizado' ? 'outline' : 'default'}>
                    Acessar Leilão <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Re-using icon
function PackageSearch(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function DollarSign(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}