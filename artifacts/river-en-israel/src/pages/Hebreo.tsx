import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, Trophy, CheckCircle2, Play, MapPin } from "lucide-react";
import { Link } from "wouter";

interface NoticiaHe {
  id: number;
  titulo: string;
  contenido: string;
  tags: string;
  fuente: string;
  imagenPortada?: string;
  createdAt: string;
}

interface GaleriaFoto {
  id: number;
  url: string;
  caption: string;
  orden: number;
}

interface VideoGaleria {
  id: number;
  url: string;
  titulo: string;
  thumbnail: string | null;
  orden: number;
}

interface PartidoApi {
  id: number;
  competicion: string;
  equipoLocal: string;
  equipoVisitante: string;
  fecha: string;
  horaIsrael?: string;
  golesLocal?: number | null;
  golesVisitante?: number | null;
  estado?: string;
}

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function resolverUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("/objects/")) return `/api/storage/objects${url.slice(8)}`;
  if (url.startsWith("/images/")) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url;
}

function extractoLimpio(contenido: string, max = 140): string {
  const limpio = contenido
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return limpio.length > max ? limpio.slice(0, max).trim() + "…" : limpio;
}

function formatFechaHe(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch { return iso; }
}

export default function Hebreo() {
  const [noticias, setNoticias] = useState<NoticiaHe[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [galeria, setGaleria] = useState<GaleriaFoto[]>([]);
  const [videos, setVideos] = useState<VideoGaleria[]>([]);
  const [proximo, setProximo] = useState<PartidoApi | null>(null);

  // Forzar RTL en toda la página
  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "he");
    return () => {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "es");
    };
  }, []);

  // Noticias en hebreo
  useEffect(() => {
    setCargando(true);
    fetch(`/api/noticias-publicadas?lang=he&page=${pagina}&limit=6`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: { noticias?: NoticiaHe[]; totalPages?: number }) => {
        setNoticias(d.noticias ?? []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => setNoticias([]))
      .finally(() => setCargando(false));
  }, [pagina]);

  // Galería
  useEffect(() => {
    fetch("/api/galeria?categoria=river", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { fotos?: GaleriaFoto[] }) => setGaleria((d.fotos ?? []).slice(0, 8)))
      .catch(() => {});
  }, []);

  // Videos
  useEffect(() => {
    fetch("/api/videos?categoria=river", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { videos?: VideoGaleria[] }) => setVideos((d.videos ?? []).slice(0, 4)))
      .catch(() => {});
  }, []);

  // Próximo partido
  useEffect(() => {
    fetch("/api/partidos-river", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { partidos?: PartidoApi[] }) => {
        const list = (d.partidos ?? []).filter(p => p.estado !== "FINALIZADO");
        if (list.length > 0) setProximo(list[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div dir="rtl" lang="he" className="bg-white">
      {/* ============ HERO ============ */}
      <section className="relative bg-gradient-to-br from-river-black via-[#1a0000] to-river-black text-white py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <img
            src={`${import.meta.env.BASE_URL}images/estadio-river.jpeg`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute top-10 right-1/4 w-[400px] h-[400px] bg-river-red/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="bg-river-red/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase text-river-red border border-river-red/40 inline-block mb-5">
            סניף רמת גן · ישראל
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-4 leading-tight">
            ריבר פלאטה <span className="text-river-red">בישראל</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            הבית הרשמי של אוהדי קלוב אתלטיקו ריבר פלאטה בישראל. חדשות, ניתוחים והרכב, היסטוריה, ואירועי הסניף ברמת גן.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#actualidad-he"
              className="bg-river-red hover:bg-river-red-hover text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
            >
              חדשות ועדכונים
            </a>
            <Link
              href="/"
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-all border border-white/20"
            >
              גרסה בספרדית
            </Link>
          </div>
        </div>
      </section>

      {/* ============ PRÓXIMO PARTIDO ============ */}
      {proximo && (
        <section className="bg-gradient-to-b from-[#0a0a0a] to-river-black text-white py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="bg-white/5 border border-river-red/30 rounded-2xl p-6 md:p-8 backdrop-blur shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-river-red font-bold text-xs uppercase tracking-wider">המשחק הבא</span>
                <span className="text-gray-400 text-xs">{proximo.competicion}</span>
              </div>
              <div className="flex items-center justify-around text-center">
                <div className="flex-1">
                  <p className="font-display font-bold text-lg md:text-2xl">{proximo.equipoLocal}</p>
                </div>
                <div className="px-4">
                  <div className="text-3xl font-display font-bold text-river-red">VS</div>
                  {proximo.horaIsrael && (
                    <p className="text-xs text-gray-400 mt-1">{proximo.horaIsrael} שעון ישראל</p>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-lg md:text-2xl">{proximo.equipoVisitante}</p>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-4">
                {proximo.fecha}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ PRÓXIMO EVENTO FILIAL (en hebreo) ============ */}
      <section className="bg-gradient-to-b from-river-black to-[#0a0a0a] text-white py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-6">
            <span className="bg-river-red/20 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase text-river-red border border-river-red/30 inline-block mb-3">
              סניף רמת גן · אירוע קרוב
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold">האירוע <span className="text-river-red">הבא</span></h2>
          </div>
          <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-river-red/30 rounded-3xl overflow-hidden backdrop-blur shadow-2xl">
            <div className="bg-gradient-to-r from-river-red to-[#a30000] p-6 md:p-7" dir="rtl">
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                ריבר פלייט נגד בלגראנו דה קורדובה
              </h3>
              <p className="text-white/90 text-sm mt-1" dir="ltr">River Plate vs. Belgrano de Córdoba</p>
            </div>
            <div className="p-6 md:p-8 space-y-4" dir="rtl">
              <div className="flex items-start gap-3">
                <span className="text-river-red text-xl mt-0.5">📅</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">תאריך</p>
                  <p className="text-white font-semibold">יום ראשון, 24 במאי 2026</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-river-red text-xl mt-0.5">⏰</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">שעת מפגש</p>
                  <p className="text-white font-semibold">21:00 (שעון ישראל)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-river-red text-xl mt-0.5">📍</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">מיקום</p>
                  <p className="text-white font-semibold">מלצר ביר – Meltzer Beer</p>
                  <p className="text-gray-400 text-sm">מרכז בן גוריון · בן גוריון 4, ראשון לציון</p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Meltzer+Beer+Ben+Gurion+4+Rishon+LeZion"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-river-red hover:text-white text-xs font-semibold transition-colors"
                  >
                    פתח ב-Google Maps
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-river-red text-xl mt-0.5">🚗</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">הטבה</p>
                  <p className="text-white font-semibold">חניה חינם זמינה במקום</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-river-red text-xl mt-0.5">👕</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">קוד לבוש</p>
                  <p className="text-white font-semibold">חולצות, דגלים וסמלים אדומים ולבנים</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 md:px-8 md:pb-8">
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-3 px-5 rounded-xl transition-all shadow-lg text-sm"
              >
                אישור הגעה בוואטסאפ
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ACTUALIDAD (en hebreo) ============ */}
      <section id="actualidad-he" className="bg-[#111] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-white">
              חדשות <span className="text-river-red">המיליונרים</span>
            </h2>
            <p className="text-gray-400 mt-2">העדכונים האחרונים מעולם ריבר ומהסניף.</p>
          </div>

          {cargando && (
            <div className="text-center py-12 text-gray-500">טוען חדשות…</div>
          )}

          {!cargando && noticias.length === 0 && (
            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-gray-300 text-lg mb-2">עדיין אין חדשות בעברית</p>
              <p className="text-gray-500 text-sm">
                התרגום מתבצע אוטומטית בכל פרסום מאמר חדש בספרדית. בקרוב.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {noticias.map((n, i) => (
              <motion.article
                key={n.id}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeIn}
                custom={i}
              >
                <Link href={`/noticia/${n.id}?lang=he`} className="block group">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 h-full flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all">
                    {n.imagenPortada ? (
                      <div className="aspect-video overflow-hidden bg-gray-100">
                        <img
                          src={resolverUrl(n.imagenPortada)}
                          alt={n.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-river-red/20 to-river-black flex items-center justify-center">
                        <Trophy className="w-12 h-12 text-river-red/40" />
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Calendar className="w-3 h-3" />
                        {formatFechaHe(n.createdAt)}
                      </div>
                      <h3 className="font-display font-bold text-river-black text-lg leading-snug mb-2 group-hover:text-river-red transition-colors line-clamp-2">
                        {n.titulo}
                      </h3>
                      <p className="text-gray-500 text-sm line-clamp-3 mb-4">
                        {extractoLimpio(n.contenido)}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-1 text-river-red font-bold text-sm">
                        קרא עוד <ChevronRight className="w-3 h-3 rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10 flex-wrap" dir="ltr">
              <button
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-white/20 text-white hover:border-river-red hover:text-river-red disabled:opacity-30 transition-all text-sm font-bold"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPagina(i)}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all border ${
                    i === pagina
                      ? "bg-river-red text-white border-river-red"
                      : "border-white/20 text-white hover:border-river-red hover:text-river-red"
                  }`}
                >{i + 1}</button>
              ))}
              <button
                onClick={() => setPagina(p => Math.min(totalPages - 1, p + 1))}
                disabled={pagina === totalPages - 1}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-white/20 text-white hover:border-river-red hover:text-river-red disabled:opacity-30 transition-all text-sm font-bold"
              >›</button>
            </div>
          )}
        </div>
      </section>

      {/* ============ FILIAL RAMAT GAN ============ */}
      <section className="py-20 bg-gray-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col lg:flex-row">
            <div className="lg:w-5/12 bg-river-black text-white p-10 lg:p-14 flex flex-col justify-center relative">
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-river-red rounded-full blur-[100px] opacity-40"></div>
              <span className="bg-white/10 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase text-river-red border border-river-red/30 inline-block mb-6 w-fit">
                סניף רשמי בישראל
              </span>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-5">
                הצטרפו ל<span className="text-river-red">משפחה</span>
              </h2>
              <p className="text-gray-300 text-lg mb-8">
                לא משנה כמה רחוקים אנחנו מהמונומנטל — הלהט מאחד אותנו. הצטרפו לסניף שלנו ברמת גן.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3"><CheckCircle2 className="text-river-red w-5 h-5 shrink-0" /><span>מפגשי משחקים מיוחדים</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-river-red w-5 h-5 shrink-0" /><span>אירועים חברתיים</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-river-red w-5 h-5 shrink-0" /><span>אירועים עתידיים ומפגשי הסניף</span></li>
              </ul>
              <a
                href="https://chat.whatsapp.com/LGMvmF1bKjJ2PlZ1GqCfo0"
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-3 px-6 rounded-xl text-center transition-all shadow-lg hover:-translate-y-1 w-fit"
              >
                להצטרפות לקבוצת הוואטסאפ
              </a>
            </div>
            <div className="lg:w-7/12 p-10 lg:p-14 flex flex-col justify-center">
              <h3 className="font-display text-3xl font-bold text-river-black mb-3">היכן אנחנו</h3>
              <div className="flex items-start gap-3 mb-6 text-gray-700">
                <MapPin className="w-5 h-5 text-river-red shrink-0 mt-1" />
                <p>רמת גן, ישראל — לבית הסניף הרשמי בארץ.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Link href="/equipo" className="p-5 bg-gray-50 hover:bg-river-red hover:text-white rounded-xl border border-gray-200 transition-all text-center group">
                  <p className="font-bold text-river-black group-hover:text-white">ההרכב</p>
                  <p className="text-xs text-gray-500 group-hover:text-white/80 mt-1">השחקנים והמאמן</p>
                </Link>
                <Link href="/historia" className="p-5 bg-gray-50 hover:bg-river-red hover:text-white rounded-xl border border-gray-200 transition-all text-center group">
                  <p className="font-bold text-river-black group-hover:text-white">היסטוריה</p>
                  <p className="text-xs text-gray-500 group-hover:text-white/80 mt-1">מאז 1901</p>
                </Link>
                <Link href="/fixture" className="p-5 bg-gray-50 hover:bg-river-red hover:text-white rounded-xl border border-gray-200 transition-all text-center group">
                  <p className="font-bold text-river-black group-hover:text-white">לוח משחקים</p>
                  <p className="text-xs text-gray-500 group-hover:text-white/80 mt-1">כל המשחקים</p>
                </Link>
                <Link href="/" className="p-5 bg-gray-50 hover:bg-river-red hover:text-white rounded-xl border border-gray-200 transition-all text-center group">
                  <p className="font-bold text-river-black group-hover:text-white">בית בספרדית</p>
                  <p className="text-xs text-gray-500 group-hover:text-white/80 mt-1">גרסה מלאה</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ GALERÍA ============ */}
      {galeria.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-river-black">
                <span className="text-river-red">גלריית</span> תמונות
              </h2>
              <p className="text-gray-500 mt-2">רגעים בלתי נשכחים מהמיליונרים והסניף.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {galeria.map(foto => (
                <div key={foto.id} className="aspect-square overflow-hidden rounded-xl bg-gray-100 group cursor-pointer">
                  <img
                    src={resolverUrl(foto.url)}
                    alt={foto.caption}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ VIDEOS ============ */}
      {videos.length > 0 && (
        <section className="py-16 bg-river-black text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 text-center">
              סרטונים <span className="text-river-red">ושערים</span>
            </h2>
            <div className="flex flex-col gap-3">
              {videos.map(v => (
                <div key={v.id} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 transition-all">
                  <div className="w-16 h-16 rounded-xl bg-river-red/20 flex items-center justify-center shrink-0">
                    <Play className="w-6 h-6 text-river-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{v.titulo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FOOTER NOTE ============ */}
      <section className="py-10 bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            התוכן מתורגם אוטומטית מספרדית לעברית באמצעות בינה מלאכותית מתקדמת.
            עורכת לשון: סטנדרטים של האקדמיה ללשון העברית.
          </p>
          <Link href="/" className="inline-block mt-3 text-river-red font-bold hover:underline">
            ← לגרסה המקורית בספרדית
          </Link>
        </div>
      </section>
    </div>
  );
}
