# WhatsApp Gateway

## Nueva Arquitectura con Gestión Avanzada de Sesiones

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

## Características

- ✅ **LRU Cache** - Gestión inteligente de memoria
- ✅ **Auto-Recovery** - Reconexión automática al reiniciar
- ✅ **Cleanup Automático** - Limpieza de sesiones inactivas
- ✅ **Escalable** - Maneja 100k+ usuarios
- ✅ **Métricas** - Monitoreo de rendimiento

## Configuración

Copia `.env.example` a `.env` y configura:

```bash
MAX_SESSIONS=1000        # Máximo sesiones en memoria
SESSION_TTL=1800000      # 30 min de inactividad
CLEANUP_INTERVAL=300000  # Cleanup cada 5 min
```

## Uso

```bash
npm start
```

## Endpoints

### Sesiones
- `POST /sessions/:key/connect` - Conectar sesión
- `GET /sessions/:key` - Estado de sesión  
- `POST /sessions/:key/send-text` - Enviar mensaje

### Administración
- `GET /admin/stats` - Métricas del sistema
- `POST /admin/cleanup` - Forzar limpieza
- `POST /admin/recovery` - Forzar recovery

## Gestión de Memoria

- **Máximo 1000 sesiones** en memoria simultáneamente
- **Auto-eliminación** después de 30 min de inactividad
- **Reconexión automática** desde archivos auth/
- **Cleanup cada 5 minutos** de sesiones expiradas

## Recovery Automático

Al reiniciar el servicio:
1. Busca carpetas en `data/auth/`
2. Reconecta sesiones válidas automáticamente
3. Carga en batches para evitar sobrecarga

## Monitoreo

```bash
# Ver estadísticas
curl -H "Authorization: Bearer $API_KEY" http://localhost:8072/admin/stats

# Forzar limpieza
curl -X POST -H "Authorization: Bearer $API_KEY" http://localhost:8072/admin/cleanup
```