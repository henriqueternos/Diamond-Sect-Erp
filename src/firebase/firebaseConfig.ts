import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do projeto Diamond Sect
// IMPORTANTE: substitua "INSERIR_API_KEY_REAL_AQUI" pela apiKey real do seu
// projeto Firebase (Console Firebase > Configurações do projeto > Seus apps).
// Nenhum outro dado precisa ser alterado.
const firebaseConfig = {
  apiKey: "AIzaSyBk6jVkDMJ8-Nq1HZS5q-JeaF6w_NQzJ1I",
  authDomain: "diamond-sect-sistem.firebaseapp.com",
  projectId: "diamond-sect-sistem",
  storageBucket: "diamond-sect-sistem.firebasestorage.app",
  messagingSenderId: "458480084114",
  appId: "1:458480084114:web:a167e2dc8953ae235cb24b",
};

export const app = initializeApp(firebaseConfig);

// Autenticação (E-mail/Senha)
export const auth = getAuth(app);

// Cloud Firestore — banco de dados principal do sistema
export const db = getFirestore(app);

// OBS: Cloud Storage não é utilizado neste projeto (plano Spark / 100% gratuito).
// Campos de imagem (produtos, clientes) devem ser tratados como URL de texto opcional.
