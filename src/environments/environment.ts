export const environment = {
  production: false,
  useEmulators: false,
  // Odivon Main API running locally (`npm run start:dev` in OdivonMainApi).
  apiBaseUrl: 'http://localhost:3000/api/v1',
  // Shared Firebase project of Odivon Main API (Auth only — data goes through the API).
  firebase: {
    apiKey: 'AIzaSyAu1u-wKeR9RQBhp6lqUvo64ZbQ5fNDIGg',
    authDomain: 'odivon-main-api-a2095.firebaseapp.com',
    projectId: 'odivon-main-api-a2095',
    storageBucket: 'odivon-main-api-a2095.firebasestorage.app',
    messagingSenderId: '845036233177',
    appId: '1:845036233177:web:ba0cbe0dcdb48e197bf9c8',
  },
};
