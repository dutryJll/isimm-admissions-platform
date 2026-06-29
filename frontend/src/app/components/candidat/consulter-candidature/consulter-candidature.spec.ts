import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsulterCandidature } from './consulter-candidature';

describe('ConsulterCandidature', () => {
  let component: ConsulterCandidature;
  let fixture: ComponentFixture<ConsulterCandidature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsulterCandidature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsulterCandidature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
