/**
 * Padroniza nomes (de clientes e de produtos) para facilitar a busca:
 * tudo em MAIÚSCULAS e sem símbolos (pontuação, @, #, -, /, etc.).
 * Os acentos também saem (JOÃO -> JOAO, AÇÚCAR -> ACUCAR) para que o mesmo nome
 * não exista de duas formas. Para voltar a manter os acentos, mude REMOVE_ACCENTS
 * para false.
 */
export const REMOVE_ACCENTS = true;

/** Tira os acentos de um texto (Ã -> A, Ç -> C). */
export function stripAccents(value: string): string {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Chave para comparar/buscar texto: minúsculo e sem acento ("João" e "JOAO" viram "joao"). */
export function searchKey(value: unknown): string {
  return stripAccents(String(value ?? "")).toLowerCase();
}

/** Use enquanto a pessoa digita (mantém o espaço no final, senão não dá para digitar o sobrenome). */
export function formatName(value: string, opts: { allowDigits?: boolean } = {}): string {
  const allowed = opts.allowDigits ? /[^\p{L}\p{N}\s]/gu : /[^\p{L}\s]/gu;
  const base = REMOVE_ACCENTS ? stripAccents(value || "") : value || "";
  return base
    .toLocaleUpperCase("pt-BR")
    .replace(/[ºª]/g, "") // contam como "letra" no Unicode, mas são símbolos
    .replace(allowed, " ") // símbolo vira espaço: "SILVA-SANTOS" -> "SILVA SANTOS"
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/, "");
}

/** Use na hora de salvar: além de formatar, tira espaços sobrando nas pontas. */
export function normalizeName(value: string, opts: { allowDigits?: boolean } = {}): string {
  return formatName(value, opts).trim();
}
