import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListeSelection } from './liste-selection';

describe('ListeSelection', () => {
  let component: ListeSelection;
  let fixture: ComponentFixture<ListeSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListeSelection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListeSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
