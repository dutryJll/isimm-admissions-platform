import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChoixCandidature } from './choix-candidature';

describe('ChoixCandidature', () => {
  let component: ChoixCandidature;
  let fixture: ComponentFixture<ChoixCandidature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChoixCandidature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChoixCandidature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
