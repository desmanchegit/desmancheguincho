import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ensureLeafletIcons } from "./leaflet-icon-fix";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

ensureLeafletIcons();

export type MapGuincho = {
  id: string;
  tradingName: string;
  neighborhood: string | null;
  city: string;
  state: string;
  whatsapp: string;
  latitude: number;
  longitude: number;
};

export function GuinchosMapView({
  guinchos,
  onWhatsapp,
}: {
  guinchos: MapGuincho[];
  onWhatsapp: (whatsapp: string) => void;
}) {
  const bounds: LatLngBoundsExpression = useMemo(
    () => guinchos.map((g) => [g.latitude, g.longitude]),
    [guinchos]
  );

  const center: [number, number] = guinchos.length
    ? [guinchos[0].latitude, guinchos[0].longitude]
    : [-14.235, -51.9253];

  return (
    <div className="h-[520px] w-full rounded-xl overflow-hidden border">
      <MapContainer
        center={center}
        zoom={guinchos.length ? 12 : 4}
        bounds={guinchos.length > 1 ? bounds : undefined}
        boundsOptions={{ padding: [40, 40] }}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {guinchos.map((g) => (
          <Marker key={g.id} position={[g.latitude, g.longitude]}>
            <Popup>
              <div className="space-y-1.5 text-sm">
                <p className="font-bold">{g.tradingName}</p>
                <p className="text-muted-foreground text-xs">
                  {g.neighborhood ? `${g.neighborhood}, ` : ""}{g.city} – {g.state}
                </p>
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold mt-1"
                  onClick={() => onWhatsapp(g.whatsapp)}
                >
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                  WhatsApp
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
