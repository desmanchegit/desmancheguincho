import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Info, FileText, Send, Image as ImageIcon, Video, User, AlertCircle } from "lucide-react";
import img1 from "@/assets/images/order-img-1.jpg";
import img2 from "@/assets/images/order-img-2.jpg";

export default function DesmancheOrderDetails() {
  const { id } = useParams();
  
  // Mock data representing a detailed order
  const order = { 
    id: id || "PED-9923", 
    item: "Motor AP 1.8 Completo", 
    vehicle: "Volkswagen Gol CLI 1994", 
    location: "Curitiba, PR", 
    isPartner: false, 
    urgent: true, 
    proposals: 4, 
    desc: "Preciso do motor AP 1.8 completo, com nota fiscal de baixa para eu conseguir regularizar no Detran. Tenho preferência por um motor com baixa quilometragem que não precise de retífica imediata. \n\nImportante: Gostaria que viesse com as polias, admissão e se possível o alternador. Por favor, enviem fotos legíveis da numeração do bloco para eu consultar antes de fechar.",
    buyer: "Roberto Automotiva",
    buyerType: "Oficina Mecânica",
    images: [img1, img2],
    videoRequested: true
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/desmanche">
            <Button variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Detalhes do Pedido</h1>
            <span className="text-xs text-slate-500 font-mono">{order.id}</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 mt-8 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Main Info - Left Column */}
          <div className="md:col-span-2 space-y-6">
            
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-white text-sm py-1 px-3">Buscando Peça</Badge>
              {order.urgent && <Badge className="bg-red-500 text-white text-sm py-1 px-3">URGENTE</Badge>}
              {order.isPartner && <Badge variant="outline" className="border-blue-500 text-blue-700 text-sm py-1 px-3">Desmanche Parceiro</Badge>}
            </div>

            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">{order.item}</h2>
              <p className="text-xl text-slate-600 font-medium">Aplicação: {order.vehicle}</p>
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-slate-100 px-6 py-3 border-b flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-500" />
                  <h3 className="font-bold text-slate-700">Descrição e Especificações</h3>
                </div>
                <div className="p-6">
                  <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                    {order.desc}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-slate-100 px-6 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-slate-500" />
                    <h3 className="font-bold text-slate-700">Fotos de Referência</h3>
                  </div>
                  {order.videoRequested && (
                    <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700">
                      <Video className="w-3 h-3" /> Cliente pediu vídeo
                    </Badge>
                  )}
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  {order.images.map((img, idx) => (
                    <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={img} alt={`Referência ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column - Negotiation & Info */}
          <div className="space-y-6">
            
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2">Informações do Comprador</h3>
                
                <div className="flex items-start gap-3">
                  <div className="bg-slate-100 p-2 rounded-full">
                    <MapPin className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Local de Entrega</p>
                    <p className="text-sm text-slate-600">{order.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-slate-100 p-2 rounded-full">
                    <User className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{order.buyer}</p>
                    <p className="text-sm text-slate-600">{order.buyerType}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-slate-100 p-2 rounded-full">
                    <Info className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Concorrência</p>
                    <p className="text-sm text-slate-600">{order.proposals} desmanches já enviaram propostas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-white shadow-lg sticky top-24">
              <CardContent className="p-6">
                <h3 className="font-bold text-xl text-slate-900 mb-4">Enviar Proposta</h3>
                
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md flex gap-2 text-xs text-blue-800 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
                  <p>O primeiro contato é obrigatório via portal. Após enviar, o <strong>botão do WhatsApp</strong> do cliente será liberado.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Sua Mensagem</label>
                    <Textarea 
                      placeholder="Ex: Temos a peça em estoque. Motor testado com NF. O valor fica..." 
                      className="min-h-[120px] resize-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-1 block">Valor da Peça (R$)</label>
                      <Input placeholder="0,00" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-1 block">Frete Estimado</label>
                      <Input placeholder="0,00" />
                    </div>
                  </div>

                  <Button className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white mt-2">
                    Enviar Proposta <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}