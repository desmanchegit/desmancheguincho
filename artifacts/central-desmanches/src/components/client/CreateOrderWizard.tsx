import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Camera, X, Loader2, Plus, ChevronDown, Trash2, Check } from "lucide-react";

// ─── VEHICLE TYPES ───────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { id: "car",          label: "Carro",           icon: "🚗", fipe: "carros" },
  { id: "motorcycle",   label: "Moto",            icon: "🏍️", fipe: "motos" },
  { id: "truck",        label: "Caminhão",        icon: "🚛", fipe: "caminhoes" },
  { id: "bus",          label: "Ônibus",          icon: "🚌", fipe: null },
  { id: "van",          label: "Van / Utilitário",icon: "🚐", fipe: null },
  { id: "agricultural", label: "Trator / Agrícola",icon:"🚜", fipe: null },
  { id: "other",        label: "Outro",           icon: "🔧", fipe: null },
];

const STATIC_BRANDS: Record<string, string[]> = {
  bus:          ["Mercedes-Benz","Volvo","Scania","Marcopolo","Busscar","Caio"],
  van:          ["Fiat","Mercedes-Benz","Ford","Volkswagen","Renault","Citroën","Hyundai"],
  agricultural: ["John Deere","New Holland","Case","Massey Ferguson","Valtra","Agrale"],
  other:        [],
};

// ─── CATEGORIES & PARTS ───────────────────────────────────────────────────────

const CATEGORIES: Record<string, { id: string; label: string; emoji: string }[]> = {
  car: [
    { id: "engine",    label: "Motor e Transmissão",  emoji: "⚙️" },
    { id: "brakes",    label: "Freios",                emoji: "🛑" },
    { id: "suspension",label: "Suspensão / Direção",   emoji: "🔩" },
    { id: "body",      label: "Carroceria / Lataria",  emoji: "🚗" },
    { id: "glass",     label: "Vidros e Espelhos",     emoji: "🪟" },
    { id: "lighting",  label: "Iluminação",            emoji: "💡" },
    { id: "interior",  label: "Interior",              emoji: "🪑" },
    { id: "electrical",label: "Elétrica / Eletrônica", emoji: "⚡" },
    { id: "wheels",    label: "Rodas e Pneus",         emoji: "⭕" },
    { id: "cooling",   label: "Arrefecimento",         emoji: "❄️" },
    { id: "fuel",      label: "Sistema de Combustível",emoji: "⛽" },
    { id: "exhaust",   label: "Escapamento",           emoji: "💨" },
    { id: "clutch",    label: "Embreagem",             emoji: "🔧" },
    { id: "other",     label: "Outro",                 emoji: "❓" },
  ],
  motorcycle: [
    { id: "engine",    label: "Motor",                 emoji: "⚙️" },
    { id: "brakes",    label: "Freios",                emoji: "🛑" },
    { id: "suspension",label: "Suspensão",             emoji: "🔩" },
    { id: "body",      label: "Carenagem / Lataria",   emoji: "🏍️" },
    { id: "lighting",  label: "Iluminação",            emoji: "💡" },
    { id: "wheels",    label: "Rodas e Pneus",         emoji: "⭕" },
    { id: "electrical",label: "Elétrica",              emoji: "⚡" },
    { id: "exhaust",   label: "Escapamento",           emoji: "💨" },
    { id: "fuel",      label: "Tanque / Combustível",  emoji: "⛽" },
    { id: "other",     label: "Outro",                 emoji: "❓" },
  ],
  truck: [
    { id: "engine",    label: "Motor e Transmissão",   emoji: "⚙️" },
    { id: "brakes",    label: "Freios",                emoji: "🛑" },
    { id: "suspension",label: "Suspensão",             emoji: "🔩" },
    { id: "body",      label: "Cabine / Carroceria",   emoji: "🚛" },
    { id: "lighting",  label: "Iluminação",            emoji: "💡" },
    { id: "wheels",    label: "Rodas e Pneus",         emoji: "⭕" },
    { id: "electrical",label: "Elétrica",              emoji: "⚡" },
    { id: "exhaust",   label: "Escapamento",           emoji: "💨" },
    { id: "fuel",      label: "Sistema de Combustível",emoji: "⛽" },
    { id: "hydraulics",label: "Sistema Hidráulico",    emoji: "💧" },
    { id: "other",     label: "Outro",                 emoji: "❓" },
  ],
};

