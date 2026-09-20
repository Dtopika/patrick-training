(()=>{'use strict';
  const config=Object.freeze({
    APP_NAME:'Patrick Training',
    APP_VERSION:'7.5.0',
    BACKUP_SCHEMA_VERSION:13,
    SESSION_SCHEMA_VERSION:9,
    DB_VERSION:1,
    CACHE_PREFIX:'patrick-training-',
    CACHE_NAME:'patrick-training-v7.5.0-r3',
    BACKUP_MAX_BYTES:2*1024*1024
  });
  globalThis.PATRICK_CONFIG=config;
})();
