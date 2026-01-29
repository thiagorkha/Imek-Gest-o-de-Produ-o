
# Guia de Configuração e Deploy - IMEK

Este documento descreve os passos necessários para configurar o backend no Firebase e realizar o deploy da aplicação no Render.

## 1. Configuração do Firebase

O aplicativo utiliza o **Cloud Firestore** para armazenar usuários e registros de produção.

### Passo a Passo:
1.  Acesse o [Console do Firebase](https://console.firebase.google.com/).
2.  Clique em **"Adicionar projeto"** e dê um nome (ex: `imek-producao`).
3.  No painel lateral, vá em **Criação > Firestore Database**.
4.  Clique em **"Criar banco de dados"**. Selecione o modo de produção ou teste (recomenda-se teste para configuração inicial, depois ajuste as regras).
5.  Em **Regras**, utilize a configuração básica para permitir leitura e escrita (ajuste conforme a necessidade de segurança):
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if true;
        }
      }
    }
    ```
6.  Vá em **Configurações do Projeto** (ícone de engrenagem) > **Geral**.
7.  Em "Seus aplicativos", clique no ícone de Web (`</>`) para registrar o app.
8.  Copie as credenciais geradas (`apiKey`, `authDomain`, `projectId`, etc).
9.  No código do arquivo `services/firebaseService.ts`, substitua os valores do objeto `firebaseConfig` pelas suas credenciais ou configure a variável de ambiente `API_KEY` no Render.

---

## 2. Deploy no Render

O Render é excelente para hospedar aplicações estáticas ou baseadas em Node.js.

### Passo a Passo:
1.  Suba o código deste projeto para um repositório no **GitHub** ou **GitLab**.
2.  Acesse o painel do [Render](https://dashboard.render.com/).
3.  Clique em **New +** > **Static Site**.
4.  Conecte seu repositório.
5.  **Configurações de Build:**
    *   **Name:** `imek-producao`
    *   **Build Command:** (Se estiver usando um bundler como Vite/Webpack: `npm run build`. Se for apenas os arquivos estáticos fornecidos: deixe em branco ou use `mkdir dist && cp -r * dist`).
    *   **Publish Directory:** `.` (ou a pasta gerada pelo seu build).
6.  **Variáveis de Ambiente:**
    *   Vá na aba **Environment**.
    *   Adicione a chave `API_KEY` com o valor da sua **Web API Key** do Firebase.
7.  Clique em **Create Static Site**.
8.  Aguarde o build terminar. O Render fornecerá uma URL (ex: `https://imek-producao.onrender.com`).

---

## 3. Ativação do PWA

Para que o botão de instalação funcione corretamente:
1.  Certifique-se de que o site está sendo servido via **HTTPS** (o Render faz isso automaticamente).
2.  Verifique se o arquivo `sw.js` e `manifest.json` estão na raiz do projeto durante o deploy.
3.  No desktop (Chrome/Edge), um ícone de "instalar" aparecerá na barra de endereços. No mobile, o navegador sugerirá "Adicionar à tela de início".

---

## 4. Estrutura de Usuários
*   **Primeiro Acesso:** Use a tela de cadastro para criar seu usuário.
*   **Administrador:** Para habilitar o menu de gestão, cadastre um usuário com o nome exatamente igual a `admin` (case insensitive). O sistema o reconhecerá automaticamente como `UserRole.ADMIN`.
