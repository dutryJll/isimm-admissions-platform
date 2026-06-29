import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeposerDocuments } from './deposer-documents';

describe('DeposerDocuments', () => {
  let component: DeposerDocuments;
  let fixture: ComponentFixture<DeposerDocuments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeposerDocuments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeposerDocuments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
