# lililili · Fases 1 a 4 (Fundação + Kanban/SLA + Automações + Integrações)

Plataforma própria de gestão e automação de projetos do PMO CX. Esta fase entrega:

* Camada fixa de governança: projetos, épicos, tarefas, status e prazos.
* Campos dinâmicos: criados pela interface, sem migração de banco e sem deploy.
* Inventário imutável: log de auditoria com bloqueio de UPDATE/DELETE por gatilho no banco e corrente de hash contra adulteração retroativa.

## Requisitos

* Node.js 18 ou superior (recomendado 20).

## Como rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000. O banco `data/cx.db` é criado automaticamente na primeira execução.

## Prova do critério de pronto da Fase 1

1. Em Campos, crie um campo novo (exemplo: "Área parceira", tipo Seleção, opções Tech, Produto, Vendas).
2. Em Tarefas, o campo aparece imediatamente no formulário. Crie uma tarefa usando o campo.
3. Em Inventário, confira o lastro: criação do campo e criação da tarefa, com antes/depois e autor.

## Prova de imutabilidade do log

```bash
npm run teste:imutabilidade
```

O script insere um evento, tenta UPDATE e DELETE direto no banco e mostra o bloqueio pelos gatilhos, além de validar a corrente de hash.

## Backup

Copiar o arquivo `data/cx.db` (com a aplicação parada, ou copiar também os arquivos `cx.db-wal` e `cx.db-shm`).

## O que a Fase 2 adiciona

* Quadro Kanban com as 6 colunas de governança e arrastar e soltar (mudança de status gera lastro na mesma transação).
* Selos automáticos de SLA no cartão: no prazo, atenção (3 dias ou menos), atrasada, repactuada, concluída e concluída fora do prazo.
* Prazo inicial congelado e prazo atual repactuável: repactuações geram evento próprio no inventário, e concluir depois do prazo gera o evento de entrega fora do prazo automaticamente.
* Edição rápida: clique no cartão abre o painel com título, responsável, épico, prazo, links de referência e todos os campos dinâmicos.
* Épicos com criação rápida, selo colorido no cartão e filtro do quadro por épico.

## O que a Fase 3 adiciona

* Motor de automações com regras de gatilho, condição e ação criadas pela interface, sem código.
* Gatilhos por evento (tarefa criada, mudança de status, repactuação, entrega fora do prazo, campo alterado, troca de responsável) disparados na hora pelo barramento interno.
* Gatilhos temporais (tarefa em atraso e SLA a 3 dias ou menos) com deduplicação: no máximo um disparo por regra, por tarefa, por dia.
* Agendador limitado ao expediente (padrão 8h às 19h, seg a sex, ajustável no .env) com varredura de recuperação ao subir o servidor: ligar a máquina de manhã já dispara os alertas do dia. Botão de execução manual na tela de Automações.
* Ações disponíveis: mensagem no Slack (Incoming Webhook, com variáveis como {{titulo}} e {{diasAtraso}}), webhook externo genérico, mover a tarefa de status e atualizar campo dinâmico.
* Governança: toda ação automática assina o Inventário como "automacao:nome_da_regra", e eventos gerados por automação não disparam novas automações (trava anti-loop).

## Configuração do Slack

Copie `.env.example` para `.env`, cole a URL do Incoming Webhook do canal do PMO em `SLACK_WEBHOOK` e reinicie o servidor. Cada regra também aceita um webhook próprio, permitindo um canal por projeto.

## Espelho no Google Sheets

O banco continua sendo a fonte da verdade — é nele que ficam o inventário imutável, os gatilhos que bloqueiam UPDATE e DELETE e a corrente de hash. A planilha é uma **cópia de consulta**, reescrita a cada sincronização: serve para abrir, filtrar e compartilhar com quem não usa o sistema. Editar uma célula no Sheets não altera nada no sistema e a edição some na sincronização seguinte.

Duas abas são mantidas: **Tarefas** (com status, responsável, épico, prazos e o selo de SLA já calculado) e **Inventário** (o log completo, com o hash de cada linha, permitindo conferir a planilha contra o lastro original).

A sincronização roda sozinha a cada 10 minutos dentro do expediente e só chama o Google quando algo mudou de fato. Há também o botão "Sincronizar planilha agora" na tela de Inventário.

### Como configurar (uma vez)

1. **Crie a planilha** no Google Sheets. Na URL, copie o trecho entre `/d/` e `/edit` — esse é o `GOOGLE_SHEETS_ID`.
   `https://docs.google.com/spreadsheets/d/`**`ESTE_TRECHO`**`/edit`
2. Acesse <https://console.cloud.google.com/> e crie um projeto (o nome não importa, ex.: `cx-presence`).
3. No menu de busca do topo, procure **"Google Sheets API"** e clique em **Ativar**.
4. Vá em **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**. Dê um nome e conclua.
5. Abra a conta de serviço criada, aba **Chaves → Adicionar chave → Criar nova chave → JSON**. O arquivo é baixado.
6. Copie o **e-mail da conta de serviço** (algo como `nome@projeto.iam.gserviceaccount.com`).
7. Volte na planilha, clique em **Compartilhar** e adicione esse e-mail como **Editor**. Sem esse passo a conta não enxerga a planilha.
8. No arquivo `.env`, preencha:

```bash
GOOGLE_SHEETS_ID=o_trecho_copiado_no_passo_1
GOOGLE_SERVICE_ACCOUNT_JSON=./credenciais-google.json
```

Guarde o arquivo JSON baixado na pasta do projeto com esse nome. Em hospedagens que só aceitam texto, cole o conteúdo inteiro do JSON na própria variável, em uma linha só.

9. Reinicie o servidor. Na tela de Inventário, o bloco "Espelho no Google Sheets" mostra os botões de sincronizar e abrir a planilha.

O arquivo de credenciais dá acesso de escrita à planilha: mantenha fora do controle de versão (o `.gitignore` já cobre o `.env`).

## O que a Fase 4 adiciona

* Webhook de entrada autenticado (POST /api/webhooks/entrada, cabeçalho x-api-key): sistemas externos criam tarefas direto no quadro, com autor "webhook:origem" gravado no inventário. Sem API_KEY no .env, a porta fica desabilitada.
* Integração nativa com as automações: uma tarefa criada por webhook dispara o gatilho de tarefa criada, permitindo, por exemplo, avisar no Slack toda solicitação externa (condição: autor contém "webhook").
* Exportação do inventário em CSV (separador ; e BOM, abre direto no Excel em português) e XLSX, respeitando os filtros aplicados.
* Filtros no inventário: período, entidade, evento e autor.

### Exemplo de chamada do webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/entrada \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{"origem":"jotform_solicitacao","titulo":"Solicitação: nova visão no Zendesk","responsavel":"PMO CX","prazoInicial":"2026-08-21"}'
```

## Próximas fases

Fase 5: reporte semanal automático de segunda-feira gerado a partir do log. Fase 6: memorial Wiki por projeto e épico. Fase 7: operação (backup automático e processo persistente).
