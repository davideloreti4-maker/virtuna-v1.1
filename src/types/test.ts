/**
 * Test type definitions for content testing
 */

/**
 * Impact score label based on performance
 */
export type ImpactLabel = 'Poor' | 'Below Average' | 'Average' | 'Good' | 'Excellent';

/**
 * A content variant (original or AI-generated)
 */
export interface Variant {
  id: string;
  type: 'original' | 'ai-generated';
  content: string;
  impactScore: number;
  label?: string;
}

/**
 * A theme identified from conversation analysis
 */
export interface ConversationTheme {
  id: string;
  title: string;
  percentage: number;
  description: string;
  quotes: string[];
}

/**
 * All available test types in the application
 */
export type TestType =
  | 'survey'
  | 'article'
  | 'website-content'
  | 'advertisement'
  | 'linkedin-post'
  | 'instagram-post'
  | 'x-post'
  | 'tiktok-script'
  | 'email-subject-line'
  | 'email'
  | 'product-proposition';

/**
 * Lucide icon names used for test types
 */
export type TestTypeIcon =
  | 'ClipboardList'
  | 'FileText'
  | 'Globe'
  | 'Megaphone'
  | 'Linkedin'
  | 'Instagram'
  | 'Twitter'
  | 'Video'
  | 'Mail'
  | 'Send'
  | 'Package';

/**
 * Configuration for a single test type
 */
export interface TestTypeConfig {
  id: TestType;
  name: string;
  description: string;
  placeholder: string;
  icon: TestTypeIcon;
}

/**
 * Category grouping for test types
 */
export interface TestCategory {
  id: string;
  name: string;
  types: TestType[];
}

/**
 * Result from a test simulation
 */
export interface TestResult {
  id: string;
  testType: TestType;
  content: string;
  impactScore: number;
  impactLabel: ImpactLabel;
  attention: {
    full: number;
    partial: number;
    ignore: number;
  };
  variants: Variant[];
  insights: string[];
  conversationThemes: ConversationTheme[];
  createdAt: string;
  societyId: string;
}

/**
 * Status of the test creation flow
 */
export type TestStatus = 'idle' | 'selecting-type' | 'filling-form' | 'simulating' | 'viewing-results';
