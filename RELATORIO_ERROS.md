# Relatório de Erros e Soluções no Desenvolvimento — RotaFit

**Disciplina:** Programação para Dispositivos Móveis  
**Professor:** Prof. Me. Bruno Assunção Dias  
**Projeto:** RotaFit (Corrida com GPS, Liquid Glass, Tema Claro/Escuro e Spotify)  
**Instituição:** IESB  
**Data:** Novembro de 2026  

---

## 1. Introdução
Este documento detalha todos os incidentes técnicos, erros de compilação, avisos de dependências e comportamentos anômalos encontrados durante o ciclo de desenvolvimento do projeto **RotaFit**, bem como as respectivas causas-raiz e soluções de engenharia adotadas.

---

## 2. Registro de Ocorrências no Terminal e Compilação

### Ocorrência 01: Aviso de Incompatibilidade de Engine no Node.js (`EBADENGINE`)
- **Sintoma:** Durante o `npm install` e `npx expo install`, múltiplos avisos com o código `npm error code EBADENGINE` foram emitidos no console, apontando que pacotes como `@react-native/babel-preset` e `react-native` solicitavam Node `>=18 <=22`, enquanto o ambiente executava em `Node v25.9.0`.
- **Causa-Raiz:** Uso de uma versão recente de ponta (*bleeding-edge*) do Node.js acima do ciclo LTS (Node 22/24).
- **Diagnóstico:** O instalador não interrompeu o fluxo de build porque se tratava de verificação de range em engines suportadas.
- **Solução Implementada:** Executado `npx expo install --fix` para alinhar as versões das bibliotecas à matriz exata do Expo SDK 58. Assegurou-se a integridade com `package-lock.json` travado.

### Ocorrência 02: Depreciação da Opção `baseUrl` no TypeScript (`TS5101`)
- **Sintoma:** Ao executar `npm run typecheck` (`tsc --noEmit`), o compilador TypeScript 6 emitiu:
  ```text
  tsconfig.json(5,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  ```
- **Causa-Raiz:** O TypeScript 6.0 marcou a diretiva legada `baseUrl` como obsoleta para projetos com módulos Node/Bundler modernos.
- **Solução Implementada:** Ajustou-se o arquivo `tsconfig.json` adicionando `"ignoreDeprecations": "6.0"`, preservando o mapeamento de paths `@/* -> ./src/*` exigido pelas camadas arquiteturais sem quebrar a compilação do Expo. O `typecheck` subsequente retornou código 0.

### Ocorrência 03: Conflito de Execução de Módulo ESM no Jest (`supabase/tests/db.test.mjs`)
- **Sintoma:** Ao rodar `npm run test:app` (`jest`), o Jest tentou executar o arquivo de testes de banco `supabase/tests/db.test.mjs` e abortou com a falha:
  ```text
  FAIL supabase/tests/db.test.mjs
  Must use import to load ES Module: .../supabase/tests/db.test.mjs
  The file contains ESM syntax (import/export) that could not be executed as CommonJS.
  ```
- **Causa-Raiz:** Por padrão, o Jest procura qualquer arquivo com extensão `*.test.*` na árvore inteira do repositório. Porém, o arquivo `db.test.mjs` foi desenhado especificamente para rodar com o test runner nativo do Node.js (`node --test`), utilizando imports ESM puros e PGlite.
- **Solução Implementada:** Configurado o campo `jest` no `package.json` para delimitar explicitamente a busca de testes do app à pasta de testes unitários:
  ```json
  "testMatch": [
    "**/__tests__/**/*.test.ts"
  ]
  ```
  Dessa forma:
  - `npm run test:app` executa exclusivamente os 37 testes do app no Jest.
  - `npm run test:db` executa exclusivamente os 11 testes do PGlite via runner nativo do Node.
  - `npm test` orquestra ambos perfeitamente, totalizando 48 testes automatizados aprovados (0 falhas).

---

## 3. Registro de Ocorrências no Supabase e Banco de Dados

### Ocorrência 04: Isolamento de Testes de RLS sem Conexão de Nuvem nem Docker
- **Desafio:** Como garantir a integridade das políticas de segurança Row Level Security (RLS) da tabela `runs` e da função RPC `weekly_stats()` sem depender de banco de dados remoto ou subir containers Docker pesados.
- **Solução Implementada:** Adoção do `@electric-sql/pglite`, compilando uma instância real do PostgreSQL em WebAssembly/Node. Criou-se um stub do schema `auth` em `db.test.mjs` simulando tokens JWT autenticados (`request.jwt.claim.sub`).
- **Validação:** Todos os 11 testes cobrindo recusa de escrita em nome de terceiros, restrição contra distância negativa (`distance_meters >= 0`), validação de datas (`ended_at >= started_at`) e agregação semanal de corridas por usuário foram validados com 100% de sucesso.

