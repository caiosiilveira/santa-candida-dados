# Santo do dia - Paróquia Santa Cândida (Ipiranga, São Paulo)

Robô que gera, fora do site, os arquivos do santo do dia (calendário do Brasil):

- `santo-do-dia.mjs`: uma vez por dia lê o santo da Canção Nova e a publicação da Paulus Editora e publica `santo.json` na branch `dados`.
- `indice-santos.mjs`: uma vez por mês monta `indice-santos.json` (cada dia do ano, os santos e a página de cada um na Paulus).
- `lib/`: leitores das páginas. `fixtures/`: cópias usadas nos testes do site.

O site lê os arquivos da branch `dados` direto do GitHub. De cada fonte guarda só um trecho do texto, com crédito e link para a publicação completa.
