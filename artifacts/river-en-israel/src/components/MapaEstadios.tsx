import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADIOS } from "@/lib/mundial-data";

// Iconos custom por país (color del marker)
const ICONOS: Record<string, L.DivIcon> = {
  USA: makeIcon("#3C82F6"),
  "Canadá": makeIcon("#DC2626"),
  "México": makeIcon("#15803D"),
};

function makeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};
      border:3px solid #F1B82D;
      box-shadow:0 0 8px rgba(241,184,45,0.6);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function FitAllMarkers() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(ESTADIOS.map(e => [e.lat, e.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map]);
  return null;
}

export function MapaEstadios() {
  return (
    <div className="rounded-2xl overflow-hidden border-2 border-arg-celeste/30 shadow-2xl">
      <MapContainer
        center={[40, -100]}
        zoom={3}
        scrollWheelZoom={false}
        style={{ height: "500px", width: "100%", background: "#0a1628" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {ESTADIOS.map(e => (
          <Marker key={e.id} position={[e.lat, e.lng]} icon={ICONOS[e.pais] ?? ICONOS.USA!}>
            <Popup>
              <div style={{ minWidth: 220, fontFamily: "Inter, sans-serif" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628", marginBottom: 4 }}>
                  {e.nombre}
                </div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                  {e.ciudad} · {e.pais} · {e.capacidad.toLocaleString()} esp.
                </div>
                <div style={{ fontSize: 12, color: "#0a1628", lineHeight: 1.4 }}>
                  {e.detalles}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitAllMarkers />
      </MapContainer>
    </div>
  );
}
