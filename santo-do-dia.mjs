// Robô do santo do dia (calendário do Brasil). Roda uma vez por dia no GitHub Actions
// (.github/workflows/santo-do-dia.yml), fora da Cloudflare; o site só lê os arquivos.
//
// - Canção Nova (https://santo.cancaonova.com/): o santo de hoje, com imagem, um
//   trecho do texto e a lista de outros santos do dia.
// - Paulus Editora: pelo índice (indice-santos.json), a página de cada santo de hoje
//   e um trecho da publicação, com o link para a página inteira.
// Se a Canção Nova ainda não virou o dia, a Paulus vira a fonte principal; se as
// duas falharem, sai com erro sem gravar nada (o arquivo anterior fica, e o site
// avisa que está atrasado em vez de mostrar o santo errado).
//
// Uso: node robo/santo-do-dia.mjs [pasta-de-saida=public/dados]
// Grava santo.json e copia indice-santos.json para a mesma pasta.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairSanto, URL_SANTO_CANCAONOVA } from './lib/cancaonova.ts';
import { chaveDia, extrairPagina } from './lib/paulus.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = resolve(process.argv[2] ?? 'public/dados');
const arquivoIndice = resolve(aqui, 'indice-santos.json');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Data de hoje em São Paulo, AAAA-MM-DD.
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const [ano, mes, dia] = hoje.split('-').map(Number);

// Até 3 tentativas: uma falha de rede passageira não pode custar o santo do dia.
async function baixar(url, tentativas = 3) {
  for (let n = 1; ; n++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'SiteParoquiaSantaCandida/1.0 (santo do dia; poucos pedidos por dia)', Accept: 'text/html' },
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

// ---- Canção Nova ----
let cn = null;
try {
  cn = extrairSanto(await baixar(URL_SANTO_CANCAONOVA));
  if (!cn) throw new Error('a estrutura da página mudou: ajuste robo/lib/cancaonova.ts');
  if (cn.dia !== dia || cn.mes !== mes) throw new Error(`a página ainda mostra ${cn.dia}/${cn.mes}, e hoje é ${dia}/${mes}`);
} catch (e) {
  console.warn(`Canção Nova indisponível: ${e.message}`);
  cn = null;
}

// ---- Paulus ----
const paulus = [];
if (existsSync(arquivoIndice)) {
  const indice = JSON.parse(readFileSync(arquivoIndice, 'utf8'));
  for (const item of indice.dias?.[chaveDia(dia, mes)] ?? []) {
    try {
      await espera(1000);
      const p = extrairPagina(await baixar(item.link), item.link);
      if (p && p.dia === dia && p.mes === mes) paulus.push({ nome: p.nome, link: p.link, imagem: p.imagem, resumo: p.resumo });
      else console.warn(`Página da Paulus fora do dia ou mudou: ${item.link}`);
    } catch (e) {
      console.warn(`Paulus indisponível (${item.nome}): ${e.message}`);
    }
  }
} else {
  console.warn('Sem indice-santos.json: rode `npm run indice` para criar.');
}

if (!cn && paulus.length === 0) throw new Error('Nenhuma fonte respondeu com o santo de hoje: nada foi gravado.');

const principal = cn
  ? { fonte: { nome: 'Canção Nova', url: cn.link }, nome: cn.nome, imagem: cn.imagem, resumo: cn.resumo, outros: cn.outros, conteudo: cn.conteudo, link: cn.link }
  : { fonte: { nome: 'Paulus Editora', url: paulus[0].link }, nome: paulus[0].nome, imagem: paulus[0].imagem, resumo: paulus[0].resumo, outros: [], conteudo: [], link: paulus[0].link };

mkdirSync(saida, { recursive: true });
const dados = { dataISO: hoje, ano, ...principal, paulus: cn ? paulus : paulus.slice(1) };
writeFileSync(join(saida, 'santo.json'), `${JSON.stringify(dados, null, 1)}\n`);
if (existsSync(arquivoIndice)) copyFileSync(arquivoIndice, join(saida, 'indice-santos.json'));
console.log(`${principal.nome} [${principal.fonte.nome}] (${hoje}); Paulus: ${dados.paulus.length}; gravado em ${saida}`);
