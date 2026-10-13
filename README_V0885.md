# Cartoon Timeline v0.8.85 — Catálogo resiliente e grade contextual

## Correções da atualização

**Catálogo nunca mais será destruído por falha temporária.** Os registros anteriores da TVmaze ficam preservados caso a consulta falhe. O importador faz consultas simultâneas limitadas (até 3) e grava os lotes à medida que chegam. A verificação do Stremio permanece independente: um episódio indexado não significa necessariamente vídeo reproduzível.

**Grade não fica em branco enquanto sincroniza.** Sem episódios importados, há uma grade nostálgica por época e horário, com as atrações explicitamente marcadas como *acervo pendente*. Essas entradas não são apresentadas como vídeos disponíveis. Assim que o acervo tem vídeos verificados, a grade passa a utilizá-los. O canal não inventa nem busca URLs protegidas ou remove CAPTCHA/DRM.

**Player com tolerância a falhas.** Manifests intermitentes (como 403 no manifesto do FenixFlix) não impedem tentar o endpoint de stream explicitamente configurado. A fonte MP4 em HTTP continua aceita em um servidor local HTTP; continuam válidas as limitações de CORS, codecs, servidores e autoplay. Falhas 408/429 entram em intervalo temporário de recuperação. Resultados negativos são reavaliados rapidamente em vez de ficar presos por cinco minutos. Se o episódio selecionado não tem URL, o player pode tentar até três episódios alternativos da mesma série, todos elegíveis pela data virtual. Não garante que o stream de terceiros funcione se o servidor estiver realmente indisponível.

**Grade com períodos do dia:** madrugada de reprises e clássicos, manhã de humor e desenhos leves, começo da tarde com comédias, tarde de heróis/aventura, horário nobre com séries mais conhecidas e noite com séries mais longas. Horários e desenhos continuam sendo uma reconstituição plausível, não a gravação de um dia específico.

**Temas comemorativos:** preferências moderadas para episódios marcados como Halloween, Natal, férias, Páscoa e Ação de Graças. Datas originais e limite de lançamento continuam respeitados. Tags especiais podem ser completadas em `data/episodios_tematicos.json`.

**Transições de era:** agora usam um movimento mais suave, com fade e blur controlados de aproximadamente 820 ms. Respeita a preferência do sistema por movimento reduzido.

## Como atualizar sem perder episódios já sincronizados

1. Extraia esta v0.8.85 numa pasta **nova**.
2. Copie sua pasta `media` antiga para a nova instalação, preservando 2015–2021.
3. **Importante:** arraste a pasta raiz da instalação anterior sobre `MIGRAR_CACHE_ANTIGO.bat`. Isso importa os caches de metadados, disponibilidade e duração de `data/` sem substituir seus quatro addons nem sua nova configuração. Também pode usar `python MIGRAR_CACHE_ANTIGO.py "D:\\caminho\\versao-antiga"`.
4. Execute `INICIAR_WINDOWS.bat` e abra `http://localhost:3000`.
5. Confira o progresso na Biblioteca. A sincronização automática continua em segundo plano; durante o processo, a grade permanece visível.

## Diagnóstico honesto de disponibilidade

- `0 episódios indexados`: a TVmaze não retornou registros, a instalação é nova ou falta importar o cache antigo. A grade aparece com **acervo pendente**.
- `N episódios indexados`, mas `0 séries com URL candidata`: metadados existem, mas os addons ainda não confirmaram streams. Espere a verificação ou teste cada fonte no Windows.
- `Sem fonte HTML5 compatível`: o addon não devolveu uma URL MP4/HLS compatível, ou ela estava inacessível. Tenta as alternativas cadastradas, depois outro episódio da mesma série se houver.
- `HTTP 408/429`: atraso ou limite do provedor. A aplicação reduz consultas repetidas, mas não pode forçar terceiros a responder.

## Testes incluídos

- `node tests/test_v0885.js` — 35 grades sem catálogo + seleção temporal e Halloween;
- `node tests/test_grade.js` e `node tests/test_v088.js` — grades e Cine Cartoon;
- `python -m unittest discover -s tests -p "test_*.py"` — servidor, recuperação de cache e resiliência do addon;
- `python testes/testes_v08.py` — adaptadores e reconhecimento de mídias.

Limitação de validação: neste ambiente foi possível testar o servidor local via HTTP, o motor e simulações; **a reprodução dos URLs externos no Chrome Windows ainda depende de teste no computador com internet**.
