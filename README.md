> **Correção v0.8.85 (catálogo e player):** leia [LEIA_HOTFIX_0.8.85.md](LEIA_HOTFIX_0.8.85.md) antes de migrar.

# Cartoon Timeline v0.8.85

**Comece pelo [README_V0885.md](README_V0885.md) para migrar o cache antigo e recuperar o acervo.**

# Cartoon Timeline v0.8.8

Canal retrô local de fã, não oficial.

**Leia primeiro `README_V088.md`** para instalar, sincronizar e compreender as limitações de duração e disponibilidade dos streams.

Instalação: extraia em pasta nova; copie sua pasta `media/` antiga, preservando subpastas; execute `INICIAR_WINDOWS.bat`; abra `http://localhost:3000`.

O servidor verifica o catálogo em segundo plano ao iniciar. Na Biblioteca, acompanhe progresso e fontes; não é necessário iniciar a sincronização manualmente.

**Cine Cartoon:** filmes inteiros na sessão correta; validade do lançamento original de Y a Y+3 (inclusive) e nunca antes da data de exibição registrada na fonte de referência internacional. Arquivos próprios seguem a mesma validação. Títulos externos só entram depois de um addon devolver endereço de mídia compatível, o que não garante reprodução nem autorização de transmissão.

**Durações:** arquivos MP4 locais usam duração extraída; duração de streams remotos pode começar estimada e ser corrigida ao `loadedmetadata`; a aplicação guarda valores medidos para os próximos dias. Buffers inesperados deslocam a grade, sem cortar o vídeo tocando. Não existe garantia absoluta sem acesso prévio ao fluxo completo e seus metadados.

**Addons configurados:** FenixFlix → FrostStream → Brazuca Torrents → Magnetflix. Cada serviço pode estar indisponível; torrents que não exponham URL HTML5 precisam de player compatível externo. A interface não remove CAPTCHA/DRM.

Pastas `media/` com divisões anuais para vinhetas, chamadas, promos, anúncios e especiais foram preservadas.

Testes offline: `node tests/test_grade.js`, `node tests/test_v088.js`, `python tests/test_backend.py`.

Mais detalhes: `README_V088.md`, `GRADE_E_FONTES.md`, `README_STREMIO.md`.
