# WhatsApp Gateway

## Nueva Arquitectura

```
src/
├── config/         # Configuración centralizada
├── middleware/     # Auth y error handling
├── services/       # Lógica de negocio (WhatsApp + Sessions)
├── routes/         # Endpoints HTTP
└── utils/          # Logging y validaciones

data/
├── auth/          # Sesiones de Baileys
└── logs/          # Archivos de log
```

## Uso

```bash
npm start
```

## Endpoints

- `POST /sessions/:key/connect` - Conectar sesión
- `GET /sessions/:key` - Estado de sesión  
- `POST /sessions/:key/send-text` - Enviar mensaje

## Cambios

- ✅ Código modular y organizado
- ✅ Logging estructurado
- ✅ Validaciones centralizadas
- ✅ Error handling global
- ✅ Configuración centralizada