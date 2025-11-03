import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
    apiKey: "AIzaSyBgd9Adn-jWzDNfUrz5aj7p95HdtVduOm0",
    authDomain: "hotel-dashboard-44e88.firebaseapp.com",
    projectId: "hotel-dashboard-44e88",
    storageBucket: "hotel-dashboard-44e88.appspot.com",
    messagingSenderId: "751227975830",
    appId: "1:751227975830:web:7d19e6452defc2a43a2ab7"
  };
  

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza i servizi
const db = getFirestore(app);
const auth = getAuth(app);

// Esporta i servizi per l'utilizzo nelle altre parti dell'app
export { db, auth };