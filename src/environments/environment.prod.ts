export const environment = {
  production: true,
  useEmulators: false,
  // TODO: replace with the real Render service URL once it's created (see deployment runbook).
  apiBaseUrl: 'https://odivonspa-server.onrender.com',
  firebase: {
    projectId: 'odivonspa',
    appId: '1:871613231301:web:80300f44c3656deb51c0ac',
    storageBucket: 'odivonspa.firebasestorage.app',
    apiKey: 'AIzaSyA_p-jgG27WN7GpUM1GYSeDUk1_Gxb3oMc',
    authDomain: 'odivonspa.firebaseapp.com',
    messagingSenderId: '871613231301',
    measurementId: 'G-650QG3B6QN',
  },
};
