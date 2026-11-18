// Santo do dia da Canção Nova (https://santo.cancaonova.com/), calendário do Brasil:
// a página inicial deles já traz o santo de hoje. Quem lê é o robô diário
// (scripts/santo-do-dia.mjs, rodando no GitHub, fora da Cloudflare); o navegador do
// visitante só lê o arquivo pronto. Aqui entra um trecho do texto, com crédito e
// link para a história completa na Canção Nova.

export const URL_SANTO_CANCAONOVA = 'https://santo.cancaonova.com/';

export interface SantoCancaoNova {
  nome: string;
  imagem: string | null;
  resumo: string;
  /** Outros santos e beatos do dia (frases curtas do Martirológio, em texto simples). */
  outros: string[];
  link: string;
  /** Dia e mês (1 a 12) que a página da Canção Nova diz estar mostrando. */
  dia: number;
  mes: number;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const NOMEADAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

export function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, c: string) => {
    if (c[0] === '#') {
      const n = c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return NOMEADAS[c.toLowerCase()] ?? inteiro;
  });
}

/** Tira as tags e deixa só o texto, com espaços normais. */
export function textoPuro(html: string): string {
  return decodificar(
    html
      .replace(/<(script|style)[^>]*>[^]*?<\/\1\s*>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Corta em fim de frase perto de `max` caracteres (ou, na falta, em fim de palavra, com reticências). */
export function aparar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const frase = Math.max(...Array.from(corte.matchAll(/[.!?](?=\s)/g), (m) => m.index ?? -1), -1);
  if (frase > max * 0.55) return corte.slice(0, frase + 1);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,;:–-]+$/, '')}…`;
}

/** Quanto do texto de cada fonte vai para o site; o resto fica no link da fonte (direitos autorais). */
export const PARAGRAFOS_RESUMO = 3;
export const LIMITE_RESUMO = 900;

/** Os primeiros parágrafos, aparados, separados por linha em branco. */
export function resumir(paragrafos: string[]): string {
  return aparar(paragrafos.slice(0, PARAGRAFOS_RESUMO).join('\n\n'), LIMITE_RESUMO);
}

function valorOculto(html: string, id: string): string {
  const m = html.match(new RegExp(`<input[^>]*\\bid=["']${id}["'][^>]*\\bvalue=["']([^"']*)["']`, 'i'));
  return m ? m[1].trim() : '';
}

function imagemSegura(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(decodificar(url));
    if (u.protocol !== 'https:' || !/(^|\.)cancaonova\.com$/.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Lê a página inicial do santo.cancaonova.com e devolve o santo do dia, ou null se a estrutura mudou. */
export function extrairSanto(html: string): SantoCancaoNova | null {
  const titulo = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([^]*?)<\/h1>/i);
  const nome = titulo ? textoPuro(titulo[1]) : '';
  const dia = parseInt(valorOculto(html, 'dia-santo'), 10);
  const mes = MESES.indexOf(valorOculto(html, 'mes-santo').slice(0, 3).toLowerCase()) + 1;
  const inicio = html.search(/<div[^>]*class=["'][^"']*content-santo[^"']*["'][^>]*>/i);
  if (!nome || !dia || !mes || inicio < 0) return null;

  // O corpo começa depois da lista de compartilhar; vai até "Outros santos…" ou o fim do artigo.
  let corpo = html.slice(inicio);
  corpo = corpo.slice(corpo.indexOf('</ul>') + 5);
  const fim = corpo.search(/<h3[^>]*>\s*(?:<b>)?\s*Outros santos|<\/article>/i);
  if (fim > 0) corpo = corpo.slice(0, fim);

  const paragrafos = Array.from(corpo.matchAll(/<p[^>]*>([^]*?)<\/p>/gi))
    // Intertítulo em negrito que abre o parágrafo ("Importância dos Apóstolos" + quebra de linha) sai.
    .map((m) => textoPuro(m[1].replace(/^\s*<b>[^<]{1,70}<\/b>(?=(?:\s|<[^>]*>){0,3}<br)/i, '')))
    // Sobram só parágrafos de verdade (rótulos curtos como "Origens" ficam de fora).
    .filter((p) => p.length > 80);
  const resumo = resumir(paragrafos);
  if (!resumo) return null;

  // "Outros santos e beatos celebrados em…": a lista que vem logo depois desse título.
  const depois = html.slice(inicio).match(/<h3[^>]*>\s*(?:<b>)?\s*Outros santos[^]*?<\/h3>\s*<ul>([^]*?)<\/ul>/i);
  const outros = depois
    ? Array.from(depois[1].matchAll(/<li[^>]*>([^]*?)<\/li>/gi))
        .map((m) => aparar(textoPuro(m[1]), 200))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const og = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const primeiraImg = corpo.match(/<img[^>]*\bsrc=["']([^"']+)["']/i);
  return { nome, imagem: imagemSegura(og?.[1]) ?? imagemSegura(primeiraImg?.[1]), resumo, outros, link: URL_SANTO_CANCAONOVA, dia, mes };
}
