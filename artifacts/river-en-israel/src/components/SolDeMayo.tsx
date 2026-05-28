type Props = {
  size?: number;
  className?: string;
  /** Color principal del sol. Default dorado de la paleta Mundial. */
  color?: string;
  /** Si true, el sol gira lentamente sobre su eje. */
  spin?: boolean;
};

/**
 * Sol de Mayo — emblema central de la bandera argentina.
 * SVG inline para escalar sin pérdida y permitir animación CSS.
 * Estructura simplificada: 16 rayos rectos + 16 ondulados + cara central.
 */
export function SolDeMayo({ size = 80, className = "", color = "#F1B82D", spin = false }: Props) {
  // Genera 16 rayos rectos
  const rayos = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16;
    return (
      <polygon
        key={`r-${i}`}
        points="100,15 96,55 104,55"
        fill={color}
        transform={`rotate(${angle} 100 100)`}
      />
    );
  });

  // Genera 16 rayos ondulados (flamígeros) entre los rectos
  const rayosFlam = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16 + 360 / 32;
    return (
      <path
        key={`f-${i}`}
        d="M100,25 C97,40 103,40 100,55 L100,55 Z"
        fill={color}
        opacity={0.85}
        transform={`rotate(${angle} 100 100)`}
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`${className} ${spin ? "animate-spin-slow" : ""}`}
      style={{ filter: `drop-shadow(0 0 14px ${color}55)` }}
      aria-hidden="true"
    >
      <g>
        {rayos}
        {rayosFlam}
      </g>
      {/* Disco solar */}
      <circle cx="100" cy="100" r="38" fill={color} stroke="#a87600" strokeWidth="2" />
      {/* Cara — ojos, cejas y boca */}
      <g fill="#a87600">
        {/* Cejas */}
        <path d="M82,88 q5,-4 10,0" stroke="#a87600" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M108,88 q5,-4 10,0" stroke="#a87600" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Ojos */}
        <ellipse cx="88" cy="96" rx="2.5" ry="3.5" />
        <ellipse cx="113" cy="96" rx="2.5" ry="3.5" />
        {/* Nariz */}
        <path d="M100,100 q-2,8 0,12 q2,-2 0,-2" stroke="#a87600" strokeWidth="2" fill="none" />
        {/* Boca */}
        <path d="M90,118 q10,8 20,0" stroke="#a87600" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
