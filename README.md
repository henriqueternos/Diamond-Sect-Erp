# Diamond Sect — Sistema de Locação

Projeto em React + TypeScript + Firebase (Auth + Firestore), 100% no plano gratuito
(Spark), hospedado no GitHub Pages.

## O que já está pronto (Fase 1 + Fase 2 + Fase 3)

- **Fundação:** Firebase configurado, login por "usuário" (mapeado internamente
  para um e-mail), contexto de autenticação, permissões por módulo, bloqueio
  após 5 tentativas de login erradas, logs de auditoria, layout com menu lateral.
- **Clientes:** cadastro completo, busca, edição, exclusão — tudo no Firestore.
  Botão de WhatsApp direto no cliente.
- **Estoque/Produtos:** cadastro completo com todas as quantidades e status,
  busca inteligente, painel de disponibilidade mostrando todos os pedidos que
  estão usando aquele produto.
- **Pedidos:** fluxo completo (cliente → tipo → produtos → datas → verificação
  de conflito → financeiro → salvar), número sequencial automático `DS-000001`,
  cálculo automático do valor em aberto, alerta de conflito de disponibilidade
  com opção de liberar mesmo assim (fica registrado em log), alteração de
  status, exclusão restrita a administradores (cancela o pedido, preservando o
  histórico).
- **Dashboard:** contadores reais de provas/retiradas/devoluções (hoje, atrasadas,
  próximos 15 dias), resumo financeiro e lista dos pedidos recentes — tudo
  puxado ao vivo do Firestore.
- **Documentos (Fase 3):** contrato, documento de retirada e pedido interno,
  todos gerados a partir dos dados reais do pedido, com **visualizar**,
  **imprimir** e **baixar em PDF** (gerado no navegador com `jsPDF`, sem
  backend nem Cloud Storage) e **enviar contrato por e-mail**. As cláusulas do
  contrato/retirada e os dados da empresa ficam editáveis em **Configurações**
  (Firestore: `companySettings`, `contractSettings`, `withdrawalSettings`).
- **Financeiro (Fase 4):** dashboard com receita de hoje/semana/mês/ano
  (baseada nos pagamentos realmente recebidos), valor recebido total, contas a
  receber, filtro por período (data inicial/final) recalculando ticket médio,
  pedidos pagos/parciais/em aberto, locações x vendas, produto mais alugado e
  mais vendido, clientes novos x recorrentes, e dois gráficos (receita diária e
  forma de pagamento) com `recharts`.
- **Controle de caixa (Fase 4):** abrir/fechar caixa por dia, saldo inicial,
  lançamentos manuais de entrada/saída/sangria, e reconciliação automática com
  os pagamentos de pedidos daquele dia (não é preciso lançar na mão o que já
  veio de um pedido pago).
- **Controle de despesas (Fase 4):** cadastro por categoria (energia, internet,
  lavanderia, costureira, funcionários, material, outras), filtro por mês,
  total por categoria e **lucro real do mês** (recebido − despesas).
- **Pagamentos:** cada pedido pode receber múltiplos pagamentos ao longo do
  tempo (ex.: sinal + saldo). Cada pagamento fica registrado em `payments` e
  atualiza automaticamente o valor pago/em aberto do pedido, o financeiro e o
  caixa do dia.
- **Agenda (Fase 5):** calendário mensal com provas, retiradas e devoluções
  puxadas ao vivo dos pedidos (cada tipo com sua cor), mais eventos
  personalizados criados na hora (`calendarEvents`). Clicar num item de pedido
  abre o pedido correspondente; a agenda nunca fica desatualizada porque não
  duplica dado nenhum — ela lê direto dos pedidos.
- **Central de relatórios (Fase 5):** todos os filtros do escopo original,
  combináveis entre si (período, produto, vendedor, cliente, tipo, status,
  forma de pagamento, datas de evento/prova/retirada/devolução,
  disponibilidade do produto), cards de resumo, e exportação real em
  **PDF** (`jsPDF`) e **Excel** (`xlsx`/SheetJS), além de impressão.
- **Lista de separação (Fase 5):** mesma lógica de filtros combináveis
  (período aplicado a evento/prova/retirada/devolução, tipo, nome, código,
  cor, marca, status), com impressão e exportação em PDF.
- **Funcionários e permissões (Fase 6):** tela em Configurações → Funcionários
  para criar contas de verdade (cria o usuário no Firebase Authentication e o
  perfil no Firestore, um clique só) e editar a matriz de permissões por
  módulo/ação de cada um. A regra "só admin exclui pedido" continua fixa,
  independente da matriz.
- **Logs (Fase 6):** tela `/logs` (admin) com todos os registros de auditoria
  já gravados desde a Fase 1 (login, pedidos, pagamentos, caixa, conflitos
  liberados, permissões alteradas etc.), com busca e filtro por módulo.
- **Pesquisa global (Fase 6):** barra no topo do sistema, pesquisa ao vivo em
  clientes, produtos e pedidos ao mesmo tempo, com resultado clicável.
- **Notificações (Fase 6):** sino no topo com alertas calculados em tempo real
  a partir dos pedidos: provas/retiradas/devoluções de hoje, devolução que
  cai amanhã, pagamento pendente, retirada/devolução atrasada e conflitos de
  disponibilidade liberados manualmente.

## Sobre a criação de funcionários sem servidor próprio

Criar um usuário no Firebase Authentication pelo navegador desloga
automaticamente quem está logado (o SDK troca a sessão ativa para o usuário
recém-criado). Para o administrador conseguir cadastrar um funcionário sem
perder a própria sessão, o sistema abre uma segunda instância isolada do
mesmo app do Firebase só para esse cadastro (`src/firebase/secondaryAuth.ts`)
— é a solução padrão da comunidade Firebase para esse problema, funciona
100% no navegador e não usa nenhum serviço pago.

## Projeto completo

As seis fases planejadas estão implementadas e funcionais. Para ajustes finos
(ex.: papéis de funcionário personalizados, categorias de despesa extras,
mais cláusulas de contrato), edite diretamente pelas telas de Configurações —
não é necessário mexer no código para o uso do dia a dia.

