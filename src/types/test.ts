/**
 * Test type definitions for content testing
 */

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
