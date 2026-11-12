> Tradução comunitária (rascunho) — Política NTARI P2-002, Transmissão Multilíngue Global (Global Multilingual Broadcast). Fonte: CONFORMANCE.md (original em inglês, snapshot de 2026-10-05). Rascunho comunitário assistido por máquina, pendente de revisão por mantenedor regional conforme P2-002 §3.1. As especificações técnicas centrais permanecem em inglês conforme §2.2.
>
> Notou algum erro nesta tradução? Correções de tradução são contribuições
> valiosas e muito bem-vindas: faça um fork do repositório e abra um pull
> request em https://github.com/NTARI-RAND/Agrinet.

> O original em inglês é normativo. Esta tradução é oferecida para leitura, não para interpretação: onde ela divergir de `CONFORMANCE.md`, prevalece o inglês. As palavras-chave normativas (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY), os nomes de campos, os rótulos e os identificadores são mantidos em inglês porque constituem o contrato de conformidade.

# Conformidade — Arquitetura de Dupla Face (Janus-Facing Architecture)

A autodescrição do repositório nos próprios termos da arquitetura, apresentada **antes** de qualquer coisa específica do produto, conforme a regra de ordenação da arquitetura. Toda alegação de conformidade está vinculada ao mecanismo e à verificação que a fazem cumprir, ou então é rotulada como provisória (stand-in) ou em revisão. Prosa sem vínculo é marketing.

A arquitetura é a **Arquitetura de Dupla Face (Janus-Facing Architecture, JFA)** — o documento de arquitetura unificada da NTARI, documentação livre sob o commons AGPL-3.0 do projeto.

## Declaração de papel

O Agrinet é uma **economia** da **camada de Economia e Educação** da JFA — a instância econômica de referência: coordenação e troca agrícolas, aplicando as quatro camadas subjacentes (substrato, registro, pacto, governança) a uma atividade socioeconômica específica. Ele mantém sua própria instância de registro por operador e adota a escala de avaliação do pacto no nível econômico.

| Termo deste repositório | Papel na arquitetura |
|---|---|
| Mycelium | o **livro-razão de diálogos por operador** — somente de adição, encadeado por hash, selado por diálogo |
| Operador | um **operador**: uma instância de plataforma que mantém seu próprio log |
| Adoção do LBTAS | o **pacto** no nível econômico — distribuições, nunca médias |
| Liquidação em custódia (escrow) | a postura de **fase um** da economia: custódia agora, crédito depois, por decisão de governança |

## Invariantes e seus vínculos — conforme `main`

Honestidade em primeiro lugar: **o maquinário de economia de membros da JFA está em revisão, não em `main`.** O escopo de log por operador, o stub de checkpoint de testemunha, o modelo de operador e a contabilidade de trocas de soma zero estão em branches de refatoração abertas; hoje, `main` é a aplicação sem eles. Cada invariante abaixo passa a vincular quando sua branch for integrada, e esta tabela é atualizada no mesmo PR (a regra de acompanhamento).

| Invariante (arquitetura) | Status | Mecanismo adotado |
|---|---|---|
| O livro-razão é **somente de adição**; correções são novas entradas; um arquivamento anota, nunca apaga | Em revisão | Mycelium: logs por troca encadeados por hash; sem atualização, sem exclusão |
| A unidade atômica é o **diálogo**, selado quando completo e quiescente | Em revisão | Selo do diálogo mantido aberto por alegações de dano não resolvidas; quem não avalia recebe um valor padrão marcado |
| **Nenhuma PII no commons** | Em revisão | A cadeia consigna o formato de uma troca; a narrativa é referenciada, local ao membro, apagável |
| Cada operador mantém seu **próprio log**; não há cadeia global | Em revisão | Escopo de log por operador; testemunho (não consenso) como modelo de não equivocação |
| Testemunho com independência; implantações com uma única testemunha são **rotuladas como provisórias** | Em revisão (provisório) | Stub de checkpoint de testemunha; a federação é o problema em aberto 2 |
| Reputação mantida como uma **distribuição completa**, nunca como média | Em revisão | LBTAS v2 (a versão sem médias) é o piso de adoção |
| Saldos são uma **função determinística do registro selado**; as trocas têm saldo líquido zero | Em revisão | Contabilidade de trocas de soma zero |
| A liquidação é em **custódia**; a mudança para crédito é decisão de governança, nunca um padrão do código | Postura permanente | Custódia em primeiro lugar; qualquer passagem para crédito emitido pelos membros exige aprovação do Conselho, notificação aos membros e uma revisão regulatória concluída |

## Provisórios e resíduos em aberto

- **Provisório de testemunha única.** Até que testemunhas independentes contra-assinem os checkpoints do operador, a não equivocação do registro é autoatestada e rotulada como tal.
- **O crédito não está ativado.** A custódia é o oposto do crédito e é descrita claramente como tal; o bootstrap em três fases (primeiro volume e integridade exibida) rege quando isso muda.
- **A federação entre operadores** existe em forma provisória (pares inscritos no cadastro (registry), tratamento provisório de conflitos reconhecido como tal); checkpoints testemunhados são o alvo declarado para a não equivocação entre operadores.

## Declaração de dependências

Adota a escala do pacto (LBTAS, piso v2) e mantém sua própria instância de registro. É independente do coordenador do substrato de computação — uma economia depende das camadas subjacentes a ela, nunca de uma economia irmã nem de um coordenador específico.

## Notas específicas do produto (por último, conforme a regra de ordenação)

A economia de referência. Seu modelo de operador/federação é a referência declarada para o alvo de projeto frontend-como-operador do substrato.
