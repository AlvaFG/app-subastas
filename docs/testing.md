# Testing

## Stack

| Herramienta | Version | Uso |
|-------------|---------|-----|
| Jest | 30.2.0 | Test runner |
| ts-jest | 29.4.6 | Soporte TypeScript |
| Supertest | 7.2.2 | Tests HTTP E2E |

## Metricas

- **Total tests:** 93
- **Suites:** 7 (4 unit + 3 E2E)
- **Estado:** Todos passing

## Ejecucion

```bash
cd server
npm test
```

El script ejecuta `jest --forceExit` para cerrar conexiones DB pendientes.

---

## Tests Unitarios (37 tests)

### auth.test.ts — 7 tests

Verifica el middleware `authGuard`:
- Token valido extrae payload correctamente
- Token ausente retorna 401
- Token expirado retorna 401
- Token malformado retorna 401
- Header con formato incorrecto retorna 401

### bidValidation.test.ts — 13 tests

Valida la logica de limites de pujas:
- Puja menor a mejor oferta -> rechazada
- Puja menor al minimo (ultima + 1% base) -> rechazada
- Puja mayor al maximo (ultima + 20% base) -> rechazada
- Puja dentro del rango -> aceptada
- Limites no aplican a categorias oro/platino
- Importe NaN -> rechazado
- Importe negativo -> rechazado

### categoryGuard.test.ts — 12 tests

Verifica la jerarquia de categorias:
- Cada categoria puede acceder a su nivel e inferiores
- Cada categoria es rechazada en niveles superiores
- Categoria invalida -> rechazada

### multas.test.ts — 5 tests

Verifica calculo de multas:
- Multa = 10% del importe original
- Fecha limite = 72 horas desde creacion
- derivadaJusticia inicialmente 'no'

---

## Tests E2E (56 tests)

### auth.e2e.test.ts

Flujo completo de autenticacion:
- POST /auth/register/step1 con datos validos -> 201
- POST /auth/register/step1 con datos faltantes -> 400
- POST /auth/register/step2 con identificador valido -> 200
- POST /auth/login con credenciales validas -> 200 + tokens
- POST /auth/login con credenciales invalidas -> 401
- POST /auth/refresh con refresh token valido -> 200
- GET /auth/me con token valido -> 200 + perfil

### subastas.e2e.test.ts

Navegacion de subastas y catalogo:
- GET /subastas sin filtros -> 200 + lista paginada
- GET /subastas?estado=abierta -> filtra correctamente
- GET /subastas/:id/catalogo sin auth -> sin precios
- GET /subastas/:id/catalogo con auth -> con precios
- GET /subastas/:id/catalogo con categoria insuficiente -> 403
- GET /subastas/items/:id -> detalle completo

### mediosPago.e2e.test.ts

CRUD de medios de pago:
- POST /medios-pago -> 201 + crear
- GET /medios-pago -> lista activos
- PUT /medios-pago/:id -> actualizar
- DELETE /medios-pago/:id -> soft delete
- Operaciones sin auth -> 401

---

## Estrategia de Mocking

| Dependencia | Mock | Motivo |
|-------------|------|--------|
| `connectDB` | Jest mock | No conectar a DB real en tests |
| `jsonwebtoken` | Jest mock | Controlar tokens generados/verificados |
| `bcrypt` | Jest mock | Acelerar hashing en tests |
| `mssql pool` | Mock objeto | Simular queries y resultados |

### Patron de Mock

```typescript
jest.mock('../models/db', () => ({
  connectDB: jest.fn().mockResolvedValue({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [...] })
    })
  })
}));
```
