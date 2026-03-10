export const colors = {
  // Primarios
  ink: '#0B0E11',
  ivory: '#FAF8F5',
  parchment: '#F2EDE6',
  graphite: '#1A1D23',

  // Acentos
  auctionGold: '#C9A84C',
  bidGreen: '#2D936C',
  alertEmber: '#D64545',
  steelBlue: '#4A7C9B',

  // Categorias
  catComun: '#8B8D91',
  catEspecial: '#5B7FA5',
  catPlata: '#A8B5C2',
  catOro: '#C9A84C',
  catPlatino: '#E8E4DF',

  // Neutros
  textPrimary: '#1A1D23',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E1DB',
  borderDark: '#2A2D33',

  // Transparencias
  overlay: 'rgba(11,14,17,0.6)',
  goldGlow: 'rgba(201,168,76,0.25)',
} as const;

export type ColorName = keyof typeof colors;
