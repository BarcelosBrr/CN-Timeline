# Pomfy + TVmaze: integração v0.7

## Passo a passo

1. Inicie o servidor e abra o Cartoon Timeline.
2. Em **Biblioteca**, clique **Sincronizar episódios (TVmaze → Pomfy)**. A opção também é tentada automaticamente ao abrir o site se o catálogo Pomfy estiver vazio, no máximo uma vez por dia no mesmo navegador.
3. Aguarde o retorno do servidor. As listas de temporadas e episódios são obtidas da **TVmaze**, e o player externo utiliza o ID de série correspondente no **TMDB**. A sincronização não baixa nem verifica a disponibilidade dos vídeos.
4. A grade vai escolher séries com acervo disponível, respeitando ano, data original, a proporção 60/40 e intervalos entre desenhos.
5. Quando um episódio Pomfy entrar na grade, o **iframe é carregado dentro da tela**, sem um clique adicional de “Abrir player externo”. É possível que o próprio iframe solicite um clique para liberar autoplay.

Os títulos pré-configurados em `data/pomfy_series.json` são Gumball, Apenas um Show e Ursos sem Curso. Você pode adicionar outras séries fornecendo `tmdbId`, `tvmazeId`, nome e ano mínimo de aparição (`earliestBR`).

`data/pomfy_automatico.json` contém o cache gerado e pode ser inspecionado. Cada item usa o endereço `https://api.pomfy.stream/serie/TMDB/TEMPORADA/EPISODIO`, data original e duração aproximada. Isso **não comprova** presença do episódio no catálogo do provedor, autorização de reprodução ou dublagem em português.

## Limitações inevitáveis do iframe

A documentação que foi possível verificar sobre a API Pomfy especifica endpoints de embed, listagem e customização da cor via `#cor:HEX`. Não documenta mensagens de seek, play, pause, volume nem eventos de tempo/término para o site hospedeiro. Por segurança, navegadores impedem controlar diretamente elementos internos de um iframe hospedado em outra origem. Por isso:

- o tempo exibido sobre o episódio Pomfy é a **posição teórica da transmissão**, não o tempo real do vídeo;
- volume, pausa, avanço, autoplay e fim do episódio dependem da interface do próprio Pomfy;
- **Som estável** funciona em arquivos HTML5 locais, não dentro do iframe;
- o iframe não é cortado automaticamente quando a grade virtual avança; feche-o para reassumir a TV.

Se o provedor publicar uma API oficial de postMessage com eventos de reprodução, poderemos criar um adaptador para controlar o iframe e sincronizar corretamente. Não tentamos contornar políticas de segurança, extrair streams ou remover proteções.

## Mídias manuais

O arquivo `data/pomfy.json` continua aceitando um array `media` com:

```json
{
  "enabled": true,
  "media": [{
    "authorized": true,
    "kind": "episode",
    "tmdbId": 37606,
    "season": 1,
    "episode": 1,
    "show": "O Incrível Mundo de Gumball",
    "name": "Título confirmado por você",
    "duration": 660,
    "firstAiredBR": "2015-01-01"
  }]
}
```

O objeto acima demonstra o formato; revise a data e a numeração antes de cadastrar. A integração de terceiros está sujeita a direitos de reprodução e à disponibilidade do serviço.
