# Sistema de Subastas

## Descripcion General

El equipo de analistas ha finalizado el relevamiento para una app que gestione la inclusion de articulos en subastas y la participacion como oferentes en estas.

La empresa solicito un desarrollo para dispositivos moviles que les permita a los usuarios participar de forma on-line en las subastas que realiza la empresa en forma presencial, como asi tambien indicar que posee algun articulo que deseen incluir en futuras subastas.

La empresa posee actualmente un sistema local que contiene toda la informacion de las subastas realizadas, los duenos de los items en subasta de cada subasta, los postores, las ofertas realizadas por cada uno de los postores (concretadas o no), los rematadores o martilleros, etc. Nuestra app debera consumir y actualizar esa informacion a fin de integrarse con el sistema existente.

## Conceptos Clave

- **Subasta (o remate):** Una competencia de ofertas donde gana el que mas paga. Se parte de un valor inicial (conocido como precio base) y el mejor postor se queda con el articulo.
- **Postor:** Persona que participa en una subasta ofreciendo dinero para intentar comprar el objeto que se esta subastando.
- **Puja:** Hacer una oferta de dinero para tratar de comprar el objeto que se esta rematando (cada vez que un postor hace una oferta es una puja).

## Modalidad de Subasta

La empresa realiza las subastas en la modalidad conocida como **subasta dinamica ascendente** donde los postores conocen las ofertas de su competencia y pueden modificar la suya mientras la subasta esta abierta.

Esta modalidad parte de un precio de reserva o base y los postores van presentando ofertas con precios ascendentes, ganando quien ofrezca el precio mayor.

## Registro de Postores

La aplicacion movil requiere que los postores se encuentren registrados para poder participar y se identifiquen antes de su participacion.

### Etapa 1: Datos personales

El postor ingresa sus datos:
- Nombre y apellido
- Foto del documento (frente y dorso)
- Domicilio legal
- Pais de origen

Estos datos son verificados por la empresa de subastas mediante una investigacion externa. Si se lo acepta, se le asigna una **categoria** de acuerdo con la investigacion realizada.

### Categorias

Las categorias son: **comun**, **especial**, **plata**, **oro** y **platino**. Esta categoria determina en que subastas puede participar.

### Etapa 2: Completar registro

Una vez finalizada la primera parte, se le envia un mail informandole que debe ingresar a la app y completar el registro y generar su clave personal.

### Medios de Pago

El usuario debe registrar al menos un medio de pago, pero puede registrar todos los que desee y gestionarlos a traves de la app. Estos pueden ser:

- **Cuentas bancarias** (pueden ser bancos extranjeros) con fondos reservados para la subasta
- **Tarjetas de credito** (nacionales o extranjeras)
- **Cheques certificados** por un monto determinado, entregado y verificado ANTES del inicio de la subasta

La diversidad de los medios de pago del usuario y su actividad en las subastas permiten mejorar su categoria.

## Subastas

### Datos de una subasta

Cada subasta tiene asignado:
- Dia y horario
- Categoria
- Rematador
- Lista de objetos a subastar denominada **catalogo**

Los catalogos son publicos, pero solo los usuarios registrados (de cualquier categoria) pueden ver su precio base de venta.

### Objetos del Catalogo

De los objetos que conforman el catalogo conocemos:
- Numero de pieza (o item)
- Descripcion (pequeno texto descriptivo)
- Precio base
- Dueno actual
- Serie de imagenes (aproximadamente 6)

> Una pieza o item puede estar formado por varios elementos (ej: Juego de Te de 18 piezas).

En el caso de **obras de arte u objetos de disenador**, se conoce ademas:
- Nombre del artista o disenador
- Fecha
- Historia del objeto (contexto, duenos anteriores, curiosidades, etc.)

## Participacion en Subastas

### Acceso

Para que un postor pueda acceder a una subasta determinada debe:
- Encontrarse registrado
- La categoria de la subasta debe ser **menor o igual** que la propia

Solo podra pujar si tiene al menos un medio de pago verificado por la empresa. Caso contrario, solo podra ver la subasta.

### Streaming

La empresa brindara un servicio de streaming para poder seguir el desarrollo de la subasta. Este servicio **no forma parte del desarrollo de la app**. Cualquier usuario registrado y aprobado puede acceder al servicio.

### Proceso de Puja

1. El usuario selecciona a cual de las subastas abiertas existentes desea conectarse
2. Al ingresar, podra ver que articulo se subasta y cual es la mayor oferta hasta el momento
3. Si cumple con las condiciones, puede pujar determinando la cantidad que desea ofertar (debe ser mayor a la mejor oferta)

### Limites de Puja

- **Minimo:** La puja debe ser al menos el mejor valor hasta el momento mas el **1% del valor base** del bien
  - Ejemplo: valor base 10.000, ultima oferta 15.000 → puja minima: 15.100
- **Maximo:** La puja no puede ser mayor al valor de la ultima oferta mas el **20% del valor base** del bien
  - Ejemplo: valor base 10.000, ultima oferta 15.000 → puja maxima: 17.000