### Sobre o "enviar por e-mail"

Sem backend pago e sem Cloud Storage, não existe como o sistema anexar e
disparar um PDF sozinho a partir do navegador. A solução 100% gratuita e sem
conta externa é abrir o aplicativo de e-mail do próprio usuário (`mailto:`)
já preenchido com destinatário, assunto e um resumo do pedido — o usuário
anexa o PDF baixado antes de enviar. Isso está descrito na própria interface,
para não passar a impressão de um envio automático que a arquitetura gratuita
não permite. Se no futuro quiser um envio automático de fato, dá para plugar
um serviço como o EmailJS (tem plano gratuito, funciona 100% pelo navegador,
sem servidor próprio) — não incluí por padrão para não depender de uma conta
externa que você ainda não criou.



---

## 1. Pré-requisitos

- Node.js 18+ instalado
- Uma conta no [Firebase Console](https://console.firebase.google.com) com o
  projeto `diamond-sect-sistem` já criado (conforme informado)

## 2. Instalar dependências

```bash
npm install
```

## 3. Colocar a API Key real do Firebase

Abra `src/firebase/firebaseConfig.ts` e troque:

```ts
apiKey: "INSERIR_API_KEY_REAL_AQUI",
```

pela API Key real do seu projeto (Firebase Console → ⚙ Configurações do
projeto → Seus apps → SDK setup and configuration).

## 4. Ativar Authentication e Firestore no Console

1. **Authentication** → Sign-in method → ative **E-mail/senha**.
2. **Firestore Database** → criar banco em modo produção, região à sua escolha.
3. Em **Regras**, cole o conteúdo do arquivo `firestore.rules` deste projeto
   (ele já reflete a regra "só admin exclui pedidos").

## 5. Criar o administrador inicial (Henrique)

Como o Firebase Authentication exige e-mail, o login "Henrique" é apenas um
apelido interno vinculado a um e-mail técnico. Passo a passo:

1. **Authentication → Users → Add user**
   - E-mail: `henrique@diamondsect.local`
   - Senha: `38371450`
   - Copie o **UID** gerado.

2. **Firestore Database → Iniciar coleção `users`**
   - ID do documento: cole o **UID** copiado acima.
   - Campos do documento:

```json
{
  "loginUsername": "Henrique",
  "email": "henrique@diamondsect.local",
  "name": "Henrique",
  "role": "admin",
  "active": true,
  "permissions": {}
}
```

   Como `role` é `"admin"`, o sistema já libera acesso total a todos os
   módulos automaticamente — não é preciso preencher `permissions` campo a
   campo para o administrador (isso será usado para os demais funcionários,
   na Fase 6).

3. Pronto — na tela de login, use usuário `Henrique` e senha `38371450`.

> Esse passo manual é necessário apenas para o **primeiro** administrador
> (Henrique), já que é o único usuário que existe antes de o sistema ter
> login para criar os demais. A partir daí, use **Configurações →
> Funcionários** dentro do próprio sistema para cadastrar o restante da
> equipe com um clique — sem precisar voltar ao Firebase Console.

## 6. Rodar localmente

```bash
npm run dev
```

## 7. Publicar no GitHub Pages

**Importante:** o GitHub Pages só serve arquivos prontos (HTML/CSS/JS) — ele
não compila TypeScript/React sozinho. Se você simplesmente arrastar os
arquivos deste projeto (a pasta `src/`, o `vite.config.ts`, etc.) direto pelo
botão "Add file → Upload files" do GitHub, o site abre em branco, porque o
navegador não consegue executar os arquivos `.tsx` sem antes passar pelo
processo de build. É exatamente isso que causa a tela branca — não é erro
seu, é só a etapa que faltou.

Este projeto já vem com um **workflow automático** (`.github/workflows/deploy.yml`)
que resolve isso: toda vez que você enviar (`git push`) os arquivos fonte
para o GitHub, ele mesmo builda o projeto e publica a versão pronta. Você só
precisa configurar isso **uma vez**:

1. Crie um repositório no GitHub (pode ser o que você já criou,
   `Diamond-Sect-Erp`).
2. Envie **os arquivos fonte** deste projeto para a branch `main` (a pasta
   inteira, incluindo `.github/`, `src/`, `package.json`, `vite.config.ts`
   etc.):

```bash
git init
git add .
git commit -m "Diamond Sect - projeto completo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/Diamond-Sect-Erp.git
git push -u origin main
```

   Se você já tinha subido os arquivos errados (fonte sem build) antes, pode
   simplesmente subir por cima — o workflow vai gerar a versão certa no
   próximo passo.

3. No repositório do GitHub, vá em **Settings → Pages**. Em **"Build and
   deployment" → "Source"**, deixe (ou troque para) **"Deploy from a
   branch"**. Na primeira vez, essa branch (`gh-pages`) ainda não existe —
   ela é criada sozinha assim que o workflow rodar pela primeira vez (veja o
   próximo passo). Depois que ela aparecer na lista, selecione `gh-pages` /
   `(root)` e clique em **Save**.
4. Vá na aba **Actions** do repositório e acompanhe — o primeiro build leva
   1–2 minutos. Quando terminar com um ✅ verde, volte em **Settings →
   Pages** pra selecionar a branch `gh-pages` (passo 3) caso ainda não
   tenha aparecido, e o site estará em:
   `https://SEU_USUARIO.github.io/Diamond-Sect-Erp/`

Depois disso, **qualquer novo `git push` na branch `main` já builda e publica
sozinho** — nunca mais precisa rodar `npm run build` na sua máquina.

> **Se o deploy ficar dando "Deployment failed, try again later"** mesmo com
> tudo certo: isso costuma acontecer quando o repositório já usou o método
> mais novo do GitHub ("GitHub Actions" como source) antes e ficou um estado
> preso. A correção: em **Settings → Pages**, clique em **Unpublish site**
> (se aparecer), espere alguns segundos, escolha **"Deploy from a branch"**
> de novo, selecione `gh-pages`, e rode o workflow uma vez mais (aba Actions
> → botão **Re-run all jobs**, ou faça um novo commit qualquer).

> Prefere fazer manualmente pelo terminal, sem depender do robô? Rode
> `npm install` e depois `npm run deploy` (usa o pacote `gh-pages` para
> publicar a pasta `dist/` já compilada direto na branch `gh-pages`, sem
> esperar o GitHub Actions).

5. No **Firebase Console → Authentication → Settings → Authorized domains**,
   adicione `SEU_USUARIO.github.io` para permitir login a partir do GitHub
   Pages.

### Já publiquei e a tela ficou branca — e agora?

1. Abra o site publicado, aperte **F12** (ferramentas do desenvolvedor) e
   veja a aba **Console**. Se aparecer algo como `Failed to load module
   script` ou `404` para um arquivo `.tsx`, confirma que o problema é esse:
   arquivo fonte sem build.
2. A correção é sempre a mesma: publicar a pasta `dist/` (gerada pelo
   `npm run build`), nunca a pasta `src/` nem os arquivos de configuração
   soltos. O passo a passo acima com GitHub Actions faz isso automaticamente
   pra você a partir de agora.

---

## Estrutura de pastas

```
src/
  components/     Modal, ConfirmDialog, badges, DiamondMark, ProtectedRoute,
                  GlobalSearch, NotificationsBell
  contexts/       AuthContext
  firebase/       firebaseConfig.ts, secondaryAuth.ts
  hooks/          useAuth
  layouts/        MainLayout (menu lateral + topo com busca e notificações)
  pages/          Login, Dashboard, Clients, Products, Orders, Settings
                  (+ EmployeesTab), Financial, Expenses, CashFlow, Calendar,
                  Reports, PickingList, Logs
  services/       AuthService, ClientService, ProductService, OrderService,
                  LogService, SettingsService, DocumentService,
                  PaymentService, ExpenseService, CashFlowService,
                  CalendarService, ExportService, EmployeeService
  types/          tipos compartilhados (Client, Product, Order, Settings,
                  Payment, Expense, CashRegister, CalendarEvent, AppUser etc.)
```

As páginas nunca acessam o Firestore diretamente — tudo passa pelos
`services/`, como pedido no projeto original, o que facilita adicionar as
próximas fases sem reescrever a UI.

> **Antes de gerar o primeiro contrato:** acesse **Configurações → Empresa** e
> preencha ao menos o nome da empresa. Sem isso, o sistema avisa na tela e não
> deixa gerar o documento — para não entregar um contrato com campos em branco.

## Observação sobre imagens

Não há upload de arquivos (Cloud Storage não é usado). Os campos de foto de
cliente e produto aceitam apenas uma **URL digitada manualmente**, mantendo o
projeto 100% dentro do plano gratuito Spark.

## Revisão de pontas soltas (pós Fase 6)

Depois das 6 fases, revisei o projeto inteiro à procura de coisas que
pareciam funcionar mas não estavam realmente ligadas ponta a ponta. Encontrei
e corrigi:

- **Estoque não se atualizava sozinho.** As quantidades reservada/em
  prova/alugada de um produto nunca mudavam quando um pedido mudava de
  status — o painel de disponibilidade dependia só da checagem de datas, mas
  os campos `reservedQuantity`/`fittingQuantity`/`rentedQuantity` do produto
  ficavam sempre zerados. Criei o `StockSyncService`, que recalcula essas
  quantidades do zero (a partir dos pedidos realmente ativos) toda vez que um
  pedido é criado, tem status ou itens alterados, ou é cancelado. "Quantidade
  disponível" no formulário de produto agora é só leitura — ela é
  consequência dos pedidos, não um número digitado à mão.
- **Não existia jeito de mover produto para lavanderia/manutenção.** A
  função já existia no código mas não estava ligada a nenhum botão. Adicionei
  "Mover estoque" na lista de produtos.
- **Esqueci minha senha** não existia — um funcionário que errasse a senha
  ficava sem saída. Adicionei o link na tela de login (usa
  `sendPasswordResetEmail` do próprio Firebase, sem servidor).
- **Editar funcionário** (nome/cargo) não tinha botão, só criar. Adicionei.
- Painel de disponibilidade do produto estava contando pedidos já devolvidos/
  finalizados como se ainda estivessem ocupando o produto. Corrigido para
  mostrar só o que está realmente ativo.
- Alguns links internos (`/clientes?buscar=...`) não escapavam caracteres
  especiais do nome do cliente — corrigido com `encodeURIComponent`.
- A checagem de estoque ao adicionar um produto já presente no carrinho do
  pedido comparava só a nova quantidade, não a soma com o que já estava no
  carrinho — corrigido.

## Limitações conhecidas (por decisão de escopo, não por bug)

- **Não há tela para editar um pedido já criado** (itens, datas, desconto)
  além de mudar o status e registrar pagamentos. Para corrigir um pedido
  errado hoje, cancele e crie de novo. Dá pra construir uma tela de edição
  completa se for importante para o seu fluxo — é só pedir.
- **E-mail do contrato usa `mailto:`**, então não anexa o PDF sozinho (motivo
  explicado mais acima). Um envio 100% automático exigiria um serviço externo
  como o EmailJS.
- **Papel de funcionário (vendedor/gerente/assistente) não muda automaticamente
  as permissões** além do conjunto padrão sugerido na criação — ajuste fino é
  sempre feito na matriz de permissões.
- Nenhuma dessas limitações impede o uso diário do sistema; são só os
  próximos pontos naturais de evolução.

## Dashboard interativo + edição de datas do pedido (atualização seguinte)

- **Dashboard agora tem 3 blocos de ação** — Provas, Retiradas e Devoluções —
  cada um dividido em Atrasadas / Hoje / Próximos 10 dias, com o pedido
  listado individualmente e um seletor de status ao lado. Mudar o status
  ali mesmo já atualiza o pedido e, automaticamente, o estoque (via o mesmo
  `StockSyncService` da correção anterior). Cada bloco só mostra pedidos que
  ainda não passaram daquela etapa (ex.: uma prova já feita não aparece mais
  como atrasada).
- **Datas de prova/retirada/devolução agora são editáveis** depois que o
  pedido já existe — no menu "⋮" do pedido, em "Editar datas". Tem um botão
  para reverificar conflito de disponibilidade com as novas datas antes de
  salvar (alerta, não bloqueia).
- **Data de criação do pedido** agora aparece no resumo rápido e na tela de
  editar datas, sempre como texto informativo — não é um campo editável,
  exatamente como pedido.

### Bugs corrigidos nesta revisão

- **Criar evento na Agenda sem preencher horário ou descrição quebrava.** O
  Firestore rejeita `undefined` como valor de campo, e o formulário mandava
  `undefined` sempre que esses campos opcionais ficavam em branco (o caso mais
  comum). Corrigido.
- **Editar as datas de um pedido também quebraria pelo mesmo motivo** se
  algum campo de data ficasse vazio — corrigido antes de ir para produção.
- Um `sellerId`/`sellerName` teoricamente `undefined` no momento de criar um
  pedido foi protegido com um valor padrão, por segurança.

## CPF e CEP obrigatórios no cadastro de cliente

CPF e CEP agora são obrigatórios para salvar um cliente. Se tentar salvar sem
preencher, o cadastro não é concluído e o(s) campo(s) que faltam ficam
destacados em vermelho, com uma mensagem explicando o que falta.

## Auditoria completa do sistema (revisão minuciosa)

Revisei arquivo por arquivo — todos os services, todas as páginas, as regras
do Firestore e o roteamento — procurando qualquer coisa quebrada, incompleta
ou mal conectada entre módulos. Encontrei e corrigi:

**Falhas de segurança/integração:**
- **Desativar um funcionário não impedia o login dele.** O campo `active`
  nunca era checado em lugar nenhum. Agora o login verifica isso (e desloga
  na hora se a conta for desativada enquanto a sessão ainda está aberta).
- **A regra "só admin cancela pedido" só existia na tela.** Qualquer usuário
  autenticado conseguia cancelar um pedido direto pela API, contornando a
  interface. Agora a própria regra do Firestore bloqueia essa transição
  específica para quem não é admin.

**Dinheiro/estoque desalinhados:**
- **Pagamento feito na criação do pedido não virava um registro de
  pagamento de verdade** — só o valor pago no pedido era atualizado, sem
  passar pelo Financeiro/Caixa. Agora esse pagamento inicial é registrado da
  mesma forma que um pagamento posterior.
- **Crédito usado num pedido nunca era descontado do saldo do cliente** — o
  mesmo crédito podia ser "gasto" em vários pedidos diferentes sem nunca
  acabar. Criei um histórico de crédito de verdade (`customerCredits`, uma
  coleção prevista desde o início mas nunca implementada) com estorno
  automático se o pedido for cancelado, validação para não gastar mais
  crédito do que o cliente tem, e visualização do histórico no cadastro do
  cliente.
- **Um pagamento registrado por duas pessoas quase ao mesmo tempo podia
  sobrescrever um ao outro.** Corrigido usando transação atômica do
  Firestore.
- O alerta de conflito de disponibilidade tinha um campo "quantidade
  disponível" que nunca era preenchido (sempre mostrava 0). Agora mostra o
  valor real.

**Outras correções:**
- Uma consulta nova (histórico de crédito) exigiria criar manualmente um
  índice composto no Firestore para funcionar — ajustada para não precisar
  disso, então funciona direto, sem configuração extra.
- Rebaixar um administrador para outro cargo o deixava sem nenhuma permissão
  configurada. Agora aplica um conjunto padrão automaticamente nesse caso.
- Cancelar um pedido cujo cliente foi excluído deixaria a tela travada sem
  aviso nenhum. Agora mostra um erro e libera a tela mesmo assim.
- Limpeza de um pequeno trecho de código morto/confuso (`Math.min(x, x)`)
  sem efeito real, mas que dificultava a leitura.

Não encontrei nenhuma rota, botão ou página desconectada do restante do
sistema — todo o roteamento (`App.tsx`), menu lateral e permissões batem
entre si.

## CEP automático + mecanismo de pagamentos combinados

- **CEP automático no cadastro de cliente:** ao digitar um CEP com 8 dígitos,
  o sistema consulta a API gratuita ViaCEP e preenche sozinho endereço,
  bairro e cidade. Se o CEP não existir, mostra um aviso e deixa preencher
  na mão — nunca trava o cadastro.
- **Pagamentos combinados na criação do pedido:** em vez de um único campo
  "valor pago", agora dá pra lançar quantos pagamentos quiser (dinheiro +
  pix + cartão, por exemplo) até fechar o valor, igual ao carrinho de
  produtos. Cada lançamento vira um registro de pagamento de verdade assim
  que o pedido é salvo.
- **Histórico de pagamentos + exclusão com aprovação do administrador:** no
  menu "⋮" do pedido, "Pagamentos" agora mostra todos os lançamentos já
  feitos, com um botão "Excluir" em cada um. Excluir pede usuário e senha de
  um administrador — a exclusão só acontece de verdade se essas credenciais
  forem confirmadas (usa a mesma técnica de sessão secundária do cadastro de
  funcionários, então não desloga quem está usando o sistema). A regra do
  Firestore também foi ajustada para bloquear a exclusão de pagamentos por
  quem não é admin, mesmo tentando direto pela API.

### Atualize a regra do Firestore

No Firebase Console → Firestore → Regras, troque a linha do `payments` por:

```
match /payments/{id} {
  allow read, create, update: if isSignedIn();
  allow delete: if isAdmin();
}
```

## Cliente opcional nos eventos da Agenda

Ao criar um "Novo evento" na Agenda, agora dá pra vincular um cliente
(opcional). Quando vinculado, o nome do cliente aparece junto do evento no
calendário e tem um botão "Abrir cliente" para ir direto ao cadastro dele.

## Permissões direto na criação do funcionário

O formulário "Novo funcionário" agora mostra a matriz de permissões (por
módulo e ação) na hora de criar, já vindo com uma sugestão padrão marcada —
não precisa mais criar o funcionário e depois abrir "Permissões" em separado
(embora essa opção continue existindo, para ajustar depois). O campo "Cargo"
continua sendo só um rótulo (Vendedor, Gerente, Assistente, Administrador);
quem realmente define o acesso é a matriz marcada ali. Administrador
continua com acesso total automático, sem depender da matriz.

## Permissões também na edição

A tela "Editar" de um funcionário agora também mostra a matriz de
permissões, do mesmo jeito que a de criar: se você mudar o Cargo para
Administrador, a matriz some (não se aplica); se mudar para qualquer outro
cargo, ela aparece já carregada com o que a pessoa tinha antes, pronta para
ajustar. Um só salvamento grava nome, cargo e permissões juntos. O botão
"Permissões" na listagem continua existindo como atalho rápido para o mesmo
resultado, sem precisar abrir a edição completa.

## Revisão pós Fase-6-avançada (pagamentos combinados, CEP, permissões)

Revisei tudo de novo depois das últimas mudanças. Encontrei e corrigi:

- **Valor em aberto travado no modal de pagamentos.** Ao abrir "Pagamentos"
  de um pedido, o número mostrado no topo ficava parado no momento em que
  você abriu a tela — lançar ou excluir um pagamento ali mesmo não
  atualizava aquele número na hora (a lista de baixo atualizava certinho, só
  o resumo do topo que ficava desatualizado). Corrigido para acompanhar ao
  vivo.
- **`firestore.rules` do projeto desatualizado.** O arquivo salvo no
  repositório ainda tinha a versão restrita da leitura de usuários, mas o que
  está publicado de verdade no seu Firebase é a versão aberta (necessária
  para o login funcionar). Sincronizei o arquivo para refletir o que
  realmente está no ar, evitando confusão se você precisar recolar as regras
  no futuro.

Revisei também o mecanismo de pagamentos combinados, a exclusão com senha de
administrador (incluindo o fluxo de autenticação via sessão secundária), o
CEP automático e a matriz de permissões na criação/edição de funcionários —
tudo funcionando e conectado corretamente, sem escritas de campos
`undefined` no Firestore e sem consultas que exijam índice composto.

## Gerente também pode aprovar exclusão de pagamento

A exclusão de um pagamento lançado agora aceita usuário e senha de um
**administrador OU gerente** (antes só admin). Isso vale tanto na tela
(a caixinha de aprovação) quanto na regra do Firestore — um gerente
autenticado corretamente consegue autorizar a exclusão de verdade, não é só
uma checagem visual.

## Layout responsivo para celular

O sistema foi construído com um menu lateral fixo ao lado do conteúdo — bom
para computador, mas espremia tudo numa faixa estreita em celular (por isso
o calendário da Agenda, os cards do Financeiro e os filtros de Relatórios
apareciam com texto cortado/embolado). Corrigido:

- **Menu vira uma gaveta no celular** (abaixo do tamanho "tablet"): fica
  escondido por padrão, abre com o botão ☰ no topo, e fecha sozinho ao
  escolher uma página. Do tablet pra cima, continua fixo do lado como antes.
- **Bug do menu "não descer até o fim da tela"** corrigido: era causado por
  usar `100vh` como altura, que em navegadores de celular é calculado errado
  por causa da barra de endereço que aparece/some. Troquei para `100dvh`
  (altura real da tela visível), que se ajusta corretamente.
- **Calendário da Agenda** ganhou tamanhos de fonte, espaçamento e altura de
  célula menores em telas pequenas, e os cabeçalhos dos dias da semana viram
  uma letra só (D, S, T...) no celular para não sobrepor os números dos dias.

Com o conteúdo agora ocupando a tela inteira no celular (em vez de dividir
espaço com o menu), os cards do Financeiro, os filtros de Relatórios/Lista de
separação e as demais telas com grades devem se ajustar corretamente também,
já que o problema raiz era a largura disponível, não cada tela individual.

## Responsividade no celular (correção)

Pelas prints que você mandou, o site publicado ainda está numa versão mais
antiga — sem o menu lateral em formato de gaveta (☰) que já existe neste
projeto. Depois de subir esta versão:

- No celular, o menu lateral fica escondido por padrão; toca no ☰ no topo
  para abrir, e ele desliza por cima do conteúdo (sem espremer a tela ao
  meio como nas prints).
- Corrigi também uma causa raiz de sobreposição de texto nos filtros (como
  em Relatórios e Lista de separação): adicionei uma regra CSS
  (`.grid > * { min-width: 0 }`) que impede um rótulo comprido de "empurrar"
  a coluna do grid além do espaço disponível — era isso que fazia palavras
  como "PRODUTO" e "VENDEDOR" aparecerem coladas.
- Várias grades de filtros e cartões (Relatórios, Lista de separação,
  Financeiro, Caixa, Despesas, Pedidos) agora começam em **uma coluna** no
  celular e só viram 2, 3 ou 4 colunas em telas maiores — antes várias
  ficavam sempre em 2 colunas, mesmo em telas muito estreitas.
- Títulos de página (ex.: "Configurações") agora usam um tamanho de fonte
  menor no celular para nunca cortar, e os rótulos dos campos ficaram um
  pouco maiores e mais claros para ler.

Depois de subir estes arquivos, teste de novo no celular — o menu deve
aparecer como uma gaveta que abre com o ☰, e os filtros devem empilhar
verticalmente em vez de se sobrepor.

## Ajuste de tipografia (mais legível e harmônico)

- Corrigi um problema real: a fonte serifada (Cormorant Garamond) só foi
  carregada nos pesos 500/600/700, mas em vários lugares o código não
  especificava peso nenhum — o navegador então "negritava sinteticamente"
  a fonte por conta própria, o que fica desalinhado e menos elegante.
  Agora `.font-display` sempre usa peso 500 de verdade.
- Números (valores em R$, contadores) agora usam a variante tabular/alinhada
  da fonte, então os algarismos ficam do mesmo tamanho e alinhados — fontes
  serifadas old-style como essa costumam ter números de alturas/larguras
  desiguais por padrão, o que atrapalha a leitura rápida de valores.
- Títulos grandes ganharam um leve ajuste de espaçamento entre letras
  (levemente mais próximo) para um ar mais refinado; o corpo do texto
  ganhou mais espaçamento entre linhas para respirar melhor.
- Corrigi um engano meu da resposta anterior: os rótulos dos campos tinham
  ficado *menores* no celular sem querer (11px) — voltei para o tamanho
  correto e mantive o contraste mais claro (cinza mais claro + negrito),
  que é o que realmente ajuda a ler no celular.

## Correção do menu "travando" no celular na horizontal

Encontrei a causa: o menu lateral usava uma técnica de altura (`100dvh`) que
tem um bug conhecido no Safari do iPhone — quando a página rola e a barra de
endereço do navegador soma/aparece, a altura não se recalcula direito durante
o gesto de rolagem, e o menu "trava" no tamanho antigo até a rolagem parar.
Troquei a arquitetura do menu:

- Agora ele usa `position: fixed` com `inset-y-0` (preso ao topo e à base da
  janela de verdade), em vez de uma altura calculada — isso não depende de
  nenhuma unidade de viewport problemática, então não trava mais durante a
  rolagem em nenhum navegador.
- Também troquei o ponto em que o menu deixa de ser uma "gaveta" (escondida,
  abre com ☰) e passa a ficar sempre visível: antes era 768px de largura,
  agora é 1024px. Celular na horizontal normalmente fica entre 650–930px de
  largura — ou seja, ele estava caindo no modo "computador" (menu sempre
  visível, espremendo o conteúdo) só por causa da largura. Agora continua no
  modo gaveta também na horizontal, dando a tela inteira pro conteúdo.

Essa é só uma mudança de código (CSS/layout) — não precisa mexer em nada no
Firebase.

## Correção: preço não atualizava ao trocar Venda/Locação

Bug real reportado pelo usuário: ao adicionar um produto com "Venda"
selecionado e depois trocar para "Locação" (ou vice-versa), os produtos que
já estavam no carrinho continuavam com o preço antigo — só produtos
adicionados depois da troca pegavam o preço certo, o que bagunçava o valor
total do pedido. Corrigido: agora, trocar o Tipo recalcula automaticamente o
valor unitário de todos os itens já adicionados, usando o preço de venda ou
de locação de cada produto conforme o tipo atual.

## Correções grandes: cancelamento de pedido e edição completa

Relato detalhado do usuário revelou três problemas reais, todos corrigidos:

1. **Cancelar um pedido não zerava o valor em aberto.** O status mudava para
   "Cancelado", mas o pedido continuava contando como dívida em aberto no
   Dashboard, em Pedidos e em Relatórios (só o Financeiro, que já filtrava
   pedidos cancelados à parte, mostrava certo). Corrigido: cancelar agora
   zera o valor em aberto do próprio pedido, então qualquer tela que olhe
   esse número já fica correta automaticamente, sem precisar de filtro
   especial em cada lugar.
   > Pedidos cancelados **antes** desta correção continuam com o valor antigo
   > até serem cancelados de novo (agora com o código corrigido). Se tiver
   > um pedido de teste assim, é só repetir "Excluir pedido (cancelar)" nele
   > pra corrigir.
2. **Cancelar pedido agora pede senha de administrador ou gerente, para
   qualquer usuário.** Antes, só quem já estivesse logado como admin via a
   opção; agora qualquer pessoa logada pode pedir o cancelamento, mas
   precisa digitar usuário e senha de um admin ou gerente pra autorizar de
   verdade (mesma técnica seye — sessão separada, sem deslogar ninguém — já
   usada pra excluir pagamento). Tirei também "Cancelado" do seletor rápido
   de status, pra cancelamento só acontecer por esse caminho com aprovação.
3. **Edição completa do pedido.** Agora dá pra clicar em cima do número do
   pedido (ou usar "Editar pedido completo" no menu "⋮") pra reabrir a
   mesma tela de criação, já preenchida — dá pra adicionar, remover ou trocar
   peças, mudar datas, desconto/acréscimo/crédito usado e as observações.
   Pagamentos já lançados não são tocados por essa tela (continuam sendo
   geridos em "Pagamentos"); o estoque se reajusta sozinho conforme as peças
   mudam, e o crédito do cliente é ajustado corretamente se você mudar o
   valor de "Crédito usado" durante a edição.

### Atualize a regra do Firestore

Adicione a função `isManagerOrAdmin` (se ainda não tiver) e troque a regra
de `orders`:

```
function isManagerOrAdmin() {
  return isSignedIn() && (myProfile().role == 'admin' || myProfile().role == 'manager');
}

match /orders/{orderId} {
  allow read, create: if isSignedIn();
  allow update: if isSignedIn() && (request.resource.data.status != 'cancelado' || isManagerOrAdmin());
  allow delete: if isAdmin();
}
```

## Correção: datas apareciam no formato errado (ano/mês/dia)

Em algumas telas — lista de Pedidos (colunas Retirada/Devolução), resumo
rápido do pedido, alertas de conflito de disponibilidade (no formulário de
pedido e no painel de disponibilidade do produto) — as datas apareciam cruas
como vêm do banco (`2026-07-21`, ano-mês-dia) em vez de convertidas para o
formato brasileiro. Corrigido em todos esses pontos para sempre mostrar
dia/mês/ano (`21/07/2026`).

## Tema claro + fonte única e profissional

A pedido, troquei o visual do sistema inteiro:

- **Fonte:** removida a fonte serifada decorativa (Cormorant Garamond) usada
  em títulos e números. Agora todo o sistema usa uma única fonte —
  Manrope — legível e de aparência profissional, do menu aos valores em R$.
  Os números continuam usando a variante tabular (alinhada), só que agora
  numa fonte padrão em vez de uma serifada old-style.
- **Tema:** de escuro para **claro**. A troca foi feita num lugar só (a
  paleta de cores do Tailwind), então ela vale para o sistema inteiro —
  fundo branco/cinza claro, texto escuro, cartões brancos com borda sutil.
  Os botões, gráficos do Financeiro e o emblema de notificações foram
  ajustados manualmente para manter bom contraste no novo tema (eles usavam
  cores fixas pensadas para fundo escuro).
- Documentos gerados (contrato, retirada, pedido interno, PDFs) **não
  mudaram** — eles já eram estilizados como papel branco com texto preto,
  independente do tema do sistema, então continuam iguais.

Se no futuro você quiser voltar pro tema escuro ou criar um modo com os
dois, a estrutura já está pronta pra isso — é só trocar os valores de volta
em `tailwind.config.js` (ou, para os dois ao mesmo tempo, isso exigiria uma
implementação nova de alternância de tema, que posso fazer se quiser).

## Correção: menu recolhido no celular ficava com espaço em branco

Bug real encontrado pelo usuário: ao tocar em "Recolher menu" (função pensada
só para computador, onde o menu fica sempre visível do lado), a gaveta do
celular ficava só com os ícones, mas o painel continuava com a largura
cheia — sobrava um espaço em branco enorme do lado, e só fechava tocando
fora. Corrigido: agora os textos do menu (nomes dos itens, "Diamond Sect",
usuário logado) sempre aparecem no celular, não importa o estado de
"recolhido" — esse estado só pode afetar a versão de computador. Também
adicionei uma segurança extra: abrir o menu no celular sempre garante que
ele abre "expandido", nunca preso num estado recolhido de uma sessão anterior.

## Correção: campos numéricos com "0" preso e difícil de apagar

Bug real de UX: campos como Desconto, Acréscimo, Crédito usado (no pedido),
Valor pago, valor de custo/aluguel/venda (produto), saldo do caixa e valor de
despesa mostravam um "0" fixo que era difícil de apagar — ao tentar limpar o
campo pra digitar um valor novo, ele sempre voltava pra "0" sozinho, e digitar
sem apagar primeiro grudava o número novo do lado do zero.

Duas correções:
- **Geral, em todo o sistema:** qualquer campo numérico agora seleciona o
  conteúdo inteiro assim que você clica nele — então digitar já substitui o
  valor anterior direto, sem precisar apagar na mão primeiro.
- **Nos campos específicos apontados** (Desconto, Acréscimo, Crédito usado,
  Valor pago, valores de produto, saldo de caixa, valor de despesa): agora
  começam realmente em branco, e só mostram "0" como dica cinza (placeholder)
  até você digitar algo — não como um valor de verdade que precisa ser
  apagado.

## Pedido cancelado: selo vermelho fixo, sem como reverter

- A opção "Cancelado" já não aparecia no seletor comum de status (só dá pra
  cancelar pelo fluxo com senha de administrador/gerente) — mas isso deixava
  um bug visual: quando um pedido já estava cancelado, o seletor ficava sem
  nenhuma opção correspondente selecionada, mostrando o primeiro status da
  lista por engano (dava a entender que o pedido não estava mais cancelado).
- Corrigido: pedidos cancelados agora mostram um selo vermelho fixo escrito
  "Cancelado" na listagem, no lugar do seletor — sem select, sem dropdown,
  sem nenhuma forma de mudar para outro status. A única maneira de reverter
  seria criar um pedido novo; não existe "descancelar".

## Pedido cancelado não conta mais em NENHUM valor do sistema

Pedido cancelado agora é tratado como "sem fundamento" para fins de dinheiro
em todo lugar que soma valores:

- **Dashboard:** "Valor recebido" e "Valor em aberto" não incluem mais
  pedidos cancelados.
- **Financeiro:** receita de hoje/semana/mês/ano, valor recebido total,
  gráfico de receita diária e o gráfico de formas de pagamento — todos
  ignoram pagamentos que pertencem a um pedido cancelado (antes, esses
  valores eram somados direto da lista de pagamentos, sem checar se o
  pedido ainda era válido).
- **Caixa:** o saldo do dia não soma mais pagamentos de pedidos cancelados.
- **Despesas:** o "lucro real do mês" (recebido − despesas) também não
  conta mais esses pagamentos.
- **Relatórios:** pedidos cancelados somem dos totais e da listagem por
  padrão — a única forma de vê-los é filtrando explicitamente por
  "Status do pedido = Cancelado", para quem precisar auditar depois.

Importante: os pagamentos em si **não são apagados** do banco (continuam
existindo no histórico do pedido, em "Pagamentos", e nos Logs, pra manter
rastreabilidade) — eles só deixam de contar nas somas e telas financeiras
gerais, exatamente como pedido.

## Correção: PDFs e documentos impressos com fonte diferente do resto do sistema

Boa pergunta do usuário revelou uma inconsistência real: contrato, retirada
e pedido interno (tanto na tela de "Visualizar/Imprimir" quanto no PDF
baixado) ainda usavam uma fonte serifada tradicional (Georgia/Times) — um
estilo de "papel formal" que fazia sentido antes, mas ficou destoante depois
da troca do sistema para uma fonte sem serifa (Manrope). Os Relatórios e a
Lista de separação já usavam sem serifa (Helvetica).

Corrigido: contrato, retirada e pedido interno agora usam a mesma família
sem serifa (Helvetica) em tudo — visualização em tela, impressão e PDF —
ficando visualmente alinhados com o restante do ERP e com os outros
documentos exportáveis. O PDF usa a fonte "Helvetica" nativa do gerador de
PDF (a mais próxima disponível de uma fonte sem serifa limpa, já que
incorporar a fonte exata do sistema, Manrope, dentro do PDF exigiria embutir
o arquivo da fonte separadamente).

## Fonte dos documentos: Times New Roman (formal/jurídica)

Depois de ver um comparativo visual, a decisão final foi manter a fonte
tradicional de documento formal — **Times New Roman** — no contrato, na
retirada e no pedido interno (tela e PDF). Relatórios e Lista de separação
continuam em Helvetica (sem serifa), já que são ferramentas internas de
operação, não documentos jurídicos.

## Auditoria completa do sistema (revisão minuciosa)

Fiz uma varredura detalhada em todo o código, arquivo por arquivo. Encontrei
e corrigi **8 problemas reais**:

1. **Trocar o cliente durante a edição de um pedido corrompia o crédito.**
   O formulário de editar pedido deixava o campo "Cliente" livre para trocar,
   mas o ajuste de crédito usava o cliente *novo* em vez do original — o
   cliente certo nunca recebia o estorno, e o errado seria debitado. Campo
   "Cliente" agora é travado na edição.
2. **Saldo de crédito podia "zerar" silenciosamente.** Se dois lançamentos
   de crédito acontecessem quase juntos, o sistema simplesmente forçava o
   saldo pra 0 sem avisar. Agora gera um erro visível em vez de mascarar.
3. **Botão de cancelar pedido aparecia pra qualquer usuário**, sem checar
   permissão (a senha de aprovação ainda protegia a ação de verdade, mas o
   botão não devia nem aparecer). Corrigido para respeitar a mesma permissão
   dos outros botões sensíveis do mesmo menu.
4. **Modal de "Mover estoque" e painel de "Disponibilidade"** mostravam
   números congelados do momento em que abriram, em vez de atualizar ao
   vivo — corrigido, mesmo padrão já usado no modal de pagamentos.
5. **Excluir produto não avisava se ele estava em pedidos ativos.** Agora
   mostra um aviso antes de confirmar.
6. **Crédito do cliente podia ser editado direto no cadastro**, sem passar
   pelo histórico — criava mudanças de saldo sem nenhum registro do motivo.
   Agora só é editável na criação do cliente; em cliente já existente, vira
   somente leitura + botão "Ajustar" que registra o motivo no histórico.
7. **Fórmula de valor em aberto duplicada sem proteção** dentro do
   `PaymentService` (lançar/excluir pagamento) — se um pedido antigo não
   tivesse `discount`/`surcharge`/`creditUsed` preenchidos, o cálculo
   quebraria. Adicionadas as mesmas proteções já usadas em outros lugares.
8. Conferidos e confirmados corretos: todos os cálculos de Dashboard,
   Financeiro, Caixa e Despesas já excluíam pedidos cancelados e seus
   pagamentos; nenhuma consulta exige índice composto; nenhuma escrita de
   campo `undefined` no Firestore restante além dos casos já sanitizados.

## Correção: tabela "Pedidos recentes" do Dashboard vazando no celular

A tabela de pedidos recentes no Dashboard era a única do sistema sem
rolagem horizontal própria — em telas estreitas, a última coluna ("Em
aberto") ficava parcialmente fora do card. Corrigido, e por segurança
apliquei a mesma proteção (rolagem horizontal) em mais 4 tabelas menores
dentro de modais (itens do pedido, conflito de disponibilidade, pagamentos
lançados na criação, histórico de pagamentos do pedido) que tinham o mesmo
risco em telas bem estreitas.

## Revisão final antes da apresentação — 3 correções importantes de segurança/UX

Última rodada de revisão, focada em segurança de acesso e consistência:

1. **Falha de segurança real: a tela de Configurações (que inclui o
   cadastro de Funcionários) não tinha nenhuma checagem de permissão na
   rota** — só exigia estar logado. Qualquer funcionário, mesmo sem
   nenhuma permissão de "Configurações", conseguiria abrir essa tela
   digitando o endereço direto. Ela já tinha uma proteção interna (só
   admin vê o conteúdo), então nenhum dado sensível chegou a vazar, mas
   agora a rota em si também exige a permissão "settings" corretamente,
   fechando a brecha por completo e evitando carregar dados à toa.
2. **Menu lateral mostrava todos os itens pra todo mundo**, mesmo os que a
   pessoa não tinha permissão de acessar (ex.: um vendedor via
   "Configurações" e "Financeiro" no menu mesmo sem poder entrar) — clicar
   levava a uma tela de "sem permissão". Ruim para uma demonstração.
   Corrigido: o menu agora só mostra os itens que aquele usuário
   específico realmente pode acessar.
3. **Tela de Logs buscava os dados do banco mesmo antes de confirmar que
   quem está vendo é administrador** — a tela escondia o conteúdo
   corretamente, mas os dados já tinham sido carregados na memória do
   navegador. Corrigido para só buscar quando a pessoa é confirmadamente
   admin.

E mais um bug real encontrado durante a revisão do cadastro de clientes:
salvar qualquer alteração num cliente já existente (nome, telefone, etc.)
reenviava o **crédito antigo, desatualizado**, desfazendo silenciosamente
qualquer ajuste de crédito feito durante a mesma sessão de edição.
Corrigido — o crédito nunca mais é reenviado ao salvar outros campos.

## Status: revisado ponto a ponto, pronto para apresentação

Todos os serviços (Pedidos, Pagamentos, Crédito, Estoque, Clientes,
Funcionários, Configurações, Autenticação, Financeiro, Caixa, Despesas,
Relatórios, Agenda, Logs) foram lidos e conferidos linha a linha nesta
revisão final. Nenhum erro de sintaxe, nenhuma escrita arriscada de campo
vazio no banco, nenhuma rota sem a proteção correta, nenhum cálculo
financeiro contando pedido cancelado.

## Novo campo: Categoria do Cliente (obrigatório) no pedido

Adicionado ao formulário de Novo Pedido / Editar Pedido, logo abaixo de
Cliente/Tipo:

- **Categoria do cliente** (obrigatório): Noivo(a) / Padrinho/Madrinha /
  Debutante / Convidado(a), escolha única (rádio). Sem escolher, o sistema
  bloqueia o salvamento com a mensagem "Selecione a categoria do cliente."
- **Observações da categoria** (opcional): campo de texto livre, uso interno.

Onde aparece:
- No resumo rápido do pedido (tela de Pedidos) — categoria e observação
  (a observação só aparece se tiver sido preenchida).
- No painel de "Disponibilidade" do Estoque, ao ver quais pedidos estão
  usando um produto — nova coluna "Categoria".
- No **contrato** (tela e PDF) — aparece a categoria do cliente.
- **A observação da categoria nunca aparece em nenhum documento** (contrato,
  retirada, pedido interno) — é só para consulta interna no sistema, como
  pedido.

Pedidos criados antes dessa atualização não têm essa informação preenchida
— aparecem como "—" até serem editados e a categoria ser escolhida.
