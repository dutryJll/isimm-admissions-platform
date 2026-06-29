import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListeCandidatures } from './liste-candidatures';

describe('ListeCandidatures', () => {
  let component: ListeCandidatures;
  let fixture: ComponentFixture<ListeCandidatures>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListeCandidatures]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListeCandidatures);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
