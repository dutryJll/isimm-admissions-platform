import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { DashboardAdminComponent } from './dashboard-admin';
import { AuthService } from '../../../services/auth.service';

describe('DashboardAdminComponent', () => {
  let component: DashboardAdminComponent;
  let fixture: ComponentFixture<DashboardAdminComponent>;

  const authServiceStub = {
    getCurrentUser: () => ({
      first_name: 'Admin',
      last_name: 'ISIMM',
      email: 'admin@isimm.tn',
    }),
    getAccessToken: () => 'fake-token',
    logout: () => undefined,
  };

  const routerStub = {
    navigate: (_commands: unknown[]) => Promise.resolve(true),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardAdminComponent],
      providers: [
        provideHttpClient(),
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
