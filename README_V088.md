# Cartoon Timeline v0.8.8 — Cine Cartoon e Grade Inteligente

Projeto local de fã **não oficial**. Não inclui longas ou episódios licenciados; a reprodução depende de arquivos próprios autorizados ou de streams compatíveis cuja disponibilização e autorização precisam ser verificadas.

## Instalação

1. Extraia o ZIP em uma **nova pasta**.
2. Copie o conteúdo de `media/` da instalação v0.8.5 para `media/` desta versão, preservando subpastas e nomes.
3. Se personalizou `data/catalogo.json`, `data/episodios_tematicos.json` ou outros metadados, compare os arquivos antes de substituir; não copie cegamente um `stremio.json` antigo, pois perderá Magnetflix.
4. Execute `INICIAR_WINDOWS.bat` e acesse `http://localhost:3000` (ou o IP LAN do Windows, com firewall adequado).
5. **A sincronização do catálogo começa automaticamente** no servidor. A Biblioteca mostra as contagens de séries e filmes com respostas de stream. A primeira importação pode demorar por limites de resposta dos serviços; não é necessário apertar Sincronizar.

## O que mudou

- **Cine Cartoon de verdade:** uma sessão de filme inteiro, com chamada anterior quando houver arquivo correspondente, sem inserir episódios no lugar. Horários inspirados em registros do Brasil: terça, sexta e domingo às 20h, e sábado ao meio-dia (datas/grades específicas podem variar). O motor reserva o horário sem cortar o episódio anterior.
- **Validade de filme:** ano original de lançamento `Y` até `Y+3`, inclusive, *e* não antes da primeira exibição na lista histórica internacional usada como referência. Ex.: 2017 é elegível para 2017–2020, sujeita à data da primeira exibição registrada. O acervo é uma lista de **candidatos**: não prova transmissão brasileira.
- **Filmes presentes nos addons:** `data/filmes_cine_cartoon.json` contém 20 títulos candidatos e IMDb IDs. O servidor só adiciona um deles à grade depois de um addon retornar URL direta reconhecida para HTML5. O link pode falhar por codec, proteção de hotlink ou indisponibilidade posterior; confirmação de URL não equivale a teste integral no Chrome.
- **Séries com fontes candidatas:** séries Stremio entram na grade quando pelo menos um episódio tem resposta de URL direta no addon. Isso não garante que todo episódio daquela série estará disponível; há fallback de URLs e addons. Séries locais com vídeos reais continuam elegíveis mesmo sem Stremio.
- **Magnetflix:** incluído após FenixFlix → FrostStream → Brazuca Torrents, mantendo a ordem dos três originais, todos no arquivo `data/stremio.json`. Somente fontes HTTP/HTML5; não implementa download ou conversão de torrents, nem burla CAPTCHA ou DRM.
- **Duração real:** TVmaze/IMDb são estimativas até o MP4 carregar. Ao receber `loadedmetadata`, o player atualiza a duração e reencaixa os seguintes horários. O valor observado fica persistido em `data/duracoes_observadas.json`, melhorando grades futuras. O cronograma é recalculado com os tempos que se tornaram conhecidos; não existe como prever o runtime real de todo stream remoto indisponível na hora da geração.
- **Travamentos:** pré-busca do próximo episódio, cache de respostas, fallback por URL e outro addon, troca de fonte após buffering prolongado, sem interromper manualmente um vídeo que ainda toca. A rapidez real depende dos servidores.
- **Comemorações:** durante outubro/dezembro/abril, as correspondências por título e `data/episodios_tematicos.json` reforçam episódios temáticos, sem lotar toda a grade com especiais. Julho mantém ênfase em maratonas e Jovens Titãs em Ação na fase 2016–2018, apenas se houver episódios elegíveis.

## Datas de lançamento

- Episódios: data original da TVmaze + início brasileiro conhecido da série; uma data brasileira de **cada episódio** ainda exige metadados verificados adicionais.
- Filmes: ano original + até três anos, e data completa da primeira exibição no **arquivo americano** consultado. Não é um certificado de exibição no Brasil. Adicione outras datas nacionais verificadas caso queira uma reconstrução literal.
- Eventos temáticos: detecção por palavras-chave nos títulos (ex.: Halloween, ghost, Christmas, Santa) e complementação manual em `data/episodios_tematicos.json`.

## Catálogo e endpoints locais

- `/api/catalog`: mídia atual que pode participar da grade.
- `/api/sync/status`: progresso da sincronização automática e contagem de séries/filmes com stream candidato.
- `/api/stremio/status`: teste dos quatro manifestos.
- `POST /api/stremio/sync`: sincronização manual **opcional** que reinicia o trabalho em segundo plano.
- `POST /api/duration/observe`: registra duração real do vídeo (uso interno do player).

A sincronização respeita caches: metadados das séries até 24 horas; verificações de streams entre 4 e 12 horas conforme resultado; manifestos por 10 minutos, streams por 5 minutos. Os períodos são aproximados e podem ser ajustados no código.

## Acervo por ano

Preservado:

```
media/vinhetas/2015/vinheta_cn_01.mp4
media/chamadas/2018/vem_ai_quadro_cinecartoon.mp4
media/promos/2017/promo_ursos_sem_curso_01.mp4
media/especiais/2020/...
media/episodios/o_incrivel_mundo_de_gumball/01_03_as_criancas_2014.mp4
```

## Referências

- https://cartoonnetwork.fandom.com/wiki/List_of_films_aired_on_Cartoon_Network (transmissões históricas internacionais; datas brasileiras podem diferir)
- https://telaviva.com.br/08/03/2019/cartoon-network-amplia-formato-de-projeto-em-parceria-com-o-cinemark/ (informação sobre faixas Cine Cartoon no Brasil)
- https://pt.wikipedia.org/wiki/Lista_de_programas_exibidos_pelo_Cartoon_Network_(Brasil)
- https://github.com/Stremio/stremio-addon-sdk (protocolo de addons; não garante disponibilidade nem direito de acesso)

## Testes automáticos

```powershell
node tests/test_grade.js
node tests/test_v088.js
python tests/test_backend.py
```

Os testes de lógica não substituem um teste de reprodução real das fontes no seu navegador e rede.

**Regra da duração:** quando a fonte do addon não fornece duração real antes de tocar, o primeiro agendamento usa uma estimativa. Após o evento `loadedmetadata`, a grade em execução é reajustada e a duração observada é gravada para os próximos dias. Não há como garantir todos os tempos com antecedência para streams cuja mídia ainda não foi carregada.