const GENERIC_CATEGORIES = [
  { id: "engine",    label: "Motor / Propulsão",   emoji: "⚙️" },
  { id: "body",      label: "Estrutura / Corpo",   emoji: "🔩" },
  { id: "electrical",label: "Elétrica",            emoji: "⚡" },
  { id: "wheels",    label: "Rodas / Deslocamento",emoji: "⭕" },
  { id: "other",     label: "Outro",               emoji: "❓" },
];

interface PartDef { id: string; label: string; pos?: string }

const PARTS: Record<string, PartDef[]> = {
  engine: [
    { id: "motor_completo",   label: "Motor Completo" },
    { id: "bloco_motor",      label: "Bloco do Motor" },
    { id: "cabecote",         label: "Cabeçote" },
    { id: "pistao",           label: "Pistão / Anel" },
    { id: "virabrequim",      label: "Virabrequim" },
    { id: "arvore_cames",     label: "Árvore de Cames" },
    { id: "bomba_oleo",       label: "Bomba de Óleo" },
    { id: "correia_dist",     label: "Correia / Corrente de Distribuição" },
    { id: "coletor_admissao", label: "Coletor de Admissão" },
    { id: "turbina",          label: "Turbina / Turbocompressor" },
    { id: "cambio_manual",    label: "Câmbio Manual" },
    { id: "cambio_auto",      label: "Câmbio Automático" },
    { id: "cambio_cvt",       label: "Câmbio CVT" },
    { id: "semi_eixo",        label: "Semi-eixo / Homocinética" },
    { id: "diferencial",      label: "Diferencial" },
    { id: "outro_motor",      label: "Outro (descrevo nos detalhes)" },
  ],
  brakes: [
    { id: "disco_freio",      label: "Disco de Freio",            pos: "axle_side" },
    { id: "tambor_freio",     label: "Tambor de Freio",           pos: "axle_side" },
    { id: "pastilha_freio",   label: "Pastilha de Freio",         pos: "axle" },
    { id: "lona_freio",       label: "Lona de Freio",             pos: "axle" },
    { id: "pinca_calibre",    label: "Pinça / Cáliper",           pos: "axle_side" },
    { id: "cilindro_mestre",  label: "Cilindro Mestre" },
    { id: "modulo_abs",       label: "Módulo ABS" },
    { id: "servo_freio",      label: "Servo Freio" },
    { id: "outro_freio",      label: "Outro (descrevo nos detalhes)" },
  ],
  suspension: [
    { id: "amortecedor",      label: "Amortecedor",               pos: "axle_side" },
    { id: "mola",             label: "Mola",                      pos: "axle_side" },
    { id: "bandeja",          label: "Bandeja / Braço de Controle",pos:"axle_side" },
    { id: "pivo",             label: "Pivô / Ball Joint",         pos: "axle_side" },
    { id: "barra_estab",      label: "Barra Estabilizadora",      pos: "axle" },
    { id: "terminal_dir",     label: "Terminal de Direção",       pos: "side" },
    { id: "cremalheira",      label: "Caixa de Direção / Cremalheira" },
    { id: "bomba_dir_hid",    label: "Bomba de Direção Hidráulica" },
    { id: "outro_susp",       label: "Outro (descrevo nos detalhes)" },
  ],
  body: [
    { id: "porta",            label: "Porta",                     pos: "axle_side" },
    { id: "capo",             label: "Capô" },
    { id: "tampa_traseira",   label: "Tampa Traseira / Porta-malas" },
    { id: "para_lama",        label: "Para-lama",                 pos: "axle_side" },
    { id: "para_choque",      label: "Para-choque",               pos: "axle_front_rear" },
    { id: "teto",             label: "Teto" },
    { id: "longarina",        label: "Longarina / Soleira",       pos: "side" },
    { id: "outro_lat",        label: "Outro (descrevo nos detalhes)" },
  ],
  glass: [
    { id: "parabrisa",        label: "Para-brisa" },
    { id: "vidro_traseiro",   label: "Vidro Traseiro" },
    { id: "vidro_lateral",    label: "Vidro Lateral",             pos: "axle_side" },
    { id: "espelho_ext",      label: "Espelho Retrovisor Externo",pos: "side" },
    { id: "espelho_int",      label: "Espelho Retrovisor Interno" },
    { id: "outro_vidro",      label: "Outro (descrevo nos detalhes)" },
  ],
  lighting: [
    { id: "farol",            label: "Farol Dianteiro",           pos: "side" },
    { id: "lanterna",         label: "Lanterna Traseira",         pos: "side" },
    { id: "farol_milha",      label: "Farol de Milha / Neblina",  pos: "axle_side" },
    { id: "pisca",            label: "Pisca-pisca / Seta",        pos: "full" },
    { id: "drl",              label: "DRL / Luz Diurna",          pos: "side" },
    { id: "outro_ilum",       label: "Outro (descrevo nos detalhes)" },
  ],
  interior: [
    { id: "banco_assento",    label: "Banco / Assento",           pos: "axle_side" },
    { id: "painel_dashboard", label: "Painel / Dashboard" },
    { id: "forro_porta",      label: "Forro de Porta",            pos: "axle_side" },
    { id: "console_central",  label: "Console Central" },
    { id: "volante",          label: "Volante" },
    { id: "painel_instrum",   label: "Painel de Instrumentos" },
    { id: "outro_int",        label: "Outro (descrevo nos detalhes)" },
  ],
  electrical: [
    { id: "alternador",       label: "Alternador" },
    { id: "motor_partida",    label: "Motor de Partida" },
    { id: "bateria",          label: "Bateria" },
    { id: "caixa_fusiveis",   label: "Caixa de Fusíveis" },
    { id: "modulo_ecu",       label: "Módulo / ECU" },
    { id: "chicote",          label: "Chicote Elétrico" },
    { id: "sensor",           label: "Sensor (especifique nos detalhes)" },
    { id: "outro_elet",       label: "Outro (descrevo nos detalhes)" },
  ],
  wheels: [
    { id: "roda_aro",         label: "Roda / Aro",                pos: "all4" },
    { id: "cubo_roda",        label: "Cubo de Roda",              pos: "axle_side" },
    { id: "rolamento",        label: "Rolamento de Roda",         pos: "axle_side" },
    { id: "pneu",             label: "Pneu",                      pos: "all4" },
    { id: "outro_roda",       label: "Outro (descrevo nos detalhes)" },
  ],
  cooling: [
    { id: "radiador",         label: "Radiador" },
    { id: "bomba_agua",       label: "Bomba D'água" },
    { id: "ventoinha",        label: "Ventoinha / Eletro-ventilador" },
    { id: "intercooler",      label: "Intercooler" },
    { id: "outro_arref",      label: "Outro (descrevo nos detalhes)" },
  ],
  fuel: [
    { id: "bomba_comb",       label: "Bomba de Combustível" },
    { id: "injetor",          label: "Injetor de Combustível" },
    { id: "filtro_comb",      label: "Filtro de Combustível" },
    { id: "tanque",           label: "Tanque / Reservatório" },
    { id: "corpo_borboleta",  label: "Corpo de Borboleta / TBI" },
    { id: "outro_comb",       label: "Outro (descrevo nos detalhes)" },
  ],
  exhaust: [
    { id: "silencioso",       label: "Silencioso / Muffler" },
    { id: "catalisador",      label: "Catalisador" },
    { id: "tubo_flex",        label: "Tubo Flex / Intermediário" },
    { id: "cano_esc",         label: "Cano de Escapamento" },
    { id: "outro_esc",        label: "Outro (descrevo nos detalhes)" },
  ],
  clutch: [
    { id: "disco_emb",        label: "Disco de Embreagem" },
    { id: "plato_emb",        label: "Platô / Pressure Plate" },
    { id: "rolamento_emb",    label: "Rolamento de Embreagem" },
    { id: "volante_motor",    label: "Volante do Motor" },
    { id: "outro_emb",        label: "Outro (descrevo nos detalhes)" },
  ],
  hydraulics: [
    { id: "bomba_hid",        label: "Bomba Hidráulica" },
    { id: "cilindro_hid",     label: "Cilindro Hidráulico" },
    { id: "mangueira_hid",    label: "Mangueira Hidráulica" },
    { id: "outro_hid",        label: "Outro (descrevo nos detalhes)" },
  ],
  other: [{ id: "outro", label: "Descrevo nos detalhes" }],
};

