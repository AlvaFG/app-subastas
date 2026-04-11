# Componentes UI

7 componentes reutilizables en `app/src/components/`. Todos usan design tokens del theme.

---

## Button

Boton con 5 variantes y 3 tamaños.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `title` | string | Si | — | Texto del boton |
| `onPress` | () => void | Si | — | Callback al presionar |
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger'` | No | `'primary'` | Estilo visual |
| `size` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Tamaño |
| `disabled` | boolean | No | false | Deshabilitar |
| `loading` | boolean | No | false | Mostrar spinner |
| `style` | ViewStyle | No | — | Estilos adicionales |

### Variantes

| Variante | Background | Texto | Borde | Uso |
|----------|-----------|-------|-------|-----|
| primary | auctionGold | ink | — | CTA: "Pujar", "Registrarse" |
| secondary | parchment | textPrimary | 1.5px border | "Ver catalogo", "Filtrar" |
| outline | transparent | auctionGold | 1.5px auctionGold | Acciones secundarias |
| ghost | transparent | textSecondary | — | "Cancelar", "Atras" |
| danger | alertEmber | ivory | — | "Eliminar medio de pago" |

### Tamaños

| Size | Altura | Padding horizontal | Font size |
|------|--------|-------------------|-----------|
| sm | 40px | 16px | 14px |
| md | 48px | 24px | 16px |
| lg | 56px | 32px | 18px |

### Animacion
Scale 0.97 on press (120ms).

### Ejemplo
```tsx
<Button title="Pujar" onPress={handleBid} variant="primary" size="lg" />
<Button title="Cancelar" onPress={goBack} variant="ghost" />
```

---

## Input

Campo de texto con label, error y password toggle.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `label` | string | No | — | Label superior |
| `error` | string | No | — | Mensaje de error |
| `leftIcon` | Ionicons glyph | No | — | Icono izquierdo |
| `isPassword` | boolean | No | false | Toggle visibilidad |
| `style` | ViewStyle | No | — | Estilos adicionales |
| ...TextInputProps | — | — | — | Todas las props nativas |

### Specs

- Altura: 52px
- Borde: 1.5px, radius 12px
- Focus: borde auctionGold
- Error: borde alertEmber, mensaje debajo en sm/alertEmber

### Ejemplo
```tsx
<Input label="Email" leftIcon="mail-outline" keyboardType="email-address" />
<Input label="Clave" isPassword error={errors.clave?.message} />
```

---

## Card

Tarjeta de item con imagen, badge y precio.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `title` | string | Si | — | Titulo del item |
| `price` | number | No | — | Precio base |
| `currency` | `'ARS' \| 'USD'` | No | `'ARS'` | Moneda |
| `description` | string | No | — | Descripcion breve |
| `imageUrl` | string | No | — | URL de la imagen |
| `category` | CategoryName | No | — | Categoria para badge |
| `onPress` | () => void | No | — | Callback al presionar |

### Specs

- Imagen: aspect ratio 4:3 con overflow hidden
- Badge: posicion absoluta top-right sobre la imagen
- Precio: Playfair Display bold, xl, auctionGold, formato `$999.999,99` (es-AR)
- Animacion: scale 1.02 on press (200ms)
- Placeholder si no hay imagen

### Ejemplo
```tsx
<Card
  title="Reloj Omega Seamaster 1965"
  price={50000}
  currency="ARS"
  category="oro"
  imageUrl="https://..."
  onPress={() => router.push(`/item/${id}`)}
/>
```

---

## Modal

Dialogo central o bottom sheet.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `visible` | boolean | Si | — | Visibilidad |
| `onClose` | () => void | Si | — | Callback al cerrar |
| `title` | string | No | — | Titulo del modal |
| `children` | ReactNode | Si | — | Contenido |
| `variant` | `'center' \| 'bottom'` | No | `'center'` | Posicion |

### Specs

- Overlay: rgba(11,14,17,0.6)
- Center: max-width 90%, radius lg
- Bottom: radius solo top, drag handle 40x4px centrado
- KeyboardAvoidingView integrado
- Close icon en header

### Ejemplo
```tsx
<Modal visible={show} onClose={() => setShow(false)} title="Seleccionar Medio de Pago" variant="bottom">
  <MediosPagoList />
</Modal>
```

---

## Badge

Badge de categoria con colores unicos.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `category` | `'comun' \| 'especial' \| 'plata' \| 'oro' \| 'platino'` | Si | — | Categoria |
| `style` | ViewStyle | No | — | Estilos adicionales |

### Estilos por Categoria

| Categoria | Background | Texto | Borde |
|-----------|-----------|-------|-------|
| comun | rgba(139,141,145,0.15) | #8B8D91 | — |
| especial | rgba(91,127,165,0.15) | #5B7FA5 | — |
| plata | rgba(168,181,194,0.15) | #A8B5C2 | 1px |
| oro | rgba(201,168,76,0.10) | #C9A84C | 1px |
| platino | rgba(232,228,223,0.10) | #0B0E11 | 1px |

### Specs
Altura 24px, padding horizontal 8px, DM Sans medium xs uppercase, letter-spacing 0.5px.

### Ejemplo
```tsx
<Badge category="oro" />
```

---

## Avatar

Avatar circular con fallback de iniciales.

### Props

| Prop | Tipo | Requerido | Default | Descripcion |
|------|------|-----------|---------|-------------|
| `imageUrl` | string | No | — | URL de la imagen |
| `name` | string | No | — | Nombre para iniciales |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | No | `'md'` | Tamaño |

### Tamaños

| Size | Dimensiones | Font |
|------|------------|------|
| sm | 32x32 | 12px |
| md | 40x40 | 14px |
| lg | 56x56 | 20px |
| xl | 80x80 | 28px |

### Fallback
Si no hay imagen: iniciales sobre fondo auctionGold al 20% de opacidad, texto auctionGold.

### Ejemplo
```tsx
<Avatar name="Juan Perez" size="xl" />
```

---

## Loading

Estados de carga: Skeleton shimmer, Spinner y CardSkeleton.

### Skeleton

| Prop | Tipo | Requerido | Default |
|------|------|-----------|---------|
| `width` | number/string | Si | — |
| `height` | number/string | Si | — |
| `borderRadius` | number | No | — |
| `style` | ViewStyle | No | — |

Animacion shimmer con loop de 0.6s.

### Spinner

| Prop | Tipo | Requerido | Default |
|------|------|-----------|---------|
| `size` | number | No | 24 |
| `color` | string | No | auctionGold |

Borde rotativo de 800ms.

### CardSkeleton

Skeleton pre-armado con imagen (180px) y 3 lineas de texto placeholder.

### Ejemplo
```tsx
<Skeleton width="100%" height={180} borderRadius={12} />
<Spinner size={32} />
<CardSkeleton />
```
