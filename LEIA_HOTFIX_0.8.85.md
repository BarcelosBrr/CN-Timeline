# Cartoon Timeline v0.8.85 — correção de catálogo e player

Esta versão substitui a 0.8.85 anterior. Mantenha a versão antiga intacta até confirmar a migração dos metadados.

## Problemas corrigidos

- **Catálogo zerado**: a verificação online de streams não desativa automaticamente episódios que já estão no catálogo. Falhas temporárias em um addon não apagam o banco local.
- **Sincronização interminável**: o carregamento de metadados não espera a verificação exaustiva de dezenas de séries e filmes. A URL do vídeo é procurada na hora da reprodução e pode ser pré-buscada para a atração seguinte.
- **TVmaze fora do ar**: Cinemeta é utilizado como alternativa quando existe um IMDb ID identificado. Episódios sem data válida de estreia não entram na programação. A data brasileira cadastrada continua sendo o limite mínimo de exibição.
- **Instalação vazia**: seis registros iniciais de episódios antigos conhecidos estão presentes em `data/stremio_episodios.json`. São apenas metadados para dar partida no sistema e NÃO comprovam que os addons tenham streams para esses seis episódios. O sistema continua sincronizando para ampliar a lista.
- **Buffering**: o player remoto aguarda antes de trocar de fonte e acompanha avanço real do vídeo. Não existe garantia de reprodução sem travar quando o servidor do addon falha ou o MP4 não tem codec suportado.
- **Guia**: mantém as divisões por faixa horária e a proporção de episódios novos/antigos. Halloween e Natal têm pesos temáticos graduais, com maior concentração nos dias mais próximos das comemorações.
- **Eras**: transição com fade suavizado de cerca de 1,18 segundo e respeito à configuração de movimento reduzido.

## Instalação recomendada

1. Extraia o ZIP numa pasta NOVA.
2. Pare o servidor da versão anterior.
3. Copie a pasta `media` anterior, mantendo toda a organização de anos.
4. Para preservar seu catálogo extenso já sincronizado, copie da pasta `data` anterior os arquivos `stremio_episodios.json`, `stremio_series_ids.json`, `duracoes_observadas.json`, `stremio_series_verificadas.json` e `stremio_filmes_verificados.json`, **somente se existirem**. Não substitua `stremio.json` sem necessidade: a instalação nova já contém FenixFlix, FrostStream, Brazuca e Magnetflix.
5. Execute `INICIAR_WINDOWS.bat` e abra `http://localhost:3000`.
6. Verifique `/api/sync/status`: `episodes` conta metadados indexados, não streams já reproduzidos. A sincronização completa exige acesso aos serviços de metadados.

## Diagnóstico rápido

- `/api/catalog`: deve retornar itens na propriedade `media` (a distribuição inclui uma pequena semente inicial).
- `/api/sync/status`: mostra o andamento e erros de metadados.
- `Sem fonte HTML5`: o episódio foi indexado, mas os provedores não entregaram URL compatível ou acessível. Isso não se corrige aumentando o número de metadados.
- MP4 remoto só funciona se servidor, codec, Range, CORS e permissões de incorporação forem compatíveis com o navegador. Links HTTP não funcionam dentro de página HTTPS (mixed content).

Esta atualização não inclui reprodução torrent, extração de DRM ou bypass de CAPTCHA. Use somente vídeos cuja reprodução e incorporação sejam permitidas.

## Testes

- `python -m unittest discover -s tests -p "test_*py" -q`
- `node tests/test_grade.js`
- `node tests/test_v0885.js`

Testes offline simulam indisponibilidade da TVmaze e recuperação de metadados pela Cinemeta, preservação de cache anterior e reconhecimento de respostas HTTP MP4 do addon. Os serviços reais precisam ser testados na instalação do usuário.
