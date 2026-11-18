// Índice dos santos da Paulus Editora: para cada dia do ano, os santos e a página de
// cada um (https://www.paulus.com.br/portal/santo/). Percorre a lista paginada
// (cerca de 31 páginas, um pedido por segundo) e grava indice-santos.json.
// A lista quase não muda, então roda só de vez em quando: a cada mês no GitHub
// Actions (.github/workflows/indice-santos.yml) ou à mão (npm run indice).
//
// Uso: node robo/indice-santos.mjs [arquivo-de-saida=robo/indice-santos.json]
// Não grava nada se a lista vier incompleta (estrutura do site mudou).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairLista, montarIndice, ultimaPagina, URL_LISTA_PAULUS } from './lib/paulus.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = resolve(process.argv[2] ?? resolve(aqui, 'indice-santos.json'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pagina(n) {
  const url = n === 1 ? URL_LISTA_PAULUS : `${URL_LISTA_PAULUS}page/${n}/`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'SiteParoquiaSantaCandida/1.0 (indice de santos; 1 leitura por mes)', Accept: 'text/html' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Paulus respondeu HTTP ${r.status} em ${url}`);
  return r.text();
}

const primeira = await pagina(1);
const total = ultimaPagina(primeira);
if (total < 25 || total > 60) throw new Error(`Número de páginas estranho (${total}): a lista da Paulus mudou?`);

const itens = extrairLista(primeira);
for (let n = 2; n <= total; n++) {
  await espera(1000);
  itens.push(...extrairLista(await pagina(n)));
}

const dias = montarIndice(itens);
const cobertos = Object.keys(dias).length;
if (cobertos < 330) throw new Error(`Só ${cobertos} dias cobertos de 366: a lista da Paulus mudou? Nada foi gravado.`);

const geradoEm = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
writeFileSync(saida, `${JSON.stringify({ geradoEm, fonte: URL_LISTA_PAULUS, dias })}\n`);
console.log(`${itens.length} santos em ${cobertos} dias, gravados em ${saida}`);
