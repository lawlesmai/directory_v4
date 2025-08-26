import { faker } from '@faker-js/faker';

export const generateTestUser = () => ({
  email: faker.internet.email(),
  password: faker.internet.password({
    length: 12,
    prefix: 'Test1!'
  }),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  businessName: faker.company.name(),
  taxId: faker.finance.accountNumber()
});
