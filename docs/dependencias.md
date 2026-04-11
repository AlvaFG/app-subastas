# Dependencias

## Frontend (app/)

### Produccion

| Paquete | Version | Uso |
|---------|---------|-----|
| expo | ~55.0.5 | Framework base React Native |
| react | 19.2.0 | Libreria UI |
| react-native | 0.83.2 | Runtime movil |
| expo-router | ~55.0.4 | Navegacion file-based |
| zustand | ^5.0.11 | Estado global ligero |
| axios | ^1.13.6 | HTTP client |
| socket.io-client | ^4.8.3 | WebSocket client |
| react-hook-form | ^7.71.2 | Formularios con validacion |
| expo-secure-store | ~55.0.8 | Almacenamiento seguro de tokens |
| expo-image-picker | ~55.0.11 | Selector de imagenes |
| react-native-reanimated | 4.2.1 | Animaciones fluidas |
| moti | ^0.30.0 | Animaciones declarativas |
| react-native-gesture-handler | ~2.30.0 | Gestos tactiles |
| react-native-screens | ~4.23.0 | Screens nativas |
| react-native-safe-area-context | ~5.6.2 | Safe areas |
| react-native-svg | ^15.15.3 | SVG rendering |
| @expo/vector-icons | ^15.1.1 | Iconos (Ionicons) |
| @expo-google-fonts/playfair-display | ^0.4.2 | Fuente display (precios, titulos) |
| @expo-google-fonts/dm-sans | ^0.4.2 | Fuente heading/body |
| expo-font | ~55.0.4 | Carga de fuentes |
| expo-constants | ~55.0.7 | Constantes del dispositivo |
| expo-linking | ~55.0.7 | Deep linking |
| expo-status-bar | ~55.0.4 | Status bar control |

### Desarrollo

| Paquete | Version | Uso |
|---------|---------|-----|
| typescript | ~5.9.2 | Tipado estatico |
| @types/react | ~19.2.2 | Tipos de React |
| eslint | ^9.0.0 | Linter |
| eslint-config-expo | ~55.0.0 | Config ESLint para Expo |

---

## Backend (server/)

### Produccion

| Paquete | Version | Uso |
|---------|---------|-----|
| express | ^5.2.1 | Framework HTTP |
| socket.io | ^4.8.3 | WebSocket server |
| mssql | ^12.2.0 | Driver SQL Server (tedious) |
| bcrypt | ^6.0.0 | Hash de passwords |
| jsonwebtoken | ^9.0.3 | Generacion/verificacion JWT |
| express-validator | ^7.3.1 | Validacion de inputs |
| express-rate-limit | ^8.3.1 | Rate limiting |
| helmet | ^8.1.0 | Security headers |
| cors | ^2.8.6 | Cross-origin requests |
| morgan | ^1.10.1 | Logging HTTP |
| multer | ^2.1.1 | Upload de archivos |
| cloudinary | ^2.9.0 | Almacenamiento de imagenes |
| dotenv | ^17.3.1 | Variables de entorno |
| swagger-jsdoc | ^6.2.8 | Generacion OpenAPI spec |
| swagger-ui-express | ^5.0.1 | Swagger UI interactivo |

### Desarrollo

| Paquete | Version | Uso |
|---------|---------|-----|
| typescript | ^5.9.3 | Tipado estatico |
| nodemon | ^3.1.14 | Hot reload en desarrollo |
| jest | ^30.2.0 | Test runner |
| ts-jest | ^29.4.6 | Soporte TypeScript en Jest |
| supertest | ^7.2.2 | Tests HTTP |
| ts-node | ^10.9.2 | Ejecucion directa de TypeScript |
| @types/bcrypt | ^6.0.0 | Tipos |
| @types/cors | ^2.8.19 | Tipos |
| @types/express | ^5.0.6 | Tipos |
| @types/jest | ^30.0.0 | Tipos |
| @types/jsonwebtoken | ^9.0.10 | Tipos |
| @types/morgan | ^1.9.10 | Tipos |
| @types/mssql | ^9.1.9 | Tipos |
| @types/multer | ^2.1.0 | Tipos |
| @types/node | ^25.4.0 | Tipos |
| @types/supertest | ^7.2.0 | Tipos |
| @types/swagger-jsdoc | ^6.0.4 | Tipos |
| @types/swagger-ui-express | ^4.1.8 | Tipos |
