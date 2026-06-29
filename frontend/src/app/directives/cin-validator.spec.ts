import { CinValidator } from './cin-validator';

describe('CinValidator', () => {
  it('should create an instance', () => {
    const directive = new CinValidator();
    expect(directive).toBeTruthy();
  });
});
