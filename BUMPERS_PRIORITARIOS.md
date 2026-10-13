# Acervo recomendado — bumpers, comerciais e chamadas (CN Brasil 2015–2021)

**Lista de coleta, não uma licença de redistribuição.** Links servem para identificação e pesquisa; os vídeos dessas páginas não são importados automaticamente nem estão incluídos no programa. Use apenas mídias que possa reproduzir.

## Referências brasileiras verificadas

| Prioridade | Uso na programação | Época / tipo | Fonte |
|---|---|---|---|
| 1 | Intervalo completo, saída de desenho → HAHAHA → anúncios → chamada → retorno | CHECK it! 3.0 / HAHAHA, 09/05/2015 | [Intervalo de 09/05/2015](https://www.youtube.com/watch?v=XTBJrdMWlzM) |
| 1 | Inserir como «Vem aí» de Gumball | CHECK it! 3.0 | [VEM AÍ — O Incrível Mundo de Gumball](https://www.youtube.com/watch?v=-lRWunOwej0) |
| 1 | Referência específica enviada pelo usuário — associar a Gumball após classificar a categoria exata | Gumball, ano a verificar | [Referência especial de Gumball](https://www.youtube.com/watch?v=kFvEMnNvKAg) |
| 1 | Bumpers de apresentação e retorno dos filmes | Cine Cartoon 2015–2020 | [Compilação CNBRArchive](https://www.youtube.com/watch?v=p1QCO_z_BOM) |
| 1 | Decoração e vinhetas de Natal | Dezembro/2017 | [Bumpers de Natal 2017](https://www.youtube.com/watch?v=2uNBwbNPF1Q) |
| 2 | Vinhetas e chamadas com a identidade Dimensional | Outubro/2017 | [Bumpers do site CN 2017](https://www.youtube.com/watch?v=cf7DrNuNejU) |
| 2 | Referência ao especial «Vem aí» de cinema | CHECK it! 3.0 / Cine Cartoon | [VEM AÍ — Cine Cartoon](https://www.youtube.com/watch?v=EIIg2VvS5-U) |
| 2 | Bloco especial alternativo | Mês do Riso, março/2016 | [Bumpers Mês do Riso 2016](https://www.youtube.com/watch?v=zNdW3VBMSWs) |
| 2 | Ajustes para a versão 2019 | Cine Cartoon, julho/2019 | [Bumpers Cine Cartoon JUL/2019](https://www.youtube.com/watch?v=rovlAcjsExo) |

Canais de pesquisa: [CNBRArchive](https://www.youtube.com/@CNBRArchive) e [CN Vinhetas](https://www.youtube.com/@cnvinhetas5956).

## Arquivos ainda necessários

A grade fica muito mais fiel quando temos cada um dos **formatos** abaixo. A lista é um guia de coleta, não afirmação de que todos os formatos existiram em todas as eras:

1. **Identificação do canal** — logotipo, idents curtos e transições de CHECK it! 3.0 (2015), CHECK it! 4.0 (2016) e Dimensional (2017–2021).
2. **VEM AÍ / A SEGUIR** — preferencialmente por desenho: Gumball, Hora de Aventura, Apenas um Show, Steven Universo, Irmão do Jorel, Clarêncio e Jovens Titãs em Ação; repetir por identidade gráfica quando existirem versões históricas diferentes.
3. **Vinheta de início e de fim de intervalo** — importante para não parecer troca simples de arquivos MP4.
4. **Chamadas de estreias e maratonas** — ano específico, incluindo mudanças de horários e o slogan «Novo Novo Novo Novo».
5. **HAHAHA** — abertura, separadores, retorno, oferecimento e chamada do bloco (sobretudo 2015).
6. **Cine Cartoon** — abertura do filme, anúncio de horário, separador comercial e encerramento; versões 2015–2020.
7. **Comerciais brasileiros** — brinquedos, material escolar, produtos infantis e anúncios de 2015–2021 com ano conhecido; atenção a anúncios específicos de uma campanha.
8. **Natal** — abertura de dezembro, chamadas natalinas, vinheta comercial, publicidade sazonal e episódios especiais. O vídeo de 2017 acima é referência concreta.
9. **Halloween** — intersticiais, chamadas de outubro, maratonas de terror leve e episódios temáticos. Falta encontrar conjuntos brasileiros datados e verificáveis.
10. **Páscoa** — identidade sazonal e episódios/propagandas da ocasião. Ainda não foi validado um acervo brasileiro amplo; o tema no site é recreativo.

## Convenção de nomes sugerida

```text
media/
  vinhetas/
    2015/identificacao_3_0_01.mp4
    2016/vem_ai_gumball_4_0.mp4
    2017/intervalo_dimensional_01.mp4
    halloween/abertura_halloween_2017.mp4
    natal/bumper_natal_2017.mp4
    pascoa/identificacao_pascoa_2019.mp4
  chamadas/
    2015/vem_ai_gumball.mp4
    2017/cine_cartoon.mp4
  anuncios/
    2015/comercial_brinquedos_01.mp4
  episodios/
    Gumball/gumball_ep01.mp4
  filmes/
    filme_autorizado.mp4
```

Para selecionar uma vinheta exclusiva de Gumball, adicione no `data/catalogo.json` o campo `show`: `"O Incrível Mundo de Gumball"`. Assim, quando ela estiver disponível, o motor dará preferência a ela antes de um episódio de Gumball.

**Datas:** CHECK it 4.0 estreou no Brasil em janeiro de 2016; Dimensional em janeiro de 2017. «Sticker» não foi adotada oficialmente pelo canal brasileiro em 2021, portanto não é aplicada automaticamente.

## Novas categorias de coleta (v0.4)

Os anexos recebidos (*Apenas um Show — No Espaço* e *Ursos sem Curso / CN GO*) são **promos internas de séries** (`promo`), não comerciais de terceiros (`ad`). Os dois arquivos estão em `media/promos/` com classificação pendente de ano.

Para completar os quadros pedidos, priorize: abertura + fechamento + "vem aí" do **Heróis**, **HAHAHA**, **Cine Cartoon**, **Votatoon** (exclusivamente 2015/até março de 2016 e retorno isolado 2020), **Brazuca**, **Maratonas de fim de semana**, **Cartoon Z@um**, **Clube Boomerang**, **Girl Power**, **Outra Semana no Cartoon**, **Toontubers**, **Copa Toon**, **Toonami** e especiais de **Halloween**, **Natal** e **Páscoa**. Nem todo bloco teve material específico em todos os anos; categorizar antes de inserir impede anacronismos.

Para promo de desenho, registre `show`, `promoType`, `validFrom`, `validUntil`, `years`, `event`, `duration` e a origem do arquivo. Para bumper genérico, registre `kind: "bumper"` e período de uso. Para comercial de brinquedo, use `kind: "ad"`.


## v0.5 — Estrutura de arquivo para catalogação automática

```text
media/vinhetas/2015/vinheta_cn_01.mp4
media/chamadas/2015/vem_ai_o_incrivel_mundo_de_gumball_01.mp4
media/chamadas/2015/vem_ai_quadro_herois.mp4
media/chamadas/2016/vem_ai_quadro_hahaha_01.mp4
media/chamadas/2018/vem_ai_quadro_cinecartoon.mp4
media/promos/2017/promo_ursos_sem_curso_01.mp4
```

Os arquivos em uma pasta de ano só tocam nesse ano. `chamadas` e `promos` alimentam o mesmo tipo de mídia (`promo`), com `promoType` diferente; `vinhetas` são bumpers. Ver o `README.md` para distinções e exemplos.
