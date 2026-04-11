# Design System

**Direccion estetica:** Luxury Refined — inspirado en catalogos de Christie's y Sotheby's cruzados con fintech moderna. La app transmite confianza, sofisticacion y urgencia controlada.

## Paleta de Colores

### Primarios

| Token | Hex | Uso |
|-------|-----|-----|
| `ink` | `#0B0E11` | Fondo principal dark mode, subasta en vivo |
| `ivory` | `#FAF8F5` | Fondo principal light mode |
| `parchment` | `#F2EDE6` | Superficies elevadas light |
| `graphite` | `#1A1D23` | Superficies elevadas dark |

### Acentos

| Token | Hex | Uso |
|-------|-----|-----|
| `auctionGold` | `#C9A84C` | CTA principal, highlights, precios |
| `bidGreen` | `#2D936C` | Puja exitosa, confirmaciones |
| `alertEmber` | `#D64545` | Errores, multas, danger |
| `steelBlue` | `#4A7C9B` | Links, info secundaria |

### Categorias (Badges)

| Token | Hex | Uso |
|-------|-----|-----|
| `catComun` | `#8B8D91` | Gris neutro |
| `catEspecial` | `#5B7FA5` | Azul acero |
| `catPlata` | `#A8B5C2` | Plata metalico |
| `catOro` | `#C9A84C` | Dorado |
| `catPlatino` | `#E8E4DF` | Blanco platino |

### Neutros

| Token | Hex | Uso |
|-------|-----|-----|
| `textPrimary` | `#1A1D23` | Texto principal |
| `textSecondary` | `#6B7280` | Texto secundario |
| `textMuted` | `#9CA3AF` | Texto deshabilitado |
| `border` | `#E5E1DB` | Bordes light mode |
| `borderDark` | `#2A2D33` | Bordes dark mode |

### Transparencias

| Token | Valor | Uso |
|-------|-------|-----|
| `overlay` | `rgba(11,14,17,0.6)` | Overlay de modals |
| `goldGlow` | `rgba(201,168,76,0.25)` | Glow en pujas nuevas |

---

## Tipografia

### Familias

| Token | Fuente | Peso | Uso |
|-------|--------|------|-----|
| `display` | Playfair Display | 700 Bold | Precios, titulos de subasta, numeros grandes |
| `heading` | DM Sans | 700 Bold | Headings principales |
| `headingSemibold` | DM Sans | 600 SemiBold | Headings secundarios |
| `headingMedium` | DM Sans | 500 Medium | Headings terciarios |
| `body` | DM Sans | 400 Regular | Texto general |
| `bodyMedium` | DM Sans | 500 Medium | Texto con enfasis |
| `bodySemibold` | DM Sans | 600 SemiBold | Labels activos |
| `bodyBold` | DM Sans | 700 Bold | Texto destacado |

### Escala de Tamaños

| Token | Size (px) | Line Height | Uso |
|-------|-----------|-------------|-----|
| `xs` | 12 | 16.8 | Captions, timestamps |
| `sm` | 14 | 21 | Labels, metadata |
| `base` | 16 | 25.6 | Body text |
| `lg` | 18 | 27 | Subtitulos |
| `xl` | 22 | 28.6 | Headings de seccion |
| `2xl` | 28 | 33.6 | Titulos de pagina |
| `3xl` | 36 | 39.6 | Precio en subasta live |
| `hero` | 48 | 48 | Splash, onboarding |

---

## Spacing

| Token | Valor (px) |
|-------|-----------|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `2xl` | 48 |
| `3xl` | 64 |

---

## Border Radius

| Token | Valor (px) | Uso |
|-------|-----------|-----|
| `sm` | 6 | Badges, chips |
| `md` | 12 | Cards, inputs |
| `lg` | 16 | Modals, sheets |
| `xl` | 24 | Botones pill |
| `full` | 9999 | Avatares |

---

## Sombras

| Token | Offset | Opacity | Radius | Elevation | Uso |
|-------|--------|---------|--------|-----------|-----|
| `sm` | 0, 1 | 0.06 | 2 | 1 | Inputs focus |
| `md` | 0, 4 | 0.08 | 12 | 3 | Cards |
| `lg` | 0, 8 | 0.12 | 24 | 6 | Modals |
| `glow` | 0, 0 | 0.25 | 20 | 4 | Gold highlight (color: `#C9A84C`) |

---

## Motion

### Duraciones

| Token | Valor | Uso |
|-------|-------|-----|
| `fast` | 120ms | Press feedback, toggles |
| `normal` | 200ms | Hover states, transiciones pequeñas |
| `slow` | 300ms | Modals, transiciones de pagina |
| `crawl` | 600ms | Skeleton shimmer, onboarding |

### Easing Curves

| Token | Valor | Uso |
|-------|-------|-----|
| `out` | `bezier(0.16, 1, 0.3, 1)` | Entradas |
| `in` | `bezier(0.55, 0.055, 0.675, 0.19)` | Salidas |
| `bounce` | `bezier(0.34, 1.56, 0.64, 1)` | Pujas nuevas |

### Momentos Clave de Animacion

1. **Nueva puja recibida:** Precio pulsa (scale 1.05 + shadow glow) con ease-bounce, 400ms
2. **Puja enviada exitosamente:** Flash verde bidGreen en borde del input, check icon fade-in
3. **Cierre de subasta:** Overlay con "VENDIDO" en Playfair Display hero, fade-in 600ms
4. **Cambio de item:** Cross-fade entre items, 300ms
5. **Badge platino:** Shimmer perpetuo sutil (gradiente lineal animado)
