import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExaminerOcr } from './examiner-ocr';

describe('ExaminerOcr', () => {
  let component: ExaminerOcr;
  let fixture: ComponentFixture<ExaminerOcr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExaminerOcr]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExaminerOcr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
