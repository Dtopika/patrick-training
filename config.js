(()=>{'use strict';
  const config=Object.freeze({
    APP_NAME:'Patrick Training',
    APP_VERSION:'6.4.0',
    BACKUP_SCHEMA_VERSION:8,
    SESSION_SCHEMA_VERSION:8,
    DB_VERSION:1,
    CACHE_PREFIX:'patrick-training-',
    CACHE_NAME:'patrick-training-v6.4.0-r1',
    BACKUP_MAX_BYTES:2*1024*1024
  });
  globalThis.PATRICK_CONFIG=config;
})();
