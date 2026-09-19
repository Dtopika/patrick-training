(()=>{'use strict';
  const config=Object.freeze({
    APP_NAME:'Patrick Training',
    APP_VERSION:'6.0.0',
    BACKUP_SCHEMA_VERSION:6,
    SESSION_SCHEMA_VERSION:6,
    DB_VERSION:1,
    CACHE_PREFIX:'patrick-training-',
    CACHE_NAME:'patrick-training-v6.0.0',
    BACKUP_MAX_BYTES:2*1024*1024
  });
  globalThis.PATRICK_CONFIG=config;
})();
