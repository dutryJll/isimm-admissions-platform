import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConcoursIngenieurComponent } from './concours-ingenieur.component';

describe('ConcoursIngenieurComponent', () => {
  let component: ConcoursIngenieurComponent;
  let fixture: ComponentFixture<ConcoursIngenieurComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConcoursIngenieurComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConcoursIngenieurComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
