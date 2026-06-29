import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardCandidat } from './dashboard-candidat';

describe('DashboardCandidat', () => {
  let component: DashboardCandidat;
  let fixture: ComponentFixture<DashboardCandidat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardCandidat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardCandidat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
