# Agrinet - Marketplace Agrícola Descentralizado 🌱

## Visão Geral

O Agrinet é uma plataforma descentralizada de negociação e serviços agrícolas construída para aprimorar transparência, confiança e eficiência nos mercados agrícolas. Conecta produtores, consumidores e prestadores de serviços, garantindo transações seguras, avaliações baseadas em reputação e sustentabilidade econômica localizada.

## Características

#### Sistema de Marketplace 🏪

- **Acesso Direto ao Mercado:** Produtores listam bens, serviços e contratos.
- - **Integração de Agroturismo:** Agricultores podem oferecer tours na fazenda, eventos e oficinas educacionais.
  - - **Marketplace de Serviços:** Usuários podem fornecer ou solicitar serviços agrícolas (ex: logística, manutenção).
   
    - #### Transações Seguras 🔒
   
    - - **LBTAS (Escala de Avaliação de Comércio Baseada em Leveson):** Garante um sistema de classificação baseado em confiança.
      - - **Gravador de Diálogo:** Registra detalhes-chave de transações para segurança e auditoria.
        - - **Módulo de Limpeza de Máquina:** Filtra e verifica dados de transações.
         
          - #### Sistema de Autenticação e Chaves 🔑
         
          - - **Geração de Chaves McEliese:** Garante identificação segura do usuário.
            - - **Limites de Transmissão de Chaves:** Auto-aposentadoria após 3, 6, 9, 12 ou 365 transmissões.
              - - **Verificação Multi-Fator:** Validação de email/telefone com segurança de repetição e bloqueio.
               
                - #### Sistema PING 📡
               
                - - **Relatório de Progresso de Produção:** Permite que compradores de contratos rastreiem status de pedidos.
                  - - **Notificações em Tempo Real:** Atualizações sobre tendências de mercado, mudanças de contratos e solicitações de serviço.
                   
                    - #### Acesso via SMS 📱
                   
                    - - **Consultar dados de mercado e clima via SMS** usando comandos de texto simples.
                      - - **Suporta idiomas locais** e enfileira mensagens offline com confirmação de entrega.
                       
                        - #### Transações Financeiras 🏦
                       
                        - - **Depósitos e Doações para Conta NTARI:** Suporta financiamento descentralizado.
                          - - **Pagamentos Automatizados:** Garante desembolso seguro de fundos após conclusão da transação.
                           
                            - #### Gerenciamento de Dados Descentralizado 🌍
                           
                            - - **Perfis de Usuário e Logs:** Mantém registros de emissão de chaves paralelos aos perfis de usuário.
                              - - **Filtragem Geográfica e Otimização de Busca:** Permite visibilidade de mercado baseada em localização.
                               
                                - #### Calculadora de Jardinagem em Metragem Quadrada 🌿
                               
                                - - Recomendações de espaçamento de plantas para culturas comuns.
                                  - - Matriz de compatibilidade para planejamento de cultivos consorciados.
                                    - - Projeções de crescimento e cronogramas sazonais com layouts de grade visual.
                                     
                                      - ## Pilha Tecnológica
                                     
                                      - - **Frontend:** React com Next.js (estrutura de site responsiva)
                                        - - **Backend:** Node.js (tratamento de API)
                                          - - **Banco de Dados:** Amazon DynamoDB (para armazenar usuários, contratos e transações)
                                            - - **Segurança:** OAuth 2.0 / Criptografia de Chave McEliese
                                              - - **Processamento em Tempo Real:** Webhooks & Sistema PING
                                               
                                                - ## Instalação e Configuração
                                               
                                                - 1. **Clone o repositório**
                                                  2. ```
                                                     git clone https://github.com/SEU_USUARIO/Fruitful.git
                                                     cd Agrinet
                                                     ```

                                                     2. **Configure o backend**
                                                     3. ```
                                                        cd backend
                                                        npm install
                                                        node server.js
                                                        ```

                                                        3. **Implante o frontend**
                                                        4. ```
                                                           cd frontend
                                                           npm install
                                                           npm run dev
                                                           ```

                                                           Para desenvolvimento local, defina a variável de ambiente `NEXT_PUBLIC_BACKEND_URL` para a URL do seu backend antes de executar o frontend, por exemplo:
                                                           ```
                                                           NEXT_PUBLIC_BACKEND_URL=http://localhost:5000 npm run dev
                                                           ```

                                                           Apenas variáveis de ambiente prefixadas com `NEXT_PUBLIC_` são expostas ao navegador, portanto este prefixo é obrigatório. Como alternativa, configure um proxy para que as solicitações para `/api` sejam encaminhadas para o backend.

                                                           ### Variáveis de Ambiente

                                                           O backend agora usa Amazon DynamoDB. Defina as seguintes variáveis em seu ambiente ou arquivo `.env`:

                                                           - `AWS_ACCESS_KEY_ID`
                                                           - - `AWS_SECRET_ACCESS_KEY`
                                                             - - `AWS_REGION`
                                                               - - `DYNAMODB_ENDPOINT` *(opcional, para DynamoDB Local, ex: `http://localhost:8000`)*
                                                                 - - `TWILIO_SID`
                                                                   - - `TWILIO_AUTH_TOKEN`
                                                                     - - `TWILIO_FROM_NUMBER`
                                                                       - - `TWILIO_STATUS_CALLBACK_URL` *(opcional para confirmação de entrega)*
                                                                        
                                                                         - ## Uso da Calculadora de Jardinagem em Metragem Quadrada
                                                                        
                                                                         - O backend inclui um utilitário para planejamento de jardins em metragem quadrada.
                                                                        
                                                                         - ```javascript
                                                                           const { planSeason } = require('./backend/utils/squareFootGardening');

                                                                           const layout = [
                                                                             ['tomato', 'basil'],
                                                                             ['lettuce', null],
                                                                           ];

                                                                           const plan = planSeason(layout, '2024-03-01', 'spring');
                                                                           console.log(plan.grid);
                                                                           console.log(plan.schedule);
                                                                           ```

                                                                           O planejador valida cultivos consorciados, projeta cronogramas de crescimento e renderiza uma grade ASCII do jardim.

                                                                           ## Endpoints da API

                                                                           Endpoints de interface de chat adicionais (ex: `/conversations`, `/messages/:id`, `/stream/:id`) e suas estruturas JSON esperadas estão documentados inline nos componentes do frontend [`Sidebar.jsx`](frontend/chat-ui/src/components/Sidebar.jsx) e [`ChatWindow.jsx`](frontend/chat-ui/src/components/ChatWindow.jsx).

                                                                           ### Registro de Usuário

                                                                           #### POST /userRegistration
                                                                           ```json
                                                                           {
                                                                             "name": "John Doe",
                                                                             "email": "johndoe@example.com",
                                                                             "location": "Kentucky, USA",
                                                                             "role": "producer"
                                                                           }
                                                                           ```

                                                                           ### Criar Contrato

                                                                           #### POST /createContract
                                                                           ```json
                                                                           {
                                                                             "producerId": "user123",
                                                                             "type": "Tomato",
                                                                             "variety": "Roma",
                                                                             "category": "food",
                                                                             "amountNeeded": "500 lbs",
                                                                             "dateNeeded": "2025-03-15",
                                                                             "pingRate": "weekly"
                                                                           }
                                                                           ```

                                                                           ### Enviar Classificação LBTAS

                                                                           #### POST /submitRating
                                                                           ```json
                                                                           {
                                                                             "transactionId": "tx987",
                                                                             "rating": 4
                                                                           }
                                                                           ```

                                                                           ## Contribuindo

                                                                           Recebemos contribuições da comunidade! 🚀

                                                                           1. Faça um fork do repositório
                                                                           2. 2. Crie um branch de funcionalidade
                                                                              3. 3. Envie um pull request
                                                                                
                                                                                 4. ### Verificando URLs Codificadas
                                                                                
                                                                                 5. Execute o seguinte script para detectar referências `localhost` codificadas antes de fazer commit do código:
                                                                                
                                                                                 6. ```bash
                                                                                    ./scripts/list-hardcoded-urls.sh
                                                                                    ```

                                                                                    O script lista linhas problemáticas e sai com status não-zero se alguma for encontrada. As referências existentes conhecidas como seguras são rastreadas em `scripts/hardcoded-url-allowlist.txt`.

                                                                                    ## Licença

                                                                                    AGPL, GNU-3.0

                                                                                    ## Contato e Suporte

                                                                                    - NTARI https://www.ntari.org/
                                                                                    - - Email - tech@ntari.org
                                                                                      - - Slack - [Junte-se à nossa comunidade para discussões!](https://ntari.slack.com)
