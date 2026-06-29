import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsulterConcours } from './consulter-concours';

describe('ConsulterConcours', () => {
  let component: ConsulterConcours;
  let fixture: ComponentFixture<ConsulterConcours>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsulterConcours]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsulterConcours);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
