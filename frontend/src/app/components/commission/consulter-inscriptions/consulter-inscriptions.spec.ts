import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsulterInscriptions } from './consulter-inscriptions';

describe('ConsulterInscriptions', () => {
  let component: ConsulterInscriptions;
  let fixture: ComponentFixture<ConsulterInscriptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsulterInscriptions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsulterInscriptions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
