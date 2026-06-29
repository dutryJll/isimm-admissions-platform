import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsulterDossier } from './consulter-dossier';

describe('ConsulterDossier', () => {
  let component: ConsulterDossier;
  let fixture: ComponentFixture<ConsulterDossier>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsulterDossier]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsulterDossier);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
