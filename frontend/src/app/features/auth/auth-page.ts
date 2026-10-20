import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, safeReturnUrl } from '../../core/auth/auth.service';
import { Failure, failureFrom } from '../../core/api';
import { FormFeedback } from '../../shared/form-feedback';

export const passwordBytes: ValidatorFn = control => new TextEncoder().encode(control.value ?? '').length <= 72 ? null : { passwordBytes: true };
@Component({ selector: 'app-auth-page', imports: [ReactiveFormsModule, RouterLink, FormFeedback],
  styleUrl: './auth-page.css', template: `
  <section class="auth-panel card card-body"><p class="eyebrow">THIMPHU HOMEFINDER</p>
  <h1>{{ registering ? 'Create an account' : 'Welcome back' }}</h1>
  @if (created()) { <p role="status">Account created. Sign in to continue.</p> }
  @if (auth.unavailable()) { <p role="status">The account service is unavailable. You can try signing in again.</p> }
  <form [formGroup]="form" (ngSubmit)="submit()">
    <app-form-feedback [form]="form" [failure]="failure()" [labels]="labels" />
    @if (registering) { <label>Full name<input formControlName="name" autocomplete="name" maxlength="120" [attr.aria-invalid]="invalid('name')"></label> }
    <label>Email<input formControlName="email" type="email" autocomplete="email" maxlength="254" [attr.aria-invalid]="invalid('email')"></label>
    <label>Password<input formControlName="password" type="password" [autocomplete]="registering ? 'new-password' : 'current-password'" [attr.aria-invalid]="invalid('password')" aria-describedby="password-help"></label>
    <p id="password-help">{{ registering ? 'Use at least 12 characters and at most 72 UTF-8 bytes.' : 'Enter your account password.' }}</p>
    @if (registering) { <label>I am a<select formControlName="role"><option value="seeker">Home seeker</option><option value="landlord">Landlord</option></select></label> }
    <button type="submit" [disabled]="pending()">{{ pending() ? 'Please wait…' : registering ? 'Create account' : 'Sign in' }}</button>
  </form>
  <p>@if (registering) { Already registered? <a routerLink="/login">Sign in</a> } @else { New here? <a routerLink="/register">Create an account</a> }</p></section>
` })
export class AuthPage {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly registering = this.route.snapshot.data['register'] === true;
  readonly created = signal(this.route.snapshot.queryParamMap.get('registered') === 'true');
  readonly pending = signal(false);
  readonly failure = signal<Failure | null>(null);
  readonly labels = { name: 'Full name', email: 'Email', password: 'Password', role: 'Role' };
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', this.registering ? [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)] : []],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(this.registering ? 12 : 1), passwordBytes]],
    role: ['seeker' as 'seeker' | 'landlord', [Validators.pattern(/^(seeker|landlord)$/)]],
  });
  invalid(name: keyof typeof this.form.controls) { return this.form.controls[name].touched && this.form.controls[name].invalid; }
  submit() {
    if (this.pending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.pending.set(true); this.failure.set(null);
    const value = this.form.getRawValue();
    const action = this.registering ? this.auth.register(value) : this.auth.login(value.email, value.password);
    action.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => {
        this.form.controls.password.reset('');
        if (this.registering) void this.router.navigate(['/login'], { queryParams: { registered: true } });
        else void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) ?? this.auth.home());
      },
      error: error => {
        const failure = failureFrom(error);
        if (!this.registering && error.status === 401) failure.message = 'Invalid email or password.';
        if (this.registering && error.status === 409) failure.message = 'An account with this email already exists. Try signing in.';
        this.failure.set(failure);
        this.form.controls.password.reset('');
      },
    });
  }
}
