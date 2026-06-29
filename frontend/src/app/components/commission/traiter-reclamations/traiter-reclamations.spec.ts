import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TraiterReclamationsComponent } from './traiter-reclamations';

describe('TraiterReclamations', () => {
  let component: TraiterReclamationsComponent;
  let fixture: ComponentFixture<TraiterReclamationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TraiterReclamationsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TraiterReclamationsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
