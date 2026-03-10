import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Sistema de Subastas — API',
      version: '1.0.0',
      description: 'API REST para el sistema de subastas (TPO DA1). Incluye autenticación JWT, gestión de subastas, pujas en tiempo real via Socket.IO, medios de pago, venta de items, multas, estadísticas y notificaciones.',
      contact: { name: 'DA1 TPO' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desarrollo local' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token JWT obtenido en POST /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error interno del servidor' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Email invalido' },
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', example: 'juan@example.com' },
            categoria: { type: 'string', enum: ['comun', 'especial', 'plata', 'oro', 'platino'] },
          },
        },
        Subasta: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            fecha: { type: 'string', format: 'date' },
            hora: { type: 'string' },
            estado: { type: 'string', enum: ['abierta', 'cerrada'] },
            ubicacion: { type: 'string' },
            categoria: { type: 'string', enum: ['comun', 'especial', 'plata', 'oro', 'platino'] },
            moneda: { type: 'string', enum: ['ARS', 'USD'] },
            capacidadAsistentes: { type: 'integer' },
            subastadorNombre: { type: 'string' },
            totalItems: { type: 'integer' },
          },
        },
        ItemCatalogo: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            subastado: { type: 'string', enum: ['si', 'no'] },
            precioBase: { type: 'number', description: 'Solo visible para usuarios autenticados' },
            comision: { type: 'number', description: 'Solo visible para usuarios autenticados' },
            descripcionCatalogo: { type: 'string' },
            descripcionCompleta: { type: 'string' },
            duenioNombre: { type: 'string' },
            fotoId: { type: 'integer', nullable: true },
          },
        },
        MedioPago: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            tipo: { type: 'string', enum: ['cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado'] },
            descripcion: { type: 'string' },
            banco: { type: 'string', nullable: true },
            numeroCuenta: { type: 'string', nullable: true },
            cbu: { type: 'string', nullable: true },
            moneda: { type: 'string', enum: ['ARS', 'USD'] },
            ultimosDigitos: { type: 'string', nullable: true },
            internacional: { type: 'string', enum: ['si', 'no'] },
            montoCheque: { type: 'number', nullable: true },
            montoDisponible: { type: 'number', nullable: true },
            verificado: { type: 'string', enum: ['si', 'no'] },
            activo: { type: 'string', enum: ['si', 'no'] },
          },
        },
        Multa: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            importeOriginal: { type: 'number' },
            importeMulta: { type: 'number', description: '10% del importe original' },
            pagada: { type: 'string', enum: ['si', 'no'] },
            fechaMulta: { type: 'string', format: 'date-time' },
            fechaLimite: { type: 'string', format: 'date-time', description: '72hs desde la multa' },
            derivadaJusticia: { type: 'string', enum: ['si', 'no'] },
          },
        },
        SolicitudVenta: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            descripcion: { type: 'string' },
            datosHistoricos: { type: 'string', nullable: true },
            estado: { type: 'string', enum: ['pendiente', 'aceptada', 'rechazada'] },
            motivoRechazo: { type: 'string', nullable: true },
            fechaSolicitud: { type: 'string', format: 'date-time' },
            valorBase: { type: 'number', nullable: true },
            comisionPropuesta: { type: 'number', nullable: true },
            aceptadoPorUsuario: { type: 'string', enum: ['si', 'no'], nullable: true },
          },
        },
        Notificacion: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            tipo: { type: 'string', enum: ['ganador', 'multa', 'sistema'] },
            titulo: { type: 'string' },
            mensaje: { type: 'string' },
            leida: { type: 'string', enum: ['si', 'no'] },
            fecha: { type: 'string', format: 'date-time' },
          },
        },
        Estadisticas: {
          type: 'object',
          properties: {
            subastasAsistidas: { type: 'integer' },
            subastasGanadas: { type: 'integer' },
            totalPujas: { type: 'integer' },
            totalPujado: { type: 'number' },
            totalPagado: { type: 'number' },
            totalComisiones: { type: 'number' },
            porCategoria: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  categoria: { type: 'string' },
                  cantidad: { type: 'integer' },
                },
              },
            },
            multas: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                impagas: { type: 'integer' },
              },
            },
          },
        },
        CuentaVista: {
          type: 'object',
          properties: {
            identificador: { type: 'integer' },
            banco: { type: 'string' },
            numeroCuenta: { type: 'string' },
            cbu: { type: 'string', nullable: true },
            moneda: { type: 'string' },
            pais: { type: 'string', nullable: true },
          },
        },
      },
    },
    paths: {
      // ── AUTH ──────────────────────────────────────────
      '/api/auth/register/step1': {
        post: {
          tags: ['Auth'],
          summary: 'Registro Etapa 1 — Datos personales',
          description: 'Crea persona + cliente pendiente. Requiere verificación manual posterior.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['documento', 'nombre', 'direccion', 'numeroPais'],
                  properties: {
                    documento: { type: 'string', example: '40123456' },
                    nombre: { type: 'string', example: 'Juan Pérez' },
                    direccion: { type: 'string', example: 'Av. Corrientes 1234' },
                    numeroPais: { type: 'integer', example: 1 },
                    fotoFrente: { type: 'string', description: 'Base64 o URL (Cloudinary)' },
                    fotoDorso: { type: 'string', description: 'Base64 o URL (Cloudinary)' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Registro etapa 1 exitoso', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { identificador: { type: 'integer' }, mensaje: { type: 'string' } } } } } } } },
            '400': { description: 'Bad Request — Datos inválidos o documento duplicado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '500': { description: 'Internal Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/register/step2': {
        post: {
          tags: ['Auth'],
          summary: 'Registro Etapa 2 — Email y clave',
          description: 'Completa el registro tras ser admitido. Hashea la clave con bcrypt.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['identificador', 'email', 'clave'],
                  properties: {
                    identificador: { type: 'integer', example: 1 },
                    email: { type: 'string', format: 'email', example: 'juan@example.com' },
                    clave: { type: 'string', minLength: 8, example: 'MiClave123', description: 'Mínimo 8 chars, 1 mayúscula, 1 número' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Registro completado' },
            '400': { description: 'Bad Request — Validación fallida o registro ya completado' },
            '403': { description: 'Forbidden — Cliente aún no admitido' },
            '404': { description: 'Not Found — Cliente no encontrado' },
            '500': { description: 'Internal Server Error' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Iniciar sesión',
          description: 'Devuelve access token (1h) y refresh token (7d). Bloquea si tiene multas derivadas a justicia.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'clave'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    clave: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login exitoso',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          accessToken: { type: 'string' },
                          refreshToken: { type: 'string' },
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized — Credenciales inválidas' },
            '403': { description: 'Forbidden — Cuenta bloqueada o suspendida por multas' },
            '429': { description: 'Too Many Requests — Rate limit excedido (15 req/15 min)' },
            '500': { description: 'Internal Server Error' },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Renovar access token',
          description: 'Emite nuevo access token usando un refresh token válido.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: { refreshToken: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Nuevo access token emitido' },
            '400': { description: 'Bad Request — Refresh token no enviado' },
            '401': { description: 'Unauthorized — Refresh token inválido o expirado' },
            '429': { description: 'Too Many Requests' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Obtener usuario actual',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Datos del usuario autenticado', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { identificador: { type: 'integer' }, documento: { type: 'string' }, nombre: { type: 'string' }, direccion: { type: 'string' }, email: { type: 'string' }, categoria: { type: 'string' }, admitido: { type: 'string' }, numeroPais: { type: 'integer' }, paisNombre: { type: 'string' } } } } } } } },
            '401': { description: 'Unauthorized — Token no proporcionado o inválido' },
            '404': { description: 'Not Found — Usuario no encontrado' },
          },
        },
      },

      // ── SUBASTAS ─────────────────────────────────────
      '/api/subastas': {
        get: {
          tags: ['Subastas'],
          summary: 'Listar subastas',
          description: 'Endpoint público. Soporta paginación y filtros.',
          parameters: [
            { name: 'estado', in: 'query', schema: { type: 'string', enum: ['abierta', 'cerrada'] } },
            { name: 'categoria', in: 'query', schema: { type: 'string', enum: ['comun', 'especial', 'plata', 'oro', 'platino'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          ],
          responses: {
            '200': {
              description: 'Lista paginada de subastas',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          subastas: { type: 'array', items: { $ref: '#/components/schemas/Subasta' } },
                          total: { type: 'integer' },
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '500': { description: 'Internal Server Error' },
          },
        },
      },
      '/api/subastas/{id}/catalogo': {
        get: {
          tags: ['Subastas'],
          summary: 'Catálogo de una subasta',
          description: 'Público sin precios. Con JWT incluye precioBase y comision. Requiere categoría suficiente si autenticado.',
          security: [{ bearerAuth: [] }, {}],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'Lista de items del catálogo', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/ItemCatalogo' } } } } } } },
            '403': { description: 'Forbidden — Categoría insuficiente para esta subasta' },
            '404': { description: 'Not Found — Subasta no encontrada' },
          },
        },
      },
      '/api/subastas/items/{id}': {
        get: {
          tags: ['Subastas'],
          summary: 'Detalle de un item',
          description: 'Incluye fotos, datos del dueño, info subasta. Precios solo con JWT.',
          security: [{ bearerAuth: [] }, {}],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'Detalle completo del item' },
            '404': { description: 'Not Found — Item no encontrado' },
          },
        },
      },

      // ── MEDIOS DE PAGO ───────────────────────────────
      '/api/medios-pago': {
        get: {
          tags: ['Medios de Pago'],
          summary: 'Listar medios de pago del usuario',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Lista de medios activos', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/MedioPago' } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['Medios de Pago'],
          summary: 'Crear medio de pago',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tipo', 'descripcion'],
                  properties: {
                    tipo: { type: 'string', enum: ['cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado'] },
                    descripcion: { type: 'string', example: 'Mi cuenta BBVA' },
                    banco: { type: 'string' },
                    numeroCuenta: { type: 'string' },
                    cbu: { type: 'string' },
                    moneda: { type: 'string', enum: ['ARS', 'USD'], default: 'ARS' },
                    ultimosDigitos: { type: 'string', example: '4532' },
                    internacional: { type: 'string', enum: ['si', 'no'], default: 'no' },
                    montoCheque: { type: 'number', description: 'Solo para cheque_certificado' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Created — Medio creado exitosamente' },
            '400': { description: 'Bad Request — Validación fallida' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/medios-pago/{id}': {
        put: {
          tags: ['Medios de Pago'],
          summary: 'Actualizar medio de pago',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['descripcion'],
                  properties: {
                    descripcion: { type: 'string' },
                    banco: { type: 'string' },
                    numeroCuenta: { type: 'string' },
                    cbu: { type: 'string' },
                    moneda: { type: 'string' },
                    ultimosDigitos: { type: 'string' },
                    internacional: { type: 'string', enum: ['si', 'no'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Medio actualizado. Se resetea verificación.' },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not Found — No pertenece al usuario' },
          },
        },
        delete: {
          tags: ['Medios de Pago'],
          summary: 'Eliminar medio de pago (soft delete)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': { description: 'Medio desactivado' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not Found' },
          },
        },
      },

      // ── MULTAS ───────────────────────────────────────
      '/api/multas': {
        get: {
          tags: ['Multas'],
          summary: 'Listar multas del usuario',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Lista de multas', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Multa' } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['Multas'],
          summary: 'Crear multa (uso interno)',
          description: 'Crea multa del 10% sobre el importe original. La multa se aplica al usuario autenticado. Deadline de 72hs.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['subasta', 'item', 'importeOriginal'],
                  properties: {
                    subasta: { type: 'integer' },
                    item: { type: 'integer' },
                    importeOriginal: { type: 'number', example: 5000 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Multa creada', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { importeMulta: { type: 'number', example: 500 }, fechaLimite: { type: 'string', format: 'date-time' } } } } } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Internal Server Error' },
          },
        },
      },

      // ── VENTA ────────────────────────────────────────
      '/api/venta/solicitudes': {
        get: {
          tags: ['Venta'],
          summary: 'Listar solicitudes de venta del usuario',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Lista de solicitudes', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/SolicitudVenta' } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['Venta'],
          summary: 'Crear solicitud de venta',
          description: 'Requiere declaración de propiedad. Mínimo 6 fotos (validado en frontend).',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['descripcion', 'declaracionPropiedad'],
                  properties: {
                    descripcion: { type: 'string', example: 'Reloj antiguo siglo XIX' },
                    datosHistoricos: { type: 'string', example: 'Perteneció a la familia desde 1920' },
                    declaracionPropiedad: { type: 'string', enum: ['si'], description: 'Debe ser "si"' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Solicitud creada' },
            '400': { description: 'Bad Request — Falta declaración de propiedad' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/venta/solicitudes/{id}': {
        get: {
          tags: ['Venta'],
          summary: 'Detalle de solicitud de venta',
          description: 'Incluye datos de depósito y seguro si existen.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': { description: 'Detalle de la solicitud con depósito y seguro' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not Found — Solicitud no encontrada o no pertenece al usuario' },
          },
        },
      },
      '/api/venta/solicitudes/{id}/respuesta': {
        put: {
          tags: ['Venta'],
          summary: 'Responder a valor base propuesto',
          description: 'El usuario acepta o rechaza el valor base asignado por la empresa.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['acepta'],
                  properties: {
                    acepta: { type: 'string', enum: ['si', 'no'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Respuesta registrada' },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not Found — Solicitud no encontrada o no aceptada' },
          },
        },
      },
      '/api/venta/cuentas': {
        get: {
          tags: ['Venta'],
          summary: 'Listar cuentas a la vista',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Lista de cuentas activas', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/CuentaVista' } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['Venta'],
          summary: 'Crear cuenta a la vista',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['banco', 'numeroCuenta'],
                  properties: {
                    banco: { type: 'string', example: 'Banco Nación' },
                    numeroCuenta: { type: 'string', example: '1234567890' },
                    cbu: { type: 'string' },
                    moneda: { type: 'string', default: 'ARS' },
                    pais: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Cuenta creada' },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
          },
        },
      },

      // ── ESTADÍSTICAS ─────────────────────────────────
      '/api/usuarios/estadisticas': {
        get: {
          tags: ['Estadísticas'],
          summary: 'Dashboard de métricas del usuario',
          description: 'Subastas asistidas, ganadas, total pujado/pagado, participación por categoría, multas.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Estadísticas del usuario', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Estadisticas' } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/usuarios/historial-pujas': {
        get: {
          tags: ['Estadísticas'],
          summary: 'Historial de pujas del usuario',
          description: 'Todas las pujas realizadas, opcionalmente filtradas por subasta.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'subastaId', in: 'query', schema: { type: 'integer' }, description: 'Filtrar por subasta específica' },
          ],
          responses: {
            '200': { description: 'Lista de pujas' },
            '401': { description: 'Unauthorized' },
          },
        },
      },

      // ── NOTIFICACIONES ───────────────────────────────
      '/api/notificaciones': {
        get: {
          tags: ['Notificaciones'],
          summary: 'Listar notificaciones del usuario',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Lista de notificaciones ordenadas por fecha DESC', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Notificacion' } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/notificaciones/count': {
        get: {
          tags: ['Notificaciones'],
          summary: 'Cantidad de notificaciones no leídas',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Contador', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { count: { type: 'integer' } } } } } } } },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/notificaciones/{id}/leer': {
        put: {
          tags: ['Notificaciones'],
          summary: 'Marcar notificación como leída',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': { description: 'Notificación marcada como leída' },
            '401': { description: 'Unauthorized' },
          },
        },
      },

      // ── HEALTH ───────────────────────────────────────
      '/api/health': {
        get: {
          tags: ['Sistema'],
          summary: 'Health check',
          description: 'Verifica que el servidor y la base de datos estén operativos.',
          responses: {
            '200': { description: 'Sistema operativo', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, db: { type: 'string', example: 'connected' } } } } } } } },
            '500': { description: 'Database connection failed' },
          },
        },
      },
    },

    tags: [
      { name: 'Auth', description: 'Registro, login y gestión de sesión (JWT)' },
      { name: 'Subastas', description: 'Listado, catálogos y detalle de items' },
      { name: 'Medios de Pago', description: 'CRUD de medios de pago del usuario' },
      { name: 'Multas', description: 'Penalizaciones por impago (10%, 72hs deadline)' },
      { name: 'Venta', description: 'Solicitudes de venta de bienes e inspección' },
      { name: 'Estadísticas', description: 'Métricas de participación y historial de pujas' },
      { name: 'Notificaciones', description: 'Notificaciones in-app (ganador, multas, sistema)' },
      { name: 'Sistema', description: 'Health check y utilidades' },
    ],
  },
  apis: [], // We define paths inline above
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Subastas API — Documentación',
  }));

  // JSON spec endpoint
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
