// Santos da Paulus Editora (https://www.paulus.com.br/portal/santo/), editora
// brasileira: uma publicação por santo, uma por dia do ano. Não há API (a lista de
// santos não está na API do WordPress deles), então o robô lê o HTML.
// - O índice (dia → santos e a página de cada um) sai da lista paginada: a data de
//   publicação de cada post (dd/mm) é o dia da festa.
// - A página de cada santo traz a publicação do dia; daqui sai só um trecho, com o
//   link para a página inteira (direitos autorais, ver docs/SANTO-DO-DIA.md).

import { decodificar, resumir, textoPuro } from './cancaonova.ts';

export const URL_LISTA_PAULUS = 'https://www.paulus.com.br/portal/santo/';

export interface ItemIndice {
  nome: string;
  link: string;
}

/** "MM-DD" → santos daquele dia. */
export type Indice = Record<string, ItemIndice[]>;

export interface ItemLista extends ItemIndice {
  dia: number;
  mes: number;
}

export interface PaginaPaulus extends ItemIndice {
  dia: number;
  mes: number;
  imagem: string | null;
  resumo: string;
}

const dois = (n: number) => String(n).padStart(2, '0');

/** Chave do índice para um dia e mês ("11-18"). */
export const chaveDia = (dia: number, mes: number) => `${dois(mes)}-${dois(dia)}`;

/** Só aceita páginas de santo no próprio site da Paulus (https). */
export function linkSeguro(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(decodificar(url));
    if (u.protocol !== 'https:' || u.hostname !== 'www.paulus.com.br' || !u.pathname.startsWith('/portal/santo/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function imagemSegura(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(decodificar(url).replace(/^http:/, 'https:'));
    return u.protocol === 'https:' && u.hostname === 'www.paulus.com.br' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Número da última página da lista ("…/santo/page/31/" no link »). */
export function ultimaPagina(html: string): number {
  const numeros = Array.from(html.matchAll(/\/portal\/santo\/page\/(\d+)\//g), (m) => Number(m[1]));
  return numeros.length ? Math.max(...numeros) : 1;
}

/** Itens de uma página da lista: nome, link e a data (dia e mês) de publicação. */
export function extrairLista(html: string): ItemLista[] {
  const itens: ItemLista[] = [];
  for (const bloco of html.split('<div class="container-noticias">').slice(1)) {
    const data = bloco.match(/<h3>\s*(\d{2})\/(\d{2})\/\d{4}\s*<\/h3>/);
    const titulo = bloco.match(/<a href="([^"]+)"><h2>([^<]+)<\/h2>/);
    const link = linkSeguro(titulo?.[1]);
    if (!data || !titulo || !link) continue;
    const nome = textoPuro(titulo[2]);
    if (nome) itens.push({ nome, link, dia: Number(data[1]), mes: Number(data[2]) });
  }
  return itens;
}

/** Junta as páginas da lista no índice por dia, sem repetir a mesma página. */
export function montarIndice(itens: ItemLista[]): Indice {
  const indice: Indice = {};
  for (const { dia, mes, nome, link } of itens) {
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    const chave = chaveDia(dia, mes);
    const lista = (indice[chave] ??= []);
    if (!lista.some((i) => i.link === link)) lista.push({ nome, link });
  }
  return Object.fromEntries(Object.entries(indice).sort(([a], [b]) => a.localeCompare(b)));
}

/** A publicação de um santo: nome, dia, imagem e um trecho do texto; null se a página mudou. */
export function extrairPagina(html: string, link: string): PaginaPaulus | null {
  const nome = html.match(/<div class="titulo-liturgia">\s*([^<]+)/);
  const data = html.match(/<h2 class="data-santo-interna">\s*(\d{2})\/(\d{2})\/\d{4}/);
  const inicio = html.indexOf('<div id="texto">');
  if (!nome || !data || inicio < 0) return null;

  let corpo = html.slice(inicio);
  const fim = corpo.search(/<!-- AddThis|class="redes-sociais"/);
  if (fim > 0) corpo = corpo.slice(0, fim);

  // Quebras de linha dentro do parágrafo viram parágrafos novos.
  const paragrafos = Array.from(corpo.matchAll(/<p[^>]*>([^]*?)<\/p>/gi))
    .flatMap((m) => textoPuro(m[1].replace(/<br\s*\/?>/gi, '¶')).split('¶'))
    .map((p) => p.trim())
    .filter((p) => p.length > 60);
  const resumo = resumir(paragrafos);
  if (!resumo) return null;

  const og = html.match(/<meta property="og:image" content="([^"]+)"/);
  return { nome: textoPuro(nome[1]), link, dia: Number(data[1]), mes: Number(data[2]), imagem: imagemSegura(og?.[1]), resumo };
}
