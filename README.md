# Cartoon Timeline - Atualização v1.04

Atualização incremental da v1.04. **Não apaga as séries configuradas, o arquivo de episódios, os vídeos locais nem os addons.**

## Novidades v1.04

1. A grade aceita episódios elegíveis do catálogo mesmo após uma falha temporária de addon; séries da lista histórica são cruzadas com o índice real e títulos válidos fora da lista seed têm fallback de seleção.
2. O modo Filtrado ignora desenhos sem episódios elegíveis para o ano atual e volta à grade normal quando nenhuma escolha pode tocar, evitando uma tela de verificação sem fim.
3. O popup Sua programação e suas cores acompanham a era selecionada; desenhos fora do ano ficam desativados na lista.
4. Episódios exatos confirmados anteriormente continuam priorizados, mesmo depois de expirar o cache temporário.
5. A proporção de episódios recentes e clássicos segue 70/30 e os intervalos tentam bumper, anúncio, promo, bumper e promo.

## Histórico v1.03

1. Cada intervalo entre episódios tenta incluir vinheta, anúncio e promo usando arquivos reais do acervo; nenhum comercial fictício é criado.
2. O player prepara o próximo vídeo local durante a atração atual e aguarda os primeiros dados de vídeo antes de retirar a tela de carregamento.
3. Quando um episódio Stremio falha, o canal tenta até cinco episódios alternativos ainda não verificados, priorizando a mesma série e respeitando os desenhos selecionados no modo filtrado.
4. O modo **Filtrado** permite selecionar desenhos presentes no acervo e mantém quadros, vinhetas, anúncios, promos e chamadas.
5. Descobrir vinhetas pesquisa mais resultados e termos equivalentes em português e inglês, com até 15 referências e revisão humana de data e direitos.

Seekee não foi integrado: não foi encontrada uma API oficial/documentada para consultar streams. O projeto só deve usar fontes públicas autorizadas e URLs HTML5 explícitas.

## Alterações

1. `GET /api/catalog/series` retorna em `series` e `seriesExibicao` **somente as séries com pelo menos um episódio cadastrado**. As séries com zero ficam em `seriesAguardando`; todas permanecem salvas em `data/stremio_series.json`.
2. `GET /api/catalog/series/configuradas` permite visualizar todos os cadastros, inclusive os que ainda estão aguardando importação.
3. `GET /api/catalog/episodes` adiciona `streamAvailability` para cada episódio, com valores `played`, `candidate`, `unknown` e `unavailable`.
4. Tentativas efetivas de stream são registradas **por IMDb, temporada e episódio**, não por série inteira. Nenhuma URL ou token é salvo nesse registro.
5. Um episódio recentemente identificado como sem fonte deixa de ser escolhido para a **próxima geração** da grade, sem impedir outros episódios da série. A marca negativa expira em 20 minutos, para que falhas temporárias não excluam conteúdo permanentemente.
6. Episódios reproduzidos têm maior prioridade no sorteio do que URLs candidatas, que têm prioridade sobre episódios sem verificação. Rejeitar um arquivo errado apaga sua confirmação anterior.
7. A biblioteca distingue episódio `REPRODUZIDO`, `FONTE CANDIDATA` e `A VERIFICAR`.

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
