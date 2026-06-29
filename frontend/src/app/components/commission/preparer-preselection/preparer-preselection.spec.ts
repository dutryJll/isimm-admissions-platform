import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreparerPreselection } from './preparer-preselection';

describe('PreparerPreselection', () => {
  let component: PreparerPreselection;
  let fixture: ComponentFixture<PreparerPreselection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreparerPreselection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreparerPreselection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
