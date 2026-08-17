export interface ServiceMeta {
  name: string;
  category: 'work' | 'personal' | 'finance' | 'social' | 'other';
  color: string;
  bgGradient: string;
  iconName: string;
}

const SERVICE_MAP: Record<string, ServiceMeta> = {
  google: {
    name: 'Google',
    category: 'personal',
    color: '#4285f4',
    bgGradient: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
    iconName: 'google'
  },
  github: {
    name: 'GitHub',
    category: 'work',
    color: '#f0f6fc',
    bgGradient: 'linear-gradient(135deg, #24292e 0%, #0d1117 100%)',
    iconName: 'github'
  },
  telegram: {
    name: 'Telegram',
    category: 'social',
    color: '#229ed9',
    bgGradient: 'linear-gradient(135deg, #2aabee 0%, #229ed9 100%)',
    iconName: 'send'
  },
  discord: {
    name: 'Discord',
    category: 'social',
    color: '#5865f2',
    bgGradient: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
    iconName: 'message-square'
  },
  binance: {
    name: 'Binance',
    category: 'finance',
    color: '#f0b90b',
    bgGradient: 'linear-gradient(135deg, #f0b90b 0%, #d49e00 100%)',
    iconName: 'coins'
  },
  bybit: {
    name: 'Bybit',
    category: 'finance',
    color: '#f7a600',
    bgGradient: 'linear-gradient(135deg, #f7a600 0%, #e08c00 100%)',
    iconName: 'trending-up'
  },
  apple: {
    name: 'Apple',
    category: 'personal',
    color: '#a2aaad',
    bgGradient: 'linear-gradient(135deg, #333336 0%, #1d1d1f 100%)',
    iconName: 'apple'
  },
  microsoft: {
    name: 'Microsoft',
    category: 'work',
    color: '#00a4ef',
    bgGradient: 'linear-gradient(135deg, #00a4ef 0%, #7fba00 100%)',
    iconName: 'layout-grid'
  },
  aws: {
    name: 'Amazon Web Services',
    category: 'work',
    color: '#ff9900',
    bgGradient: 'linear-gradient(135deg, #232f3e 0%, #ff9900 100%)',
    iconName: 'cloud'
  },
  openai: {
    name: 'OpenAI / ChatGPT',
    category: 'work',
    color: '#10a37f',
    bgGradient: 'linear-gradient(135deg, #10a37f 0%, #007755 100%)',
    iconName: 'sparkles'
  },
  cloudflare: {
    name: 'Cloudflare',
    category: 'work',
    color: '#f38020',
    bgGradient: 'linear-gradient(135deg, #faad3f 0%, #f38020 100%)',
    iconName: 'shield'
  },
  twitter: {
    name: 'X (Twitter)',
    category: 'social',
    color: '#ffffff',
    bgGradient: 'linear-gradient(135deg, #1d1d1f 0%, #000000 100%)',
    iconName: 'twitter'
  },
  meta: {
    name: 'Meta / Facebook',
    category: 'social',
    color: '#0080fb',
    bgGradient: 'linear-gradient(135deg, #0080fb 0%, #0064e0 100%)',
    iconName: 'share-2'
  },
  instagram: {
    name: 'Instagram',
    category: 'social',
    color: '#e1306c',
    bgGradient: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
    iconName: 'camera'
  },
  steam: {
    name: 'Steam',
    category: 'other',
    color: '#171a21',
    bgGradient: 'linear-gradient(135deg, #1b2838 0%, #2a475e 100%)',
    iconName: 'gamepad-2'
  },
  proton: {
    name: 'Proton',
    category: 'personal',
    color: '#6d4aff',
    bgGradient: 'linear-gradient(135deg, #6d4aff 0%, #5227d8 100%)',
    iconName: 'lock'
  },
  stripe: {
    name: 'Stripe',
    category: 'finance',
    color: '#635bff',
    bgGradient: 'linear-gradient(135deg, #635bff 0%, #0a2540 100%)',
    iconName: 'credit-card'
  },
  slack: {
    name: 'Slack',
    category: 'work',
    color: '#4a154b',
    bgGradient: 'linear-gradient(135deg, #ecb22e 0%, #e01e5a 50%, #2eb67d 100%)',
    iconName: 'hash'
  },
  notion: {
    name: 'Notion',
    category: 'work',
    color: '#ffffff',
    bgGradient: 'linear-gradient(135deg, #2e2e2e 0%, #000000 100%)',
    iconName: 'file-text'
  }
};

/**
 * Detect service metadata based on issuer or account label
 */
export function detectServiceMeta(issuer: string, accountName: string = ''): ServiceMeta {
  const query = `${issuer} ${accountName}`.toLowerCase();

  for (const [key, meta] of Object.entries(SERVICE_MAP)) {
    if (query.includes(key)) {
      return meta;
    }
  }

  // Fallback default avatar generator based on first letters
  const nameHash = issuer.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = nameHash % 360;

  return {
    name: issuer,
    category: 'other',
    color: `hsl(${hue}, 70%, 55%)`,
    bgGradient: `linear-gradient(135deg, hsl(${hue}, 65%, 45%) 0%, hsl(${(hue + 40) % 360}, 65%, 35%) 100%)`,
    iconName: 'key'
  };
}
