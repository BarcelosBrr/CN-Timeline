# Grade histórica: fontes e grau de confiança

Este projeto usa fontes do Cartoon Network **Brasil** quando disponíveis. O ano selecionado na Timeline muda repertório, identidade visual e datas de estreias. **Não confunda grade inspirada em época com grade oficial de uma data específica**.

## Fontes com informações concretas

- [Grade 23–28 outubro de 2017 — acervo de fã](https://schedulecartoonnetworkandmore.blogspot.com/2017/10/grade-da-programacao-23102017-28102017.html): referência para âncoras como Ben 10, Irmão do Jorel, Magiespadas, Gumball, Jovens Titãs em Ação, Hora de Aventura e Dragon Ball Super, sobretudo manhã/tarde/noite. Por ser arquivo de fã, sujeito a divergências.
- [Programação outubro 2017 — semanas](https://schedulecartoonnetworkandmore.blogspot.com/2017/10/): detalhes de fins de semana e Cine Cartoon.
- [Lista de programas exibidos no Brasil](https://pt.wikipedia.org/wiki/Lista_de_programas_exibidos_pelo_Cartoon_Network_%28Brasil%29): primeira triagem de datas e catálogos, inclusive blocos; validar datas específicas.
- [Ursos sem Curso — temporadas e datas brasileiras](https://pt.wikipedia.org/wiki/Lista_de_epis%C3%B3dios_de_We_Bare_Bears): a 1ª temporada começou no Brasil em agosto de 2015.
- [Ben 10 (2016)](https://pt.wikipedia.org/wiki/Ben_10_%282016%29): estreia nas Américas em 10/04/2017.
- [OK K.O. — lista de episódios](https://pt.wikipedia.org/wiki/Lista_de_epis%C3%B3dios_de_OK_K.O.%21_Lets_Be_Heroes): estreia brasileira 18/09/2017.
- [Dragon Ball Super — estreia brasileira em 05/08/2017](https://www.uol.com.br/start/ultimas-noticias/2017/08/06/dragon-ball-super-estreia-dublado-no-brasil-e-fas-vao-a-loucura.html); [horários posteriores](https://anmtv.com.br/dragon-ball-super-estreia-em-agosto-no-cartoon-network/).
- [Votatoon — histórico](https://cartoonnetwork.fandom.com/pt-br/wiki/Votatoon): rotina brasileira terminou em março de 2016 e houve episódio especial em outubro de 2020; não inserir semanalmente na grade de 2017–2021.
- [Toontubers — estreia na TV](https://anmtv.com.br/toontubers-estreia-no-cartoon-network/): cinco episódios diários de 27/02/2017 a 03/03/2017 às 19h45; os vídeos já circulavam na internet antes disso.
- [Outra Semana no Cartoon](https://pt.wikipedia.org/wiki/Outra_Semana_no_Cartoon): curtas iniciados em maio de 2015.
- [CN Brasil — identidade CHECK it 4.0](https://natelinha.uol.com.br/amp/noticias/2016/01/10/cartoon-network-atualiza-conceito-visual-no-brasil-e-muda-formato-de-mad-95517.php): janeiro de 2016.
- [Identidade Dimensional](https://cartoonnetwork.fandom.com/pt-br/wiki/Dimensional): Brasil janeiro de 2017. Sticker em 2021 pertenceu à continuidade americana e não é tratado como identidade principal brasileira.

## Blocos no simulador

| Bloco | Janelas incluídas | Tratamento |
|---|---|---|
| HAHAHA | 2015–2021 | Comédias; faixa simulada, horário histórico sujeito a confirmação |
| Heróis | 2015–2021 | Ação e super-heróis; inspirado em bloco real |
| Cine Cartoon | 2015–2021 | Sessões às sextas/finais de semana; posição ilustrativa conforme ano |
| Votatoon | 2015–mar/2016 + edição única em out/2020 | Sem a votação interativa real, apenas simulação de maratona |
| Brazuca / Brasuca | 2015–2016 | Programas brasileiros, horário ilustrativo |
| Maratonas | Fins de semana 2015–2021 | Repete desenhos em blocos prolongados |
| Madrugada Cartoon | 2015–2021 | Faixa temática **inventada como rótulo de UI**, não bloco oficial confirmado |
| Outra Semana no Cartoon | 2015–2021 | `short`, depende de arquivo real |
| Toontubers | A partir de fev/2017 | `short`, respeita estreia de TV |
| Cartoon Z@um, Clube Boomerang | Períodos compatíveis | Representação temática simplificada |
| Girl Power, Copa Toon | Períodos selecionados | Blocos ilustrativos, datas específicas serão refinadas |
| Cartoon Off-Air, Toonami | Final da década e início de 2020 | Programação de madrugada ilustrativa |
| Halloween / Natal / Páscoa | Mês temático conforme calendário | Decoração e prioridade para acervo sazonal |

Para obter uma grade *exatamente* histórica em cada dia, precisaremos de registros com horários detalhados de cada mês/ano. Não foram encontrados documentos completos para cada data de 2015–2021; o motor usa âncoras confirmadas e preenche intervalos com uma seleção historicamente plausível.


## Correção do motor e fontes externas — v0.5

As faixas de 30 minutos são **referência de escolha dos desenhos**, não limite de duração. O motor roda arquivos inteiros e ajusta os inícios dos próximos programas. O usuário pode melhorar a precisão histórica cadastrando `firstAiredBR` por episódio e `validFrom/validUntil` para chamadas temporárias. Um ano no nome do episódio isoladamente oferece somente precisão anual.

A [API Pomfy](https://api.pomfy.stream/) publica documentação de incorporação por iframe usando identificadores TMDB e episódios. Esse mecanismo é diferente de um arquivo MP4 direto e **não oferece no material consultado garantias de seek preciso, duração real e autorização de retransmissão**. Por isso, não foi integrado ao player contínuo.
