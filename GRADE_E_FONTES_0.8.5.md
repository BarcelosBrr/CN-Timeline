# Repertório histórico e fontes — v0.8.5

> A grade usa desenhos que fizeram parte do repertório do Cartoon Network brasileiro de 2015 a 2021 e programas antigos que apareciam em reprises. É uma programação **plausível**, sorteada, não uma cópia de grade oficial diária.

## Fontes consultadas

- [Repertório de programas exibidos no CN Brasil](https://pt.wikipedia.org/wiki/Lista_de_programas_exibidos_pelo_Cartoon_Network_%28Brasil%29) — visão geral de períodos brasileiros.
- [Janeiro de 2015: novidades e faixa de estreias](https://cartoonnetworkblogbrasil.blogspot.com/2015/01/novidades-de-janeiro-no-cartoon-network.html) — maratonas e faixas de Gumball, Clarêncio, Jorel, Apenas um Show, Steven, Hora de Aventura e Titio Avô.
- [Julho de 2015: estreias e reprises](https://cartoonnetworkbrasil2015.blogspot.com/2015/07/) — Ursos sem Curso, Grojband, Sonic Boom, Johnny Test e afins.
- [Grade registrada de 9 a 15 de outubro de 2017](https://schedulecartoonnetworkandmore.blogspot.com/) — horários de manhã, tarde e noite, incluindo Pokémon, Poderosas Magiespadas, Jorel, Dragon Ball Super, Gumball e Jovens Titãs em Ação.
- [Grade registrada de 23 a 28 de outubro de 2017](https://schedulecartoonnetworkandmore.blogspot.com/2017/10/grade-da-programacao-23102017-28102017.html) — complemento histórico mantido por fãs.
- [Destaques de outubro de 2017](https://anmtv.com.br/outubro-no-cartoon-network-mes-do-ben-10-e-as-meninas-superpoderosas/) — Ben 10, Meninas Superpoderosas, Oswaldo e especiais de Halloween.
- [Destaques de dezembro de 2019](https://www.ouniversodatv.com/2019/11/cartoon-network-destaques-da.html) — Craig/O Mundo de Greg, DC Super Hero Girls, Acampamento de Verão, Victor e Valentino, Trem Infinito e Mao Mao em especiais de fim de ano.
- [Cartoon Network Wiki: 2015](https://cartoonnetwork.fandom.com/wiki/2015), [2016](https://cartoonnetwork.fandom.com/wiki/2016), [2017](https://cartoonnetwork.fandom.com/wiki/2017), [2018](https://cartoonnetwork.fandom.com/wiki/2018), [2019](https://cartoonnetwork.fandom.com/wiki/2019), [2020](https://cartoonnetwork.fandom.com/wiki/2020) e [2021](https://cartoonnetwork.fandom.com/wiki/2021) — **cronologias predominantemente americanas**, não correspondem sempre às estreias brasileiras.

## Repertório principal por época

**2015:** Gumball, Apenas um Show, Hora de Aventura, Steven Universo, Irmão do Jorel, Clarêncio, Titio Avô, Jovens Titãs em Ação, Ben 10: Omniverse, Pokémon, Scooby-Doo, Turma da Mônica, O Show de Tom e Jerry, Ursos sem Curso (depois de sua estreia), Sonic Boom, Grojband e reprises clássicas à noite.

**2016:** mantém os títulos anteriores, acrescenta As Meninas Superpoderosas (reinício de 2016) e Poderosas Magiespadas, com maratonas de férias e quadros de comédia/heróis.

**2017:** Ursos sem Curso, Gumball, Jorel, Jovens Titãs, Ben 10 (reinício), Apenas um Show, Hora de Aventura, Steven, Poderosas Magiespadas, OK K.O., Oswaldo, Dragon Ball Super, Pokémon, Scooby-Doo e reprises. Referência de 2017 usada para favorecer certos horários, sem duplicá-la como verdade absoluta.

**2018:** Jorel, Ursos, Gumball, Jovens Titãs, Ben 10, O Mundo de Greg, Acampamento de Verão, Maçã e Cebola, Unigata!, OK K.O., Hora de Aventura e outros.

**2019:** O Mundo de Greg, Acampamento de Verão, Maçã e Cebola, Gumball, Ursos, Steven, Jorel, Victor e Valentino, Mao Mao, Trem Infinito, DC Super Hero Girls, Ben 10 e reprises. Referência forte em programas especiais de fim de ano.

**2020–2021:** novas fases de Greg, Jorel, Gumball, Victor e Valentino, Trem Infinito, Acampamento de Verão, Maçã e Cebola, Mao Mao, Elliott e outras séries com períodos específicos. Reprises antigas podem aparecer, porém com peso menor.

O algoritmo já contém **54 nomes de programas/versões**, ainda que o importador automático do Stremio tente **38 entradas**. Alguns títulos exigem arquivos locais ou cadastro manual por não terem uma correspondência segura TVmaze ↔ IMDb.

## Como o motor escolhe

1. Lê o ano virtual e só libera programas cuja **época inicial** não é posterior ao ano escolhido.
2. Define uma faixa: madrugada, manhã/clássicos, HAHAHA, Heróis, Cine Cartoon, regular, maratonas e quadros elegíveis.
3. Sorteia **desenhos de várias séries**, com pesos maiores para a época em que eram mais presentes; impede repetições seguidas.
4. Procura episódios do desenho com data original e `firstAiredBR` não posteriores à data virtual. Se faltarem, mantém a série na grade como **pendente** — não substitui por Gumball/Ursos/Apenas um Show de forma sistemática.
5. Usa os 60% recentes/40% antigos **quando existirem episódios elegíveis nas duas classes**.
6. Insere chamadas somente ao iniciar série/quadro, promo e intervalo conforme arquivos locais, e especiais temáticos do mês.

## Limites de fidelidade

- As datas **mensais exatas** da estreia brasileira de cada episódio ainda não foram levantadas; importação TVmaze usa a data original e aplica a barreira do primeiro ano brasileiro da série. Pode ser necessária curadoria manual para reproduzir a grade de um mês específico com precisão.
- Desenhos antigos podem ter sido reprisados em meses e horários diferentes; a distribuição é inspirada nos registros, não auditada dia a dia.
- **Presença no catálogo Stremio não é prova de que um stream funcione.**
