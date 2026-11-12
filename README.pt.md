> Tradução comunitária (rascunho) — política P2-002 da NTARI, Transmissão Multilíngue Global. Fonte: README.md (original em inglês, snapshot de 2026-10-05). Rascunho comunitário assistido por máquina, pendente de revisão do mantenedor regional conforme P2-002 §3.1. As especificações técnicas centrais permanecem em inglês conforme §2.2.
>
> Notou algum erro nesta tradução? Correções de tradução são contribuições
> valiosas e muito bem-vindas: faça um fork do repositório e abra um pull
> request em https://github.com/NTARI-RAND/Agrinet.

# Agrinet - Marketplace Agrícola Descentralizado 🌱

## Visão geral

O Agrinet é uma plataforma descentralizada de comércio e serviços agrícolas, criada para aumentar a transparência, a confiança e a eficiência nos mercados agrícolas. Ele conecta produtores, consumidores e prestadores de serviços, garantindo transações seguras, avaliações baseadas em reputação e sustentabilidade econômica local.

## Funcionalidades

#### Sistema de marketplace 🏪 

- Acesso direto ao mercado: produtores anunciam produtos, serviços e contratos.
- Integração com agroturismo: agricultores podem oferecer visitas à fazenda, eventos e oficinas educativas.
- Marketplace de serviços: usuários podem prestar ou solicitar serviços agrícolas (por exemplo, logística, manutenção).

#### Transações seguras 🔒

- LBTAS (Leveson-Based Trade Assessment Scale, escala de avaliação comercial baseada em Leveson): garante um sistema de avaliação baseado em confiança.
- Gravador de diálogo: registra os principais detalhes das transações para fins de segurança e auditoria.
- Módulo de depuração automática (Machine Scrub): filtra e verifica os dados das transações.

#### Sistema de chaves e autenticação 🔑

- Geração de chaves McEliese: garante a identificação segura dos usuários.
- Limites de transmissão de chaves: aposentadoria automática após 3, 6, 9, 12 ou 365 transmissões.
- Verificação multifator: validação por e-mail/telefone com segurança de novas tentativas e bloqueio.

#### Sistema PING 📡

- Relatórios de progresso da produção: permitem que compradores de contratos acompanhem o status dos pedidos.
- Notificações em tempo real: atualizações sobre tendências de mercado, alterações de contratos e solicitações de serviço.

#### Acesso por SMS 📱

- Consulte dados de mercado e de clima por SMS usando comandos de texto simples.
- Oferece suporte a idiomas locais e enfileira mensagens offline, com confirmação de entrega.

#### Transações financeiras 🏦

- Depósitos e doações para a conta da NTARI: apoia o financiamento descentralizado.
- Pagamentos automatizados: garantem desembolsos seguros de fundos após a conclusão da transação.

#### Gestão descentralizada de dados 🌍

- Perfis e logs de usuários: mantém logs de emissão de chaves paralelos aos perfis de usuário.
- Filtragem geográfica e otimização de busca: permite a visibilidade no mercado com base na localização.

#### Calculadora de horta em pés quadrados (Square Foot Gardening) 🌿

- Recomendações de espaçamento entre plantas para culturas comuns.
- Matriz de compatibilidade para planejar o plantio consorciado.
- Projeções de crescimento e calendários sazonais, com layouts visuais em grade.

## Stack tecnológica

- Frontend: React com Next.js (estrutura de site responsiva)
- Backend: Node.js (tratamento da API)
- Banco de dados: Amazon DynamoDB (para armazenar usuários, contratos e transações)
- Segurança: OAuth 2.0 / criptografia de chaves McEliese
- Processamento em tempo real: webhooks e sistema PING

## Instalação e configuração

1. Clone o repositório
```
git clone https://github.com/YOUR_USERNAME/Fruitful.git
cd Agrinet
```

2. Configure o backend
```
cd backend
npm install
node server.js
```

3. Implante o frontend
```
cd frontend
npm install
npm run dev
```

Para desenvolvimento local, defina a variável de ambiente `NEXT_PUBLIC_BACKEND_URL` com a URL do seu backend antes de executar o frontend, por exemplo:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000 npm run dev
```
Somente as variáveis de ambiente com o prefixo `NEXT_PUBLIC_` são expostas ao navegador, por isso esse prefixo é obrigatório.
Como alternativa, configure um proxy para que as requisições para `/api` sejam encaminhadas ao backend.

### Variáveis de ambiente

O backend agora usa o Amazon DynamoDB. Defina as seguintes variáveis no seu ambiente ou no arquivo `.env`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `DYNAMODB_ENDPOINT` *(opcional, para o DynamoDB Local, por exemplo `http://localhost:8000`)*
- `TWILIO_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_STATUS_CALLBACK_URL` *(opcional, para confirmação de entrega)*

## Uso do Square Foot Gardening

O backend inclui um utilitário para planejar hortas em pés quadrados.

```javascript
const { planSeason } = require('./backend/utils/squareFootGardening');

const layout = [
  ['tomato', 'basil'],
  ['lettuce', null],
];

const plan = planSeason(layout, '2024-03-01', 'spring');
console.log(plan.grid);
console.log(plan.schedule);
```

O planejador valida o plantio consorciado, projeta cronogramas de crescimento e renderiza uma grade ASCII da horta.

## Endpoints da API

Endpoints adicionais da interface de chat (por exemplo, `/conversations`, `/messages/:id`, `/stream/:id`) e as estruturas JSON
esperadas estão documentados diretamente nos componentes do frontend
[`Sidebar.jsx`](frontend/chat-ui/src/components/Sidebar.jsx) e
[`ChatWindow.jsx`](frontend/chat-ui/src/components/ChatWindow.jsx).
### Cadastro de usuário
#### POST /userRegistration
```
{
  "name": "John Doe",
  "email": "johndoe@example.com",
  "location": "Kentucky, USA",
  "role": "producer"
}
```

### Criar contrato
#### POST /createContract
```
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

### Enviar avaliação LBTAS
#### POST /submitRating
```
{
  "transactionId": "tx987",
  "rating": 4
}
```

## Como contribuir
Contribuições da comunidade são bem-vindas! 🚀

1. Faça um fork do repositório
2. Crie um branch de funcionalidade
3. Envie um pull request

### Verificação de URLs fixas no código

Execute o script a seguir para detectar quaisquer referências a `localhost` fixas no código antes de fazer commit:

```bash
./scripts/list-hardcoded-urls.sh
```

O script lista as linhas problemáticas e encerra com status diferente de zero se alguma for encontrada.
As referências existentes reconhecidas como seguras são registradas em `scripts/hardcoded-url-allowlist.txt`.

## Licença
AGPL, GNU-3�

## Contato e suporte
- NTARI https://www.ntari.org/ 
- E-mail - tech@ntari.org
- Slack - [Participe da nossa comunidade para discussões!](https://ntari.slack.com) 
