import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
describe('App', () => {
  it('provides a browse link and accessible content target', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('nav a').textContent).toContain(
      'Thimphu HomeFinder',
    );
    expect(fixture.nativeElement.querySelector('main').id).toBe('main');
  });
});