const POSITIONS: Record<string, { id: string; label: string }[]> = {
  side:           [{ id:"esquerdo",label:"Esquerdo"},{ id:"direito",label:"Direito"},{ id:"par",label:"Par (ambos)"}],
  axle:           [{ id:"dianteiro",label:"Dianteiro"},{ id:"traseiro",label:"Traseiro"},{ id:"eixo_par",label:"Par (ambos eixos)"}],
  axle_front_rear:[{ id:"dianteiro",label:"Dianteiro"},{ id:"traseiro",label:"Traseiro"}],
  axle_side:      [{ id:"dianteiro_esquerdo",label:"Dianteiro Esq."},{ id:"dianteiro_direito",label:"Dianteiro Dir."},{ id:"traseiro_esquerdo",label:"Traseiro Esq."},{ id:"traseiro_direito",label:"Traseiro Dir."},{ id:"par_dianteiro",label:"Par Dianteiro"},{ id:"par_traseiro",label:"Par Traseiro"},{ id:"todos",label:"Todos (4)"}],
  all4:           [{ id:"dianteiro_esquerdo",label:"Dianteiro Esq."},{ id:"dianteiro_direito",label:"Dianteiro Dir."},{ id:"traseiro_esquerdo",label:"Traseiro Esq."},{ id:"traseiro_direito",label:"Traseiro Dir."},{ id:"todos",label:"Todos (4)"}],
  full:           [{ id:"dianteiro_esquerdo",label:"Dianteiro Esq."},{ id:"dianteiro_direito",label:"Dianteiro Dir."},{ id:"traseiro_esquerdo",label:"Traseiro Esq."},{ id:"traseiro_direito",label:"Traseiro Dir."},{ id:"lateral_esquerdo",label:"Lateral Esq."},{ id:"lateral_direito",label:"Lateral Dir."}],
};

