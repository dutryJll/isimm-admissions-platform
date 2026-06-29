import { TestBed } from '@angular/core/testing';

import { Validation } from './validation';

describe('Validation', () => {
  let service: Validation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Validation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
