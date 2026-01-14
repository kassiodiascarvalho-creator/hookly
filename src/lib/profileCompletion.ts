// Profile completion calculation utility

export interface FreelancerProfileData {
  avatar_url?: string | null;
  full_name?: string | null;
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  country?: string | null;
  skills?: string[] | null;
  hourly_rate?: number | null;
}

export interface CompanyProfileData {
  logo_url?: string | null;
  company_name?: string | null;
  website?: string | null;
  company_size?: string | null;
  about?: string | null;
  industry?: string | null;
  location?: string | null;
  country?: string | null;
}

export interface CompletionItem {
  key: string;
  label: string;
  completed: boolean;
  weight: number;
  section?: string;
}

export interface ProfileCompletionResult {
  percent: number;
  items: CompletionItem[];
  missingItems: CompletionItem[];
  completedItems: CompletionItem[];
}

// Freelancer completion rules with weights (total = 100)
const FREELANCER_FIELDS: { key: keyof FreelancerProfileData; label: string; weight: number; section?: string }[] = [
  { key: 'avatar_url', label: 'profileCompletion.addPhoto', weight: 10, section: 'profile' },
  { key: 'full_name', label: 'profileCompletion.addFullName', weight: 10, section: 'profile' },
  { key: 'title', label: 'profileCompletion.addTitle', weight: 10, section: 'profile' },
  { key: 'bio', label: 'profileCompletion.addBio', weight: 15, section: 'profile' },
  { key: 'location', label: 'profileCompletion.addLocation', weight: 5, section: 'profile' },
  { key: 'country', label: 'profileCompletion.addCountry', weight: 5, section: 'profile' },
  { key: 'skills', label: 'profileCompletion.addSkills', weight: 15, section: 'profile' },
  { key: 'hourly_rate', label: 'profileCompletion.addHourlyRate', weight: 10, section: 'profile' },
];

// Company completion rules with weights (total = 100)
const COMPANY_FIELDS: { key: keyof CompanyProfileData; label: string; weight: number; section?: string }[] = [
  { key: 'logo_url', label: 'profileCompletion.addLogo', weight: 10, section: 'profile' },
  { key: 'company_name', label: 'profileCompletion.addCompanyName', weight: 15, section: 'profile' },
  { key: 'website', label: 'profileCompletion.addWebsite', weight: 10, section: 'profile' },
  { key: 'company_size', label: 'profileCompletion.addCompanySize', weight: 10, section: 'profile' },
  { key: 'about', label: 'profileCompletion.addAbout', weight: 15, section: 'profile' },
  { key: 'industry', label: 'profileCompletion.addIndustry', weight: 10, section: 'profile' },
  { key: 'location', label: 'profileCompletion.addLocation', weight: 10, section: 'profile' },
  { key: 'country', label: 'profileCompletion.addCountry', weight: 10, section: 'profile' },
];

function isFieldCompleted(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

export function computeFreelancerCompletion(
  profile: FreelancerProfileData,
  hasPortfolio: boolean = false,
  hasPayoutMethod: boolean = false
): ProfileCompletionResult {
  const items: CompletionItem[] = [];
  
  // Add base profile fields
  for (const field of FREELANCER_FIELDS) {
    items.push({
      key: field.key,
      label: field.label,
      completed: isFieldCompleted(profile[field.key]),
      weight: field.weight,
      section: field.section,
    });
  }
  
  // Add portfolio check (20% weight)
  items.push({
    key: 'portfolio',
    label: 'profileCompletion.addPortfolio',
    completed: hasPortfolio,
    weight: 10,
    section: 'portfolio',
  });
  
  // Add payout method check (10% weight)
  items.push({
    key: 'payout_method',
    label: 'profileCompletion.addPayoutMethod',
    completed: hasPayoutMethod,
    weight: 10,
    section: 'billing',
  });
  
  const completedItems = items.filter(item => item.completed);
  const missingItems = items.filter(item => !item.completed);
  const percent = Math.round(completedItems.reduce((sum, item) => sum + item.weight, 0));
  
  return { percent, items, missingItems, completedItems };
}

export function computeCompanyCompletion(
  profile: CompanyProfileData,
  hasPaymentMethod: boolean = false
): ProfileCompletionResult {
  const items: CompletionItem[] = [];
  
  // Add base profile fields
  for (const field of COMPANY_FIELDS) {
    items.push({
      key: field.key,
      label: field.label,
      completed: isFieldCompleted(profile[field.key]),
      weight: field.weight,
      section: field.section,
    });
  }
  
  // Add payment method check (10% weight)
  items.push({
    key: 'payment_method',
    label: 'profileCompletion.addPaymentMethod',
    completed: hasPaymentMethod,
    weight: 10,
    section: 'billing',
  });
  
  const completedItems = items.filter(item => item.completed);
  const missingItems = items.filter(item => !item.completed);
  const percent = Math.round(completedItems.reduce((sum, item) => sum + item.weight, 0));
  
  return { percent, items, missingItems, completedItems };
}

export function getCompletionStatus(percent: number): 'low' | 'medium' | 'high' | 'complete' {
  if (percent >= 100) return 'complete';
  if (percent >= 80) return 'high';
  if (percent >= 50) return 'medium';
  return 'low';
}

export function getCompletionColor(percent: number): string {
  if (percent >= 100) return 'text-green-600';
  if (percent >= 80) return 'text-yellow-600';
  if (percent >= 50) return 'text-orange-500';
  return 'text-red-500';
}

export function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-green-500';
  if (percent >= 80) return 'bg-yellow-500';
  if (percent >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}
