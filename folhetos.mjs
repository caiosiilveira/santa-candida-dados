// Robô do Folheto Povo de Deus: lê a lista de folhetos da Arquidiocese de São Paulo
// (robo/lib/arquisp.ts) e grava folhetos.json, com a data, a celebração e os links dos PDFs
// do folheto e das partituras. Roda uma vez por mês, junto com o índice de santos
// (.github/workflows/indice-santos.yml), e o arquivo fica guardado no repositório; o robô
// diário só o leva para a branch dados. Se a página falhar ou vier sem folhetos, sai com
// erro sem gravar nada (fica a lista do mês anterior).
//
// Uso: node robo/folhetos.mjs [pasta-de-saida=public/dados]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extrairFolhetos, URL_FOLHETO_ARQUISP } from './lib/arquisp.ts';

const saida = resolve(process.argv[2] ?? 'public/dados');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function baixar(url, tentativas = 3) {
  for (let n = 1; ; n++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'SiteParoquiaSantaCandida/1.0 (folheto Povo de Deus; um pedido por mes)', Accept: 'text/html' },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
      return await r.text();
    } catch (e) {
      if (n >= tentativas) throw e;
      await espera(3000 * n);
    }
  }
}

const itens = extrairFolhetos(await baixar(URL_FOLHETO_ARQUISP));
// Menos que isso é sinal de que a página mudou: melhor manter o arquivo de ontem.
if (itens.length < 10) throw new Error(`só ${itens.length} folhetos na página: ajuste robo/lib/arquisp.ts`);

const atualizado = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, 'folhetos.json'), `${JSON.stringify({ atualizado, fonte: URL_FOLHETO_ARQUISP, itens }, null, 1)}\n`);
console.log(`${itens.length} folhetos (${itens[0].dataISO} a ${itens.at(-1).dataISO}); gravado em ${saida}`);
