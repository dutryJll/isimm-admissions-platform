import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardCommission } from './dashboard-commission';

describe('DashboardCommission', () => {
  let component: DashboardCommission;
  let fixture: ComponentFixture<DashboardCommission>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardCommission]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardCommission);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