// ─── FIPE HELPERS ─────────────────────────────────────────────────────────────

async function fetchFipeBrands(fipeType: string): Promise<{ codigo: string; nome: string }[]> {
  const res = await fetch(`https://parallelum.com.br/fipe/api/v1/${fipeType}/marcas`);
  if (!res.ok) throw new Error("FIPE unavailable");
  return res.json();
}

async function fetchFipeModels(fipeType: string, brandCode: string): Promise<{ codigo: string; nome: string }[]> {
  const res = await fetch(`https://parallelum.com.br/fipe/api/v1/${fipeType}/marcas/${brandCode}/modelos`);
  if (!res.ok) throw new Error("FIPE unavailable");
  const data = await res.json();
  return data.modelos || [];
}

// ─── FORM STATE ───────────────────────────────────────────────────────────────

interface FormState {
  vehicleType: string;
  vehicleBrand: string;
  vehicleBrandCode: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  partCategory: string;
  partName: string;
  customPartName: string;
  partPosition: string;
  description: string;
  urgency: string;
  photos: File[];
}

const EMPTY: FormState = {
  vehicleType: "", vehicleBrand: "", vehicleBrandCode: "", vehicleModel: "",
  vehicleYear: "", vehiclePlate: "", partCategory: "", partName: "",
  customPartName: "", partPosition: "", description: "", urgency: "normal", photos: [],
};

function isCustomPart(partId: string): boolean {
  return partId.startsWith("outro") || partId === "outro";
}

function buildTitle(s: FormState): string {
  const parts: string[] = [];
  if (s.partName) {
    if (isCustomPart(s.partName) && s.customPartName.trim()) {
      parts.push(s.customPartName.trim());
    } else {
      const partDef = Object.values(PARTS).flat().find((p) => p.id === s.partName);
      if (partDef) parts.push(partDef.label);
    }
  }
  const vehicle: string[] = [];
  if (s.vehicleBrand) vehicle.push(s.vehicleBrand);
  if (s.vehicleModel) vehicle.push(s.vehicleModel);
  if (s.vehicleYear) vehicle.push(s.vehicleYear);
  if (vehicle.length) parts.push(`- ${vehicle.join(" ")}`);
  return parts.join(" ") || "Pedido de Peça";
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void; onSuccess: () => void; isDesmancheAd?: boolean }

