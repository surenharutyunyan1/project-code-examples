import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { fuseAnimations } from 'app/animations';
import { AuthService } from 'app/services/auth.service';
import { AppError, fromError } from 'utils/error-utils';

@Component({
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
    animations: fuseAnimations,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
    form: FormGroup;
    loading = false;
    error: AppError;
    constructor(
        private service: AuthService,
        private router: Router,
        private formBuilder: FormBuilder,
        private cdRef: ChangeDetectorRef
    ) {
        this.form = this.formBuilder.group({
            email: [null, [Validators.required, Validators.email]],
            psw: [null, Validators.required]
        });
    }

    get emailCtrl() {
        return this.form.get('email') as FormControl;
    }

    async onLoginClick() {
        this.loading = true;
        delete this.error;
        this.cdRef.markForCheck();
        const { email, psw } = this.form.getRawValue();
        try {
            await this.service.login(email, psw);
            this.router.navigate(['']);
        } catch (error) {
            this.error = fromError(error, 'error.unknown');
        }
        finally {
            this.loading = false;
            this.cdRef.markForCheck();
        }
    }
}