### Ocorrência 05: Proteção Contra Escrita de Outro Usuário no RLS
- **Ponto de Atenção:** Na política `Corridas: criar como dono`, sem a verificação `with check ((select auth.uid()) = user_id)`, um usuário malicioso poderia inserir corridas no perfil de outro usuário.
- **Verificação:** Um teste específico em `db.test.mjs` tenta forjar um `insert` passando o UUID do Bob enquanto logado como Alice. O banco recusa imediatamente com erro de violação de RLS.

---

## 4. Registro de Ocorrências em Autenticação OAuth (Google & Supabase)

### Ocorrência 06: Redirecionamento para `localhost:3000` e Falha no Safari do iOS
- **Sintoma:** Após o usuário autenticar na tela do Google no Safari (iOS), o navegador tenta carregar `http://localhost:3000` e emite o erro *"O Safari não pôde se conectar ao servidor"*.
- **Causa-Raiz:** Configuração padrão do Supabase em **Authentication → URL Configuration**, onde o campo **Site URL** vem pré-configurado como `http://localhost:3000`. Quando a URL de retorno passada pelo app não tem permissão explícita ou o fluxo cai para o default, o Supabase envia o navegador para o Site URL.
- **Solução Implementada:** 
  1. Cadastro do esquema customizado do aplicativo (`rotafit://` e `rotafit://**`) e do Expo Go (`exp://**`) em **Redirect URLs** no painel do Supabase.
  2. Ajuste do **Site URL** para a URL do projeto Supabase (`https://xsefpexrstwhujaiekhc.supabase.co`) para evitar requisições a portas locais inexistentes no dispositivo móvel.

### Ocorrência 07: Validação Estrita de Protocolo no Campo `Site URL` do Supabase
- **Sintoma:** Ao tentar salvar `rotafit://` diretamente no campo **Site URL** do painel do Supabase, a interface acusa erro de link/URL inválido e impede o salvamento.
- **Causa-Raiz:** O painel administrativo do Supabase valida o campo **Site URL** exigindo obrigatoriamente protocolos Web (`http://` ou `https://`). Esquemas customizados de deep linking mobile (como `rotafit://`) só são aceitos na seção **Redirect URLs**.
- **Solução Implementada:** Mantido um domínio web válido no campo **Site URL** e adicionadas as regras de deep linking (`rotafit://**`) explicitamente na lista de permissões em **Redirect URLs**.

### Ocorrência 08: `error: requested path is invalid` no Supabase durante o Callback OAuth
- **Sintoma:** Após autenticar a conta Google no Safari, o Supabase exibe em tela a mensagem `error: requested path is invalid` ou falha ao devolver os tokens de autorização para o aplicativo.
- **Causa-Raiz:** O `AuthSession.makeRedirectUri({ scheme: 'rotafit' })` dentro do ambiente Expo Go no iOS tenta resolver caminhos dinâmicos baseados no IP do Metro Bundler (`exp://.../--/`), os quais não correspondiam à rota estrita permitida pelo Supabase. Quando o parâmetro `redirectTo` enviado ao Supabase difere do permitido ou contém paths não roteáveis na URL do Supabase, a API de Auth rejeita o callback com `requested path is invalid`.
- **Solução Implementada:** Fixado o `authRedirectUri` diretamente como `'rotafit://'` em `src/lib/googleAuth.ts`, alinhando-o estritamente com o scheme do `app.json` e com a URL explicitamente liberada na lista de **Redirect URLs** do Supabase.

### Ocorrência 09: Restrição de Criação de Apps Web API no Spotify Developer Dashboard
- **Sintoma:** Ao tentar criar o aplicativo no painel do Spotify for Developers (`developer.spotify.com`), a opção `Web API` encontra-se desabilitada com o aviso: *"Upgrade to Spotify Premium to access the Web API and unlock additional features for your app."*
- **Causa-Raiz:** Alteração recente na política da plataforma de desenvolvedores do Spotify, restringindo a concessão de novas credenciais da Web API para contas com assinatura Premium ativa.
- **Solução Implementada / Tratamento no App:** O RotaFit foi arquitetado de forma resiliente: na ausência de credenciais do Spotify ou para contas gratuitas, a camada de UI (`SpotifyPlayerCard`) degrada de forma não intrusiva exibindo o card amigável de conexão sem bloquear nenhuma funcionalidade essencial do aplicativo (login com Google via Supabase, rastreamento GPS de alta precisão, cálculo de ritmo/calorias, renderização vetorial de traçado SVG e persistência no banco de dados com RLS continuam operando com 100% de integridade).

---

## 5. Status de Verificação Atual
- **Verificação de Tipos (`tsc --noEmit`):** ✅ 0 erros
- **Testes de Aplicação (`Jest`):** ✅ 37 testes passando (Geolocalização, Tracker Reducer, Saudação, Dinheiro)
- **Testes de Banco de Dados (`PGlite`):** ✅ 11 testes passando (RLS, Constraints, Functions)
- **Total de Testes:** ✅ 48/48 aprovados