export function CreateOrderWizard({ open, onClose, onSuccess, isDesmancheAd = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = getToken();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savedItems, setSavedItems] = useState<(FormState & { title: string })[]>([]);

  const set = (patch: Partial<FormState>) => setForm((s) => ({ ...s, ...patch }));

  const saveCurrentItemToList = () => {
    if (!form.vehicleType || !form.vehicleBrand || !form.partName) {
      toast({ title: "Campos obrigatórios", description: "Selecione o tipo de veículo, marca e a peça antes de adicionar.", variant: "destructive" });
      return;
    }
    if (isCustomPart(form.partName) && !form.customPartName.trim()) {
      toast({ title: "Campos obrigatórios", description: "Descreva o nome da peça.", variant: "destructive" });
      return;
    }
    const title = buildTitle(form);
    setSavedItems(prev => [...prev, { ...form, title }]);
    const keepUrgency = form.urgency;
    setForm({ ...EMPTY, urgency: keepUrgency });
    setPreviewUrls([]);
  };

  const removeSavedItem = (idx: number) => {
    setSavedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const vt = VEHICLE_TYPES.find((v) => v.id === form.vehicleType);
  const hasFipe = !!vt?.fipe;
  const categories = CATEGORIES[form.vehicleType] ?? GENERIC_CATEGORIES;
  const partOptions = form.partCategory ? (PARTS[form.partCategory] ?? []) : [];
  const selectedPart = Object.values(PARTS).flat().find((p) => p.id === form.partName);
  const positionOptions = selectedPart?.pos ? POSITIONS[selectedPart.pos] : null;

  // FIPE queries
  const { data: fipeBrands = [], isFetching: loadingBrands } = useQuery({
    queryKey: ["fipe-brands", vt?.fipe],
    queryFn: () => fetchFipeBrands(vt!.fipe!),
    enabled: hasFipe,
    staleTime: 1000 * 60 * 60,
  });

  const { data: fipeModels = [], isFetching: loadingModels } = useQuery({
    queryKey: ["fipe-models", vt?.fipe, form.vehicleBrandCode],
    queryFn: () => fetchFipeModels(vt!.fipe!, form.vehicleBrandCode),
    enabled: hasFipe && !!form.vehicleBrandCode,
    staleTime: 1000 * 60 * 60,
  });

  const staticBrands = !hasFipe && vt ? (STATIC_BRANDS[vt.id] ?? []) : [];

  // Reset dependent fields when vehicle type changes
  useEffect(() => {
    set({ vehicleBrand: "", vehicleBrandCode: "", vehicleModel: "", partCategory: "", partName: "", partPosition: "" });
  }, [form.vehicleType]);

  useEffect(() => {
    set({ vehicleModel: "", vehicleBrandCode: hasFipe ? form.vehicleBrandCode : "" });
  }, [form.vehicleBrand]);

  useEffect(() => {
    set({ partName: "", customPartName: "", partPosition: "" });
  }, [form.partCategory]);

  useEffect(() => {
    set({ partPosition: "" });
  }, [form.partName]);

  // Helpers para serializar um item de formulário para o formato da API
  const serializeItem = (item: FormState & { title?: string }) => {
    const partDef = Object.values(PARTS).flat().find((p) => p.id === item.partName);
    const itemCategories = CATEGORIES[item.vehicleType] ?? GENERIC_CATEGORIES;
    const catDef = itemCategories.find((c) => c.id === item.partCategory);
    const itemPositionOptions = partDef?.pos ? POSITIONS[partDef.pos] : null;
    const posDef = itemPositionOptions?.find((p) => p.id === item.partPosition);
    const resolvedPartName = isCustomPart(item.partName) && item.customPartName.trim()
      ? item.customPartName.trim()
      : (partDef?.label || item.partName);
    const title = item.title || buildTitle(item as FormState);
    return {
      title,
      description: item.description || title,
      vehicleType: item.vehicleType,
      vehicleBrand: item.vehicleBrand,
      vehicleModel: item.vehicleModel || "Não informado",
      vehicleYear: parseInt(item.vehicleYear) || new Date().getFullYear(),
      vehiclePlate: item.vehiclePlate || undefined,
      partCategory: catDef?.label || item.partCategory,
      partName: resolvedPartName,
      partPosition: posDef?.label || item.partPosition || undefined,
      partConditionAccepted: "any",
    };
  };

  // Submit
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isDesmancheAd && !user?.profileComplete) throw new Error("profile");
      if (!form.vehicleType || !form.vehicleBrand || !form.partName) throw new Error("required");
      if (isCustomPart(form.partName) && !form.customPartName.trim()) throw new Error("required");

      const location = isDesmancheAd
        ? ((user as any)?.city ? `${(user as any).city}, ${(user as any).state || ""}`.trim().replace(/,\s*$/, "") : "Brasil")
        : (user ? `${(user as any).city || ""},${(user as any).state || ""}`.replace(/^,|,$/g, "").trim() || "Brasil" : "Brasil");

      // Build items list: savedItems + current form
      const allItemForms = [...savedItems, { ...form, title: buildTitle(form) }];
      const items = allItemForms.map((item) => serializeItem(item));

      // Use first item for the order-level fields
      const firstItem = items[0];
      const body: Record<string, any> = {
        ...firstItem,
        location,
        urgency: form.urgency,
        isPartnerRequest: false,
        postedByType: isDesmancheAd ? "desmanche" : "client",
        items: items.length > 1 ? items : undefined,
      };

      const res = await apiRequest("POST", "/api/orders", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao criar pedido");
      }
      const order = await res.json();

      // Upload photos per item
      const hasPhotos = allItemForms.some(item => item.photos.length > 0);
      if (hasPhotos) {
        setUploading(true);
        try {
          for (let i = 0; i < allItemForms.length; i++) {
            const itemForm = allItemForms[i];
            if (itemForm.photos.length === 0) continue;
            const orderItem = order.items?.[i];
            const itemParam = orderItem?.id ? `?itemId=${orderItem.id}` : "";
            const fd = new FormData();
            itemForm.photos.forEach((f) => fd.append("photos", f));
            await fetch(`/api/orders/${order.id}/images${itemParam}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: fd,
            });
          }
        } catch {}
        finally { setUploading(false); }
      }
      return order;
    },
    onSuccess: () => {
      if (isDesmancheAd) {
        qc.invalidateQueries({ queryKey: ["/api/orders/my-ads"] });
        qc.invalidateQueries({ queryKey: ["/api/orders"] });
        toast({ title: "Anúncio publicado!", description: "Sua peça aparecerá no mural por 3 dias." });
      } else {
        qc.invalidateQueries({ queryKey: ["/api/orders/my"] });
        qc.invalidateQueries({ queryKey: ["/api/orders"] });
        toast({ title: "Pedido criado!", description: "Seu pedido foi publicado no mural dos desmanches." });
      }
      handleClose();
      onSuccess();
    },
    onError: (err: any) => {
      if (err.message === "profile") {
        toast({ title: "Complete seu perfil", description: "Preencha WhatsApp e endereço no seu perfil.", variant: "destructive" });
      } else if (err.message === "required") {
        toast({ title: "Campos obrigatórios", description: "Selecione o tipo de veículo, marca e a peça.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: err.message || "Não foi possível criar o pedido.", variant: "destructive" });
      }
    },
  });

  const handleClose = () => {
    setForm(EMPTY);
    setPreviewUrls([]);
    setSavedItems([]);
    onClose();
  };

  const handlePhotos = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (form.photos.length + arr.length > 6) {
      toast({ title: "Máximo 6 fotos", variant: "destructive" });
      return;
    }
    set({ photos: [...form.photos, ...arr] });
    setPreviewUrls((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (i: number) => {
    set({ photos: form.photos.filter((_, idx) => idx !== i) });
    setPreviewUrls((prev) => prev.filter((_, idx) => idx !== i));
  };

  const isLoading = createMutation.isPending || uploading;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => String(currentYear - i));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isDesmancheAd ? "Publicar Anúncio de Peça" : "Solicitar Peça"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── Itens já adicionados ──────────────────────────── */}
          {savedItems.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Peças no pedido ({savedItems.length})
              </p>
              {savedItems.map((item, idx) => {
                const vIcon = VEHICLE_TYPES.find(v => v.id === item.vehicleType)?.icon ?? "🔧";
                return (
                  <div key={idx} className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border text-sm">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">
                      <span className="mr-1">{vIcon}</span>
                      {item.title}
                    </span>
                    {item.photos.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">{item.photos.length} foto{item.photos.length !== 1 ? "s" : ""}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSavedItem(idx)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">Preencha os dados da próxima peça abaixo.</p>
            </div>
          )}

          {/* ── Tipo de Veículo ───────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tipo de Veículo <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => set({ vehicleType: v.id })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs font-medium transition-all",
                    form.vehicleType === v.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-xl">{v.icon}</span>
                  <span className="leading-tight text-center">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {form.vehicleType && (
            <>
              {/* ── Veículo ───────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Marca */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Marca <span className="text-destructive">*</span>
                    {loadingBrands && <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />}
                  </Label>
                  {hasFipe ? (
                    <Select
                      value={form.vehicleBrandCode}
                      onValueChange={(val) => {
                        const brand = fipeBrands.find((b) => b.codigo === val);
                        set({ vehicleBrandCode: val, vehicleBrand: brand?.nome || val, vehicleModel: "" });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingBrands ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {fipeBrands.map((b) => (
                          <SelectItem key={b.codigo} value={b.codigo}>{b.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : staticBrands.length > 0 ? (
                    <Select value={form.vehicleBrand} onValueChange={(v) => set({ vehicleBrand: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {staticBrands.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Ex: Fiat, Toyota..."
                      value={form.vehicleBrand}
                      onChange={(e) => set({ vehicleBrand: e.target.value })}
                    />
                  )}
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Modelo
                    {loadingModels && <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />}
                  </Label>
                  {hasFipe && form.vehicleBrandCode ? (
                    <Select value={form.vehicleModel} onValueChange={(v) => set({ vehicleModel: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingModels ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {fipeModels.map((m) => (
                          <SelectItem key={m.codigo} value={m.nome}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Ex: Gol, Civic, S10..."
                      value={form.vehicleModel}
                      onChange={(e) => set({ vehicleModel: e.target.value })}
                      disabled={hasFipe && !form.vehicleBrandCode}
                    />
                  )}
                </div>

                {/* Ano */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Ano</Label>
                  <Select value={form.vehicleYear} onValueChange={(v) => set({ vehicleYear: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-52">
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Placa */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Placa <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input
                    placeholder="AAA-0000"
                    value={form.vehiclePlate}
                    onChange={(e) => set({ vehiclePlate: e.target.value.toUpperCase() })}
                    maxLength={8}
                  />
                </div>
              </div>

              {/* ── Categoria da Peça ─────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Categoria <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set({ partCategory: c.id })}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all text-left",
                        form.partCategory === c.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Peça ─────────────────────────────────────────── */}
              {form.partCategory && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Peça <span className="text-destructive">*</span></Label>
                      <Select value={form.partName} onValueChange={(v) => set({ partName: v, customPartName: "" })}>
                        <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                        <SelectContent className="max-h-60">
                          {partOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                          <SelectItem value="outro-custom">✏️ Outro (digitar o nome)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Posição */}
                    {positionOptions && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Posição</Label>
                        <Select value={form.partPosition} onValueChange={(v) => set({ partPosition: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {positionOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Campo de nome livre quando "Outro" é selecionado */}
                  {form.partName && isCustomPart(form.partName) && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">
                        Nome da peça <span className="text-destructive">*</span>
                        <span className="font-normal text-muted-foreground ml-1">(descreva a peça que você precisa)</span>
                      </Label>
                      <Input
                        placeholder="Ex: Coxim do motor, tensor da correia, bomba d'água..."
                        value={form.customPartName}
                        onChange={(e) => set({ customPartName: e.target.value })}
                        className="bg-white"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Observações <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Textarea
                  placeholder="Descreva detalhes extras: condição do veículo, se a peça tem defeito específico, referência de outra marca aceita, etc."
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* ── Fotos ─────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Fotos do Veículo <span className="text-muted-foreground text-xs">(opcional, até 6)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {form.photos.length < 6 && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Camera className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
              </div>
            </>
          )}

          {/* ── Adicionar outra peça ──────────────────────────────── */}
          {!isDesmancheAd && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 text-sm font-medium border-dashed"
              onClick={saveCurrentItemToList}
              disabled={isLoading || !form.vehicleType || !form.vehicleBrand || !form.partName}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar outra peça ao mesmo pedido
            </Button>
          )}

          {/* ── Submit ────────────────────────────────────────────── */}
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={() => createMutation.mutate()}
            disabled={isLoading || !form.vehicleType || !form.vehicleBrand || !form.partName || (isCustomPart(form.partName) && !form.customPartName.trim())}
          >
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
              : savedItems.length > 0
                ? `Criar Pedido (${savedItems.length + 1} peça${savedItems.length + 1 !== 1 ? "s" : ""})`
                : "Publicar Pedido de Peça"
            }
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