> Estos limites **no aplican** a las subastas de categorias **oro y platino**.

### Tiempo Real

Los usuarios conectados deben recibir en tiempo real las modificaciones de las ofertas para poder hacer sus propias ofertas. La app debe validarlas antes de ser enviadas.

### Cierre de Puja

Cuando ya nadie puja con un valor mas alto, el usuario de la ultima puja pasa a ser el nuevo dueno de la pieza. Se registra la venta del objeto con el medio de pago seleccionado y los datos del usuario. La pieza se marca como vendida y se actualizan todos los datos (registracion del nuevo dueno, importes, comisiones, etc.).

Se le informa por medio de un **mensaje privado** el importe que debe pagar indicando:
- Lo pujado
- Las comisiones
- El costo de envio a la direccion declarada

> El usuario puede retirar personalmente el bien adquirido, pero en ese caso pierde la cobertura del seguro.

## Pagos y Garantias

- Si el usuario dejo como garantia de pago un monto de dinero (ej: cheque certificado), sus compras no pueden superar dicho monto, pero mientras le alcance puede participar en tantas subastas como quiera.
- Si al momento de pagar no posee el dinero:
  - Recibe una **multa del 10%** del valor ofertado que debera abonar antes de participar en otra subasta
  - Debera presentar antes de las **72hs** los fondos necesarios
- Si no cumple con su obligacion de pago, el caso se deriva a la justicia (fuera del alcance de la app) y el usuario **no podra acceder a ningun servicio** de la aplicacion.

## Restricciones

- La empresa puede hacer varias subastas al mismo tiempo, pero los usuarios **no pueden estar conectados en mas de una a la vez**.
- Las subastas pueden ser en **pesos o en dolares** (determinado al momento de crear la subasta). No es posible hacer una subasta bimonetaria.
- Las subastas en dolares deben ser canceladas en dicha moneda (por transferencia o tarjeta internacional).

## Registro de Datos

De cada subasta se conocen todos sus datos: ubicacion, fecha y hora de inicio, subastador, etc. Se deben guardar **todos los pujes realizados por cada usuario**, respetando el orden.

Se debe garantizar que los pujes esten registrados correctamente: cuando un usuario hace un puje, la aplicacion **no debe permitir otro** hasta haber recibido la confirmacion del sistema de que la transaccion fue realizada con exito e informado al resto de los usuarios.

## Metricas y Estadisticas

Cada usuario puede ver:
- Su participacion en las subastas
- Cantidad de subastas a las que asistio
- Veces que gano
- Historial de pujos de una subasta
- Metricas sobre categorias de subastas, participaciones, importes pagados y ofertados, etc.

## Venta de Articulos

Los usuarios pueden solicitar a la empresa que coloque algun articulo de su propiedad en subasta.

### Proceso de solicitud

1. Ingresar los datos del bien a subastar
2. Subir fotos (al menos 6)
3. Cualquier dato de interes o historico relevante
4. Declarar que el bien le pertenece y no posee impedimento para venderlo (casillero obligatorio en el formulario)
5. Debe poder acreditar el origen licito de los bienes (si fuera requerido)

> La empresa, en caso de duda, avisara a las autoridades sobre dudas en el origen.

### Inspeccion

Si la empresa esta interesada, el usuario debera enviar los articulos a la direccion indicada para su inspeccion. El usuario debe aceptar que si el bien no es aceptado, sera devuelto **con cargo al usuario**.

Si la cantidad de articulos es muy numerosa, la empresa puede hacer una sola subasta con esos objetos, denominada **coleccion** con el nombre del usuario.

### Resultado de la inspeccion

- **No aceptado:** El bien es devuelto con cargo. El usuario puede ver las causas del rechazo en la app.
- **Aceptado:** El bien se incluye en una futura subasta. Se informa al usuario:
  - Fecha, hora, lugar
  - Valor base de cada objeto aceptado
  - Comisiones

> El usuario puede no aceptar el valor base o las comisiones. En ese caso, se procede a la devolucion y se le informa de los gastos.

### Envio y Pago

- Cuando un usuario adquiere un bien, el envio esta a cargo del comprador y se incluye en la factura de compra.
- Si nadie puja por un articulo, **la empresa compra el mismo** por el valor base al finalizar la subasta.
- El dinero de los articulos vendidos se envia a una **cuenta a la vista** (puede ser del exterior). Las cuentas deben ser declaradas antes del inicio de la subasta.

## Seguros

- De cada bien recibido para la venta se le contrata un **seguro** en funcion del valor base del bien.
- El seguro puede cubrir varias piezas, pero siempre que sean de un **mismo dueno** (beneficiario de la poliza).
- La aplicacion debe permitir al dueno de una pieza entregada ver:
  - Ubicacion de la pieza (en que deposito se encuentra)
  - Poliza de seguro contratada por la empresa
- El cliente puede contactar a la compania de seguros y **aumentar el valor de la poliza** pagando la diferencia del premio.
