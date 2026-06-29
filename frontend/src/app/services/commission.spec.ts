import { TestBed } from '@angular/core/testing';

import { Commission } from './commission';

describe('Commission', () => {
  let service: Commission;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Commission);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
