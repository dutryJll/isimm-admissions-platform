import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreparerSelection } from './preparer-selection';

describe('PreparerSelection', () => {
  let component: PreparerSelection;
  let fixture: ComponentFixture<PreparerSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreparerSelection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreparerSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
