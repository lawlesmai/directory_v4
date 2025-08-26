import { jest } from '@jest/globals';

type SupabaseBaseResponse<T = any> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseQueryChain = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  lt: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  or: jest.Mock;
  and: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  range: jest.Mock;
  count: jest.Mock;
};

export const createSupabaseMock = () => {
  const mockQueryChain: SupabaseQueryChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    range: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis()
  };

  const supabase = {
    from: jest.fn(() => mockQueryChain)
  };

  return { 
    supabase, 
    mockQueryChain 
  };
};

export const mockSupabaseResponse = <T>(
  mockQueryChain: SupabaseQueryChain, 
  data: T | null = null, 
  error: { message: string } | null = null
) => {
  mockQueryChain.single.mockResolvedValue({ data, error });
  return { data, error };
};

export const createSupabaseErrorMock = (message: string = 'Unknown error') => 
  createSupabaseMock().mockQueryChain.single.mockResolvedValue({ 
    data: null, 
    error: { message } 
  });

export const createSupabaseDataMock = <T>(data: T) => 
  createSupabaseMock().mockQueryChain.single.mockResolvedValue({ 
    data, 
    error: null 
  });
