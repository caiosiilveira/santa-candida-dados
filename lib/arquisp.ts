// Folheto Povo de Deus, da Arquidiocese de São Paulo (https://arquisp.org.br/folheto-povo-de-deus/):
// uma tabela por mês, com a data, a celebração e os PDFs do folheto e das partituras. Os
// endereços dos PDFs não seguem um padrão (mudam com o mês do envio), então o robô diário lê
// a tabela e guarda a lista; o site só aponta para os PDFs, que ficam na Arquidiocese.
// A página não libera CORS, por isso a leitura é do robô e não do navegador.

import { decodificar, textoPuro } from './cancaonova.ts';

export const URL_FOLHETO_ARQUISP = 'https://arquisp.org.br/folheto-povo-de-deus/';

export interface Folheto {
  /** AAAA-MM-DD */
  dataISO: string;
  nome: string;
  folheto: string | null;
  partituras: string | null;
}

/** Só aceita PDFs enviados ao próprio site da Arquidiocese, em https. */
export function pdfSeguro(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(decodificar(url).trim().replace(/^http:/, 'https:'));
    if (u.protocol !== 'https:' || u.hostname !== 'arquisp.org.br') return null;
    if (!u.pathname.startsWith('/wp-content/uploads/') || !/\.pdf$/i.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Todas as linhas da tabela com data e ao menos um PDF, em ordem de data, sem repetir. */
export function extrairFolhetos(html: string): Folheto[] {
  const porData = new Map<string, Folheto>();
  for (const linha of html.split(/<tr[\s>]/i).slice(1)) {
    const celulas = [...linha.split(/<\/tr>/i)[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (celulas.length < 3) continue;
    const data = textoPuro(celulas[0]).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const nome = textoPuro(celulas[1]).replace(/\s+/g, ' ').trim();
    if (!data || !nome) continue;
    const [, d, m, a] = data;
    const dataISO = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const link = (html: string | undefined) => pdfSeguro(html?.match(/href="([^"]+)"/i)?.[1]);
    const item = { dataISO, nome, folheto: link(celulas[2]), partituras: link(celulas[3]) };
    if (!item.folheto && !item.partituras) continue;
    porData.set(`${dataISO} ${nome}`, item);
  }
  return [...porData.values()].sort((x, y) => x.dataISO.localeCompare(y.dataISO));
}
