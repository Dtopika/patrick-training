(()=>{
  const DB_NAME='patrick-training-db';
  const DB_VERSION=1;
  const STORE='kv';
  let dbPromise=null;

  function open(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Could not open IndexedDB'));
      request.onblocked=()=>reject(new Error('IndexedDB open blocked'));
    });
    return dbPromise;
  }

  async function withStore(mode,work){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      const store=tx.objectStore(STORE);
      let result;
      try{result=work(store)}catch(e){reject(e);return}
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
    });
  }

  async function get(key){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(key);
      req.onsuccess=()=>resolve(req.result?.value);
      req.onerror=()=>reject(req.error||new Error('IndexedDB read failed'));
    });
  }

  async function set(key,value){
    return withStore('readwrite',store=>store.put({key,value,updatedAt:new Date().toISOString()}));
  }

  async function del(key){
    return withStore('readwrite',store=>store.delete(key));
  }

  async function clearAll(){
    return withStore('readwrite',store=>store.clear());
  }

  async function migrateLocalStorage(keys){
    const marker='__localStorageMigrationV1';
    if(await get(marker))return false;
    for(const key of keys){
      if(await get(key)!==undefined)continue;
      const raw=localStorage.getItem(key);
      if(raw===null)continue;
      try{await set(key,JSON.parse(raw))}catch{await set(key,raw)}
    }
    await set(marker,{done:true,at:new Date().toISOString()});
    return true;
  }

  window.PatrickDB={open,get,set,del,clearAll,migrateLocalStorage,dbName:DB_NAME};
})();
