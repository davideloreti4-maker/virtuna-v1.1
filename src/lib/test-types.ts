import type { TestType, TestTypeConfig, TestCategory } from '@/types/test';

/**
 * Configuration for all 11 test types
 * Icons match Lucide React icon names
 */
export const TEST_TYPES: Record<TestType, TestTypeConfig> = {
  'survey': {
    id: 'survey',
    name: 'Survey',
    description: 'Create a survey to gather feedback from your target audience',
    placeholder: 'Enter your survey questions...',
    icon: 'ClipboardList',
  },
  'article': {
    id: 'article',
    name: 'Article',
    description: 'Test article content for engagement and clarity',
    placeholder: 'Paste your article content here...',
    icon: 'FileText',
  },
  'website-content': {
    id: 'website-content',
    name: 'Website Content',
    description: 'Test website copy for conversion and messaging',
    placeholder: 'Paste your website content here...',
    icon: 'Globe',
  },
  'advertisement': {
    id: 'advertisement',
    name: 'Advertisement',
    description: 'Test ad copy for effectiveness and appeal',
    placeholder: 'Paste your advertisement copy here...',
    icon: 'Megaphone',
  },
  'linkedin-post': {
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    description: 'Test LinkedIn posts for professional engagement',
    placeholder: 'Write your LinkedIn post here...',
    icon: 'Linkedin',
  },
  'instagram-post': {
    id: 'instagram-post',
    name: 'Instagram Post',
    description: 'Test Instagram captions for engagement',
    placeholder: 'Write your Instagram caption here...',
    icon: 'Instagram',
  },
  'x-post': {
    id: 'x-post',
    name: 'X Post',
    description: 'Test posts for X (formerly Twitter)',
    placeholder: 'Write your X post here...',
    icon: 'Twitter',
  },
  'tiktok-script': {
    id: 'tiktok-script',
    name: 'TikTok Script',
    description: 'Test TikTok video scripts for engagement',
    placeholder: 'Write your TikTok script here...',
    icon: 'Video',
  },
  'email-subject-line': {
    id: 'email-subject-line',
    name: 'Email Subject Line',
    description: 'Test email subject lines for open rates',
    placeholder: 'Write your email subject line here...',
    icon: 'Mail',
  },
  'email': {
    id: 'email',
    name: 'Email',
    description: 'Test full email content for engagement',
    placeholder: 'Write your email content here...',
    icon: 'Send',
  },
  'product-proposition': {
    id: 'product-proposition',
    name: 'Product Proposition',
    description: 'Test product value propositions',
    placeholder: 'Describe your product proposition here...',
    icon: 'Package',
  },
};

/**
 * Test types organized into 5 categories
 * Order matches hive visualization layout
 */
export const TEST_CATEGORIES: TestCategory[] = [
  {
    id: 'survey',
    name: 'SURVEY',
    types: ['survey'],
  },
  {
    id: 'marketing-content',
    name: 'MARKETING CONTENT',
    types: ['article', 'website-content', 'advertisement'],
  },
  {
    id: 'social-media-posts',
    name: 'SOCIAL MEDIA POSTS',
    types: ['linkedin-post', 'instagram-post', 'x-post', 'tiktok-script'],
  },
  {
    id: 'communication',
    name: 'COMMUNICATION',
    types: ['email-subject-line', 'email'],
  },
  {
    id: 'product',
    name: 'PRODUCT',
    types: ['product-proposition'],
  },
];

/**
 * Helper to get test type config by id
 */
export function getTestTypeConfig(type: TestType): TestTypeConfig {
  return TEST_TYPES[type];
}

/**
 * Get all test types as an array
 */
export function getAllTestTypes(): TestTypeConfig[] {
  return Object.values(TEST_TYPES);
}
