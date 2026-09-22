(()=>{'use strict';
  const config=Object.freeze({
    APP_NAME:'Patrick Training',
    APP_VERSION:'7.10.1',
    BACKUP_SCHEMA_VERSION:13,
    SESSION_SCHEMA_VERSION:9,
    DB_VERSION:1,
    MAX_DOG_AGE_MONTHS:240,
    CACHE_PREFIX:'patrick-training-',
    CACHE_NAME:'patrick-training-v7.10.1-r1',
    BACKUP_MAX_BYTES:2*1024*1024
  });
  globalThis.PATRICK_CONFIG=config;
})();
