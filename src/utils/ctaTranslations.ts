/**
 * Mapping of Meta Ads CTA types to Portuguese labels
 */
const ctaTranslations: Record<string, string> = {
  // Shopping & E-commerce
  'SHOP_NOW': 'Comprar Agora',
  'BUY_NOW': 'Comprar Agora',
  'BUY': 'Comprar',
  'ADD_TO_CART': 'Adicionar ao Carrinho',
  'ORDER_NOW': 'Pedir Agora',
  'GET_OFFER': 'Ver Oferta',
  'GET_QUOTE': 'Solicitar Orçamento',
  'REQUEST_QUOTE': 'Solicitar Orçamento',
  
  // Information & Learning
  'LEARN_MORE': 'Saiba Mais',
  'SEE_MORE': 'Ver Mais',
  'WATCH_MORE': 'Assistir Mais',
  'READ_MORE': 'Leia Mais',
  'FIND_OUT_MORE': 'Descubra Mais',
  
  // Contact & Communication
  'CONTACT_US': 'Fale Conosco',
  'CALL_NOW': 'Ligue Agora',
  'CALL': 'Ligar',
  'MESSAGE_US': 'Enviar Mensagem',
  'SEND_MESSAGE': 'Enviar Mensagem',
  'WHATSAPP_MESSAGE': 'Enviar Mensagem no WhatsApp',
  'SEND_WHATSAPP_MESSAGE': 'Enviar no WhatsApp',
  'GET_DIRECTIONS': 'Como Chegar',
  'EMAIL': 'Enviar E-mail',
  
  // Actions & Engagement
  'SIGN_UP': 'Cadastrar',
  'SUBSCRIBE': 'Inscrever-se',
  'REGISTER_NOW': 'Registrar Agora',
  'BOOK_NOW': 'Agendar',
  'BOOK_TRAVEL': 'Reservar Viagem',
  'RESERVE': 'Reservar',
  'SCHEDULE': 'Agendar',
  'APPLY_NOW': 'Candidatar-se',
  'APPLY': 'Candidatar-se',
  'DOWNLOAD': 'Baixar',
  'INSTALL_APP': 'Instalar App',
  'USE_APP': 'Usar App',
  'INSTALL_MOBILE_APP': 'Instalar App',
  'GET_APP': 'Baixar App',
  'PLAY_GAME': 'Jogar',
  'PLAY_GAME_ON_FACEBOOK': 'Jogar no Facebook',
  
  // Events & Entertainment
  'WATCH_VIDEO': 'Assistir Vídeo',
  'LISTEN_MUSIC': 'Ouvir Música',
  'LISTEN_NOW': 'Ouvir Agora',
  'EVENT_RSVP': 'Confirmar Presença',
  'INTERESTED': 'Tenho Interesse',
  'GET_TICKETS': 'Comprar Ingressos',
  'BUY_TICKETS': 'Comprar Ingressos',
  
  // Financial & Services
  'DONATE': 'Doar',
  'DONATE_NOW': 'Doar Agora',
  'REQUEST_TIME': 'Agendar Horário',
  'GET_SHOWTIMES': 'Ver Horários',
  'SEE_MENU': 'Ver Cardápio',
  'OPEN_LINK': 'Abrir Link',
  'VISIT_PAGES_FEED': 'Visitar Página',
  
  // Specific Actions
  'LIKE_PAGE': 'Curtir Página',
  'FOLLOW_PAGE': 'Seguir Página',
  'FOLLOW_USER': 'Seguir',
  'SHARE': 'Compartilhar',
  'SAVE': 'Salvar',
  'VOTE_NOW': 'Votar Agora',
  
  // Generic
  'NO_BUTTON': 'Sem Botão',
  'NONE': 'Sem CTA',
};

/**
 * Translates a Meta Ads CTA type to Portuguese
 * @param ctaType - The original CTA type from Meta API (e.g., "LEARN_MORE")
 * @returns The translated CTA in Portuguese (e.g., "Saiba Mais")
 */
export function translateCTA(ctaType: string | null | undefined): string {
  if (!ctaType) return '';
  
  // Clean up the CTA type (remove extra spaces, uppercase)
  const cleanCta = ctaType.trim().toUpperCase();
  
  // Try to find exact match
  if (ctaTranslations[cleanCta]) {
    return ctaTranslations[cleanCta];
  }
  
  // Try with underscores replaced by spaces and back
  const withUnderscores = cleanCta.replace(/ /g, '_');
  if (ctaTranslations[withUnderscores]) {
    return ctaTranslations[withUnderscores];
  }
  
  // Fallback: Format the CTA to be more readable
  // Convert LEARN_MORE to "Learn More" style, then title case
  return ctaType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Gets the translated CTA with a fallback
 * @param ctaType - The original CTA type from Meta API
 * @param fallback - Fallback text if CTA is empty
 * @returns The translated CTA or fallback
 */
export function getCtaLabel(ctaType: string | null | undefined, fallback: string = 'Sem CTA'): string {
  const translated = translateCTA(ctaType);
  return translated || fallback;
}
