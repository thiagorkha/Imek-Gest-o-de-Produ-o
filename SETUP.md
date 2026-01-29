
# Guia de Configuração e Deploy - IMEK

Este documento descreve os passos necessários para configurar o backend no Firebase e realizar o deploy da aplicação no Render.

## 1. Configuração do Firebase

O aplicativo utiliza o **Cloud Firestore** para armazenar usuários e registros de produção.

### Passo a Passo:
1.  Acesse o [Console do Firebase](https://console.firebase.google.com/).
2.  Crie um projeto e ative o **Firestore Database**.
3.  Configure as regras para permitir acesso (conforme detalhado anteriormente).
4.  Crie um aplicativo Web e copie as credenciais para o arquivo `services/firebaseService.ts`.

---

## 2. Deploy no Render (Static Site)

O projeto está configurado para ser transpilado via Vite.

### Configuração no Painel do Render:
1.  Crie um novo **Static Site**.
2.  **Build Command**: `npm install --legacy-peer-deps && npm run build`
3.  **Publish Directory**: `dist`

---

## 3. Estrutura de Usuários e PWA
*   O aplicativo é um PWA instalável. Use o botão no rodapé para instalar no Android, iOS ou Desktop.
*   Usuário **admin** (nome: `admin`) tem acesso aos relatórios e exportação para Excel.
