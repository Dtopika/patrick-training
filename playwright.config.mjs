import {defineConfig,devices} from '@playwright/test';

const galaxy=devices['Galaxy S9+'];
const common={
  baseURL:'http://127.0.0.1:4173',
  locale:'es-CO',
  timezoneId:'America/Bogota',
  serviceWorkers:'allow'
};

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  expect:{timeout:5000},
  fullyParallel:false,
  workers:1,
  reporter:'line',
  use:common,
  projects:[
    {name:'android-compact',use:{...galaxy}},
    {name:'android-modern',use:{...galaxy,viewport:{width:412,height:915},screen:{width:412,height:915}}}
  ]
});
