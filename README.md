# Cartoon Timeline v1.02.1 — Catálogo de exibição e disponibilidade por episódio

Atualização incremental da v1.02. **Não apaga as 50 séries configuradas, o arquivo de episódios, os vídeos locais nem os addons.**

## Por que a grade diz "Fonte indisponível"?

A importação da TVmaze/Cinemeta cria o **índice histórico de metadados**, mas não fornece o vídeo. Um show com 76 episódios indexados pode ter zero episódios reproduzíveis no momento. O addon pode devolver apenas torrent, URL inválida, stream bloqueado, fonte temporariamente fora do ar ou um episódio diferente.

## Alterações

1. `GET /api/catalog/series` retorna em `series` e `seriesExibicao` **somente as séries com pelo menos um episódio cadastrado**. As séries com zero ficam em `seriesAguardando`; todas permanecem salvas em `data/stremio_series.json`.
2. `GET /api/catalog/series/configuradas` permite visualizar todos os cadastros, inclusive os que ainda estão aguardando importação.
3. `GET /api/catalog/episodes` adiciona `streamAvailability` para cada episódio, com valores `played`, `candidate`, `unknown` e `unavailable`.
4. Tentativas efetivas de stream são registradas **por IMDb, temporada e episódio**, não por série inteira. Nenhuma URL ou token é salvo nesse registro.
5. Um episódio recentemente identificado como sem fonte deixa de ser escolhido para a **próxima geração** da grade, sem impedir outros episódios da série. A marca negativa expira em 20 minutos, para que falhas temporárias não excluam conteúdo permanentemente.
6. Episódios reproduzidos têm maior prioridade no sorteio do que URLs candidatas, que têm prioridade sobre episódios sem verificação. Rejeitar um arquivo errado apaga sua confirmação anterior.
7. A biblioteca distingue episódio `REPRODUZIDO`, `FONTE CANDIDATA` e `A VERIFICAR`.

**Importante:** URLs candidatas não são garantia de reprodução no navegador. Para não repetir o erro histórico da grade vazia, episódios ainda não testados **continuam como candidatos**, até haver evidência positiva ou negativa. Esta atualização não elimina falhas dos provedores externos.

## Instalação

1. Encerre o servidor antigo.
2. Extraia o ZIP e arraste a pasta da instalação existente para `ATUALIZAR_WINDOWS.bat`.
3. Rode `INICIAR_WINDOWS.bat` dentro da instalação atualizada.
4. No navegador, atualize com `Ctrl+Shift+R` e use **Gerar nova programação** para aplicar imediatamente as exclusões detectadas. A grade em andamento não é alterada automaticamente para não cortar o vídeo atual.

O instalador faz backup dos arquivos substituídos e **preserva `media/`, `data/stremio_episodios.json`, `data/stremio_series.json` (mesclando novos cadastros), `data/stremio.json`, caches e alterações pessoais**.

## Diagnósticos úteis

- `/api/catalog/series` — séries efetivamente indexadas e cadastros sem episódio.
- `/api/catalog/series/configuradas` — todos os títulos cadastrados.
- `/api/catalog/episodes` — quantidade de episódios conhecidos, com fonte candidata e temporariamente sem fonte.
- `/api/sync/status` — situação das importações.

## Testes realizados

Testes Python e JavaScript locais, incluindo grade de 24 horas, recuperação de 5.000 episódios catalogados, API HTTP, episódios sem fonte, preservação de dados pelo atualizador e período de expiração das marcações. Não houve teste de reprodução ponta a ponta com os addons Stremio reais no Windows/Android.
