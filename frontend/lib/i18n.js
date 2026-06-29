'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/*
 * Lightweight i18n for Agrinet.
 *
 * Translations are keyed by the ORIGINAL Portuguese source string, so:
 *   - in 'pt' mode, t('Entrar') returns 'Entrar' (the key itself);
 *   - in 'en' mode, t('Entrar') returns EN['Entrar'] ?? 'Entrar'.
 * This keeps the retrofit mechanical (wrap existing strings) and lets us add
 * more languages later by adding another map.
 */
const EN = {
  // ── Nav / auth ──
  'Início': 'Home',
  'Marketplace': 'Marketplace',
  'Chat': 'Chat',
  'Perfil': 'Profile',
  'Admin': 'Admin',
  'Mercado': 'Market',
  'Entrar': 'Sign in',
  'Cadastrar': 'Sign up',
  'Sair da conta': 'Sign out',
  'Sair': 'Sign out',
  'Criar conta': 'Create account',
  'E-mail': 'Email',
  'Senha': 'Password',
  'Aguarde...': 'Please wait...',
  'Marketplace agrícola descentralizado': 'Decentralized agricultural marketplace',
  'Clique em Entrar sem preencher para modo demo': 'Click Sign in without filling the fields for demo mode',
  'Bem-vindo ao Agrinet!': 'Welcome to Agrinet!',
  'Conta criada!': 'Account created!',
  'Modo demo — backend offline': 'Demo mode — backend offline',

  // ── Category / status / history labels (from lib/format.js) ──
  'Grãos': 'Grains',
  'Frutas': 'Fruits',
  'Pecuária': 'Livestock',
  'Máquinas': 'Machinery',
  'Outros': 'Other',
  'Depósito recebido': 'Deposit received',
  'Compra realizada': 'Purchase completed',
  'Venda recebida': 'Sale received',
  'Reembolso': 'Refund',
  'Saque': 'Withdrawal',
  'Pendente': 'Pending',
  'Pago': 'Paid',
  'Concluído': 'Completed',
  'Cancelado': 'Cancelled',
  'Em disputa': 'In dispute',
  'Reembolsado': 'Refunded',
  'Ativo': 'Active',
  'Pausado': 'Paused',
  'Vendido': 'Sold',
  'Aberta': 'Open',
  'Confirmado': 'Confirmed',
  'Falhou': 'Failed',

  // ── Listing card / detail ──
  'Últimas unidades': 'Last units',
  'disponível': 'available',
  'Disponível': 'Available',
  'Informe a quantidade': 'Enter the quantity',
  'Compra iniciada! Acesse seu perfil para pagar.': 'Purchase started! Go to your profile to pay.',
  'por': 'per',
  'Quantidade': 'Quantity',
  'Ex:': 'e.g.',
  'Total estimado': 'Estimated total',
  'Comprar agora': 'Buy now',
  'Cancelar': 'Cancel',

  // ── Landing page ──
  'Escolha o produto': 'Choose the product',
  'Busque entre centenas de produtores por categoria, região e preço.': 'Search hundreds of producers by category, region and price.',
  'Negocie diretamente': 'Negotiate directly',
  'Converse com o produtor pelo chat integrado antes de fechar negócio.': 'Chat with the producer directly before closing the deal.',
  'Pague com segurança': 'Pay securely',
  'O valor fica em escrow. Ninguém recebe antes da confirmação.': 'The amount is held in escrow. No one is paid before confirmation.',
  'Confirme e avalie': 'Confirm and rate',
  'Recebeu? Confirme e o produtor recebe na hora. Simples assim.': 'Received it? Confirm and the producer gets paid instantly. Simple as that.',
  'Tudo': 'All',
  'Grãos & Cereais': 'Grains & Cereals',
  'Frutas & Hortaliças': 'Fruits & Vegetables',
  'Insumos': 'Supplies',
  'Marketplace Agrícola Descentralizado': 'Decentralized Agricultural Marketplace',
  'O campo': 'The field',
  'conectado': 'connected',
  'ao mercado': 'to the market',
  'Compre e venda commodities agrícolas com segurança. Escrow garantido, pagamento protegido. Da roça ao comprador, sem intermediários.': 'Buy and sell agricultural commodities safely. Guaranteed escrow, protected payments. From the farm to the buyer, no middlemen.',
  'Explorar produtos': 'Browse products',
  'Vender no Agrinet': 'Sell on Agrinet',
  'Negociados no mês': 'Traded this month',
  'Produtores ativos': 'Active producers',
  'Transações seguras': 'Secure transactions',
  'Pagamento com Escrow': 'Escrow Payment',
  'Seu dinheiro só é liberado após confirmação da entrega': 'Your money is only released after delivery is confirmed',
  'Seguro': 'Secure',
  'Destaques': 'Highlights',
  'Produtos em destaque': 'Featured products',
  'Ver todos': 'See all',
  'Como funciona': 'How it works',
  'Simples, seguro e transparente': 'Simple, secure and transparent',
  'Transacionados este mês': 'Traded this month',
  'Produtores cadastrados': 'Registered producers',
  '18 estados': '18 states',
  'Cobertura nacional': 'Nationwide coverage',
  'Resolução de disputas': 'Dispute resolution',
  'Comece agora': 'Get started',
  'Pronto para vender sua produção?': 'Ready to sell your harvest?',
  'Crie sua conta grátis e publique seu primeiro anúncio em minutos.': 'Create your free account and post your first listing in minutes.',
  'Criar conta grátis': 'Create free account',
  'Ver marketplace': 'View marketplace',

  // ── Marketplace ──
  'Todos': 'All',
  'Faça login para anunciar': 'Sign in to post a listing',
  'Produtos agrícolas de produtores de todo o Brasil': 'Agricultural products from producers across Brazil',
  'Buscar produto ou cidade...': 'Search product or city...',
  'Buscar': 'Search',
  'Anunciar': 'Post listing',
  'Filtros': 'Filters',
  'Estado': 'State',
  'Preço (R$)': 'Price (R$)',
  'Mín': 'Min',
  'Máx': 'Max',
  'Aplicar filtros': 'Apply filters',
  'Ordenar por': 'Sort by',
  'Mais recentes': 'Most recent',
  'Menor preço': 'Lowest price',
  'Maior preço': 'Highest price',
  'Buscando...': 'Searching...',
  'produto encontrado': 'product found',
  'produtos encontrados': 'products found',
  'Nenhum produto encontrado': 'No products found',
  'Limpar filtros': 'Clear filters',

  // ── New listing modal ──
  'Informações': 'Details',
  'Fotos': 'Photos',
  'Revisão': 'Review',
  'Enviando...': 'Uploading...',
  'Solte as fotos aqui': 'Drop the photos here',
  'Arraste fotos ou clique para selecionar': 'Drag photos or click to select',
  'Até 5 fotos · JPG, PNG, WebP · Máx 8 MB cada': 'Up to 5 photos · JPG, PNG, WebP · Max 8 MB each',
  'Capa': 'Cover',
  'Preencha os campos obrigatórios': 'Fill in the required fields',
  'Anúncio publicado com sucesso!': 'Listing published successfully!',
  'Publicar anúncio': 'Publish listing',
  'Título *': 'Title *',
  'Ex: Soja Safra 2025 — Tipo 1': 'e.g. Soybean Harvest 2025 — Type 1',
  'Categoria': 'Category',
  'Unidade': 'Unit',
  'Saca (60kg)': 'Bag (60kg)',
  'Quilograma (kg)': 'Kilogram (kg)',
  'Tonelada': 'Ton',
  'Cabeça': 'Head',
  'Caixa': 'Box',
  'Preço (R$) *': 'Price (R$) *',
  'Quantidade disponível': 'Quantity available',
  'Cidade *': 'City *',
  'Ex: Ribeirão Preto': 'e.g. Ribeirão Preto',
  'Estado (UF) *': 'State *',
  'Descrição': 'Description',
  'Descreva a qualidade, variedade, condições de entrega...': 'Describe the quality, variety, delivery conditions...',
  'Adicione fotos do produto. Boas imagens aumentam as chances de venda.': 'Add photos of the product. Good images increase the chances of a sale.',
  'Preço': 'Price',
  'Localização': 'Location',
  'Ao publicar, seu anúncio passará por moderação automática.': 'Once published, your listing will go through automatic moderation.',
  'Voltar': 'Back',
  'Próximo': 'Next',
  'Publicando...': 'Publishing...',

  // ── Chat ──
  'Usuário': 'User',
  'Nenhuma mensagem': 'No messages',
  'Mensagens': 'Messages',
  'Buscar conversa...': 'Search conversation...',
  'Nenhuma conversa': 'No conversations',
  'Inicie uma negociação pelo marketplace para começar a trocar mensagens.': 'Start a deal from the marketplace to begin exchanging messages.',
  'Explorar marketplace': 'Explore marketplace',
  'Ver anúncio': 'View listing',
  'Nenhuma mensagem ainda': 'No messages yet',
  'Diga olá e comece a negociar!': 'Say hello and start negotiating!',
  'Escrever mensagem...': 'Write a message...',

  // ── Admin ──
  'Usuários': 'Users',
  'Anúncios ativos': 'Active listings',
  'Transações hoje': 'Transactions today',
  'Disputas abertas': 'Open disputes',
  'Anúncios': 'Listings',
  'Disputas': 'Disputes',
  'Fila de fraude': 'Fraud queue',
  'Pagamentos': 'Payments',
  'Painel Administrativo': 'Admin Panel',
  'Gestão de usuários, anúncios, disputas e fraudes': 'Manage users, listings, disputes and fraud',
  'Nenhum item encontrado': 'No items found',
  'Fraude': 'Fraud',
  'Ações': 'Actions',
  'Bloqueado': 'Blocked',
  'Desbloquear': 'Unblock',
  'Bloquear': 'Block',
  'Produto': 'Product',
  'Moderação': 'Moderation',
  'Remover': 'Remove',
  'Motivo': 'Reason',
  'Liberar': 'Release',
  'Reembolsar': 'Refund',
  'Aprovar': 'Approve',
  'Valor': 'Amount',
  'Data': 'Date',
  'com sucesso': 'successfully',
  'Desbloqueado': 'Unblocked',
  'Removido': 'Removed',
  'Liberado': 'Released',
  'Aprovado': 'Approved',

  // ── Profile / wallet ──
  'Informe um valor': 'Enter an amount',
  'PaymentIntent criado! Verifique o e-mail.': 'PaymentIntent created! Check your email.',
  'Pagamento iniciado!': 'Payment started!',
  'Escrow liberado!': 'Escrow released!',
  'Motivo da disputa:': 'Dispute reason:',
  'Disputa aberta': 'Dispute opened',
  'Transações': 'Transactions',
  'Meus anúncios': 'My listings',
  'Saldo disponível': 'Available balance',
  'Depositar': 'Deposit',
  'Resumo': 'Summary',
  'Total depositado': 'Total deposited',
  'Total gasto': 'Total spent',
  'Recebido em vendas': 'Received from sales',
  'Histórico de movimentações': 'Transaction history',
  'Nenhuma movimentação': 'No transactions',
  'Nenhuma transação ainda': 'No transactions yet',
  'Compra': 'Purchase',
  'Venda': 'Sale',
  'Pagar': 'Pay',
  'Disputar': 'Dispute',
  'Ver': 'View',
  'Seus anúncios publicados': 'Your published listings',
  'Novo anúncio': 'New listing',
  'Nenhum anúncio publicado': 'No listings published',
  'Criar primeiro anúncio': 'Create your first listing',
  'Depositar na wallet': 'Deposit to wallet',
  'Valor (R$)': 'Amount (R$)',
  'Pagamento processado com segurança via Stripe. Saldo creditado instantaneamente.': 'Payment processed securely via Stripe. Balance credited instantly.',
  'Processando...': 'Processing...',
  'Confirmar depósito': 'Confirm deposit',
  'Detalhes da transação': 'Transaction details',
  'Escrow ativo': 'Escrow active',
  'Preço unitário': 'Unit price',
  'Criada em': 'Created on',
};

const DICTS = { pt: null, en: EN };
const LANG_KEY = 'agri_lang';

const I18nContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }) {
  // Deterministic initial value for SSR/first paint; real value resolved on mount.
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    let initial = 'en';
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'pt' || saved === 'en') {
        initial = saved;
      } else if (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('pt')) {
        initial = 'pt';
      }
    } catch { /* localStorage unavailable */ }
    setLangState(initial);
    document.documentElement.lang = initial === 'pt' ? 'pt-BR' : 'en';
  }, []);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
  }, []);

  const t = useCallback((s) => {
    const dict = DICTS[lang];
    if (!dict) return s;            // pt: source string IS the key
    return dict[s] ?? s;            // en: fall back to source if untranslated
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
