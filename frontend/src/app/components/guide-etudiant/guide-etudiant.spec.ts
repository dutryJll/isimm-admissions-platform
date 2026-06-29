import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuideEtudiant } from './guide-etudiant';

describe('GuideEtudiant', () => {
  let component: GuideEtudiant;
  let fixture: ComponentFixture<GuideEtudiant>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideEtudiant]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuideEtudiant);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
