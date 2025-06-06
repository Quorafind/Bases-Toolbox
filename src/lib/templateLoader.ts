/**
 * Lazy loader for template examples to reduce initial bundle size
 */

let templatesCache: any = null;

export async function loadTemplates() {
  if (templatesCache) {
    return templatesCache;
  }
  
  try {
    const { baseTemplates } = await import('./templateExamples');
    templatesCache = baseTemplates;
    return baseTemplates;
  } catch (error) {
    console.error('Failed to load templates:', error);
    return {};
  }
}

export function getTemplateNames(): string[] {
  if (!templatesCache) {
    return [];
  }
  return Object.keys(templatesCache);
}

export function hasTemplatesLoaded(): boolean {
  return templatesCache !== null;
}
