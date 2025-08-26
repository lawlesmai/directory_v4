export interface SearchFilters {
  categories?: string[];
  rating?: number;
  distance?: number;
  priceRange?: [number, number];
  businessHours?: string;
  amenities?: string[];
  specialties?: string[];
  language?: string[];
}

export interface SearchAnalytics {
  query: string;
  filters: SearchFilters;
  resultCount: number;
  responseTime: number;
  clickThroughRate: number;
  executedAt: Date;
}
