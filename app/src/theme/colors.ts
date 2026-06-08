export const colors = {
  // Primarios
  ink: '#070542',        // navy-violeta casi negro (texto sobre acentos, superficies oscuras)
  ivory: '#f4f4ff',      // fondo principal (lo mas claro de la paleta)
  parchment: '#e4e4ff',  // superficie secundaria (chips/cards) — tint claro derivado de #9696ff
  graphite: '#1e0069',   // violeta profundo (superficie/acento oscuro alternativo)

  // Acentos
  auctionGold: '#ffaf5c',  // CTA primario / destacados (naranja) — antes dorado
  bidGreen: '#00ffb3',     // exito / puja ganadora (teal)
  alertEmber: '#e5484d',   // peligro / error — la paleta no trae rojo; se mantiene uno por semantica
  steelBlue: '#5d51fc',    // info / estado pendiente (periwinkle)

  // Categorias (5 distinguibles entre si)
  catComun: '#606060',     // gris
  catEspecial: '#2309d6',  // azul vivo
  catPlata: '#9696ff',     // lavanda
  catOro: '#ffaf5c',       // naranja
  catPlatino: '#5d51fc',   // periwinkle

  // Neutros
  textPrimary: '#070542',   // texto principal
  textSecondary: '#606060', // texto secundario (gris)
  textMuted: '#9696ff',     // texto atenuado (lavanda)
  border: '#d6d6f5',        // divisores suaves — tint derivado de #9696ff
  borderDark: '#1e0069',

  // Transparencias
  overlay: 'rgba(7,5,66,0.6)',      // derivado de ink
  goldGlow: 'rgba(255,175,92,0.25)', // derivado del acento naranja
} as const;

export type ColorName = keyof typeof colors;
