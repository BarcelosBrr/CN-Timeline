# Guia Stremio — atualização 0.8.8

A v0.8.8 inclui Magnetflix, sincronização automática e cache de disponibilidade. Veja README_V088.md.

# Atualização da integração Stremio — 0.8.5v

Esta versão preserva a reprodução HTML5 da 0.8.1v que funcionou nos seus testes. Adiciona catálogo ampliado de 38 séries candidatas por busca segura na TVmaze, pré-busca do próximo episódio até 80 s antes da transição, cache de manifestos por 10 min e limite de 8,5 s por URL ao carregar metadados. **Nenhum dos addons garante que todas as séries estejam disponíveis ou autorizadas para reprodução.**

`data/stremio_series.json` contém as séries e títulos usados na busca (configuração ampliável). Depois de clicar em **Sincronizar 38 séries**, confira o total de episódios e as séries sem correspondência segura; para as não identificadas, cadastre manualmente `tvmazeId` e `imdbId` confirmados.

---

# Stremio no Cartoon Timeline 0.8.1v

## Fontes configuradas

1. FenixFlix: `https://fenixflix.fenixhub.online/manifest.json`
2. FrostStream: `https://froststream.cloutteam.com/manifest.json`
3. Brazuca Torrents: `https://94c8cb9f702d-brazuca-torrents.baby-beamup.club/manifest.json`

O adaptador usa `/{resource}/{type}/{videoID}.json`, especificamente `/stream/series/ttID:temporada:episodio.json`, conforme o protocolo Stremio. Rejeita tipos e IDs que o manifesto não suporta. Aceita URLs `.mp4`, `.webm` ou `.m3u8` HTTP e HTTPS de hosts publicos, quando o addon nao marcar `notWebReady`. O site local HTTP aceita HTTP, mas paginas HTTPS nao podem carregar HTTP por mixed content. Tenta as URLs de cada addon em ordem antes do proximo.

- **FenixFlix**: na verificação de 12/10/2026 houve resposta 403 para o manifesto; pode estar temporariamente indisponível. O teste no seu Windows pode ter resultado diferente.
- **FrostStream**: manifesto válido com recursos `meta` e `stream`. Existência de manifesto não garante episódios reproduzíveis em HTML5.
- **Brazuca Torrents**: manifesto válido com `stream`, mas declara conteúdo P2P. `infoHash`/`fileIdx` não são URLs HTML5: sem um motor de torrent apropriado, não tocam no Chrome.

## Como testar

Clique em **Verificar addons Stremio**, **Sincronizar catálogo Stremio** e **Assistir agora**. O log/aviso da Biblioteca mostra o motivo se nenhuma das fontes retornar uma URL HTML5. Após falha de reprodução HTTP, tenta o addon seguinte. URLs protegidas, HTML de verificação, CAPTCHA, servidores que exigem cookies, DRM ou páginas com seleção manual não serão contornados.

Os metadados iniciais incluem Gumball, Apenas um Show e Ursos sem Curso. Para outras séries, adicione `show`, `tvmazeId`, `imdbId`, `earliestBR` e `episodeMinutes` em `data/stremio_series.json` e sincronize novamente.

## Reprodução contínua / limites

O navegador só garante autoplay após a interação do usuário e conforme a política de áudio do browser. É possível buscar posição em MP4 por Range; em HLS pode ser preciso `hls.js` (carregado da CDN pública se houver internet). O serviço do addon pode rejeitar o acesso por CORS, token ou formato. Vídeos cujo tempo real diferir do runtime do catálogo podem desalinhar a programação, pois não se consegue comprovar o tempo antes de receber o stream. O Pomfy fica desativado.

### Segurança

Não exponha a porta 3000 na internet enquanto não acrescentar autenticação e HTTPS; o servidor foi pensado para LAN. Não use streams sem direitos ou permissão. A versão não baixa torrents nem extrai players protegidos.

## Correcao 0.8.1: HTTP MP4 + fallback por URL

O diagnostico de Gumball T01E01 mostrou cinco URLs `http://...mp4` no FenixFlix.
Na v0.8 o servidor rejeitava HTTP antes da reproducao; nesta versao aceita HTTP no site HTTP local.
Agora cada link direto do FenixFlix e testado em ordem; se falhar por erro do navegador ou
nao entregar metadados em 20 segundos, o player tenta o proximo, e so entao muda de addon.

Nao ha proxy, bypass de CAPTCHA/DRM ou suporte a torrents no Chrome. URLs retornadas
nao foram verificadas como MP4s reais por este pacote. Se um servidor exigir cookies,
permissoes especiais, CORS ou cabeçalhos personalizados, a reproducao pode continuar falhando.

O contador de episodios e metadados da TVmaze, nao confirmacao de arquivos disponiveis.
Os controles de volume do Stremio usam um elemento separado do video local: o compressor
Som Estavel continua disponivel apenas para midias locais.

Para depurar: abra as Ferramentas do Desenvolvedor do Chrome (F12), guia Rede,
filtre por `mp4`. Verifique se o arquivo responde 200/206 com `Content-Type: video/mp4`
e se o codec e compativel. Nunca compartilhe URLs completas contendo tokens.
