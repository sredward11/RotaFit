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

## 4. Status de Verificação Atual
- **Verificação de Tipos (`tsc --noEmit`):** ✅ 0 erros
- **Testes de Aplicação (`Jest`):** ✅ 37 testes passando (Geolocalização, Tracker Reducer, Saudação, Dinheiro)
- **Testes de Banco de Dados (`PGlite`):** ✅ 11 testes passando (RLS, Constraints, Functions)
- **Total de Testes:** ✅ 48/48 aprovados
