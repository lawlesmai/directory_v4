import { performance } from 'perf_hooks';
import { supabase } from '../../lib/supabaseClient';

async function runLoadTest(concurrentUsers: number, iterations: number) {
  const testUsers = Array.from({ length: concurrentUsers }, (_, i) => ({
    email: `load_${Date.now()}_${i}@example.com`,
    password: 'LoadTestPassword123!'
  }));

  const performanceMetrics = {
    signUpTimes: [] as number[],
    signInTimes: [] as number[],
    tokenValidationTimes: [] as number[]
  };

  async function testUserFlow(user: { email: string; password: string }) {
    // Sign Up
    const signUpStart = performance.now();
    await supabase.auth.signUp({ email: user.email, password: user.password });
    const signUpDuration = performance.now() - signUpStart;
    performanceMetrics.signUpTimes.push(signUpDuration);

    // Sign In
    const signInStart = performance.now();
    await supabase.auth.signInWithPassword({ email: user.email, password: user.password });
    const signInDuration = performance.now() - signInStart;
    performanceMetrics.signInTimes.push(signInDuration);

    // Token Validation
    const tokenValidationStart = performance.now();
    await supabase.auth.getUser();
    const tokenValidationDuration = performance.now() - tokenValidationStart;
    performanceMetrics.tokenValidationTimes.push(tokenValidationDuration);
  }

  const loadTestPromises = Array.from({ length: iterations }, () => 
    Promise.all(testUsers.map(testUserFlow))
  );

  await Promise.all(loadTestPromises);

  return {
    averageSignUpTime: performanceMetrics.signUpTimes.reduce((a, b) => a + b, 0) / performanceMetrics.signUpTimes.length,
    averageSignInTime: performanceMetrics.signInTimes.reduce((a, b) => a + b, 0) / performanceMetrics.signInTimes.length,
    averageTokenValidationTime: performanceMetrics.tokenValidationTimes.reduce((a, b) => a + b, 0) / performanceMetrics.tokenValidationTimes.length
  };
}

describe('Authentication Load Testing', () => {
  it('should handle 50 concurrent users with acceptable performance', async () => {
    const result = await runLoadTest(50, 5);
    
    console.log('Load Test Results:', result);

    expect(result.averageSignUpTime).toBeLessThan(500);
    expect(result.averageSignInTime).toBeLessThan(200);
    expect(result.averageTokenValidationTime).toBeLessThan(50);
  }, 60000);  // Extended timeout for load test
});
