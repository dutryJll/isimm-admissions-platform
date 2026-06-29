import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModifierCandidature } from './modifier-candidature';

describe('ModifierCandidature', () => {
  let component: ModifierCandidature;
  let fixture: ComponentFixture<ModifierCandidature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModifierCandidature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModifierCandidature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
