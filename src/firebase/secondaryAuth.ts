import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { app as primaryApp } from "./firebaseConfig";

// Motivo: createUserWithEmailAndPassword troca automaticamente o usuário
// autenticado no client SDK para o usuário recém-criado. Para o admin poder
// cadastrar funcionários sem ser deslogado da própria conta, criamos uma
// segunda instância do mesmo app do Firebase, isolada, só para esse cadastro.
//
// A mesma instância também é usada para o fluxo de "aprovação do
// administrador" (ex.: excluir um pagamento): a pessoa loga momentaneamente
// como admin nessa sessão secundária, a ação é executada de fato usando essa
// identidade (para respeitar as regras do Firestore que exigem admin), e a
// sessão secundária é encerrada logo em seguida — sem nunca afetar quem
// já estava logado no sistema.
const SECONDARY_APP_NAME = "diamond-sect-secondary";

function getSecondaryApp() {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  if (existing) return existing;
  return initializeApp(primaryApp.options, SECONDARY_APP_NAME);
}

export function getSecondaryAuth() {
  return getAuth(getSecondaryApp());
}

export function getSecondaryDb() {
  return getFirestore(getSecondaryApp());
}
