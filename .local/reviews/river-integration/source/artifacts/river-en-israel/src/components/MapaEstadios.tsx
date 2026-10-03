import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADIOS, type EstadioInfo } from "@/lib/mundial-data";

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

/** Bounds restringidos al territorio del Mundial (México + USA + sur de Canadá). */
const MUNDIAL_BOUNDS: L.LatLngBoundsExpression = [
  [14, -170], // suroeste: sur de México, costa pacífica
  [62, -50],  // noreste: sur de Canadá, costa atlántica
];

function FitAllMarkers() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(ESTADIOS.map(e => [e.lat, e.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
    map.setMaxBounds(MUNDIAL_BOUNDS);
  }, [map]);
  return null;
}

function FotoEstadio({ estadio }: { estadio: EstadioInfo }) {
  const [error, setError] = useState(false);
  if (!estadio.imagen || error) {
    // Fallback: gradient con nombre
    return (
      <div
        style={{
          width: "100%",
          height: 130,
          borderRadius: 8,
          marginBottom: 8,
          background: "linear-gradient(135deg,#0a1628 0%,#103a5e 50%,#F1B82D 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          textAlign: "center",
          padding: 8,
        }}
      >
        🏟️ {estadio.nombre}
      </div>
    );
  }
  return (
    <img
      src={estadio.imagen}
      alt={estadio.nombre}
      onError={() => setError(true)}
      style={{
        width: "100%",
        height: 130,
        objectFit: "cover",
        borderRadius: 8,
        marginBottom: 8,
        display: "block",
      }}
    />
  );
}

export function MapaEstadios() {
  return (
    <div className="rounded-2xl overflow-hidden border-2 border-arg-celeste/30 shadow-2xl">
      <MapContainer
        center={[40, -100]}
        zoom={3}
        minZoom={3}
        maxZoom={7}
        scrollWheelZoom={false}
        maxBounds={MUNDIAL_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "500px", width: "100%", background: "#0a1628" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          noWrap={true}
        />
        {ESTADIOS.map(e => (
          <Marker key={e.id} position={[e.lat, e.lng]} icon={ICONOS[e.pais] ?? ICONOS.USA!}>
            <Popup maxWidth={280}>
              <div style={{ width: 260, fontFamily: "Inter, sans-serif" }}>
                <FotoEstadio estadio={e} />
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628", marginBottom: 4 }}>
                  {e.nombre}
                </div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                  {e.ciudad} · {e.pais} · {e.capacidad.toLocaleString()} esp. · {e.inaugurado}
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
