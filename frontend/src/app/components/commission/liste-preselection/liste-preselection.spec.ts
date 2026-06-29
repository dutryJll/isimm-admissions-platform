import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListePreselection } from './liste-preselection';

describe('ListePreselection', () => {
  let component: ListePreselection;
  let fixture: ComponentFixture<ListePreselection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListePreselection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListePreselection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
