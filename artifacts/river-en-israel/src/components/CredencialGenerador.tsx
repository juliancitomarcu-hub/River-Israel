import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download, RefreshCw } from "lucide-react";

const ESCUDO_URL = "/images/escudo-carp.png";

function getNumeroSocio(): string {
  const key = "river-filial-socio-count";
  const stored = localStorage.getItem(key);
  const next = stored ? parseInt(stored, 10) + 1 : Math.floor(Math.random() * 200) + 300;
  localStorage.setItem(key, String(next));
  return String(next).padStart(4, "0");
}

function formatFecha(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  return `${d} · ${m} · ${y}`;
}

interface Props {
  onClose: () => void;
}

export default function CredencialGenerador({ onClose }: Props) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fotoSrc, setFotoSrc] = useState<string | null>(null);
  const [generada, setGenerada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [numero] = useState(getNumeroSocio);
  const [fecha] = useState(formatFecha);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const dibujarCredencial = useCallback((): Promise<string> => {
    return new Promise<string>((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve("");

      const W = 900;
      const H = 560;
      canvas.width = W;
      canvas.height = H;

      const drawAll = (escudoImg: HTMLImageElement | null, fotoImg: HTMLImageElement | null) => {
        // ── Fondo blanco ──
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, W, H);

        // ── Panel izquierdo rojo ──
        const splitX = 320;
        ctx.fillStyle = "#CC0000";
        ctx.fillRect(0, 0, splitX, H);

        // ── Bandas diagonales blancas translúcidas ──
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = "#FFFFFF";
        for (let i = -H; i < W + H; i += 60) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 28, 0);
          ctx.lineTo(i + 28 + H, H);
          ctx.lineTo(i + H, H);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // ── Escudo izq arriba ──
        if (escudoImg) {
          ctx.drawImage(escudoImg, 18, 16, 52, 60);
        }

        // ── Texto Club Atlético ──
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 10px Arial, sans-serif";
        ctx.fillText("CLUB ATLÉTICO", 78, 36);
        ctx.font = "bold 14px Arial, sans-serif";
        ctx.fillText("RIVER PLATE", 78, 54);

        // ── Línea fina ──
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(16, 82, splitX - 32, 1);

        // ── Foto del socio ──
        const photoX = 42;
        const photoY = 98;
        const photoW = 195;
        const photoH = 245;
        const radius = 10;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(photoX + radius, photoY);
        ctx.lineTo(photoX + photoW - radius, photoY);
        ctx.quadraticCurveTo(photoX + photoW, photoY, photoX + photoW, photoY + radius);
        ctx.lineTo(photoX + photoW, photoY + photoH - radius);
        ctx.quadraticCurveTo(photoX + photoW, photoY + photoH, photoX + photoW - radius, photoY + photoH);
        ctx.lineTo(photoX + radius, photoY + photoH);
        ctx.quadraticCurveTo(photoX, photoY + photoH, photoX, photoY + photoH - radius);
        ctx.lineTo(photoX, photoY + radius);
        ctx.quadraticCurveTo(photoX, photoY, photoX + radius, photoY);
        ctx.closePath();
        ctx.clip();

        if (fotoImg) {
          const ar = fotoImg.width / fotoImg.height;
          let sw = photoW;
          let sh = photoH;
          if (ar > photoW / photoH) { sh = photoH; sw = sh * ar; }
          else { sw = photoW; sh = sw / ar; }
          const sx = photoX + (photoW - sw) / 2;
          const sy = photoY + (photoH - sh) / 2;
          ctx.drawImage(fotoImg, sx, sy, sw, sh);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(photoX, photoY, photoW, photoH);
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.font = "bold 48px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase() || "?",
            photoX + photoW / 2, photoY + photoH / 2 + 16
          );
          ctx.textAlign = "left";
        }
        ctx.restore();

        // ── Badge filial ──
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(42, photoY + photoH + 6, 195, 28);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 10px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🇮🇱  FILIAL RAMAT GAN", 42 + 97, photoY + photoH + 24);
        ctx.textAlign = "left";

        // ── PANEL DERECHO ──
        // Franja roja superior
        ctx.fillStyle = "#CC0000";
        ctx.fillRect(splitX, 0, W - splitX, 68);

        // Escudo derecha arriba
        if (escudoImg) {
          ctx.drawImage(escudoImg, W - 75, 7, 56, 54);
        }

        // Texto en franja roja
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 10px Arial, sans-serif";
        ctx.fillText("CLUB ATLÉTICO", splitX + 20, 26);
        ctx.font = "bold 22px Arial, sans-serif";
        ctx.fillText("RIVER PLATE", splitX + 20, 52);

        // Separador
        ctx.fillStyle = "#EEEEEE";
        ctx.fillRect(splitX + 16, 78, W - splitX - 32, 1);

        // Nombre
        ctx.fillStyle = "#CC0000";
        ctx.font = "500 14px Arial, sans-serif";
        ctx.fillText((nombre || "TU NOMBRE").toUpperCase(), splitX + 20, 118);

        // Apellido grande
        ctx.fillStyle = "#111111";
        ctx.font = `bold 40px Arial, sans-serif`;
        // Truncate if too long
        let apellidoText = (apellido || "APELLIDO").toUpperCase();
        while (ctx.measureText(apellidoText).width > W - splitX - 50 && apellidoText.length > 1) {
          apellidoText = apellidoText.slice(0, -1);
        }
        ctx.fillText(apellidoText, splitX + 20, 162);

        // Línea roja bajo apellido
        ctx.fillStyle = "#CC0000";
        ctx.fillRect(splitX + 20, 175, 100, 3);

        // Categoría
        ctx.fillStyle = "#999999";
        ctx.font = "10px Arial, sans-serif";
        ctx.fillText("CATEGORÍA", splitX + 20, 214);
        ctx.fillStyle = "#111111";
        ctx.font = "bold 15px Arial, sans-serif";
        ctx.fillText("FILIAL RAMAT GAN", splitX + 20, 236);

        // Número socio
        ctx.fillStyle = "#999999";
        ctx.font = "10px Arial, sans-serif";
        ctx.fillText("Nº SOCIO", splitX + 20, 280);
        ctx.fillStyle = "#CC0000";
        ctx.font = `bold 30px Arial, sans-serif`;
        ctx.fillText(`#${numero}`, splitX + 20, 312);

        // Fecha
        ctx.fillStyle = "#999999";
        ctx.font = "10px Arial, sans-serif";
        ctx.fillText("FECHA DE EMISIÓN", splitX + 20, 358);
        ctx.fillStyle = "#111111";
        ctx.font = "bold 15px Arial, sans-serif";
        ctx.fillText(fecha, splitX + 20, 379);

        // Footer "EL MÁS GRANDE"
        ctx.fillStyle = "#CC0000";
        ctx.fillRect(splitX, H - 48, W - splitX, 48);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 17px Arial, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText("EL MÁS GRANDE", W - 20, H - 16);
        ctx.textAlign = "left";

        // Borde
        ctx.strokeStyle = "#DDDDDD";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

        resolve(canvas.toDataURL("image/png"));
      };

      const escudo = new Image();
      escudo.crossOrigin = "anonymous";
      escudo.onload = () => {
        if (fotoSrc) {
          const foto = new Image();
          foto.onload = () => drawAll(escudo, foto);
          foto.onerror = () => drawAll(escudo, null);
          foto.src = fotoSrc;
        } else {
          drawAll(escudo, null);
        }
      };
      escudo.onerror = () => {
        if (fotoSrc) {
          const foto = new Image();
          foto.onload = () => drawAll(null, foto);
          foto.onerror = () => drawAll(null, null);
          foto.src = fotoSrc;
        } else {
          drawAll(null, null);
        }
      };
      escudo.src = ESCUDO_URL;
    });
  }, [nombre, apellido, fotoSrc, numero, fecha]);

  const handleGenerar = async () => {
    if (!nombre.trim() || !apellido.trim()) return;
    setLoading(true);
    const url = await dibujarCredencial();
    setPreviewUrl(url);
    setGenerada(true);
    setLoading(false);
  };

  const handleDescargar = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.download = `credencial-river-${apellido.toLowerCase().replace(/\s/g, "-")}.png`;
    link.href = previewUrl;
    link.click();
  };

  const handleReset = () => {
    setGenerada(false);
    setPreviewUrl(null);
    setNombre("");
    setApellido("");
    setFotoSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-river-black px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-river-red text-xs font-bold uppercase tracking-widest">Club Atlético River Plate</p>
              <h2 className="text-white font-display font-bold text-xl">Tu Credencial · Filial Ramat Gan</h2>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {!generada ? (
              <div className="space-y-5">
                <p className="text-gray-500 text-sm">
                  Completá tus datos para generar tu credencial simbólica como miembro de la Filial Ramat Gan.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre</label>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Martín"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-river-red/30 focus:border-river-red transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Apellido</label>
                    <input
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Ej: Pérez"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-river-red/30 focus:border-river-red transition"
                    />
                  </div>
                </div>

                {/* Foto */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tu foto (opcional)</label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-river-red/50 rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-4"
                  >
                    {fotoSrc ? (
                      <>
                        <img src={fotoSrc} alt="foto" className="w-16 h-16 rounded-lg object-cover border-2 border-river-red/30" />
                        <div>
                          <p className="font-semibold text-sm text-gray-700">Foto cargada ✓</p>
                          <p className="text-xs text-gray-400">Tocá para cambiarla</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-700">Subir foto de perfil</p>
                          <p className="text-xs text-gray-400">JPG, PNG · Máx 10MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Datos automáticos */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Categoría</p>
                    <p className="font-bold text-sm text-river-black">Filial Ramat Gan</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Nº Socio</p>
                    <p className="font-bold text-sm text-river-red">#{numero}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fecha</p>
                    <p className="font-bold text-sm text-river-black">{fecha}</p>
                  </div>
                </div>

                <button
                  onClick={handleGenerar}
                  disabled={!nombre.trim() || !apellido.trim() || loading}
                  className="w-full bg-river-red hover:bg-river-red/90 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                  ) : (
                    "Generar mi credencial"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-gray-500 text-sm text-center">¡Tu credencial está lista! Descargala como imagen.</p>

                {previewUrl && (
                  <div className="rounded-xl overflow-hidden border border-gray-100 shadow-lg">
                    <img src={previewUrl} alt="Credencial" className="w-full h-auto block" />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 border border-gray-200 hover:border-gray-300 text-gray-600 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> Nueva
                  </button>
                  <button
                    onClick={handleDescargar}
                    className="flex-[2] bg-river-red hover:bg-river-red/90 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" /> Descargar PNG
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
