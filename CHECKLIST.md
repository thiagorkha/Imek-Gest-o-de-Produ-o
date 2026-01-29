# Checklist de Configuração - IMEK SLEEVE

Se o erro "Erro ao registrar usuário" persistir, confira estes 5 pontos fundamentais:

## 1. Regras do Firebase (Crítico)
No console do Firebase (Firestore Database > Regras), verifique se as regras permitem escrita. 
Para testes, você pode usar:
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
*Nota: Após validar que funciona, o ideal é restringir.*

## 2. Ativação do Firestore
*   Verifique se você criou o banco de dados no modo **Firestore** e não no Realtime Database.
*   Certifique-se de que o banco de dados não está em "Modo de Leitura" (leilão expirado ou regras bloqueadas).

## 3. Credenciais em `services/firebaseService.ts`
*   Confira se o `projectId` é exatamente `imek-producao`.
*   Compare a `apiKey` com a que aparece em *Configurações do Projeto > Geral > Seus Aplicativos*.

## 4. Deploy no Render
*   **Build Command**: `npm install && npm run build`
*   **Publish Directory**: `dist`
*   **Static Site**: Certifique-se de que criou como "Static Site".

## 5. Console do Navegador (F12)
*   Se o erro ocorrer, pressione F12 e vá em **Console**.
*   Procure por mensagens em vermelho. 
    *   `Missing or insufficient permissions`: Problema nas Regras do Firebase (item 1).
    *   `Quota exceeded`: Você atingiu o limite gratuito do Firebase.
    *   `Network Error`: Bloqueio de firewall ou sem internet.