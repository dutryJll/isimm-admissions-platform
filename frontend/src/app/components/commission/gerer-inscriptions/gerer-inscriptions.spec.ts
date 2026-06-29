import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GererInscriptions } from './gerer-inscriptions';

describe('GererInscriptions', () => {
  let component: GererInscriptions;
  let fixture: ComponentFixture<GererInscriptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GererInscriptions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GererInscriptions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
